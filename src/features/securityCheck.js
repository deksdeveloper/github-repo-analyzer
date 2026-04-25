import ora from 'ora';
import chalk from 'chalk';
import { getRepoInfo, getRepoTree, getMultipleFiles } from '../github/repo.js';
import { streamChat, streamChatChunked } from '../ai/fireworks.js';
import { getSecuritySystemPrompt, getSecurityUserPrompt, buildSecurityChunkedPrompt } from '../ai/prompts.js';
import { displayResult } from '../ui/results.js';
import { chunkFileContents, groupChunksIntoBatches, needsChunking } from '../utils/chunker.js';
import logger from '../utils/logger.js';

// Guvenlik analizi icin incelenmesi gereken dosyalar.
// Bunlar hassas veri, yapilandirma ve bagimliliklari iceren dosyalar.
const SECURITY_FILES = [
  'package.json',
  'package-lock.json',
  'requirements.txt',
  'Pipfile',
  'go.mod',
  'Cargo.toml',
  'pom.xml',
  'build.gradle',
  'Gemfile',
  'composer.json',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  '.env.example',
  '.env.sample',
  '.env.template',
  '.github/workflows/ci.yml',
  '.github/workflows/ci.yaml',
  '.github/workflows/main.yml',
  '.github/workflows/build.yml',
  '.github/workflows/deploy.yml',
  '.github/dependabot.yml',
  'nginx.conf',
  'server.js',
  'app.js',
  'index.js',
  'src/index.js',
  'src/app.js',
  'src/server.js',
  'src/main.js',
  'config.js',
  'config.ts',
  'src/config.js',
  'src/config.ts',
  '.eslintrc.json',
  '.eslintrc.js',
  'security.txt',
  '.npmrc',
  'cors.js',
  'auth.js',
  'src/auth.js',
  'middleware/auth.js',
];

// Guvenlik taramasi surecini yonetir.
// Repo'daki hassas dosyalari okuyup AI'ya kapsamli bir analiz yaptir.
// Buyuk repolarda icerik parcalara bolunup sirayla islenir.
async function runSecurityCheck(owner, repo) {
  const spinner = ora({
    text: chalk.dim('Repo bilgileri aliniyor...'),
    color: 'red',
  }).start();

  try {
    const repoInfo = await getRepoInfo(owner, repo);
    spinner.text = chalk.dim('Dosya yapisi taraniyor...');

    const tree = await getRepoTree(owner, repo, repoInfo.defaultBranch);
    spinner.text = chalk.dim('Guvenlikle ilgili dosyalar okunuyor...');

    // Agactaki dosyalardan guvenlik analizi icin gerekli olanlari seciyoruz
    const existingFiles = tree
      .filter((item) => item.type === 'blob')
      .map((item) => item.path);

    // Workflow dizinindeki tum yaml dosyalarini da taramaya dahil ediyoruz
    const workflowFiles = existingFiles.filter((f) =>
      f.startsWith('.github/workflows/') && (f.endsWith('.yml') || f.endsWith('.yaml'))
    );

    const filesToFetch = [
      ...new Set([
        ...SECURITY_FILES.filter((f) => existingFiles.includes(f)),
        ...workflowFiles,
      ]),
    ];

    const fileContents = await getMultipleFiles(owner, repo, filesToFetch, repoInfo.defaultBranch);

    spinner.stop();

    logger.info(`Repo: ${chalk.bold(repoInfo.fullName)}`);
    logger.info(`Dil: ${chalk.bold(repoInfo.language)} | Dosya sayisi: ${chalk.bold(existingFiles.length)}`);
    logger.info(`Taranan dosya sayisi: ${chalk.bold(fileContents.length)}`);
    logger.spacer();

    let result;

    if (needsChunking(fileContents)) {
      const totalSize = fileContents.reduce((sum, f) => sum + f.content.length, 0);
      logger.info(`Toplam icerik: ${chalk.bold(Math.round(totalSize / 1024) + ' KB')} — parcali analiz yapilacak`);
      logger.spacer();

      const chunks = chunkFileContents(fileContents);
      const batches = groupChunksIntoBatches(chunks);

      logger.info(`${chalk.bold(batches.length)} parca halinde AI guvenlik analizi yapiyor...`);

      result = await streamChatChunked(
        getSecuritySystemPrompt(),
        batches,
        buildSecurityChunkedPrompt(repoInfo, tree)
      );
    } else {
      logger.info('AI guvenlik analizi yapiyor...');
      logger.spacer();

      const messages = [
        { role: 'system', content: getSecuritySystemPrompt() },
        { role: 'user', content: getSecurityUserPrompt(repoInfo, tree, fileContents) },
      ];

      result = await streamChat(messages);
    }

    await displayResult(result, 'security');

    return true;
  } catch (err) {
    spinner.stop();
    logger.error(err.message);
    return false;
  }
}

export { runSecurityCheck };
