import { Octokit } from '@octokit/rest';
import { config } from '../config.js';

// GitHub API istemcisini olusturur.
// Eger .env'de GITHUB_TOKEN tanimliysa authenticated istekler yapilir,
// tanimli degilse sadece public repolara erisim mumkun olur.
function createClient() {
  const options = {
    userAgent: 'github-repo-analyzer/1.0.0',
  };

  if (config.github.token) {
    options.auth = config.github.token;
  }

  return new Octokit(options);
}

export { createClient };
