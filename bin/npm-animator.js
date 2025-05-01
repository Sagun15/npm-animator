#!/usr/bin/env node

const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

async function main() {
  try {
    const npmWrapperPath = path.join(__dirname, '../lib/npm-wrapper');
    const { executeNpmCommand } = require(npmWrapperPath);

    const argv = yargs(hideBin(process.argv))
      .option('theme', {
        alias: 't',
        type: 'string',
        description: 'Animation theme to use',
        choices: ['default', 'rainbow', 'matrix', 'minimal', 'elegant'],
        default: 'default'
      })
      .option('quiet', {
        alias: 'q',
        type: 'boolean',
        description: 'Disable animations',
        default: false
      })
      .option('dry-run', {
        alias: 'd',
        type: 'boolean',
        description: 'Run without making changes',
        default: false
      })
      .help()
      .argv;

    const npmArgs = argv._;
    const command = npmArgs[0] || 'help';
    
    let commandArgs = npmArgs.slice(1);
    
    const dryRunIndex = commandArgs.findIndex(arg => 
      arg === '--dry-run' || arg === '--dry-run=true');
    
    let hasDryRunFlag = dryRunIndex >= 0 || argv['dry-run'] === true;
    
    const useAnimation = !argv.quiet && process.stdout.isTTY;

    const animatableCommands = [
      'install', 'i', 'add', 'update', 'audit', 'fund', 'ci', 'clean-install'
    ];
    
    const shouldAnimate = useAnimation && (animatableCommands.includes(command) || hasDryRunFlag);

    await executeNpmCommand({
      command,
      args: commandArgs,
      options: {
        ...argv,
        isDryRun: hasDryRunFlag
      },
      useAnimation: shouldAnimate,
      theme: argv.theme
    });
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error executing npm-animator:', error.message);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unhandled error:', error.message);
  process.exit(1);
});