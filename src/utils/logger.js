import chalk from 'chalk';

// Basit ve tutarli loglama fonksiyonlari.
// Her seviye icin farkli renk kullanarak terminalde okunabilirligi artiriyoruz.

const logger = {
  info(message) {
    console.log(chalk.cyan('  ℹ ') + message);
  },

  success(message) {
    console.log(chalk.green('  ✔ ') + message);
  },

  warning(message) {
    console.log(chalk.yellow('  ⚠ ') + message);
  },

  error(message) {
    console.log(chalk.red('  ✖ ') + message);
  },

  dim(message) {
    console.log(chalk.dim('    ' + message));
  },

  // Bos satir basarak gorsel ayirma saglar
  spacer() {
    console.log();
  },
};

export default logger;
