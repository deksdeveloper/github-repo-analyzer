import 'dotenv/config';

// Uygulama yapilandirmasi. Env degiskenlerini yukleyip
// gerekli alanlarin tanimli olup olmadigini kontrol eder.

const config = {
  fireworks: {
    apiKey: process.env.FIREWORKS_API_KEY || '',
    model: process.env.FIREWORKS_MODEL || 'accounts/fireworks/models/minimax-m2p7',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
  },
  github: {
    token: process.env.GITHUB_TOKEN || '',
  },
};

// API key olmadan uygulama calisamaz, bunu baslatirken kontrol ediyoruz
function validateConfig() {
  const missing = [];

  if (!config.fireworks.apiKey) {
    missing.push('FIREWORKS_API_KEY');
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

export { config, validateConfig };
