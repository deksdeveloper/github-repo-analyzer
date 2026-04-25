import { config } from '../config.js';
import chalk from 'chalk';
import logger from '../utils/logger.js';

// Fireworks AI API'sine streaming istegi gonderir.
// OpenAI uyumlu chat completions endpoint'ini kullaniyor.
// Yanitlar karakter karakter terminale yazilir ve tam metin biriktirilerek doner.
async function streamChat(messages) {
  const response = await fetch(`${config.fireworks.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.fireworks.apiKey}`,
    },
    body: JSON.stringify({
      model: config.fireworks.model,
      messages,
      stream: true,
      max_tokens: 4096,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Fireworks API hatasi (${response.status}): ${errorBody}`
    );
  }

  // Streaming yaniti satir satir okuyup parse ediyoruz
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE formatindaki satirlari isliyoruz
    const lines = buffer.split('\n');
    // Son satir eksik olabilir, onu buffer'da tutuyoruz
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed === 'data: [DONE]') {
        continue;
      }

      if (!trimmed.startsWith('data: ')) {
        continue;
      }

      try {
        const json = JSON.parse(trimmed.slice(6));
        const delta = json.choices?.[0]?.delta?.content;

        if (delta) {
          process.stdout.write(delta);
          fullContent += delta;
        }
      } catch {
        // Bozuk JSON satirlarini atliyoruz, bu SSE'de normal olabiliyor
      }
    }
  }

  // Son satir basi ekleyerek ciktinin duzgun kapanmasini sagliyoruz
  process.stdout.write('\n');

  return fullContent;
}

// Streaming olmadan tek seferde yanit alan fonksiyon.
// Kisa islemler icin veya streaming desteklenmediginde kullanilir.
async function chat(messages) {
  const response = await fetch(`${config.fireworks.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.fireworks.apiKey}`,
    },
    body: JSON.stringify({
      model: config.fireworks.model,
      messages,
      max_tokens: 4096,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Fireworks API hatasi (${response.status}): ${errorBody}`
    );
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Buyuk icerikler icin parcali analiz fonksiyonu.
// Dosya iceriklerini gruplara bolup her grubu sirayla AI'ya gonderir.
// Her grubun sonucu biriktirilir, sonunda birlesik bir cikti doner.
//
// Calisma mantigi:
// 1. Ilk grup icin normal system + user prompt gonderilir
// 2. Sonraki gruplar icin onceki analizin ozeti assistant mesaji olarak eklenir
// 3. AI her seferinde mevcut parcalari analiz edip sonuca ekler
// 4. Son grup bittikten sonra birlesik sonuc kullaniciya gosterilir
async function streamChatChunked(systemPrompt, batches, buildUserPrompt) {
  let allResults = '';
  const totalBatches = batches.length;

  for (let i = 0; i < totalBatches; i++) {
    const batch = batches[i];
    const isFirst = i === 0;
    const isLast = i === totalBatches - 1;

    // Kacinci grup oldugunu kullaniciya gosteriyoruz
    if (totalBatches > 1) {
      logger.spacer();
      logger.info(
        chalk.dim(`Parca ${i + 1}/${totalBatches} analiz ediliyor...`)
      );
      logger.spacer();
    }

    // Her grup icin user prompt'u olusturuyoruz
    const userContent = buildUserPrompt(batch, i, totalBatches);

    const messages = [
      { role: 'system', content: systemPrompt },
    ];

    // Ilk gruptan sonraki gruplar icin onceki sonucu baglam olarak ekliyoruz.
    // Boylece AI onceki parcalarda ne buldugunu biliyor ve tekrara dusmuyor.
    if (!isFirst && allResults.length > 0) {
      // Onceki sonucun son 2000 karakterini baglam olarak veriyoruz
      // Tamamini vermek token limitini asabilir
      const previousContext = allResults.length > 2000
        ? '...\n' + allResults.slice(-2000)
        : allResults;

      messages.push({
        role: 'assistant',
        content: previousContext,
      });

      messages.push({
        role: 'user',
        content: `Devam ediyoruz. Iste analiz edilecek sonraki parca:\n\n${userContent}\n\n${
          isLast
            ? 'Bu son parca. Tum parcalari goz onunde bulundurarak nihai sonucu tamamla.'
            : 'Bu parcayi analiz et ve sonuclari ekle. Daha fazla parca gelecek.'
        }`,
      });
    } else {
      messages.push({ role: 'user', content: userContent });
    }

    const result = await streamChat(messages);
    allResults += result + '\n';
  }

  return allResults.trim();
}

export { streamChat, chat, streamChatChunked };
