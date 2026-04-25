import ora from 'ora';
import chalk from 'chalk';
import { getRepoInfo, getRepoTree, getMultipleFiles } from '../github/repo.js';
import { streamChat, streamChatChunked } from '../ai/fireworks.js';
import { getApiDocsSystemPrompt, getApiDocsUserPrompt, buildApiDocsChunkedPrompt } from '../ai/prompts.js';
import { displayResult } from '../ui/results.js';
import { chunkFileContents, groupChunksIntoBatches, needsChunking } from '../utils/chunker.js';
import logger from '../utils/logger.js';

// API endpoint'lerini icerme olasiligi yuksek olan dosya desenleri.
// Farkli framework'ler farkli dosya yapilandirmalari kullaniyor.
const API_FILE_PATTERNS = [
  // Express / Fastify / Koa / Hono (Node.js)
  /routes?\//i,
  /controllers?\//i,
  /api\//i,
  /endpoints?\//i,
  /middleware\//i,
  /server\.(js|ts|mjs)$/i,
  /app\.(js|ts|mjs)$/i,
  /index\.(js|ts|mjs)$/i,
  // Python (Flask / Django / FastAPI)
  /views?\.(py)$/i,
  /urls?\.(py)$/i,
  /routes?\.(py)$/i,
  /app\.(py)$/i,
  /main\.(py)$/i,
  /api\.(py)$/i,
  // Go
  /handler/i,
  /router/i,
  /main\.go$/i,
  // Ruby (Rails)
  /controllers?\//i,
  // PHP (Laravel)
  /routes\//i,
  /Controllers?\//i,
  // Java / Kotlin (Spring)
  /Controller\.(java|kt)$/i,
  /RestController/i,
  /Resource\.(java|kt)$/i,
];

// Config ve yapilandirma dosyalari, framework tespiti icin
const API_CONFIG_FILES = [
  'package.json',
  'requirements.txt',
  'Pipfile',
  'go.mod',
  'Cargo.toml',
  'pom.xml',
  'build.gradle',
  'Gemfile',
  'composer.json',
  'openapi.json',
  'openapi.yaml',
  'openapi.yml',
  'swagger.json',
  'swagger.yaml',
  'swagger.yml',
];

// Dosya agacindan API endpoint icerme olasiligi yuksek dosyalari secer.
// Regex pattern'larla eslesenleri ve config dosyalarini toplar.
function selectApiFiles(tree, maxFiles = 40) {
  const blobs = tree
    .filter((item) => item.type === 'blob')
    .map((item) => item.path);

  // Vendor ve build dizinlerini disarida birakiyoruz
  const filtered = blobs.filter((path) => {
    const lower = path.toLowerCase();
    return (
      !lower.includes('node_modules/') &&
      !lower.includes('vendor/') &&
      !lower.includes('dist/') &&
      !lower.includes('build/') &&
      !lower.includes('.min.') &&
      !lower.includes('__pycache__/')
    );
  });

  const matched = new Set();

  // Pattern'larla eslesen dosyalari topluyoruz
  for (const path of filtered) {
    if (matched.size >= maxFiles) break;
    for (const pattern of API_FILE_PATTERNS) {
      if (pattern.test(path)) {
        matched.add(path);
        break;
      }
    }
  }

  // Eger hicbir pattern eslesmediyse, proje root'undaki ana dosyalara bakalim.
  // Kucuk projelerde tum API tek bir dosyada olabiliyor.
  if (matched.size === 0) {
    const rootCandidates = ['server.js', 'server.ts', 'app.js', 'app.ts',
      'index.js', 'index.ts', 'main.js', 'main.ts', 'main.go', 'app.py',
      'main.py', 'src/index.js', 'src/index.ts', 'src/app.js', 'src/app.ts',
      'src/main.js', 'src/main.ts', 'src/server.js', 'src/server.ts'];

    for (const candidate of rootCandidates) {
      if (filtered.includes(candidate)) {
        matched.add(candidate);
      }
    }
  }

  return Array.from(matched);
}

// API dokumantasyonu olusturma surecini yonetir.
// API endpoint'i iceren dosyalari bulup AI'ya analiz ettirir.
async function generateApiDocs(owner, repo) {
  const spinner = ora({
    text: chalk.dim('Repo bilgileri aliniyor...'),
    color: 'green',
  }).start();

  try {
    const repoInfo = await getRepoInfo(owner, repo);
    spinner.text = chalk.dim('API dosyalari araniyor...');

    const tree = await getRepoTree(owner, repo, repoInfo.defaultBranch);

    const existingFiles = tree
      .filter((item) => item.type === 'blob')
      .map((item) => item.path);

    // Mevcut OpenAPI/Swagger dosyasi varsa onu da dahil ediyoruz
    const configToFetch = API_CONFIG_FILES.filter((f) => existingFiles.includes(f));
    const apiFiles = selectApiFiles(tree);
    const filesToFetch = [...new Set([...configToFetch, ...apiFiles])];

    if (apiFiles.length === 0) {
      spinner.stop();
      logger.warning('Bu repoda API endpoint dosyasi bulunamadi.');
      logger.dim('Proje bir API icermiyor olabilir veya dosya yapisi tanimlanamadi.');
      return false;
    }

    spinner.text = chalk.dim(`${filesToFetch.length} dosya okunuyor...`);
    const fileContents = await getMultipleFiles(owner, repo, filesToFetch, repoInfo.defaultBranch);

    spinner.stop();

    logger.info(`Repo: ${chalk.bold(repoInfo.fullName)}`);
    logger.info(`Dil: ${chalk.bold(repoInfo.language)}`);
    logger.info(`API dosya adayi: ${chalk.bold(apiFiles.length)} | Toplam okunacak: ${chalk.bold(fileContents.length)}`);
    logger.spacer();

    let result;

    if (needsChunking(fileContents)) {
      const totalSize = fileContents.reduce((sum, f) => sum + f.content.length, 0);
      logger.info(`Toplam icerik: ${chalk.bold(Math.round(totalSize / 1024) + ' KB')} — parcali analiz yapilacak`);
      logger.spacer();

      const chunks = chunkFileContents(fileContents);
      const batches = groupChunksIntoBatches(chunks);

      logger.info(`${chalk.bold(batches.length)} parca halinde AI dokumantasyon olusturuyor...`);

      result = await streamChatChunked(
        getApiDocsSystemPrompt(),
        batches,
        buildApiDocsChunkedPrompt(repoInfo, tree)
      );
    } else {
      logger.info('AI API dokumantasyonu olusturuyor...');
      logger.spacer();

      const messages = [
        { role: 'system', content: getApiDocsSystemPrompt() },
        { role: 'user', content: getApiDocsUserPrompt(repoInfo, tree, fileContents) },
      ];

      result = await streamChat(messages);
    }

    await displayResult(result, 'apidocs');

    return true;
  } catch (err) {
    spinner.stop();
    logger.error(err.message);
    return false;
  }
}

export { generateApiDocs };
