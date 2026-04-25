import ora from 'ora';
import chalk from 'chalk';
import { getRepoInfo, getRepoTree, getMultipleFiles } from '../github/repo.js';
import { streamChat, streamChatChunked } from '../ai/fireworks.js';
import { getGitignoreSystemPrompt, getGitignoreUserPrompt, buildGitignoreChunkedPrompt } from '../ai/prompts.js';
import { displayResult } from '../ui/results.js';
import { chunkFileContents, groupChunksIntoBatches, needsChunking } from '../utils/chunker.js';
import logger from '../utils/logger.js';

// Proje tipini anlamak icin bakmamiz gereken dosyalar.
// Bunlarin varligina gore AI dogru gitignore kurallari olusturabilir.
const DEPENDENCY_FILES = [
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'requirements.txt',
  'Pipfile',
  'pyproject.toml',
  'go.mod',
  'go.sum',
  'Cargo.toml',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'Gemfile',
  'composer.json',
  'Makefile',
  'CMakeLists.txt',
  'tsconfig.json',
  'next.config.js',
  'next.config.mjs',
  'nuxt.config.js',
  'angular.json',
  'vue.config.js',
  'vite.config.js',
  'vite.config.ts',
  'Dockerfile',
  'docker-compose.yml',
  '.gitignore', // Mevcut gitignore varsa karsilastirma icin faydali olur
];

// Gitignore olusturma surecini yonetir.
// Proje yapisini analiz edip AI'ya uygun bir gitignore urettir.
// Buyuk projelerde parcali analiz yapar.
async function generateGitignore(owner, repo) {
  const spinner = ora({
    text: chalk.dim('Repo bilgileri aliniyor...'),
    color: 'yellow',
  }).start();

  try {
    const repoInfo = await getRepoInfo(owner, repo);
    spinner.text = chalk.dim('Proje yapisi analiz ediliyor...');

    const tree = await getRepoTree(owner, repo, repoInfo.defaultBranch);

    // Mevcut dosyalardan hangilerinin bagimlillik dosyasi oldugunu belirliyoruz
    const existingFiles = tree
      .filter((item) => item.type === 'blob')
      .map((item) => item.path);

    const filesToFetch = DEPENDENCY_FILES.filter((f) =>
      existingFiles.includes(f)
    );

    const fileContents = await getMultipleFiles(owner, repo, filesToFetch, repoInfo.defaultBranch);

    spinner.stop();

    logger.info(`Repo: ${chalk.bold(repoInfo.fullName)}`);
    logger.info(`Dil: ${chalk.bold(repoInfo.language)}`);
    logger.spacer();

    let result;

    if (needsChunking(fileContents)) {
      const totalSize = fileContents.reduce((sum, f) => sum + f.content.length, 0);
      logger.info(`Toplam icerik: ${chalk.bold(Math.round(totalSize / 1024) + ' KB')} — parcali analiz yapilacak`);
      logger.spacer();

      const chunks = chunkFileContents(fileContents);
      const batches = groupChunksIntoBatches(chunks);

      logger.info(`${chalk.bold(batches.length)} parca halinde AI'ya gonderiliyor...`);

      result = await streamChatChunked(
        getGitignoreSystemPrompt(),
        batches,
        buildGitignoreChunkedPrompt(repoInfo, tree)
      );
    } else {
      logger.info('AI .gitignore olusturuyor...');
      logger.spacer();

      const messages = [
        { role: 'system', content: getGitignoreSystemPrompt() },
        { role: 'user', content: getGitignoreUserPrompt(repoInfo, tree, fileContents) },
      ];

      result = await streamChat(messages);
    }

    await displayResult(result, 'gitignore');

    return true;
  } catch (err) {
    spinner.stop();
    logger.error(err.message);
    return false;
  }
}

export { generateGitignore };
