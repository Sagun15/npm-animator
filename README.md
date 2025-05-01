# npm-animator
Beautiful terminal animations for npm commands with detailed package status tracking.

## Features

- 🌈 Beautiful Progress Bars: Visualize npm operations with rainbow-themed progress
- 📦 Package Status Tracking: See individual packages as they're installed, updated, or removed
- 🔄 Live Updates: Real-time feedback on package operations
- 🛡️ Smart Error Handling: Continues installing valid packages even when some fail
- 🚫 Vulnerability Warnings: Clear display of security vulnerabilities
- 🔍 Detailed Summary: Complete breakdown of all package operations at the end

## Installation
```bash
npm install -g npm-animator
```

## Usage
Use `npm-animator` as a drop-in replacement for npm:
```bash
npm-animator install lodash react redux
npm-animator update express mongoose
npm-animator audit
```

### Supported Commands

- `install` / `i` / `add`
- `update`
- `audit`
- `fund`
- `ci` / `clean-install`
- ...and more!

### Options

`--theme` / `-t`: Animation theme to use (default: 'rainbow')
`--quiet` / `-q`: Disable animations (default: false)
`--dry-run` / `-d`: Test the command without making changes

## Error Handling
When installing multiple packages, npm-animator will:

1. Install packages one by one
2. Continue with valid packages even if some fail
3. Show clear error messages for failed packages
4. Provide a detailed summary at the end

Example:
```bash
npm-animator install lodash invalid-package react

✔ Installed 2 packages (1 failed) in 3.25s

Package summary:
❯ 2 packages installed
❯ 1 package failed

✖ Failed packages:
   invalid-package: 404 Not Found - Package does not exist
```

## Vulnerability Warnings
When security vulnerabilities are found, npm-animator displays clear warnings:
```bash
⚠ Security vulnerabilities found:
   2 vulnerabilities (1 moderate, 1 critical)
   Run npm audit for details.
```

## Project Structure
```bash
npm-animator/
├── bin/
│   └── npm-animator.js      # CLI entry point
├── lib/
│   ├── animator.js          # Animation engine
│   └── npm-wrapper.js       # npm command execution wrapper
├── index.js                 # Main package entry
├── package.json             # Package manifest
└── README.md                # Documentation
```

## Contributing
1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/my-new-feature`
5. Submit a pull request

## License
MIT

## Credits
1. [Chalk](https://github.com/chalk/chalk) - For terminal colors
2. [Log-update](https://github.com/sindresorhus/log-update) - For updating terminal output
3. [Figures](https://github.com/sindresorhus/figures) - For terminal symbols
4. [Yargs](https://github.com/yargs/yargs) - For command-line argument parsing