import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

// Verilen icerik bir dosyaya yazilir.
// Eger hedef dizin mevcut degilse otomatik olarak olusturulur.
async function saveToFile(filePath, content) {
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, content, 'utf-8');
}

export { saveToFile };
