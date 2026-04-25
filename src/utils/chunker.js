import logger from './logger.js';
import chalk from 'chalk';

// Tek bir dosya iceriginin kabul edilebilir maksimum karakter sayisi.
// Bunun uzerindeki dosyalar parcalara ayrilir.
const MAX_CHUNK_CHARS = 6000;

// Parcalar arasinda biraz overlap birakiyoruz ki
// baglam kaybi olmasin, fonksiyon ortasindan bolunmesin.
const OVERLAP_CHARS = 500;

// Dosya iceriklerini AI'ya gonderilebilecek boyutta parcalara boler.
// Kucuk dosyalar oldugu gibi kalir, buyuk dosyalar parcalanir.
// Her parca hangi dosyaya ait oldugu ve kacinci parca oldugu bilgisiyle etiketlenir.
function chunkFileContents(fileContents, maxChunkChars = MAX_CHUNK_CHARS) {
  const chunks = [];

  for (const file of fileContents) {
    const content = file.content;

    // Dosya yeterince kucukse parcalamaya gerek yok
    if (content.length <= maxChunkChars) {
      chunks.push({
        path: file.path,
        content: content,
        chunkIndex: 0,
        totalChunks: 1,
      });
      continue;
    }

    // Buyuk dosyayi parcalara boluyoruz
    const totalChunks = Math.ceil(content.length / (maxChunkChars - OVERLAP_CHARS));
    let offset = 0;

    for (let i = 0; i < totalChunks; i++) {
      // Son parcada dosyanin sonuna kadar aliyoruz
      const end = Math.min(offset + maxChunkChars, content.length);
      const slice = content.slice(offset, end);

      chunks.push({
        path: file.path,
        content: slice,
        chunkIndex: i,
        totalChunks,
      });

      // Bir sonraki parca icin overlap kadar geri gidiyoruz
      offset = end - OVERLAP_CHARS;
      if (offset < 0) offset = 0;
    }
  }

  return chunks;
}

// Parcalari AI'ya gonderilebilecek gruplara ayirir.
// Her grubun toplam karakter sayisi belirtilen limite yakin olur.
// Boylece her API cagrisinda mumkun oldugunca cok parca gonderilir.
function groupChunksIntoBatches(chunks, maxBatchChars = 15000) {
  const batches = [];
  let currentBatch = [];
  let currentSize = 0;

  for (const chunk of chunks) {
    const chunkSize = chunk.content.length + chunk.path.length + 50; // metadata icin ek alan

    // Mevcut gruba sigmazsa yeni grup baslat
    if (currentSize + chunkSize > maxBatchChars && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentSize = 0;
    }

    currentBatch.push(chunk);
    currentSize += chunkSize;
  }

  // Son grubu da ekliyoruz
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

// Parca bilgilerini okunabilir bir metin formatina cevirir.
// AI'ya gonderilecek user prompt'unun dosya icerikleri bolumunde kullanilir.
function formatChunksForPrompt(chunks) {
  return chunks
    .map((chunk) => {
      const partInfo =
        chunk.totalChunks > 1
          ? ` (parca ${chunk.chunkIndex + 1}/${chunk.totalChunks})`
          : '';
      return `--- ${chunk.path}${partInfo} ---\n${chunk.content}`;
    })
    .join('\n\n');
}

// Dosya iceriklerinin toplam buyuklugunu hesaplar.
// Chunking gerekip gerekmedigine karar vermek icin kullanilir.
function getTotalContentSize(fileContents) {
  return fileContents.reduce((sum, f) => sum + (f.content?.length || 0), 0);
}

// Chunking'e ihtiyac olup olmadigini kontrol eder.
// Toplam icerik belirli bir esigi asarsa true doner.
function needsChunking(fileContents, threshold = 20000) {
  return getTotalContentSize(fileContents) > threshold;
}

export {
  chunkFileContents,
  groupChunksIntoBatches,
  formatChunksForPrompt,
  getTotalContentSize,
  needsChunking,
  MAX_CHUNK_CHARS,
};
