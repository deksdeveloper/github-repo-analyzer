

# GitHub Repository Analyzer

An AI-powered terminal user interface (TUI) for analyzing GitHub repositories. Generate comprehensive READMEs, .gitignore files, security reports, and more using Fireworks AI.

![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **README Generator** — Automatically generate professional README.md files
- **.gitignore Generator** — Create optimized .gitignore files for any project
- **Security Check** — Scan dependencies for known vulnerabilities
- **Code Quality Report** — Analyze code patterns and best practices
- **Dependency Health** — Review package health and outdated dependencies
- **API Docs Generator** — Generate documentation from API endpoints

## Tech Stack

- **Runtime:** Node.js 18+
- **UI:** Chalk, Figlet, Boxen, Ora, Inquirer
- **AI:** Fireworks AI
- **API:** Octokit (GitHub REST API)

## Installation

```bash
# Clone the repository
git clone https://github.com/deksdeveloper/github-repo-analyzer.git

# Navigate to project directory
cd github-repo-analyzer

# Install dependencies
npm install

# Copy environment template and configure
cp .env.example .env
```

## Configuration

Create a `.env` file in the root directory:

```env
FIREWORKS_API_KEY=your_fireworks_api_key
GITHUB_TOKEN=your_github_token  # Optional, increases rate limits
```

Get your Fireworks AI API key from [fireworks.ai](https://fireworks.ai).

## Usage

```bash
npm start
```

## Project Structure

```
├── src/
│   ├── ai/                 # AI integration
│   │   ├── fireworks.js    # Fireworks AI client
│   │   └── prompts.js      # AI prompt templates
│   ├── config.js           # Configuration management
│   ├── features/           # Core analysis features
│   │   ├── apiDocsGenerator.js
│   │   ├── codeQualityReport.js
│   │   ├── dependencyHealth.js
│   │   ├── gitignoreGenerator.js
│   │   ├── readmeGenerator.js
│   │   └── securityCheck.js
│   ├── github/             # GitHub API integration
│   │   ├── client.js       # Octokit client
│   │   └── repo.js         # Repository data fetching
│   ├── index.js            # Entry point
│   ├── ui/                 # Terminal UI components
│   │   ├── banner.js
│   │   ├── menu.js
│   │   ├── repoInput.js
│   │   └── results.js
│   └── utils/              # Helper utilities
│       ├── chunker.js
│       ├── fileHelpers.js
│       └── logger.js
├── package.json
└── LICENSE
```

## Contributing

Contributions are welcome! Feel free to open issues and pull requests.

## License

MIT License — see [LICENSE](LICENSE) for details.

---
<sub>Generated with ❤️ by <a href="https://github.com/deksdeveloper/github-repo-analyzer">GitHub Repository Analyzer</a></sub>
