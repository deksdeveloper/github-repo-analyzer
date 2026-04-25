// Her feature icin AI'ya gonderilecek system ve user promptlari.
// Promptlar mumkun oldugunca net ve yonlendirici olmali ki
// AI tutarli ve kaliteli ciktilar uretsin.
//
// Parcali (chunked) analiz destegi de burada yer aliyor.
// Buyuk repolar icin dosya icerikleri gruplara bolunup
// her grup ayri bir user prompt olarak gonderilir.

import { formatChunksForPrompt } from '../utils/chunker.js';

// README olusturma icin kullanilan system promptu.
// AI'nin bir teknik yazar gibi davranmasini sagliyoruz.
function getReadmeSystemPrompt() {
  return `Sen deneyimli bir teknik yazarsin. Sana verilen GitHub reposunun yapisi, 
dosyalari ve bagimlilik bilgilerini analiz ederek profesyonel bir README.md dosyasi olusturacaksin.

README su bolumleri icermeli (uygun olanlari):
- Baslik ve kisa aciklama
- Ozellikler (Features)
- Teknolojiler / Tech Stack
- Kurulum (Installation)
- Kullanim (Usage)
- Proje Yapisi (opsiyonel, buyuk projeler icin)
- Katkida Bulunma (Contributing)
- Lisans (License)

Kurallar:
- Markdown formatinda yaz
- Basit, anlasilir ve profesyonel bir dil kullan
- Reponun diline gore README'yi o dilde yaz (ornegin Turkce repo ise Turkce, Ingilizce ise Ingilizce)
- Badge'ler ekleyebilirsin ama abartma
- Sadece README icerigini dondur, ekstra aciklama ekleme`;
}

function getReadmeUserPrompt(repoInfo, tree, fileContents) {
  const treeStr = tree
    .filter((item) => item.type === 'blob')
    .map((item) => item.path)
    .slice(0, 200) // Cok buyuk repolarda token limitini asmamak icin sinir koyuyoruz
    .join('\n');

  const filesStr = fileContents
    .map((f) => `--- ${f.path} ---\n${f.content.slice(0, 3000)}`)
    .join('\n\n');

  return `Repo bilgileri:
- Ad: ${repoInfo.fullName}
- Aciklama: ${repoInfo.description}
- Ana Dil: ${repoInfo.language}
- Lisans: ${repoInfo.license}
- Topics: ${repoInfo.topics.join(', ') || 'Yok'}
- Yildiz: ${repoInfo.stars} | Fork: ${repoInfo.forks}
- Anasayfa: ${repoInfo.homepage || 'Yok'}

Dosya yapisi:
${treeStr}

Onemli dosya icerikleri:
${filesStr}`;
}

// Parcali analiz icin README user prompt olusturucusu.
// Her batch icin cagirilir, repo meta bilgisi ve dosya agaci
// sadece ilk batch'te gonderilir.
function buildReadmeChunkedPrompt(repoInfo, tree) {
  return (batch, batchIndex, totalBatches) => {
    const filesStr = formatChunksForPrompt(batch);

    if (batchIndex === 0) {
      const treeStr = tree
        .filter((item) => item.type === 'blob')
        .map((item) => item.path)
        .slice(0, 200)
        .join('\n');

      return `Repo bilgileri:
- Ad: ${repoInfo.fullName}
- Aciklama: ${repoInfo.description}
- Ana Dil: ${repoInfo.language}
- Lisans: ${repoInfo.license}
- Topics: ${repoInfo.topics.join(', ') || 'Yok'}
- Yildiz: ${repoInfo.stars} | Fork: ${repoInfo.forks}

Dosya yapisi:
${treeStr}

Bu repo ${totalBatches} parcada analiz edilecek. Iste ilk parcanin dosya icerikleri:

${filesStr}`;
    }

    return filesStr;
  };
}

// Gitignore olusturma icin kullanilan promptlar.
// Proje tipine gore kapsamli bir gitignore uretmesini istiyoruz.
function getGitignoreSystemPrompt() {
  return `Sen deneyimli bir DevOps muhendisisin. Sana verilen proje yapisini analiz ederek 
kapsamli ve dogru bir .gitignore dosyasi olusturacaksin.

Kurallar:
- Projenin diline ve framework'une uygun kurallar ekle
- IDE dosyalari (VS Code, IntelliJ, vb.)
- Isletim sistemi dosyalari (macOS, Windows, Linux)
- Build ciktilari ve gecici dosyalar
- Ortam degiskenleri (.env dosyalari)
- Bagimliliklari dizinleri (node_modules, venv, vb.)
- Log dosyalari
- Her bolumu yorum satiriyla grupla ve acikla
- Sadece .gitignore icerigini dondur, ekstra aciklama ekleme`;
}

function getGitignoreUserPrompt(repoInfo, tree, fileContents) {
  const treeStr = tree
    .filter((item) => item.type === 'blob')
    .map((item) => item.path)
    .slice(0, 150)
    .join('\n');

  const filesStr = fileContents
    .map((f) => `--- ${f.path} ---\n${f.content.slice(0, 2000)}`)
    .join('\n\n');

  return `Proje bilgileri:
- Ad: ${repoInfo.fullName}
- Ana Dil: ${repoInfo.language}
- Topics: ${repoInfo.topics.join(', ') || 'Yok'}

Dosya yapisi:
${treeStr}

Bagimlillik dosyalari:
${filesStr}`;
}

// Parcali gitignore prompt olusturucusu
function buildGitignoreChunkedPrompt(repoInfo, tree) {
  return (batch, batchIndex, totalBatches) => {
    const filesStr = formatChunksForPrompt(batch);

    if (batchIndex === 0) {
      const treeStr = tree
        .filter((item) => item.type === 'blob')
        .map((item) => item.path)
        .slice(0, 150)
        .join('\n');

      return `Proje bilgileri:
- Ad: ${repoInfo.fullName}
- Ana Dil: ${repoInfo.language}
- Topics: ${repoInfo.topics.join(', ') || 'Yok'}

Dosya yapisi:
${treeStr}

Bu proje ${totalBatches} parcada analiz edilecek. Iste ilk parcanin dosyalari:

${filesStr}`;
    }

    return filesStr;
  };
}

// Guvenlik taramasi icin kullanilan promptlar.
// AI'nin bir siber guvenlik uzmani gibi davranmasini istiyoruz.
function getSecuritySystemPrompt() {
  return `Sen deneyimli bir siber guvenlik uzmanisin. Sana verilen GitHub reposunun dosyalarini 
ve yapisini analiz ederek guvenlik aciklari ve riskler hakkinda detayli bir rapor olusturacaksin.

Analiz kapsami:
1. Bagimlillik guvenligi - Bilinen zafiyetler, guncel olmayan paketler
2. Hardcoded secrets - API anahtari, parola, token gibi hassas veriler
3. Guvenlik yapilandirmasi - CORS, HTTPS, input validation
4. Docker guvenligi - Root kullanici, guvenli olmayan base image (varsa)
5. CI/CD guvenligi - Workflow injection, guvenli olmayan action kullanimi (varsa)
6. Genel best practice kontrolleri

Rapor formati:
Her bulgu icin asagidaki yapiyi kullan:

### [SEVERITY] Bulgu Basligi
- **Dosya:** dosya/yolu
- **Risk:** Ne tur bir risk olusturdugu
- **Aciklama:** Detayli aciklama
- **Oneri:** Nasil duzeltilecegi

Severity seviyeleri:
- CRITICAL - Acil mudahale gerektiren ciddi guvenlik acigi
- HIGH - Onemli guvenlik riski
- MEDIUM - Orta seviye risk
- LOW - Dusuk oncelikli iyilestirme
- INFO - Bilgilendirme amacli oneri

Raporun sonunda bir ozet bolumu ekle:
- Toplam bulgu sayisi (severity bazinda)
- Genel guvenlik degerlendirmesi
- Oncelikli olarak ele alinmasi gereken konular

Eger icerik parcalar halinde geliyorsa, her parcayi analiz et ve
bulgulari birikimli olarak raporla. Son parcada nihai ozeti olustur.

Sadece rapor icerigini dondur, ekstra aciklama ekleme.`;
}

function getSecurityUserPrompt(repoInfo, tree, fileContents) {
  const treeStr = tree
    .filter((item) => item.type === 'blob')
    .map((item) => item.path)
    .slice(0, 200)
    .join('\n');

  const filesStr = fileContents
    .map((f) => `--- ${f.path} ---\n${f.content.slice(0, 4000)}`)
    .join('\n\n');

  return `Repo bilgileri:
- Ad: ${repoInfo.fullName}
- Ana Dil: ${repoInfo.language}
- Lisans: ${repoInfo.license}
- Topics: ${repoInfo.topics.join(', ') || 'Yok'}
- Gorunurluk: ${repoInfo.isPrivate ? 'Private' : 'Public'}

Dosya yapisi:
${treeStr}

Guvenlik analizi icin dosya icerikleri:
${filesStr}`;
}

// Parcali guvenlik analizi prompt olusturucusu
function buildSecurityChunkedPrompt(repoInfo, tree) {
  return (batch, batchIndex, totalBatches) => {
    const filesStr = formatChunksForPrompt(batch);

    if (batchIndex === 0) {
      const treeStr = tree
        .filter((item) => item.type === 'blob')
        .map((item) => item.path)
        .slice(0, 200)
        .join('\n');

      return `Repo bilgileri:
- Ad: ${repoInfo.fullName}
- Ana Dil: ${repoInfo.language}
- Lisans: ${repoInfo.license}
- Topics: ${repoInfo.topics.join(', ') || 'Yok'}
- Gorunurluk: ${repoInfo.isPrivate ? 'Private' : 'Public'}

Dosya yapisi:
${treeStr}

Bu repoda ${totalBatches} parca halinde guvenlik analizi yapilacak. Iste ilk parca:

${filesStr}`;
    }

    return filesStr;
  };
}

// ---------------------------------------------------------------------------
// Kod kalitesi raporu icin promptlar.
// AI'nin tecrubeli bir yazilim muhendisi gibi kodu incelemesini istiyoruz.
// ---------------------------------------------------------------------------

function getCodeQualitySystemPrompt() {
  return `Sen cok deneyimli bir senior yazilim muhendisisin. Sana verilen GitHub reposunun 
kaynak kodlarini inceleyerek kapsamli bir kod kalitesi raporu olusturacaksin.

Analiz kapsami:
1. Kod karmasikligi - Cok uzun fonksiyonlar, derin ic ice yapilari, karmasik kosullar
2. Tekrar eden pattern'lar - DRY ihlalleri, copy-paste kod bloklari
3. Adlandirma kalitesi - Degisken, fonksiyon ve dosya isimlendirme tutarliligi
4. Hata yonetimi - Try-catch kullanimi, hata mesajlari, edge case'ler
5. Modulerlik - Dosya organizasyonu, tek sorumluluk prensibi, bagimlilik yonetimi
6. Best practice ihlalleri - Dile ozgu anti-pattern'lar, guvenli olmayan kullanim
7. Test coverage gorusu - Test dosyalari varsa kaliteleri, yoksa eksikligi
8. Performans ipuclari - Gereksiz donguler, bellek sizintisi riski, optimize edilebilecek yapilar

Rapor formati:

## Genel Degerlendirme
Projeye 10 uzerinden bir puan ver ve kisa bir ozet yaz.

## Olumlu Yonler
Kodda iyi yapilan seyleri listele.

## Iyilestirme Alanlari
Her bulgu icin:
### [KATEGORI] Baslik
- **Dosya:** dosya/yolu
- **Satir/Bolum:** Ilgili kisim
- **Sorun:** Ne oldugu
- **Oneri:** Nasil iyilestirilecegi
- **Ornek:** Varsa duzeltilmis kod ornegi

Kategoriler: COMPLEXITY, DRY, NAMING, ERROR_HANDLING, MODULARITY, BEST_PRACTICE, PERFORMANCE, TESTING

## Oncelik Sirasi
En kritik iyilestirmeleri oncelik sirasina gore listele.

Sadece rapor icerigini dondur, ekstra aciklama ekleme.`;
}

function getCodeQualityUserPrompt(repoInfo, tree, fileContents) {
  const treeStr = tree
    .filter((item) => item.type === 'blob')
    .map((item) => item.path)
    .slice(0, 200)
    .join('\n');

  const filesStr = fileContents
    .map((f) => `--- ${f.path} ---\n${f.content.slice(0, 4000)}`)
    .join('\n\n');

  return `Repo bilgileri:
- Ad: ${repoInfo.fullName}
- Ana Dil: ${repoInfo.language}
- Dosya sayisi: ${tree.filter((i) => i.type === 'blob').length}

Dosya yapisi:
${treeStr}

Kaynak kod icerikleri:
${filesStr}`;
}

function buildCodeQualityChunkedPrompt(repoInfo, tree) {
  return (batch, batchIndex, totalBatches) => {
    const filesStr = formatChunksForPrompt(batch);

    if (batchIndex === 0) {
      const treeStr = tree
        .filter((item) => item.type === 'blob')
        .map((item) => item.path)
        .slice(0, 200)
        .join('\n');

      return `Repo bilgileri:
- Ad: ${repoInfo.fullName}
- Ana Dil: ${repoInfo.language}
- Dosya sayisi: ${tree.filter((i) => i.type === 'blob').length}

Dosya yapisi:
${treeStr}

Bu repoda ${totalBatches} parca halinde kod kalitesi analizi yapilacak. Iste ilk parca:

${filesStr}`;
    }

    return filesStr;
  };
}

// ---------------------------------------------------------------------------
// Bagimlillik saglik kontrolu icin promptlar.
// Guncellik, guvenlik ve alternatif onerileri kapsayan bir analiz istiyoruz.
// ---------------------------------------------------------------------------

function getDependencyHealthSystemPrompt() {
  return `Sen deneyimli bir DevOps ve yazilim muhendisisin. Sana verilen projenin bagimlillik 
dosyalarini (package.json, requirements.txt, go.mod vb.) analiz ederek kapsamli bir 
bagimlillik saglik raporu olusturacaksin.

Analiz kapsami:
1. Guncellik durumu - Bilinen eski versiyonlar, major guncelleme gerektiren paketler
2. Guvenlik riskleri - Bilinen CVE'si olan paketler, guvenlik uyarilari
3. Gereksiz bagimliliklar - Kullanilmiyor olabilecek veya yerlesik alternatifi olan paketler
4. Boyut etkisi - Bundle boyutunu gereksiz artiran buyuk paketler
5. Alternatif onerileri - Daha hafif, daha modern veya daha iyi desteklenen alternatifler
6. Lisans uyumlulugu - Ticari projelerle uyumsuz olabilecek lisanslar
7. Bagimlillik agaci derinligi - Cok fazla transitive dependency getiren paketler
8. Dev vs Production ayrimi - devDependencies'e tasinmasi gereken paketler

Rapor formati:

## Genel Saglik Degerlendirmesi
Bagimliliklara 10 uzerinden bir saglik puani ver.
Toplam bagimlillik sayisi ve dagilimi.

## Kritik Bulgular
Acil dikkat gerektiren konular.

## Bagimlillik Analizi
Her onemli bulgu icin:
### [SEVIYE] Paket Adi
- **Mevcut:** suanki versiyon
- **Guncel:** bilinen en son versiyon (biliniyorsa)
- **Durum:** Guncel / Eski / Kritik
- **Not:** Aciklama ve oneri

Seviyeler: CRITICAL, WARNING, INFO, OK

## Alternatif Onerileri
Daha iyi alternatifleri olan paketler.

## Ozet ve Aksiyon Plani
Oncelik sirasina gore yapilmasi gerekenler.

Sadece rapor icerigini dondur, ekstra aciklama ekleme.`;
}

function getDependencyHealthUserPrompt(repoInfo, tree, fileContents) {
  const treeStr = tree
    .filter((item) => item.type === 'blob')
    .map((item) => item.path)
    .slice(0, 100)
    .join('\n');

  const filesStr = fileContents
    .map((f) => `--- ${f.path} ---\n${f.content.slice(0, 5000)}`)
    .join('\n\n');

  return `Repo bilgileri:
- Ad: ${repoInfo.fullName}
- Ana Dil: ${repoInfo.language}
- Lisans: ${repoInfo.license}

Dosya yapisi:
${treeStr}

Bagimlillik dosyalari:
${filesStr}`;
}

function buildDependencyHealthChunkedPrompt(repoInfo, tree) {
  return (batch, batchIndex, totalBatches) => {
    const filesStr = formatChunksForPrompt(batch);

    if (batchIndex === 0) {
      const treeStr = tree
        .filter((item) => item.type === 'blob')
        .map((item) => item.path)
        .slice(0, 100)
        .join('\n');

      return `Repo bilgileri:
- Ad: ${repoInfo.fullName}
- Ana Dil: ${repoInfo.language}
- Lisans: ${repoInfo.license}

Dosya yapisi:
${treeStr}

Bu proje ${totalBatches} parca halinde analiz edilecek. Iste ilk parcanin bagimlillik dosyalari:

${filesStr}`;
    }

    return filesStr;
  };
}

// ---------------------------------------------------------------------------
// API dokumantasyonu olusturma icin promptlar.
// Endpoint'leri tespit edip detayli bir API dokumantasyonu olusturmasini istiyoruz.
// ---------------------------------------------------------------------------

function getApiDocsSystemPrompt() {
  return `Sen deneyimli bir API tasarimcisi ve teknik yazarsin. Sana verilen kaynak kodlarini 
analiz ederek kapsamli bir API dokumantasyonu olusturacaksin.

Analiz kapsami:
1. Framework tespiti - Express, Fastify, Flask, Django, FastAPI, Spring, Gin vb.
2. Endpoint tespiti - Tum HTTP endpoint'lerini bul (GET, POST, PUT, DELETE, PATCH)
3. Route parametreleri - Path params, query params, body schema
4. Middleware - Authentication, rate limiting, validation katmanlari
5. Response formatlari - Basarili ve hata response ornekleri
6. Gruplama - Endpoint'leri mantiksal gruplara ayir (auth, users, products vb.)

Dokumantasyon formati:

## API Genel Bakis
Framework, base URL (tespit edilebildiyse), authentication yontemi.

## Endpoint'ler
Her endpoint icin:

### [HTTP_METHOD] /path/to/endpoint
- **Aciklama:** Endpoint'in ne yaptigi
- **Authentication:** Gerekli mi, hangi yontem
- **Parametreler:**
  | Parametre | Konum | Tip | Zorunlu | Aciklama |
  |-----------|-------|-----|---------|----------|
  | id | path | string | Evet | ... |
  | page | query | number | Hayir | ... |
- **Request Body:** (varsa JSON schema veya ornek)
- **Response:** Basarili response ornegi
- **Hata Kodlari:** Olasi hata durumlari

## Middleware ve Ortak Yapilar
Paydasilan middleware, error handler, validation katmanlari.

## Notlar
Eksik veya iyilestirilebilecek noktalar.

Eger endpoint bulamazsan, kodun bir API icermedigini acikla ve
projenin ne tur bir uygulama oldugunu belirt.

Sadece dokumantasyon icerigini dondur, ekstra aciklama ekleme.`;
}

function getApiDocsUserPrompt(repoInfo, tree, fileContents) {
  const treeStr = tree
    .filter((item) => item.type === 'blob')
    .map((item) => item.path)
    .slice(0, 200)
    .join('\n');

  const filesStr = fileContents
    .map((f) => `--- ${f.path} ---\n${f.content.slice(0, 4000)}`)
    .join('\n\n');

  return `Repo bilgileri:
- Ad: ${repoInfo.fullName}
- Ana Dil: ${repoInfo.language}
- Topics: ${repoInfo.topics.join(', ') || 'Yok'}

Dosya yapisi:
${treeStr}

API analizi icin dosya icerikleri:
${filesStr}`;
}

function buildApiDocsChunkedPrompt(repoInfo, tree) {
  return (batch, batchIndex, totalBatches) => {
    const filesStr = formatChunksForPrompt(batch);

    if (batchIndex === 0) {
      const treeStr = tree
        .filter((item) => item.type === 'blob')
        .map((item) => item.path)
        .slice(0, 200)
        .join('\n');

      return `Repo bilgileri:
- Ad: ${repoInfo.fullName}
- Ana Dil: ${repoInfo.language}
- Topics: ${repoInfo.topics.join(', ') || 'Yok'}

Dosya yapisi:
${treeStr}

Bu repoda ${totalBatches} parca halinde API analizi yapilacak. Iste ilk parca:

${filesStr}`;
    }

    return filesStr;
  };
}

export {
  getReadmeSystemPrompt,
  getReadmeUserPrompt,
  buildReadmeChunkedPrompt,
  getGitignoreSystemPrompt,
  getGitignoreUserPrompt,
  buildGitignoreChunkedPrompt,
  getSecuritySystemPrompt,
  getSecurityUserPrompt,
  buildSecurityChunkedPrompt,
  getCodeQualitySystemPrompt,
  getCodeQualityUserPrompt,
  buildCodeQualityChunkedPrompt,
  getDependencyHealthSystemPrompt,
  getDependencyHealthUserPrompt,
  buildDependencyHealthChunkedPrompt,
  getApiDocsSystemPrompt,
  getApiDocsUserPrompt,
  buildApiDocsChunkedPrompt,
};
