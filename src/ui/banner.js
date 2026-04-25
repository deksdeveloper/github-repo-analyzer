import figlet from 'figlet';
import gradient from 'gradient-string';
import boxen from 'boxen';
import chalk from 'chalk';

// Uygulama basladiginda terminale gosterilen ASCII art banner.
// Gradient renk gecisi ve cerceveli kutu ile premium bir gorunum saglar.
async function showBanner() {
  const asciiArt = figlet.textSync('GIT  AI', {
    font: 'ANSI Shadow',
    horizontalLayout: 'fitted',
  });

  // Mor-mavi gradient gecisi uyguluyoruz
  const coloredArt = gradient(['#8B5CF6', '#6366F1', '#3B82F6'])(asciiArt);

  const subtitle = chalk.dim('GitHub Repo Analyzer v1.0.0');
  const powered = chalk.dim('Powered by Fireworks AI');

  const content = `${coloredArt}\n\n  ${subtitle}\n  ${powered}`;

  const banner = boxen(content, {
    padding: 1,
    margin: { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle: 'double',
    borderColor: '#6366F1',
  });

  console.log(banner);
}

export { showBanner };
