import { select } from '@inquirer/prompts';
import chalk from 'chalk';

// Ana menu. Kullaniciya alti temel ozellik ve cikis secenegi sunar.
// Her secenekte kisa bir aciklama gosteriliyor.
async function showMainMenu() {
  const choice = await select({
    message: chalk.bold('Ne yapmak istersiniz?'),
    choices: [
      {
        name: `${chalk.green('README Generator')}        ${chalk.dim('— Profesyonel README olustur')}`,
        value: 'readme',
      },
      {
        name: `${chalk.yellow('Gitignore Generator')}     ${chalk.dim('— Akilli .gitignore olustur')}`,
        value: 'gitignore',
      },
      {
        name: `${chalk.red('Security Check')}          ${chalk.dim('— Guvenlik acigi tara')}`,
        value: 'security',
      },
      {
        name: `${chalk.cyan('Code Quality Report')}     ${chalk.dim('— Kod kalitesi analizi')}`,
        value: 'quality',
      },
      {
        name: `${chalk.blue('Dependency Health Check')}  ${chalk.dim('— Bagimlillik saglik raporu')}`,
        value: 'dependency',
      },
      {
        name: `${chalk.magenta('API Docs Generator')}      ${chalk.dim('— API dokumantasyonu olustur')}`,
        value: 'apidocs',
      },
      {
        name: `${chalk.dim('Cikis')}`,
        value: 'exit',
      },
    ],
    theme: {
      prefix: '',
      style: {
        highlight: (text) => chalk.hex('#8B5CF6')(text),
      },
    },
  });

  return choice;
}

export { showMainMenu };
