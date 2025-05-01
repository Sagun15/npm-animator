const chalk = require('chalk');
const logUpdate = require('log-update');
const stringWidth = require('string-width');
const figures = require('figures');
const fs = require('fs');
const path = require('path');

class Animator {
  constructor(options = {}) {
    this.options = {
      text: options.text || 'Working...',
      theme: options.theme || 'rainbow',
      width: options.width || 30,
      maxPackagesToShow: options.maxPackagesToShow || 5,
      ...options
    };

    this.startTime = Date.now();
    this.progress = 0;
    this.packageUpdates = new Map();
    this.interval = null;
    this.completed = false;
    this.lastRender = 0;
    this.simulations = new Map();

    this.rainbowColors = [
      'red', 'redBright',
      'yellow', 'yellowBright',
      'green', 'greenBright',
      'cyan', 'cyanBright',
      'blue', 'blueBright',
      'magenta', 'magentaBright'
    ];

    this.colorOffset = 0;
  }

  start() {
    this.startTime = Date.now();

    this.interval = setInterval(() => {
      this._renderProgress();
      this.colorOffset = (this.colorOffset + 1) % this.rainbowColors.length;
      
      const now = Date.now();
      if (now - this.lastRender > 1000 && this.progress < 0.9 && !this.completed) {
        this.updateProgress(this.progress + 0.05);
        this.lastRender = now;
      }
    }, 50);

    return this;
  }

  update(text) {
    if (!this.completed) {
      this.options.text = text;
    }
    return this;
  }

  updateProgress(progress) {
    const newProgress = Math.min(Math.max(progress, 0), 1);
    this.progress = newProgress;
    this.lastRender = Date.now();
    
    this._renderProgress();
    
    return this;
  }

  getPackageInfo(packageName) {
    return this.packageUpdates.get(packageName);
  }

  updatePackageProgress(packageName, status, details = '') {
    if (this.completed) return this;

    this.packageUpdates.set(packageName, {
      status,
      details,
      timestamp: Date.now()
    });

    const totalPackages = this.packageUpdates.size;
    const completedPackages = Array.from(this.packageUpdates.values())
      .filter(info => ['installed', 'updated', 'removed', 'failed', 'skipped'].includes(info.status))
      .length;

    if (totalPackages > 0) {
      const progressValue = completedPackages / totalPackages;
      if (progressValue > this.progress) {
        this.updateProgress(progressValue);
      }
    }

    return this;
  }

  simulatePackageInstallation(packageName) {
    const packageInfo = this.packageUpdates.get(packageName);
    if (!packageInfo || packageInfo.status !== 'pending') {
      return this;
    }
    
    this.updatePackageProgress(packageName, 'installing');
    
    const timer = setTimeout(() => {
      this.updatePackageProgress(packageName, 'installed');
    }, 300);
    
    this.simulations.set(packageName, timer);
    
    return this;
  }

  completePendingPackages() {
    let pendingPackages = [];
    this.packageUpdates.forEach((info, packageName) => {
      if (info.status === 'pending') {
        pendingPackages.push(packageName);
      }
    });
    
    if (pendingPackages.length > 0) {
      pendingPackages.forEach((packageName, index) => {
        setTimeout(() => {
          this.simulatePackageInstallation(packageName);
        }, index * 100);
      });
    }
  }

  _renderProgress() {
    if (this.completed) return;

    const terminalWidth = process.stdout.columns || 80;
    const barWidth = Math.min(this.options.width, terminalWidth - 20);
    const completedWidth = Math.round(barWidth * this.progress);
    const remainingWidth = barWidth - completedWidth;

    let progressBar = '';

    for (let i = 0; i < completedWidth; i++) {
      const colorIndex = (i + this.colorOffset) % this.rainbowColors.length;
      const color = this.rainbowColors[colorIndex];
      progressBar += chalk[color]('█');
    }

    progressBar += chalk.gray('░'.repeat(remainingWidth));

    const percent = Math.round(this.progress * 100);
    const percentText = chalk.bold(`${percent}%`);

    let outputLines = [
      `${progressBar} ${percentText} ${this.options.text}`
    ];

    const maxPackagesToShow = this.options.maxPackagesToShow;
    
    let packageUpdates = Array.from(this.packageUpdates.entries());
    
    const statusOrder = {
      'installing': 1,
      'updating': 2,
      'removing': 3,
      'failed': 0,
      'pending': 4,
      'installed': 5,
      'updated': 6,
      'removed': 7,
      'skipped': 8
    };
    
    packageUpdates.sort((a, b) => {
      const statusDiff = (statusOrder[a[1].status] || 99) - (statusOrder[b[1].status] || 99);
      if (statusDiff !== 0) return statusDiff;
      
      return b[1].timestamp - a[1].timestamp;
    });
    
    const recentUpdates = packageUpdates.slice(0, maxPackagesToShow);

    if (recentUpdates.length > 0) {
      outputLines.push('');
      recentUpdates.forEach(([packageName, info]) => {
        const statusColor = this._getStatusColor(info.status);
        const bullet = chalk[statusColor](figures.pointer);
        const status = chalk[statusColor](info.status);
        const details = info.details ? ` (${info.details})` : '';

        const maxNameLength = terminalWidth - stringWidth(status) - stringWidth(details) - 10;
        const displayName = packageName.length > maxNameLength 
          ? packageName.substring(0, maxNameLength - 3) + '...' 
          : packageName;

        outputLines.push(`  ${bullet} ${chalk.bold(displayName)} ${status}${details}`);
      });
      
      if (packageUpdates.length > maxPackagesToShow) {
        const remaining = packageUpdates.length - maxPackagesToShow;
        outputLines.push(`  ${chalk.gray('...')} ${remaining} more package${remaining !== 1 ? 's' : ''}`);
      }
    }

    logUpdate(outputLines.join('\n'));
  }

  _getStatusColor(status) {
    switch (status) {
      case 'installing': return 'yellow';
      case 'updating': return 'blue';
      case 'removing': return 'red';
      case 'pending': return 'gray';
      case 'installed': return 'green';
      case 'updated': return 'cyan';
      case 'removed': return 'magenta';
      case 'failed': return 'red';
      case 'skipped': return 'gray';
      default: return 'gray';
    }
  }

  succeed(message) {
    this.progress = 1.0;
    this._renderProgress();
    
    this._cleanup();
    logUpdate.done();

    const symbol = chalk.green(figures.tick);
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);

    console.log(`\n${symbol} ${message || 'Completed successfully!'} in ${duration}s`);
    this._showSummary('success');

    return this;
  }

  fail(message) {
    this._cleanup();

    logUpdate.done();

    const symbol = chalk.red(figures.cross);
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);

    console.log(`\n${symbol} ${message || 'Operation failed!'} in ${duration}s`);
    this._showSummary('error');

    return this;
  }

  _cleanup() {
    clearInterval(this.interval);
    this.completed = true;
    
    this.simulations.forEach(timer => clearTimeout(timer));
    this.simulations.clear();
  }

  _showSummary(type) {
    const packageCount = this.packageUpdates.size;

    if (packageCount > 0) {
      const statusCount = {};
      for (const [_, info] of this.packageUpdates) {
        statusCount[info.status] = (statusCount[info.status] || 0) + 1;
      }

      console.log(`\nPackage summary:`);
      
      const statusOrder = [
        'installed', 'updated', 'removed', 
        'failed', 'skipped',
        'installing', 'updating', 'removing', 'pending'
      ];
      
      statusOrder.forEach(status => {
        if (statusCount[status]) {
          const color = this._getStatusColor(status);
          const bullet = chalk[color](figures.pointer);
          console.log(`${bullet} ${statusCount[status]} ${statusCount[status] === 1 ? 'package' : 'packages'} ${chalk[color](status)}`);
        }
      });
    }
  }
}

module.exports = Animator;