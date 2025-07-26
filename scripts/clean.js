#!/usr/bin/env node

/**
 * Clean Script for AirSonos Optimized
 * 
 * This script cleans build artifacts, temporary files, and optionally
 * resets the project to a clean state.
 * 
 * Usage:
 *   node scripts/clean.js [options]
 *   npm run clean
 * 
 * Options:
 *   --all              Clean everything including node_modules
 *   --build            Clean build directories only (default)
 *   --cache            Clean npm and build caches
 *   --logs             Clean log files
 *   --temp             Clean temporary files
 *   --verbose          Enable verbose output
 *   --dry-run          Show what would be cleaned without actually cleaning
 *   --help             Show help message
 */

const fs = require('fs').promises;
const path = require('path');

class Cleaner {
    constructor(options = {}) {
        this.options = {
            all: options.all || false,
            build: options.build !== false, // Default true
            cache: options.cache || false,
            logs: options.logs || false,
            temp: options.temp || false,
            verbose: options.verbose || false,
            dryRun: options.dryRun || false,
            ...options
        };
        
        this.projectRoot = path.join(__dirname, '..');
        this.cleanedCount = 0;
        this.failedCount = 0;
        this.totalSize = 0;
    }

    async clean() {
        try {
            this.log('🧹 Starting cleanup process...');
            
            if (this.options.dryRun) {
                this.log('📋 DRY RUN MODE - No files will be deleted');
            }
            
            // Build directories
            if (this.options.build || this.options.all) {
                await this.cleanBuildDirectories();
            }
            
            // Cache directories
            if (this.options.cache || this.options.all) {
                await this.cleanCacheDirectories();
            }
            
            // Log files
            if (this.options.logs || this.options.all) {
                await this.cleanLogFiles();
            }
            
            // Temporary files
            if (this.options.temp || this.options.all) {
                await this.cleanTempFiles();
            }
            
            // Node modules (only with --all)
            if (this.options.all) {
                await this.cleanNodeModules();
            }
            
            this.printSummary();
            
        } catch (error) {
            console.error(`❌ Cleanup failed: ${error.message}`);
            if (this.options.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    async cleanBuildDirectories() {
        this.log('🏗️  Cleaning build directories...');
        
        const buildDirs = [
            'lib',
            'dist',
            'build',
            '.build-temp',
            'bin'
        ];
        
        for (const dir of buildDirs) {
            await this.removeDirectory(dir);
        }
        
        // Clean build artifacts
        const buildFiles = [
            'build-info.json',
            '.babelrc.json',
            'tsconfig.tsbuildinfo'
        ];
        
        for (const file of buildFiles) {
            await this.removeFile(file);
        }
    }

    async cleanCacheDirectories() {
        this.log('💾 Cleaning cache directories...');
        
        const cacheDirs = [
            '.npm',
            '.yarn',
            '.cache',
            'node_modules/.cache',
            '.jest-cache',
            '.babel-cache',
            '.eslintcache'
        ];
        
        for (const dir of cacheDirs) {
            await this.removeDirectory(dir);
        }
        
        // Clean npm cache if available
        if (!this.options.dryRun) {
            try {
                const { execSync } = require('child_process');
                execSync('npm cache clean --force', { stdio: 'pipe' });
                this.log('✓ NPM cache cleaned');
            } catch (error) {
                this.warn(`Failed to clean npm cache: ${error.message}`);
            }
        }
    }

    async cleanLogFiles() {
        this.log('📝 Cleaning log files...');
        
        const logPatterns = [
            '*.log',
            'logs/**/*',
            'test-results/**/*',
            'coverage/**/*',
            'benchmark-results/**/*'
        ];
        
        for (const pattern of logPatterns) {
            await this.removeByPattern(pattern);
        }
        
        // Clean test result directories
        const testDirs = [
            'test-results',
            'coverage',
            'test/benchmark-results'
        ];
        
        for (const dir of testDirs) {
            await this.removeDirectory(dir);
        }
    }

    async cleanTempFiles() {
        this.log('🗂️  Cleaning temporary files...');
        
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
        
        const tempDirs = [
            'tmp',
            'temp',
            '.tmp'
        ];
        
        for (const dir of tempDirs) {
            await this.removeDirectory(dir);
        }
    }

    async cleanNodeModules() {
        this.log('📦 Cleaning node_modules...');
        
        await this.removeDirectory('node_modules');
        await this.removeFile('package-lock.json');
        await this.removeFile('yarn.lock');
    }

    async removeDirectory(dirPath) {
        const fullPath = path.join(this.projectRoot, dirPath);
        
        try {
            const stats = await fs.stat(fullPath);
            if (stats.isDirectory()) {
                const size = await this.getDirectorySize(fullPath);
                
                if (this.options.dryRun) {
                    this.log(`Would remove directory: ${dirPath} (${this.formatSize(size)})`);
                } else {
                    await fs.rm(fullPath, { recursive: true, force: true });
                    this.log(`✓ Removed directory: ${dirPath} (${this.formatSize(size)})`);
                }
                
                this.cleanedCount++;
                this.totalSize += size;
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                this.warn(`Failed to remove directory ${dirPath}: ${error.message}`);
                this.failedCount++;
            }
        }
    }

    async removeFile(filePath) {
        const fullPath = path.join(this.projectRoot, filePath);
        
        try {
            const stats = await fs.stat(fullPath);
            if (stats.isFile()) {
                if (this.options.dryRun) {
                    this.log(`Would remove file: ${filePath} (${this.formatSize(stats.size)})`);
                } else {
                    await fs.unlink(fullPath);
                    this.log(`✓ Removed file: ${filePath} (${this.formatSize(stats.size)})`);
                }
                
                this.cleanedCount++;
                this.totalSize += stats.size;
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                this.warn(`Failed to remove file ${filePath}: ${error.message}`);
                this.failedCount++;
            }
        }
    }

    async removeByPattern(pattern) {
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
                    this.failedCount++;
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
            console.log(`[CLEAN] ${message}`);
        }
    }

    warn(message) {
        console.warn(`[CLEAN WARN] ${message}`);
    }

    printSummary() {
        console.log('\n📊 Cleanup Summary:');
        console.log(`   Items cleaned: ${this.cleanedCount}`);
        console.log(`   Failed operations: ${this.failedCount}`);
        console.log(`   Space reclaimed: ${this.formatSize(this.totalSize)}`);
        
        if (this.options.dryRun) {
            console.log('   ℹ️  This was a dry run - no files were actually deleted');
        }
        
        if (this.cleanedCount > 0) {
            console.log('✅ Cleanup completed successfully!');
        } else {
            console.log('ℹ️  Nothing to clean');
        }
    }
}

// CLI interface
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {};
    
    for (const arg of args) {
        switch (arg) {
            case '--all':
                options.all = true;
                break;
            case '--build':
                options.build = true;
                break;
            case '--cache':
                options.cache = true;
                break;
            case '--logs':
                options.logs = true;
                break;
            case '--temp':
                options.temp = true;
                break;
            case '--verbose':
                options.verbose = true;
                break;
            case '--dry-run':
                options.dryRun = true;
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
    
    // If no specific options provided, default to build
    if (!options.all && !options.build && !options.cache && !options.logs && !options.temp) {
        options.build = true;
    }
    
    return options;
}

function showUsage() {
    console.log(`
AirSonos Optimized Clean Script

Usage: node scripts/clean.js [options]

Options:
  --all              Clean everything including node_modules
  --build            Clean build directories only (default)
  --cache            Clean npm and build caches
  --logs             Clean log files
  --temp             Clean temporary files
  --verbose          Enable verbose output
  --dry-run          Show what would be cleaned without actually cleaning
  --help             Show this help message

Examples:
  node scripts/clean.js                # Clean build directories
  node scripts/clean.js --all          # Clean everything
  node scripts/clean.js --cache --logs # Clean caches and logs
  node scripts/clean.js --dry-run --all # See what would be cleaned

Note: Use --all with caution as it will remove node_modules and require npm install
`);
}

// Run if called directly
if (require.main === module) {
    // Check if glob module is available
    try {
        require('glob');
    } catch (error) {
        console.warn('Warning: glob module not found. Pattern matching may not work.');
        console.warn('Install with: npm install glob');
    }
    
    const options = parseArgs();
    const cleaner = new Cleaner(options);
    cleaner.clean();
}

module.exports = { Cleaner };