import { input } from '@inquirer/prompts';
import chalk from 'chalk';

// Kullanicidan repo bilgisi alir. Tam URL veya owner/repo formati kabul edilir.
// Girilen degeri parse edip { owner, repo } olarak doner.
async function getRepoInput() {
  const raw = await input({
    message: chalk.bold('Repo girin (owner/repo veya GitHub URL):'),
    validate(value) {
      const trimmed = value.trim();
      if (!trimmed) {
        return 'Lutfen bir repo girin.';
      }

      // URL formati veya owner/repo formati kontrol ediliyor
      const parsed = parseRepoInput(trimmed);
      if (!parsed) {
        return 'Gecersiz format. "owner/repo" veya "https://github.com/owner/repo" seklinde girin.';
      }

      return true;
    },
    theme: {
      prefix: '',
    },
  });

  return parseRepoInput(raw.trim());
}

// Girilen metni parse ederek owner ve repo bilgisini cikarir.
// Hem duz "owner/repo" formatini hem de GitHub URL'lerini destekler.
function parseRepoInput(value) {
  // GitHub URL'sini temizle
  const urlPattern = /(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)/;
  const urlMatch = value.match(urlPattern);
  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: urlMatch[2].replace(/\.git$/, ''),
    };
  }

  // Duz owner/repo formatini kontrol et
  const slugPattern = /^([^/\s]+)\/([^/\s]+)$/;
  const slugMatch = value.match(slugPattern);
  if (slugMatch) {
    return {
      owner: slugMatch[1],
      repo: slugMatch[2],
    };
  }

  return null;
}

export { getRepoInput };
