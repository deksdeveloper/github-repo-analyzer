import boxen from 'boxen';
import chalk from 'chalk';
import { confirm, input } from '@inquirer/prompts';
import { saveToFile } from '../utils/fileHelpers.js';
import logger from '../utils/logger.js';
import { join } from 'path';

// AI tarafindan uretilen sonucu terminalde gosterir.
// Icerik turune gore uygun formatlama yapilir.
async function displayResult(content, type) {
  logger.spacer();

  const titles = {
    readme: 'README.md',
    gitignore: '.gitignore',
    security: 'Guvenlik Raporu',
    quality: 'Kod Kalitesi Raporu',
    dependency: 'Bagimlillik Saglik Raporu',
    apidocs: 'API Dokumantasyonu',
  };

  const colors = {
    readme: '#22C55E',
    gitignore: '#EAB308',
    security: '#EF4444',
    quality: '#06B6D4',
    dependency: '#3B82F6',
    apidocs: '#A855F7',
  };

  const title = titles[type] || 'Sonuc';
  const color = colors[type] || '#8B5CF6';

  // Sonuc basligini goster
  console.log(
    boxen(chalk.hex(color).bold(` ${title} — Analiz Tamamlandi `), {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      borderStyle: 'round',
      borderColor: color,
    })
  );

  logger.spacer();

  // Icerik zaten streaming ile yazildiysa burada tekrar yazmiyoruz.
  // Bu fonksiyon sadece bitis sonrasi kaydetme islemi icin kullanilir.

  logger.spacer();

  // Kullaniciya dosyaya kaydetme secenegi sun
  const shouldSave = await confirm({
    message: chalk.bold('Sonucu dosyaya kaydetmek ister misiniz?'),
    default: true,
    theme: { prefix: '' },
  });

  if (shouldSave) {
    const defaultNames = {
      readme: 'README.md',
      gitignore: '.gitignore',
      security: 'security-report.md',
      quality: 'code-quality-report.md',
      dependency: 'dependency-health-report.md',
      apidocs: 'api-docs.md',
    };

    const fileName = await input({
      message: chalk.bold('Dosya adi:'),
      default: defaultNames[type] || 'output.md',
      theme: { prefix: '' },
    });

    const filePath = join(process.cwd(), fileName);

    try {
      await saveToFile(filePath, content);
      logger.success(`Dosya kaydedildi: ${chalk.underline(filePath)}`);
    } catch (err) {
      logger.error(`Dosya kaydedilemedi: ${err.message}`);
    }
  }

  logger.spacer();
}

export { displayResult };
