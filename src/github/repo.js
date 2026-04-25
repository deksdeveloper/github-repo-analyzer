import { createClient } from './client.js';
import logger from '../utils/logger.js';

// Reponun temel bilgilerini GitHub API uzerinden getirir.
// Repo adi, aciklamasi, dili, lisansi ve topic'leri iceren bir obje doner.
async function getRepoInfo(owner, repo) {
  const octokit = createClient();

  try {
    const { data } = await octokit.repos.get({ owner, repo });

    return {
      name: data.name,
      fullName: data.full_name,
      description: data.description || '',
      language: data.language || 'Bilinmiyor',
      license: data.license?.spdx_id || 'Belirtilmemis',
      topics: data.topics || [],
      defaultBranch: data.default_branch,
      stars: data.stargazers_count,
      forks: data.forks_count,
      isPrivate: data.private,
      homepage: data.homepage || '',
    };
  } catch (err) {
    if (err.status === 404) {
      throw new Error(
        'Repo bulunamadi. URL\'yi kontrol edin veya private repo icin .env dosyasina GITHUB_TOKEN ekleyin.'
      );
    }
    if (err.status === 403) {
      throw new Error(
        'API limit asildi. Daha fazla istek icin .env dosyasina GITHUB_TOKEN ekleyin.'
      );
    }
    throw new Error(`GitHub API hatasi: ${err.message}`);
  }
}

// Reponun dosya agacini recursive olarak getirir.
// Her dosyanin yolu ve tipini iceren bir liste doner.
async function getRepoTree(owner, repo, branch) {
  const octokit = createClient();

  try {
    const { data } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: branch,
      recursive: '1',
    });

    // Gereksiz buyuklugu onlemek icin sadece yol ve tip bilgisini aliyoruz
    return data.tree.map((item) => ({
      path: item.path,
      type: item.type, // blob = dosya, tree = klasor
      size: item.size || 0,
    }));
  } catch (err) {
    logger.warning(`Dosya agaci alinamadi: ${err.message}`);
    return [];
  }
}

// Belirli bir dosyanin icerigini repo'dan ceker.
// GitHub API base64 olarak dondurdugu icin decode ediyoruz.
// Buyuk dosyalar icin (1MB uzerindeki) Blobs API'sine duser.
async function getFileContent(owner, repo, path, treeSha) {
  const octokit = createClient();

  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    // Dosya icerigini base64'ten cozuyoruz
    if (data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }

    // Icerik yoksa ama sha varsa Blobs API'sini deniyoruz.
    // Bu durum genellikle 1MB'den buyuk dosyalarda olusur.
    if (data.sha) {
      return await getFileContentViaBlob(octokit, owner, repo, data.sha);
    }

    return null;
  } catch (err) {
    // 403 Too Large hatasi alirsa Blobs API ile tekrar deniyoruz
    if (err.status === 403 && treeSha) {
      logger.dim(`${path} buyuk dosya, alternatif yontemle aliniyor...`);
      try {
        return await getFileContentViaBlobByPath(octokit, owner, repo, path, treeSha);
      } catch {
        return null;
      }
    }
    // Dosya bulunamazsa sessizce null donuyoruz, bu beklenen bir durum
    return null;
  }
}

// Blobs API uzerinden dosya icerigini getirir.
// Contents API 1MB sinirini astiginda bu yontem devreye girer.
// Blobs API 100MB'a kadar dosyalari destekliyor.
async function getFileContentViaBlob(octokit, owner, repo, sha) {
  try {
    const { data } = await octokit.git.getBlob({
      owner,
      repo,
      file_sha: sha,
    });

    if (data.content && data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }

    return data.content || null;
  } catch {
    return null;
  }
}

// Dosya yolundan once tree'de sha'yi bulup sonra Blobs API ile icerigini getirir.
// Contents API basarisiz olup sadece dosya yolunu bildigimiz durumlarda kullanilir.
async function getFileContentViaBlobByPath(octokit, owner, repo, path, treeSha) {
  const { data: treeData } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: treeSha,
    recursive: '1',
  });

  const entry = treeData.tree.find((item) => item.path === path && item.type === 'blob');
  if (!entry) return null;

  return await getFileContentViaBlob(octokit, owner, repo, entry.sha);
}

// Birden fazla dosyanin icerigini paralel olarak ceker.
// Her dosya icin path ve content iceren bir obje dizisi doner.
// treeSha parametresi buyuk dosyalarda fallback icin kullanilir.
async function getMultipleFiles(owner, repo, paths, treeSha) {
  const results = await Promise.allSettled(
    paths.map(async (path) => {
      const content = await getFileContent(owner, repo, path, treeSha);
      return { path, content };
    })
  );

  // Basarili olan sonuclari filtrele, icerigi null olanlari cikart
  return results
    .filter((r) => r.status === 'fulfilled' && r.value.content !== null)
    .map((r) => r.value);
}

export { getRepoInfo, getRepoTree, getFileContent, getMultipleFiles };
