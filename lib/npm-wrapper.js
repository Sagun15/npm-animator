const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

const Animator = require(path.join(__dirname, './animator'));

function executeNpmCommand({ command, args, options, useAnimation, theme = 'rainbow' }) {
  const displayCommand = `npm ${command} ${args.join(' ')}`.trim();
  
  const hasDryRun = args.some(arg => arg === '--dry-run' || arg === '--dry-run=true') || 
                   (options && (options.isDryRun || options.dryRun));
  
  if (!useAnimation) {
    return runNpmDirectly(command, args);
  }
  
  const packageArgs = (command === 'install' || command === 'i' || command === 'add' || command === 'remove' || command === 'uninstall') 
    ? args.filter(arg => !arg.startsWith('-')) 
    : [];
  
  if ((command === 'install' || command === 'i' || command === 'add') && packageArgs.length > 1 && !hasDryRun) {
    return installPackagesOneByOne(command, packageArgs, options, useAnimation, theme);
  }
  
  const timers = [];
  const intervals = [];
  
  const animator = new Animator({
    text: `Running ${displayCommand}`,
    theme: theme,
    width: 40
  }).start();
  
  const initialProgress = hasDryRun ? 0.2 : 0.05;
  animator.updateProgress(initialProgress);
  
  let simulatedProgress = initialProgress;
  
  const interval = hasDryRun ? 150 : 300;
  const increment = hasDryRun ? 0.1 : 0.05;
  
  const progressSimulation = setInterval(() => {
    simulatedProgress = Math.min(0.9, simulatedProgress + increment);
    animator.updateProgress(simulatedProgress);
  }, interval);
  
  intervals.push(progressSimulation);
  
  return new Promise((resolve, reject) => {
    let processCompleted = false;
    let vulnerabilityInfo = null;
    let errorInfo = null;
    
    const packageList = [];
    
    if ((command === 'install' || command === 'i' || command === 'add') && args.length > 0) {
      const packages = args.filter(arg => !arg.startsWith('-'));
      
      if (packages.length > 0) {
        packages.forEach(pkg => packageList.push(pkg));
        
        packages.forEach((pkg, index) => {
          setTimeout(() => {
            animator.updatePackageProgress(pkg, 'pending');
          }, index * 50);
        });
      }
    }
    
    const npmProcess = spawn('npm', [command, ...args], { 
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, npm_config_color: 'always' }
    });
    
    let packageCount = 0;
    let completedCount = 0;
    let installationStarted = false;
    let fullErrorOutput = '';
    
    npmProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      
      const firstLine = output.split('\n')[0].trim();
      if (firstLine && !firstLine.startsWith('+') && !firstLine.startsWith('-')) {
        animator.update(`${firstLine}`);
      }
      
      parseNpmOutput(output, animator);
    });
    
    npmProcess.stderr.on('data', (data) => {
      const output = data.toString().trim();
      
      fullErrorOutput += output + '\n';
      
      const errorPackageMatch = output.match(/(?:error code E404|404 Not Found).*['"]([^'"]+)['"]/);
      if (errorPackageMatch) {
        const errorPackage = errorPackageMatch[1];
        animator.updatePackageProgress(errorPackage, 'failed', 'Not found');
      }
      
      if (output.includes('npm ERR!')) {
        const errorLines = output.split('\n').filter(line => line.includes('npm ERR!'));
        if (errorLines.length > 0) {
          const errorSummary = errorLines[0].replace('npm ERR!', '').trim();
          errorInfo = errorSummary;
          animator.update(`Error: ${errorSummary}`);
        }
      }
      
      parseNpmOutput(output, animator, true);
    });
    
    npmProcess.on('close', (code) => {
      processCompleted = true;
      
      intervals.forEach(interval => clearInterval(interval));
      
      if (code === 0) {
        animator.updateProgress(1.0);
        
        packageList.forEach(pkg => {
          animator.simulatePackageInstallation(pkg);
        });
        
        const timer = setTimeout(() => {
          animator.succeed(`${displayCommand} completed successfully`);
          
          if (vulnerabilityInfo) {
            console.log(`\n${chalk.yellow('⚠')} Security vulnerabilities found:`);
            console.log(`   ${vulnerabilityInfo}`);
            console.log(`   Run ${chalk.cyan('npm audit')} for details.\n`);
          }
          
          setTimeout(() => {
            resolve({ success: true });
          }, 100);
        }, 50);
        
        timers.push(timer);
      } else {
        packageList.forEach(pkg => {
          const packageInfo = animator.getPackageInfo(pkg);
          if (packageInfo && (packageInfo.status === 'pending' || packageInfo.status === 'installing')) {
            if (fullErrorOutput.includes(pkg)) {
              animator.updatePackageProgress(pkg, 'failed', 'Error');
            } else {
              animator.updatePackageProgress(pkg, 'skipped');
            }
          }
        });
        
        const logMatch = fullErrorOutput.match(/A complete log of this run can be found in:\s*([^\n]+)/);
        const logLocation = logMatch ? logMatch[1].trim() : 'npm log';
        
        animator.fail(`${displayCommand} failed with code ${code}`);
        
        if (errorInfo) {
          console.log(`\n${chalk.red('✖')} Error details:`);
          console.log(`   ${errorInfo}`);
          console.log(`   Check ${chalk.cyan(logLocation)} for more details.\n`);
        }
        
        setTimeout(() => {
          reject(new Error(`Command failed with code ${code}`));
        }, 100);
      }
    });
    
    const completionCheck = setInterval(() => {
      if (processCompleted && animator.progress >= 0.9 && animator.progress < 1.0) {
        animator.updateProgress(1.0);
        clearInterval(completionCheck);
      }
    }, 100);
    
    intervals.push(completionCheck);
    
    const exitTimeout = setTimeout(() => {
      timers.forEach(timer => clearTimeout(timer));
      intervals.forEach(interval => clearInterval(interval));
      
      if (!processCompleted) {
        animator.fail(`${displayCommand} timed out`);
        reject(new Error(`Command timed out`));
      } else {
        resolve({ success: false, message: 'Timeout' });
      }
    }, 30000);
    
    timers.push(exitTimeout);
    
    const packageInstallationSimulation = setTimeout(() => {
      if (!installationStarted && packageList.length > 0) {
        installationStarted = true;
        
        packageList.forEach((pkg, index) => {
          setTimeout(() => {
            animator.updatePackageProgress(pkg, 'installing');
            
            setTimeout(() => {
              animator.updatePackageProgress(pkg, 'installed');
            }, 300);
          }, index * 200);
        });
      }
    }, 3000);
    
    timers.push(packageInstallationSimulation);
  
    function parseNpmOutput(output, animator, isError = false) {
      const lines = output.split('\n');
      
      lines.forEach(line => {
        if (line.includes('added ')) {
          const match = line.match(/added (\d+) packages/);
          if (match) {
            packageCount = parseInt(match[1], 10);
            animator.update(`Adding ${packageCount} packages...`);
            
            installationStarted = true;
          }
        }
        
        const packagePatterns = [
          { regex: /[+]\s+([^@\s]+)(@[^\s]+)?/, status: 'installed' },
          { regex: /added [0-9]+ packages?: ([^@\s]+)(@[^\s]+)?/, status: 'installed' },
          { regex: /changed\s+([^@\s]+)(@[^\s]+)?/, status: 'updated' },
          { regex: /[-]\s+([^@\s]+)(@[^\s]+)?/, status: 'removed' }
        ];
        
        for (const pattern of packagePatterns) {
          const match = line.match(pattern.regex);
          if (match) {
            const packageName = match[1];
            const version = match[2] || '';
            
            installationStarted = true;
            
            const intermediateStatus = 
              pattern.status === 'installed' ? 'installing' :
              pattern.status === 'updated' ? 'updating' :
              pattern.status === 'removed' ? 'removing' : 'processing';
            
            animator.updatePackageProgress(packageName, intermediateStatus);
            
            setTimeout(() => {
              animator.updatePackageProgress(packageName, pattern.status, version.replace('@', ''));
              completedCount++;
            }, 300);
            
            break;
          }
        }
        
        const installingMatch = line.match(/installing\s+([^@\s]+)(@[^\s]+)?/i);
        if (installingMatch) {
          const packageName = installingMatch[1];
          animator.updatePackageProgress(packageName, 'installing');
          installationStarted = true;
        }
        
        const notFoundMatch = line.match(/404 Not Found.*[\/:]([^\/:\s]+)$/);
        if (notFoundMatch) {
          const packageName = notFoundMatch[1];
          animator.updatePackageProgress(packageName, 'failed', 'Not found');
        }
        
        if (line.includes('vulnerabilities')) {
          animator.update(`Checking for vulnerabilities: ${line.trim()}`);
          
          vulnerabilityInfo = line.trim();
        }
        
        if (isError && line.length > 3) {
          animator.update(`Error: ${line.trim()}`);
        }
      });
    }
  });
}

async function installPackagesOneByOne(command, packages, options, useAnimation, theme) {
  const animator = new Animator({
    text: `Preparing to install ${packages.length} packages`,
    theme: theme,
    width: 40
  }).start();
  
  const results = { success: [], failed: [] };
  let currentPackageIndex = 0;
  
  packages.forEach((pkg, index) => {
    setTimeout(() => {
      animator.updatePackageProgress(pkg, 'pending');
    }, index * 50);
  });
  
  animator.updateProgress(0.05);
  
  for (const pkg of packages) {
    currentPackageIndex++;
    const progress = currentPackageIndex / packages.length;
    
    animator.update(`Installing package ${currentPackageIndex}/${packages.length}: ${pkg}`);
    animator.updateProgress(progress * 0.9);
    
    animator.updatePackageProgress(pkg, 'installing');
    
    try {
      const args = [pkg, ...(options?.isDryRun ? ['--dry-run'] : [])];
      
      await runNpmDirectly(command, args);
      
      animator.updatePackageProgress(pkg, 'installed');
      results.success.push(pkg);
    } catch (error) {
      animator.updatePackageProgress(pkg, 'failed', error.message);
      results.failed.push({ package: pkg, error: error.message });
    }
  }
  
  animator.updateProgress(1.0);
  
  if (results.failed.length === 0) {
    animator.succeed(`Successfully installed all ${packages.length} packages`);
  } else {
    animator.succeed(`Installed ${results.success.length} packages (${results.failed.length} failed)`);
    
    if (results.failed.length > 0) {
      console.log(`\n${chalk.red('✖')} Failed packages:`);
      results.failed.forEach(failedPkg => {
        console.log(`   ${chalk.bold(failedPkg.package)}: ${failedPkg.error || 'Unknown error'}`);
      });
      console.log('');
    }
  }
  
  return results;
}

function runNpmDirectly(command, args) {
  const npmProcess = spawn('npm', [command, ...args], { 
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env }
  });
  
  let errorOutput = '';
  
  npmProcess.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });
  
  return new Promise((resolve, reject) => {
    npmProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(errorOutput.trim() || `npm exited with code ${code}`));
      }
    });
  });
}

module.exports = { executeNpmCommand };