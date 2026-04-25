import chalk from 'chalk';
import { showBanner } from './ui/banner.js';
import { showMainMenu } from './ui/menu.js';
import { getRepoInput } from './ui/repoInput.js';
import { validateConfig } from './config.js';
import { generateReadme } from './features/readmeGenerator.js';
import { generateGitignore } from './features/gitignoreGenerator.js';
import { runSecurityCheck } from './features/securityCheck.js';
import { runCodeQualityReport } from './features/codeQualityReport.js';
import { runDependencyHealthCheck } from './features/dependencyHealth.js';
import { generateApiDocs } from './features/apiDocsGenerator.js';
import logger from './utils/logger.js';

// Uygulamanin giris noktasi.
// Banner gosterimi, config dogrulamasi ve ana dongu burada yonetilir.
async function main() {
  // Terminali temizleyip banner ile basliyoruz
  console.clear();
  await showBanner();

  // Fireworks API key gibi zorunlu degerlerin tanimli olup olmadigini kontrol et
  const configStatus = validateConfig();
  if (!configStatus.valid) {
    logger.error('Yapilandirma eksik! Asagidaki degiskenleri .env dosyaniza ekleyin:');
    for (const key of configStatus.missing) {
      logger.dim(`- ${key}`);
    }
    logger.spacer();
    logger.dim('Ornek icin .env.example dosyasina bakin.');
    process.exit(1);
  }

  logger.success('Yapilandirma yuklendi.');
  logger.spacer();

  // Ana dongu: Kullanici cikis secene kadar menu gostermeye devam ediyoruz
  while (true) {
    try {
      const choice = await showMainMenu();

      if (choice === 'exit') {
        logger.spacer();
        logger.info(chalk.dim('Gorusuruz!'));
        logger.spacer();
        process.exit(0);
      }

      // Secilen islem icin repo bilgisi aliyoruz
      logger.spacer();
      const repoData = await getRepoInput();

      if (!repoData) {
        logger.warning('Gecersiz repo bilgisi.');
        continue;
      }

      logger.spacer();

      // Secime gore ilgili feature'i calistiriyoruz
      switch (choice) {
        case 'readme':
          await generateReadme(repoData.owner, repoData.repo);
          break;
        case 'gitignore':
          await generateGitignore(repoData.owner, repoData.repo);
          break;
        case 'security':
          await runSecurityCheck(repoData.owner, repoData.repo);
          break;
        case 'quality':
          await runCodeQualityReport(repoData.owner, repoData.repo);
          break;
        case 'dependency':
          await runDependencyHealthCheck(repoData.owner, repoData.repo);
          break;
        case 'apidocs':
          await generateApiDocs(repoData.owner, repoData.repo);
          break;
      }
    } catch (err) {
      // Ctrl+C gibi kesme sinyallerini yakalayip temiz bir cikis sagliyoruz
      if (err.name === 'ExitPromptError' || err.message?.includes('User force closed')) {
        logger.spacer();
        logger.info(chalk.dim('Gorusuruz!'));
        process.exit(0);
      }

      logger.error(`Beklenmeyen hata: ${err.message}`);
      logger.spacer();
    }
  }
}

// Uygulamayi baslat
main();
