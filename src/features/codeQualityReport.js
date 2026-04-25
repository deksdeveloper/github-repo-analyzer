import ora from 'ora';
import chalk from 'chalk';
import { getRepoInfo, getRepoTree, getMultipleFiles } from '../github/repo.js';
import { streamChat, streamChatChunked } from '../ai/fireworks.js';
import { getCodeQualitySystemPrompt, getCodeQualityUserPrompt, buildCodeQualityChunkedPrompt } from '../ai/prompts.js';
import { displayResult } from '../ui/results.js';
import { chunkFileContents, groupChunksIntoBatches, needsChunking } from '../utils/chunker.js';
import logger from '../utils/logger.js';

// Kod kalitesi analizi icin incelenmesi gereken kaynak dosya uzantilari.
// Bunlar projenin ana dilindeki dosyalari kapsar.
const CODE_EXTENSIONS = [
  '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt',
  '.php', '.cs', '.cpp', '.c', '.h', '.hpp',
  '.swift', '.dart', '.lua', '.ex', '.exs',
  '.vue', '.svelte',
];

// Config ve yapilandirma dosyalari da kalite analizinde onemli
const CONFIG_FILES = [
  'package.json',
  'tsconfig.json',
  '.eslintrc.json',
  '.eslintrc.js',
  '.prettierrc',
  '.prettierrc.json',
  'jest.config.js',
  'jest.config.ts',
  'vitest.config.js',
  'vitest.config.ts',
  '.editorconfig',
  'pyproject.toml',
  'setup.cfg',
  'tox.ini',
  '.flake8',
  'Makefile',
];

// Dosya agacindan analiz edilecek kaynak dosyalarini secer.
// Cok buyuk repolarda dosya sayisini sinirlandiriyoruz
// ama mumkun oldugunca cesitli bir ornek almaya calisiyoruz.
function selectSourceFiles(tree, maxFiles = 30) {
  const blobs = tree.filter((item) => item.type === 'blob');

  // Kaynak kod dosyalarini uzantiya gore filtreliyoruz
  const sourceFiles = blobs.filter((item) => {
    const ext = '.' + item.path.split('.').pop();
    return CODE_EXTENSIONS.includes(ext);
  });

  // Test ve vendor dosyalarini ayikliyoruz, asil kodu gormek istiyoruz
  const mainFiles = sourceFiles.filter((item) => {
    const lower = item.path.toLowerCase();
    return (
      !lower.includes('node_modules/') &&
      !lower.includes('vendor/') &&
      !lower.includes('dist/') &&
      !lower.includes('build/') &&
      !lower.includes('.min.') &&
      !lower.includes('__pycache__/')
    );
  });

  // Test dosyalarini ayri tutuyoruz, birlikte gondererek test coverage hakkinda da yorum yapmasini sagliyoruz
  const testFiles = mainFiles.filter((item) => {
    const lower = item.path.toLowerCase();
    return lower.includes('test') || lower.includes('spec') || lower.includes('__tests__');
  });

  const nonTestFiles = mainFiles.filter((item) => {
    const lower = item.path.toLowerCase();
    return !lower.includes('test') && !lower.includes('spec') && !lower.includes('__tests__');
  });

  // Cesitlilik icin farkli dizinlerden dosya secmeye calisiyoruz
  const selected = [];
  const seenDirs = new Set();

  // Once cesitli dizinlerden birer dosya aliyoruz
  for (const file of nonTestFiles) {
    if (selected.length >= maxFiles - 5) break;
    const dir = file.path.split('/').slice(0, -1).join('/') || '/';
    if (!seenDirs.has(dir)) {
      seenDirs.add(dir);
      selected.push(file.path);
    }
  }

  // Hala yer varsa kalan dosyalardan ekliyoruz
  for (const file of nonTestFiles) {
    if (selected.length >= maxFiles - 5) break;
    if (!selected.includes(file.path)) {
      selected.push(file.path);
    }
  }

  // Birkaç test dosyasi da ekliyoruz
  for (const file of testFiles.slice(0, 5)) {
    selected.push(file.path);
  }

  return selected;
}

// Kod kalitesi raporu olusturma surecini yonetir.
// Kaynak dosyalari okuyup AI'ya kapsamli bir kalite analizi yaptir.
async function runCodeQualityReport(owner, repo) {
  const spinner = ora({
    text: chalk.dim('Repo bilgileri aliniyor...'),
    color: 'cyan',
  }).start();

  try {
    const repoInfo = await getRepoInfo(owner, repo);
    spinner.text = chalk.dim('Dosya yapisi taraniyor...');

    const tree = await getRepoTree(owner, repo, repoInfo.defaultBranch);
    spinner.text = chalk.dim('Kaynak dosyalar seciliyor...');

    const existingFiles = tree
      .filter((item) => item.type === 'blob')
      .map((item) => item.path);

    // Config dosyalari ve secilen kaynak dosyalari birlestiriyoruz
    const configToFetch = CONFIG_FILES.filter((f) => existingFiles.includes(f));
    const sourceToFetch = selectSourceFiles(tree);
    const filesToFetch = [...new Set([...configToFetch, ...sourceToFetch])];

    spinner.text = chalk.dim(`${filesToFetch.length} dosya okunuyor...`);
    const fileContents = await getMultipleFiles(owner, repo, filesToFetch, repoInfo.defaultBranch);

    spinner.stop();

    logger.info(`Repo: ${chalk.bold(repoInfo.fullName)}`);
    logger.info(`Dil: ${chalk.bold(repoInfo.language)} | Dosya sayisi: ${chalk.bold(existingFiles.length)}`);
    logger.info(`Analiz edilecek dosya: ${chalk.bold(fileContents.length)}`);
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
        getCodeQualitySystemPrompt(),
        batches,
        buildCodeQualityChunkedPrompt(repoInfo, tree)
      );
    } else {
      logger.info('AI kod kalitesi analizi yapiyor...');
      logger.spacer();

      const messages = [
        { role: 'system', content: getCodeQualitySystemPrompt() },
        { role: 'user', content: getCodeQualityUserPrompt(repoInfo, tree, fileContents) },
      ];

      result = await streamChat(messages);
    }

    await displayResult(result, 'quality');

    return true;
  } catch (err) {
    spinner.stop();
    logger.error(err.message);
    return false;
  }
}

export { runCodeQualityReport };
