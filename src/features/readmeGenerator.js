import ora from 'ora';
import chalk from 'chalk';
import { getRepoInfo, getRepoTree, getMultipleFiles } from '../github/repo.js';
import { streamChat, streamChatChunked } from '../ai/fireworks.js';
import { getReadmeSystemPrompt, getReadmeUserPrompt, buildReadmeChunkedPrompt } from '../ai/prompts.js';
import { displayResult } from '../ui/results.js';
import { chunkFileContents, groupChunksIntoBatches, needsChunking } from '../utils/chunker.js';
import logger from '../utils/logger.js';

// Bagimliliklari ve proje yapisini anlamak icin okunmasi gereken dosyalar.
// Bunlar reponun turune gore degisir ama en yaygin olanlari listeliyoruz.
const IMPORTANT_FILES = [
  'package.json',
  'requirements.txt',
  'Pipfile',
  'go.mod',
  'Cargo.toml',
  'pom.xml',
  'build.gradle',
  'Gemfile',
  'composer.json',
  'Makefile',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  '.env.example',
  'tsconfig.json',
  'vite.config.js',
  'vite.config.ts',
  'next.config.js',
  'next.config.mjs',
  'webpack.config.js',
  'README.md',
];

// README olusturma surecini yonetir.
// Oncelikle repo verilerini toplar, sonra AI'ya gondererek README urettir.
// Icerik cok buyukse parcalara boler ve her parcayi sirayla analiz eder.
async function generateReadme(owner, repo) {
  const spinner = ora({
    text: chalk.dim('Repo bilgileri aliniyor...'),
    color: 'magenta',
  }).start();

  try {
    // Repo hakkindaki temel bilgileri cekiyoruz
    const repoInfo = await getRepoInfo(owner, repo);
    spinner.text = chalk.dim('Dosya yapisi taraniyor...');

    // Tum dosya agacini aliyoruz
    const tree = await getRepoTree(owner, repo, repoInfo.defaultBranch);
    spinner.text = chalk.dim('Dosya icerikleri okunuyor...');

    // Agactaki dosyalardan onemli olanlari belirliyoruz
    const existingFiles = tree
      .filter((item) => item.type === 'blob')
      .map((item) => item.path);

    const filesToFetch = IMPORTANT_FILES.filter((f) =>
      existingFiles.includes(f)
    );

    // Onemli dosyalarin iceriklerini paralel olarak cekiyoruz
    const fileContents = await getMultipleFiles(owner, repo, filesToFetch, repoInfo.defaultBranch);

    spinner.stop();

    logger.info(`Repo: ${chalk.bold(repoInfo.fullName)}`);
    logger.info(`Dil: ${chalk.bold(repoInfo.language)} | Dosya sayisi: ${chalk.bold(existingFiles.length)}`);
    logger.spacer();

    let result;

    // Icerik buyuklugune gore tek seferde mi yoksa parcali mi gonderecekmize karar veriyoruz
    if (needsChunking(fileContents)) {
      const totalSize = fileContents.reduce((sum, f) => sum + f.content.length, 0);
      logger.info(`Toplam icerik: ${chalk.bold(Math.round(totalSize / 1024) + ' KB')} — parcali analiz yapilacak`);
      logger.spacer();

      const chunks = chunkFileContents(fileContents);
      const batches = groupChunksIntoBatches(chunks);

      logger.info(`${chalk.bold(batches.length)} parca halinde AI'ya gonderiliyor...`);

      result = await streamChatChunked(
        getReadmeSystemPrompt(),
        batches,
        buildReadmeChunkedPrompt(repoInfo, tree)
      );
    } else {
      logger.info('AI README olusturuyor...');
      logger.spacer();

      const messages = [
        { role: 'system', content: getReadmeSystemPrompt() },
        { role: 'user', content: getReadmeUserPrompt(repoInfo, tree, fileContents) },
      ];

      result = await streamChat(messages);
    }

    // Sonucu goster ve kaydetme secenegi sun
    await displayResult(result, 'readme');

    return true;
  } catch (err) {
    spinner.stop();
    logger.error(err.message);
    return false;
  }
}

export { generateReadme };
