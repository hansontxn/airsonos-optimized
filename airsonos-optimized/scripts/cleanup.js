#!/usr/bin/env node

/**
 * Cleanup and Uninstall Script for AirSonos Optimized
 * 
 * This script handles cleanup operations and complete uninstallation
 * of AirSonos Optimized, including data backup and restoration.
 * 
 * Usage:
 *   node scripts/cleanup.js [options]
 *   npm run uninstall
 * 
 * Options:
 *   --uninstall           Complete uninstallation (removes everything)
 *   --pre-uninstall       Pre-uninstall cleanup (backup data)
 *   --data-only           Clean only user data and logs
 *   --temp-only           Clean only temporary files
 *   --backup              Create backup before cleanup
 *   --restore <backup>    Restore from backup file
 *   --force               Skip confirmation prompts
 *   --dry-run            Show what would be cleaned without doing it
 *   --verbose            Enable verbose output
 *   --help               Show help message
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

class CleanupManager {
    constructor(options = {}) {
        this.options = {
            uninstall: options.uninstall || false,
            preUninstall: options.preUninstall || false,
            dataOnly: options.dataOnly || false,
            tempOnly: options.tempOnly || false,
            backup: options.backup || false,
            restore: options.restore || null,
            force: options.force || false,
            dryRun: options.dryRun || false,
            verbose: options.verbose || false,
            ...options
        };
        
        this.projectRoot = path.join(__dirname, '..');
        this.backupDir = path.join(this.projectRoot, '.backups');
        this.stats = {
            filesRemoved: 0,
            directoriesRemoved: 0,
            backupsCreated: 0,
            errors: 0,
            totalSize: 0
        };
        
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async cleanup() {
        try {
            this.log('🧹 Starting AirSonos Optimized cleanup...');
            
            if (this.options.dryRun) {
                this.log('📋 DRY RUN MODE - No files will be deleted');
            }
            
            // Handle restore operation
            if (this.options.restore) {
                await this.restoreFromBackup(this.options.restore);
                return;
            }
            
            // Create backup if requested or if doing major cleanup
            if (this.options.backup || this.options.uninstall || this.options.preUninstall) {
                await this.createBackup();
            }
            
            // Pre-uninstall operations
            if (this.options.preUninstall) {
                await this.preUninstallCleanup();
            }
            
            // Complete uninstallation
            if (this.options.uninstall) {
                await this.completeUninstall();
            }
            
            // Data-only cleanup
            if (this.options.dataOnly) {
                await this.cleanUserData();
            }
            
            // Temp-only cleanup
            if (this.options.tempOnly) {
                await this.cleanTempFiles();
            }
            
            // Default cleanup if no specific option provided
            if (!this.options.uninstall && !this.options.preUninstall && 
                !this.options.dataOnly && !this.options.tempOnly) {
                await this.defaultCleanup();
            }
            
            this.printSummary();
            
        } catch (error) {
            this.log(`❌ Cleanup failed: ${error.message}`);
            if (this.options.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        } finally {
            this.rl.close();
        }
    }

    async preUninstallCleanup() {
        this.log('📦 Running pre-uninstall cleanup...');
        
        // Stop any running services
        await this.stopServices();
        
        // Create comprehensive backup
        await this.backupUserData();
        
        // Clean temporary files
        await this.cleanTempFiles();
        
        // Save uninstall information
        await this.saveUninstallInfo();
        
        this.log('✅ Pre-uninstall cleanup completed');
    }

    async completeUninstall() {
        this.log('🗑️  Performing complete uninstallation...');
        
        if (!this.options.force) {
            const confirm = await this.askConfirmation(
                'This will completely remove AirSonos Optimized and all its data. Continue?'
            );
            
            if (!confirm) {
                this.log('Uninstallation cancelled');
                return;
            }
        }
        
        // Stop services
        await this.stopServices();
        
        // Remove user data
        await this.cleanUserData();
        
        // Remove configuration files
        await this.removeConfigurationFiles();
        
        // Remove application files
        await this.removeApplicationFiles();
        
        // Clean system integrations
        await this.cleanSystemIntegrations();
        
        // Remove package
        await this.removePackage();
        
        this.log('✅ Complete uninstallation finished');
    }

    async defaultCleanup() {
        this.log('🧽 Running default cleanup...');
        
        // Clean build artifacts
        await this.cleanBuildArtifacts();
        
        // Clean temporary files
        await this.cleanTempFiles();
        
        // Clean logs
        await this.cleanLogFiles();
        
        // Clean caches
        await this.cleanCaches();
        
        this.log('✅ Default cleanup completed');
    }

    async stopServices() {
        this.log('⏹️  Stopping services...');
        
        try {
            // Check if service is running via PM2
            try {
                execSync('pm2 stop airsonos-optimized', { stdio: 'pipe' });
                this.log('✓ Stopped PM2 service');
            } catch (error) {
                // PM2 not used or service not running
            }
            
            // Check for systemd service
            if (process.platform === 'linux') {
                try {
                    execSync('systemctl stop airsonos-optimized', { stdio: 'pipe' });
                    this.log('✓ Stopped systemd service');
                } catch (error) {
                    // Service not installed or not running
                }
            }
            
            // Kill any running processes
            try {
                execSync('pkill -f "airsonos"', { stdio: 'pipe' });
                this.log('✓ Terminated running processes');
            } catch (error) {
                // No processes running
            }
            
        } catch (error) {
            this.warn(`Failed to stop some services: ${error.message}`);
        }
    }

    async createBackup() {
        this.log('💾 Creating backup...');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `airsonos-backup-${timestamp}`;
        const backupPath = path.join(this.backupDir, backupName);
        
        if (!this.options.dryRun) {
            await fs.mkdir(this.backupDir, { recursive: true });
            await fs.mkdir(backupPath, { recursive: true });
        }
        
        // Backup user data
        await this.backupUserData(backupPath);
        
        // Backup configuration
        await this.backupConfiguration(backupPath);
        
        // Create backup manifest
        const manifest = {
            created: new Date().toISOString(),
            version: '0.3.0',
            platform: process.platform,
            arch: process.arch,
            files: []
        };
        
        if (!this.options.dryRun) {
            await fs.writeFile(
                path.join(backupPath, 'manifest.json'),
                JSON.stringify(manifest, null, 2)
            );
        }
        
        this.stats.backupsCreated++;
        this.log(`✓ Backup created: ${backupName}`);
        
        return backupPath;
    }

    async backupUserData(backupPath = null) {
        if (!backupPath) {
            backupPath = await this.createBackup();
        }
        
        const dataFiles = [
            '/data/airsonos_config.json',
            '/data/airsonos_optimized_config.json',
            '/data/dashboard_config.json',
            '/config/airsonos.json'
        ];
        
        for (const file of dataFiles) {
            try {
                const srcPath = path.join(this.projectRoot, file);
                const destPath = path.join(backupPath, 'data', path.basename(file));
                
                if (!this.options.dryRun) {
                    await fs.mkdir(path.dirname(destPath), { recursive: true });
                    await fs.copyFile(srcPath, destPath);
                }
                
                this.log(`✓ Backed up: ${file}`);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    this.warn(`Failed to backup ${file}: ${error.message}`);
                }
            }
        }
    }

    async backupConfiguration(backupPath) {
        const configFiles = [
            'config.yaml',
            'config/options.json',
            'config/services.yaml',
            'translations/en.json'
        ];
        
        for (const file of configFiles) {
            try {
                const srcPath = path.join(this.projectRoot, file);
                const destPath = path.join(backupPath, 'config', file);
                
                if (!this.options.dryRun) {
                    await fs.mkdir(path.dirname(destPath), { recursive: true });
                    await fs.copyFile(srcPath, destPath);
                }
                
                this.log(`✓ Backed up config: ${file}`);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    this.warn(`Failed to backup config ${file}: ${error.message}`);
                }
            }
        }
    }

    async restoreFromBackup(backupPath) {
        this.log(`📥 Restoring from backup: ${backupPath}`);
        
        const fullBackupPath = path.resolve(backupPath);
        
        try {
            // Verify backup exists and is valid
            const manifestPath = path.join(fullBackupPath, 'manifest.json');
            const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
            
            this.log(`Backup created: ${manifest.created}`);
            this.log(`Backup version: ${manifest.version}`);
            
            if (!this.options.force) {
                const confirm = await this.askConfirmation(
                    'This will overwrite current configuration. Continue?'
                );
                
                if (!confirm) {
                    this.log('Restore cancelled');
                    return;
                }
            }
            
            // Restore data files
            await this.restoreDataFiles(fullBackupPath);
            
            // Restore configuration files
            await this.restoreConfigFiles(fullBackupPath);
            
            this.log('✅ Restore completed successfully');
            
        } catch (error) {
            throw new Error(`Restore failed: ${error.message}`);
        }
    }

    async restoreDataFiles(backupPath) {
        const dataBackupPath = path.join(backupPath, 'data');
        
        try {
            const files = await fs.readdir(dataBackupPath);
            
            for (const file of files) {
                const srcPath = path.join(dataBackupPath, file);
                const destPath = path.join(this.projectRoot, 'data', file);
                
                await fs.mkdir(path.dirname(destPath), { recursive: true });
                await fs.copyFile(srcPath, destPath);
                
                this.log(`✓ Restored: data/${file}`);
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                this.warn(`Failed to restore data files: ${error.message}`);
            }
        }
    }

    async restoreConfigFiles(backupPath) {
        const configBackupPath = path.join(backupPath, 'config');
        
        try {
            const files = await this.getAllFiles(configBackupPath);
            
            for (const file of files) {
                const relativePath = path.relative(configBackupPath, file);
                const destPath = path.join(this.projectRoot, relativePath);
                
                await fs.mkdir(path.dirname(destPath), { recursive: true });
                await fs.copyFile(file, destPath);
                
                this.log(`✓ Restored: ${relativePath}`);
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                this.warn(`Failed to restore config files: ${error.message}`);
            }
        }
    }

    async cleanUserData() {
        this.log('🗂️  Cleaning user data...');
        
        const dataDirs = [
            'data',
            'logs',
            'test-results',
            'coverage',
            '.backups'
        ];
        
        for (const dir of dataDirs) {
            await this.removeDirectory(dir);
        }
        
        const dataFiles = [
            '*.log',
            'airsonos.json',
            'dashboard_config.json',
            '.env.local'
        ];
        
        for (const pattern of dataFiles) {
            await this.removeByPattern(pattern);
        }
    }

    async cleanTempFiles() {
        this.log('🗃️  Cleaning temporary files...');
        
        const tempDirs = [
            '.tmp',
            'tmp',
            'temp',
            '.build-temp',
            'node_modules/.cache'
        ];
        
        for (const dir of tempDirs) {
            await this.removeDirectory(dir);
        }
        
        const tempPatterns = [
            '*.tmp',
            '*.temp',
            '.DS_Store',
            'Thumbs.db',
            '*.swp',
            '*.swo',
            '*~'
        ];
        
        for (const pattern of tempPatterns) {
            await this.removeByPattern(pattern);
        }
    }

    async cleanBuildArtifacts() {
        this.log('🏗️  Cleaning build artifacts...');
        
        const buildDirs = [
            'lib',
            'dist',
            'build',
            'bin'
        ];
        
        for (const dir of buildDirs) {
            await this.removeDirectory(dir);
        }
        
        const buildFiles = [
            'build-info.json',
            '.babelrc.json',
            'tsconfig.tsbuildinfo'
        ];
        
        for (const file of buildFiles) {
            await this.removeFile(file);
        }
    }

    async cleanLogFiles() {
        this.log('📝 Cleaning log files...');
        
        const logPatterns = [
            '*.log',
            'logs/**/*',
            'test-results/**/*'
        ];
        
        for (const pattern of logPatterns) {
            await this.removeByPattern(pattern);
        }
    }

    async cleanCaches() {
        this.log('💾 Cleaning caches...');
        
        const cacheDirs = [
            '.npm',
            '.yarn',
            '.cache',
            '.jest-cache',
            '.babel-cache',
            '.eslintcache'
        ];
        
        for (const dir of cacheDirs) {
            await this.removeDirectory(dir);
        }
    }

    async removeConfigurationFiles() {
        this.log('⚙️  Removing configuration files...');
        
        const configFiles = [
            'config.yaml',
            'config/options.json',
            'config/services.yaml',
            'translations/en.json',
            'apparmor.txt'
        ];
        
        for (const file of configFiles) {
            await this.removeFile(file);
        }
        
        await this.removeDirectory('config');
        await this.removeDirectory('translations');
    }

    async removeApplicationFiles() {
        this.log('📱 Removing application files...');
        
        const appFiles = [
            'package.json',
            'README.md',
            'CHANGELOG.md',
            'DOCS.md',
            'LICENSE',
            'run.sh'
        ];
        
        for (const file of appFiles) {
            await this.removeFile(file);
        }
        
        const appDirs = [
            'src',
            'lib',
            'scripts',
            'test',
            '.github'
        ];
        
        for (const dir of appDirs) {
            await this.removeDirectory(dir);
        }
    }

    async cleanSystemIntegrations() {
        this.log('🔗 Cleaning system integrations...');
        
        // Remove systemd service (Linux)
        if (process.platform === 'linux') {
            try {
                const servicePath = '/etc/systemd/system/airsonos-optimized.service';
                if (!this.options.dryRun) {
                    await fs.unlink(servicePath);
                }
                this.log('✓ Removed systemd service');
            } catch (error) {
                // Service file doesn't exist
            }
        }
        
        // Remove PM2 service
        try {
            if (!this.options.dryRun) {
                execSync('pm2 delete airsonos-optimized', { stdio: 'pipe' });
            }
            this.log('✓ Removed PM2 service');
        } catch (error) {
            // PM2 service doesn't exist
        }
    }

    async removePackage() {
        this.log('📦 Removing package...');
        
        try {
            if (!this.options.dryRun) {
                // If installed globally, try to uninstall
                try {
                    execSync('npm uninstall -g airsonos-optimized', { stdio: 'pipe' });
                    this.log('✓ Uninstalled global package');
                } catch (error) {
                    // Not installed globally
                }
                
                // Remove node_modules
                await this.removeDirectory('node_modules');
                await this.removeFile('package-lock.json');
                await this.removeFile('yarn.lock');
            }
        } catch (error) {
            this.warn(`Failed to remove package: ${error.message}`);
        }
    }

    async saveUninstallInfo() {
        const uninstallInfo = {
            timestamp: new Date().toISOString(),
            version: '0.3.0',
            platform: process.platform,
            arch: process.arch,
            removedFiles: this.stats.filesRemoved,
            removedDirectories: this.stats.directoriesRemoved
        };
        
        if (!this.options.dryRun) {
            await fs.writeFile(
                path.join(this.backupDir, 'uninstall-info.json'),
                JSON.stringify(uninstallInfo, null, 2)
            );
        }
    }

    async removeDirectory(dirPath) {
        const fullPath = path.join(this.projectRoot, dirPath);
        
        try {
            if (!this.options.dryRun) {
                const size = await this.getDirectorySize(fullPath);
                await fs.rm(fullPath, { recursive: true, force: true });
                this.stats.totalSize += size;
            }
            
            this.stats.directoriesRemoved++;
            this.log(`✓ Removed directory: ${dirPath}`);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                this.warn(`Failed to remove directory ${dirPath}: ${error.message}`);
                this.stats.errors++;
            }
        }
    }

    async removeFile(filePath) {
        const fullPath = path.join(this.projectRoot, filePath);
        
        try {
            if (!this.options.dryRun) {
                const stats = await fs.stat(fullPath);
                await fs.unlink(fullPath);
                this.stats.totalSize += stats.size;
            }
            
            this.stats.filesRemoved++;
            this.log(`✓ Removed file: ${filePath}`);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                this.warn(`Failed to remove file ${filePath}: ${error.message}`);
                this.stats.errors++;
            }
        }
    }

    async removeByPattern(pattern) {
        // Simple glob implementation
        const glob = require('glob');
        const fullPattern = path.join(this.projectRoot, pattern);
        
        try {
            const files = glob.sync(fullPattern);
            
            for (const file of files) {
                const relativePath = path.relative(this.projectRoot, file);
                
                try {
                    const stats = await fs.stat(file);
                    
                    if (stats.isDirectory()) {
                        await this.removeDirectory(relativePath);
                    } else {
                        await this.removeFile(relativePath);
                    }
                } catch (error) {
                    this.warn(`Failed to remove ${relativePath}: ${error.message}`);
                    this.stats.errors++;
                }
            }
        } catch (error) {
            this.warn(`Failed to process pattern ${pattern}: ${error.message}`);
        }
    }

    async getDirectorySize(dirPath) {
        let totalSize = 0;
        
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const entryPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    totalSize += await this.getDirectorySize(entryPath);
                } else if (entry.isFile()) {
                    const stats = await fs.stat(entryPath);
                    totalSize += stats.size;
                }
            }
        } catch (error) {
            // Directory doesn't exist or permission denied
        }
        
        return totalSize;
    }

    async getAllFiles(dirPath) {
        const files = [];
        
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const entryPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    files.push(...await this.getAllFiles(entryPath));
                } else {
                    files.push(entryPath);
                }
            }
        } catch (error) {
            // Directory doesn't exist
        }
        
        return files;
    }

    async askConfirmation(question) {
        return new Promise((resolve) => {
            this.rl.question(`${question} (y/N): `, (answer) => {
                resolve(answer.toLowerCase().startsWith('y'));
            });
        });
    }

    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    log(message) {
        if (this.options.verbose || !message.startsWith('✓')) {
            console.log(`[CLEANUP] ${message}`);
        }
    }

    warn(message) {
        console.warn(`[CLEANUP WARN] ${message}`);
    }

    printSummary() {
        console.log('\n📊 Cleanup Summary:');
        console.log(`   Files removed: ${this.stats.filesRemoved}`);
        console.log(`   Directories removed: ${this.stats.directoriesRemoved}`);
        console.log(`   Backups created: ${this.stats.backupsCreated}`);
        console.log(`   Errors: ${this.stats.errors}`);
        console.log(`   Space reclaimed: ${this.formatSize(this.stats.totalSize)}`);
        
        if (this.options.dryRun) {
            console.log('   ℹ️  This was a dry run - no files were actually deleted');
        }
        
        if (this.options.uninstall) {
            console.log('\n🎯 AirSonos Optimized has been completely uninstalled');
            console.log('   Backups are available in .backups/ directory');
        } else {
            console.log('\n✅ Cleanup completed successfully');
        }
    }
}

// CLI interface
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
            case '--uninstall':
                options.uninstall = true;
                break;
            case '--pre-uninstall':
                options.preUninstall = true;
                break;
            case '--data-only':
                options.dataOnly = true;
                break;
            case '--temp-only':
                options.tempOnly = true;
                break;
            case '--backup':
                options.backup = true;
                break;
            case '--restore':
                options.restore = args[++i];
                break;
            case '--force':
                options.force = true;
                break;
            case '--dry-run':
                options.dryRun = true;
                break;
            case '--verbose':
                options.verbose = true;
                break;
            case '--help':
                showUsage();
                process.exit(0);
                break;
            default:
                if (arg.startsWith('--')) {
                    console.warn(`Unknown option: ${arg}`);
                }
                break;
        }
    }
    
    return options;
}

function showUsage() {
    console.log(`
AirSonos Optimized Cleanup and Uninstall Script

Usage: node scripts/cleanup.js [options]

Options:
  --uninstall           Complete uninstallation (removes everything)
  --pre-uninstall       Pre-uninstall cleanup (backup data)
  --data-only           Clean only user data and logs
  --temp-only           Clean only temporary files
  --backup              Create backup before cleanup
  --restore <backup>    Restore from backup file
  --force               Skip confirmation prompts
  --dry-run            Show what would be cleaned without doing it
  --verbose            Enable verbose output
  --help               Show this help message

Examples:
  node scripts/cleanup.js                    # Default cleanup
  node scripts/cleanup.js --uninstall        # Complete uninstallation
  node scripts/cleanup.js --backup           # Create backup only
  node scripts/cleanup.js --data-only        # Clean user data only
  node scripts/cleanup.js --restore backup/  # Restore from backup

Warning: --uninstall will permanently remove AirSonos Optimized
`);
}

// Run if called directly
if (require.main === module) {
    const options = parseArgs();
    const cleanup = new CleanupManager(options);
    cleanup.cleanup();
}

module.exports = { CleanupManager };