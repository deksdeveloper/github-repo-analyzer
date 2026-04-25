import ora from 'ora';
import chalk from 'chalk';
import { getRepoInfo, getRepoTree, getMultipleFiles } from '../github/repo.js';
import { streamChat, streamChatChunked } from '../ai/fireworks.js';
import { getDependencyHealthSystemPrompt, getDependencyHealthUserPrompt, buildDependencyHealthChunkedPrompt } from '../ai/prompts.js';
import { displayResult } from '../ui/results.js';
import { chunkFileContents, groupChunksIntoBatches, needsChunking } from '../utils/chunker.js';
import logger from '../utils/logger.js';

// Bagimlillik analizi icin incelenmesi gereken dosyalar.
// Her dilin ve paket yoneticisinin manifest ve lock dosyalari.
const DEPENDENCY_FILES = [
  // Node.js / JavaScript
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  // Python
  'requirements.txt',
  'Pipfile',
  'Pipfile.lock',
  'pyproject.toml',
  'setup.py',
  'setup.cfg',
  'poetry.lock',
  // Go
  'go.mod',
  'go.sum',
  // Rust
  'Cargo.toml',
  'Cargo.lock',
  // Java / Kotlin
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'gradle.properties',
  // Ruby
  'Gemfile',
  'Gemfile.lock',
  // PHP
  'composer.json',
  'composer.lock',
  // .NET
  'packages.config',
  // Genel
  '.tool-versions',
  '.nvmrc',
  '.node-version',
  '.python-version',
  'Dockerfile',
];

// Bagimlillik saglik kontrolu surecini yonetir.
// Manifest ve lock dosyalarini okuyup AI'ya analiz ettirir.
async function runDependencyHealthCheck(owner, repo) {
  const spinner = ora({
    text: chalk.dim('Repo bilgileri aliniyor...'),
    color: 'blue',
  }).start();

  try {
    const repoInfo = await getRepoInfo(owner, repo);
    spinner.text = chalk.dim('Bagimlillik dosyalari araniyor...');

    const tree = await getRepoTree(owner, repo, repoInfo.defaultBranch);

    const existingFiles = tree
      .filter((item) => item.type === 'blob')
      .map((item) => item.path);

    // Hem bilinen dosya adlarini hem de alt dizinlerdeki manifest dosyalarini ariyoruz.
    // Monorepo'larda alt paketlerin package.json'lari da onemli.
    const monorepoPkgs = existingFiles.filter((f) =>
      (f.endsWith('/package.json') || f.endsWith('/requirements.txt') || f.endsWith('/go.mod') || f.endsWith('/Cargo.toml'))
      && f.split('/').length <= 3 // cok derin dizinleri atliyoruz
    );

    const filesToFetch = [
      ...new Set([
        ...DEPENDENCY_FILES.filter((f) => existingFiles.includes(f)),
        ...monorepoPkgs,
      ]),
    ];

    if (filesToFetch.length === 0) {
      spinner.stop();
      logger.warning('Bu repoda bagimlillik dosyasi bulunamadi.');
      return false;
    }

    spinner.text = chalk.dim(`${filesToFetch.length} bagimlillik dosyasi okunuyor...`);
    const fileContents = await getMultipleFiles(owner, repo, filesToFetch, repoInfo.defaultBranch);

    spinner.stop();

    logger.info(`Repo: ${chalk.bold(repoInfo.fullName)}`);
    logger.info(`Dil: ${chalk.bold(repoInfo.language)}`);
    logger.info(`Bulunan bagimlillik dosyasi: ${chalk.bold(fileContents.length)}`);
    logger.spacer();

    let result;

    if (needsChunking(fileContents)) {
      const totalSize = fileContents.reduce((sum, f) => sum + f.content.length, 0);
      logger.info(`Toplam icerik: ${chalk.bold(Math.round(totalSize / 1024) + ' KB')} — parcali analiz yapilacak`);
      logger.spacer();

      const chunks = chunkFileContents(fileContents);
      const batches = groupChunksIntoBatches(chunks);

      logger.info(`${chalk.bold(batches.length)} parca halinde AI analiz yapiyor...`);

      result = await streamChatChunked(
        getDependencyHealthSystemPrompt(),
        batches,
        buildDependencyHealthChunkedPrompt(repoInfo, tree)
      );
    } else {
      logger.info('AI bagimlillik analizi yapiyor...');
      logger.spacer();

      const messages = [
        { role: 'system', content: getDependencyHealthSystemPrompt() },
        { role: 'user', content: getDependencyHealthUserPrompt(repoInfo, tree, fileContents) },
      ];

      result = await streamChat(messages);
    }

    await displayResult(result, 'dependency');

    return true;
  } catch (err) {
    spinner.stop();
    logger.error(err.message);
    return false;
  }
}

export { runDependencyHealthCheck };
