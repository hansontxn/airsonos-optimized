#!/usr/bin/env node

/**
 * Build Script for AirSonos Optimized
 * 
 * This script compiles ES6+ code to ES5 for maximum compatibility,
 * optimizes the code for production, and prepares the distribution.
 * 
 * Features:
 * - Babel compilation ES6+ to ES5
 * - Code minification and optimization
 * - Source map generation
 * - File copying and organization
 * - Build validation
 * - Performance optimization
 * 
 * Usage:
 *   node scripts/build.js [options]
 *   npm run build
 *   npm run build:clean
 * 
 * Options:
 *   --dev, --development    Build for development (no minification)
 *   --prod, --production    Build for production (default)
 *   --clean                 Clean before build
 *   --watch                 Watch for changes and rebuild
 *   --verbose               Enable verbose output
 *   --no-minify            Skip minification
 *   --source-maps          Generate source maps
 *   --help                 Show help message
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync, spawn } = require('child_process');

// Build configuration
const BUILD_CONFIG = {
    srcDir: path.join(__dirname, '..', 'src'),
    libDir: path.join(__dirname, '..', 'lib'),
    distDir: path.join(__dirname, '..', 'dist'),
    tempDir: path.join(__dirname, '..', '.build-temp'),
    
    // Files to copy without compilation
    copyFiles: [
        'package.json',
        'README.md',
        'CHANGELOG.md',
        'DOCS.md',
        'LICENSE',
        'config.yaml',
        'apparmor.txt',
        'run.sh'
    ],
    
    // Directories to copy
    copyDirs: [
        'config',
        'translations'
    ],
    
    // Files to exclude from build
    excludePatterns: [
        'test/',
        '*.test.js',
        '*.spec.js',
        '__tests__/',
        '.git/',
        'node_modules/',
        '.build-temp/',
        'dist/',
        '.DS_Store',
        'Thumbs.db'
    ]
};

class Builder {
    constructor(options = {}) {
        this.options = {
            mode: options.mode || 'production',
            clean: options.clean || false,
            watch: options.watch || false,
            verbose: options.verbose || false,
            minify: options.minify !== false,
            sourceMaps: options.sourceMaps || false,
            ...options
        };
        
        this.startTime = Date.now();
        this.stats = {
            filesProcessed: 0,
            filesSkipped: 0,
            errors: 0,
            warnings: 0
        };
    }

    async build() {
        try {
            this.log('🚀 Starting AirSonos Optimized build process...');
            this.log(`Mode: ${this.options.mode}`);
            this.log(`Target: ${BUILD_CONFIG.libDir}`);
            
            // Clean if requested
            if (this.options.clean) {
                await this.clean();
            }
            
            // Create directories
            await this.createDirectories();
            
            // Check dependencies
            await this.checkDependencies();
            
            // Compile source code
            await this.compileSource();
            
            // Copy static files
            await this.copyStaticFiles();
            
            // Optimize for production
            if (this.options.mode === 'production') {
                await this.optimizeForProduction();
            }
            
            // Validate build
            await this.validateBuild();
            
            // Generate build info
            await this.generateBuildInfo();
            
            // Setup watch mode
            if (this.options.watch) {
                await this.setupWatchMode();
            }
            
            this.log('✅ Build completed successfully!');
            this.printStats();
            
        } catch (error) {
            this.log(`❌ Build failed: ${error.message}`);
            if (this.options.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    async clean() {
        this.log('🧹 Cleaning build directories...');
        
        const dirsToClean = [
            BUILD_CONFIG.libDir,
            BUILD_CONFIG.distDir,
            BUILD_CONFIG.tempDir
        ];
        
        for (const dir of dirsToClean) {
            try {
                await fs.rm(dir, { recursive: true, force: true });
                this.log(`Cleaned: ${path.relative(process.cwd(), dir)}`);
            } catch (error) {
                this.warn(`Failed to clean ${dir}: ${error.message}`);
            }
        }
    }

    async createDirectories() {
        this.log('📁 Creating build directories...');
        
        const dirsToCreate = [
            BUILD_CONFIG.libDir,
            BUILD_CONFIG.distDir,
            BUILD_CONFIG.tempDir,
            path.join(BUILD_CONFIG.libDir, 'src')
        ];
        
        for (const dir of dirsToCreate) {
            await fs.mkdir(dir, { recursive: true });
            this.log(`Created: ${path.relative(process.cwd(), dir)}`);
        }
    }

    async checkDependencies() {
        this.log('🔍 Checking dependencies...');
        
        const requiredDeps = [
            '@babel/core',
            '@babel/preset-env',
            '@babel/cli'
        ];
        
        try {
            const packageJson = JSON.parse(
                await fs.readFile(path.join(__dirname, '..', 'package.json'), 'utf8')
            );
            
            const allDeps = {
                ...packageJson.dependencies,
                ...packageJson.devDependencies
            };
            
            for (const dep of requiredDeps) {
                if (!allDeps[dep]) {
                    throw new Error(`Missing required dependency: ${dep}`);
                }
            }
            
            this.log('All required dependencies found');
            
        } catch (error) {
            throw new Error(`Dependency check failed: ${error.message}`);
        }
    }

    async compileSource() {
        this.log('🔧 Compiling source code with Babel...');
        
        try {
            // Create Babel configuration
            const babelConfig = {
                presets: [
                    ['@babel/preset-env', {
                        targets: {
                            node: '16.0.0'
                        },
                        modules: 'commonjs',
                        useBuiltIns: 'usage',
                        corejs: 3
                    }]
                ],
                plugins: [],
                sourceMaps: this.options.sourceMaps,
                minified: this.options.minify && this.options.mode === 'production',
                comments: this.options.mode === 'development'
            };
            
            // Write Babel config
            await fs.writeFile(
                path.join(BUILD_CONFIG.tempDir, '.babelrc.json'),
                JSON.stringify(babelConfig, null, 2)
            );
            
            // Compile with Babel
            const babelCmd = [
                'npx', 'babel',
                BUILD_CONFIG.srcDir,
                '--out-dir', path.join(BUILD_CONFIG.libDir, 'src'),
                '--config-file', path.join(BUILD_CONFIG.tempDir, '.babelrc.json'),
                '--copy-files',
                '--include-dotfiles'
            ];
            
            if (this.options.sourceMaps) {
                babelCmd.push('--source-maps');
            }
            
            if (this.options.verbose) {
                babelCmd.push('--verbose');
            }
            
            this.log(`Running: ${babelCmd.join(' ')}`);
            
            execSync(babelCmd.join(' '), {
                stdio: this.options.verbose ? 'inherit' : 'pipe',
                cwd: path.join(__dirname, '..')
            });
            
            this.stats.filesProcessed += await this.countFiles(path.join(BUILD_CONFIG.libDir, 'src'));
            this.log('Source compilation completed');
            
        } catch (error) {
            throw new Error(`Compilation failed: ${error.message}`);
        }
    }

    async copyStaticFiles() {
        this.log('📄 Copying static files...');
        
        // Copy individual files
        for (const file of BUILD_CONFIG.copyFiles) {
            try {
                const srcPath = path.join(__dirname, '..', file);
                const destPath = path.join(BUILD_CONFIG.libDir, file);
                
                await fs.copyFile(srcPath, destPath);
                this.log(`Copied: ${file}`);
                this.stats.filesProcessed++;
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    this.warn(`Failed to copy ${file}: ${error.message}`);
                    this.stats.errors++;
                }
            }
        }
        
        // Copy directories
        for (const dir of BUILD_CONFIG.copyDirs) {
            try {
                const srcPath = path.join(__dirname, '..', dir);
                const destPath = path.join(BUILD_CONFIG.libDir, dir);
                
                await this.copyDirectory(srcPath, destPath);
                this.log(`Copied directory: ${dir}`);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    this.warn(`Failed to copy directory ${dir}: ${error.message}`);
                    this.stats.errors++;
                }
            }
        }
        
        // Copy essential scripts
        const scriptsToCopy = [
            'validate_config.js',
            'verify_installation.js',
            'cleanup.js',
            'post_install.js'
        ];
        
        await fs.mkdir(path.join(BUILD_CONFIG.libDir, 'scripts'), { recursive: true });
        
        for (const script of scriptsToCopy) {
            try {
                const srcPath = path.join(__dirname, script);
                const destPath = path.join(BUILD_CONFIG.libDir, 'scripts', script);
                
                await fs.copyFile(srcPath, destPath);
                this.log(`Copied script: ${script}`);
                this.stats.filesProcessed++;
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    this.warn(`Failed to copy script ${script}: ${error.message}`);
                    this.stats.errors++;
                }
            }
        }
    }

    async copyDirectory(src, dest) {
        await fs.mkdir(dest, { recursive: true });
        
        const entries = await fs.readdir(src, { withFileTypes: true });
        
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
                await this.copyDirectory(srcPath, destPath);
            } else {
                await fs.copyFile(srcPath, destPath);
                this.stats.filesProcessed++;
            }
        }
    }

    async optimizeForProduction() {
        this.log('⚡ Optimizing for production...');
        
        // Remove development-only files
        const devFiles = [
            '.babelrc.json',
            'jest.config.js',
            '.eslintrc.js',
            '.prettierrc'
        ];
        
        for (const file of devFiles) {
            try {
                await fs.unlink(path.join(BUILD_CONFIG.libDir, file));
                this.log(`Removed dev file: ${file}`);
            } catch (error) {
                // File doesn't exist, ignore
            }
        }
        
        // Optimize package.json for production
        await this.optimizePackageJson();
        
        // Create production environment file
        await this.createProductionEnv();
    }

    async optimizePackageJson() {
        try {
            const packageJsonPath = path.join(BUILD_CONFIG.libDir, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            
            // Remove development dependencies
            delete packageJson.devDependencies;
            
            // Remove development scripts
            const devScripts = [
                'test', 'test:unit', 'test:integration', 'test:performance',
                'test:compatibility', 'test:watch', 'test:coverage', 'test:ci',
                'lint', 'lint:fix', 'format', 'format:check',
                'build', 'build:clean', 'clean'
            ];
            
            devScripts.forEach(script => {
                delete packageJson.scripts[script];
            });
            
            // Mark as production build
            packageJson.buildInfo = {
                mode: 'production',
                timestamp: new Date().toISOString(),
                version: packageJson.version
            };
            
            await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
            this.log('Optimized package.json for production');
            
        } catch (error) {
            this.warn(`Failed to optimize package.json: ${error.message}`);
        }
    }

    async createProductionEnv() {
        const envContent = `# Production Environment Configuration
NODE_ENV=production
AIRSONOS_MODE=production
AIRSONOS_PERFORMANCE_MONITORING=true
AIRSONOS_DEBUG=false
`;
        
        await fs.writeFile(path.join(BUILD_CONFIG.libDir, '.env.production'), envContent);
        this.log('Created production environment file');
    }

    async validateBuild() {
        this.log('✅ Validating build...');
        
        // Check required files exist
        const requiredFiles = [
            'lib/index.js',
            'lib/src/optimized_airsonos.js',
            'lib/src/ha_integration.js',
            'lib/package.json',
            'lib/config.yaml'
        ];
        
        for (const file of requiredFiles) {
            const filePath = path.join(__dirname, '..', file);
            try {
                await fs.access(filePath);
                this.log(`✓ ${file}`);
            } catch (error) {
                throw new Error(`Missing required file: ${file}`);
            }
        }
        
        // Validate JavaScript files can be loaded
        try {
            const mainPath = path.join(BUILD_CONFIG.libDir, 'index.js');
            require(mainPath);
            this.log('✓ Main entry point loads successfully');
        } catch (error) {
            this.warn(`Main entry point validation failed: ${error.message}`);
            this.stats.warnings++;
        }
        
        this.log('Build validation completed');
    }

    async generateBuildInfo() {
        const buildInfo = {
            version: '0.3.0',
            mode: this.options.mode,
            timestamp: new Date().toISOString(),
            buildTime: Date.now() - this.startTime,
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            stats: this.stats,
            options: this.options
        };
        
        await fs.writeFile(
            path.join(BUILD_CONFIG.libDir, 'build-info.json'),
            JSON.stringify(buildInfo, null, 2)
        );
        
        this.log('Generated build information');
    }

    async setupWatchMode() {
        this.log('👀 Setting up watch mode...');
        
        const chokidar = require('chokidar');
        
        const watcher = chokidar.watch(BUILD_CONFIG.srcDir, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true
        });
        
        let building = false;
        
        watcher.on('change', async (filePath) => {
            if (building) return;
            
            building = true;
            this.log(`File changed: ${path.relative(process.cwd(), filePath)}`);
            
            try {
                await this.compileSource();
                this.log('✅ Incremental build completed');
            } catch (error) {
                this.log(`❌ Incremental build failed: ${error.message}`);
            }
            
            building = false;
        });
        
        this.log('Watch mode active. Press Ctrl+C to stop.');
        
        // Keep process alive
        process.on('SIGINT', () => {
            this.log('Stopping watch mode...');
            watcher.close();
            process.exit(0);
        });
    }

    async countFiles(dir) {
        let count = 0;
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    count += await this.countFiles(path.join(dir, entry.name));
                } else {
                    count++;
                }
            }
        } catch (error) {
            // Directory doesn't exist
        }
        return count;
    }

    log(message) {
        console.log(`[BUILD] ${message}`);
    }

    warn(message) {
        console.warn(`[BUILD WARN] ${message}`);
        this.stats.warnings++;
    }

    printStats() {
        const duration = Date.now() - this.startTime;
        
        console.log('\n📊 Build Statistics:');
        console.log(`   Duration: ${duration}ms`);
        console.log(`   Files processed: ${this.stats.filesProcessed}`);
        console.log(`   Files skipped: ${this.stats.filesSkipped}`);
        console.log(`   Warnings: ${this.stats.warnings}`);
        console.log(`   Errors: ${this.stats.errors}`);
        console.log(`   Output: ${path.relative(process.cwd(), BUILD_CONFIG.libDir)}`);
    }
}

// CLI interface
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
            case '--dev':
            case '--development':
                options.mode = 'development';
                break;
            case '--prod':
            case '--production':
                options.mode = 'production';
                break;
            case '--clean':
                options.clean = true;
                break;
            case '--watch':
                options.watch = true;
                break;
            case '--verbose':
                options.verbose = true;
                break;
            case '--no-minify':
                options.minify = false;
                break;
            case '--source-maps':
                options.sourceMaps = true;
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
AirSonos Optimized Build Script

Usage: node scripts/build.js [options]

Options:
  --dev, --development    Build for development (no minification)
  --prod, --production    Build for production (default)
  --clean                 Clean before build
  --watch                 Watch for changes and rebuild
  --verbose               Enable verbose output
  --no-minify            Skip minification
  --source-maps          Generate source maps
  --help                 Show this help message

Examples:
  node scripts/build.js                    # Production build
  node scripts/build.js --dev --watch      # Development with watch
  node scripts/build.js --clean --verbose  # Clean build with verbose output
`);
}

// Run if called directly
if (require.main === module) {
    const options = parseArgs();
    const builder = new Builder(options);
    builder.build().catch(error => {
        console.error('Build failed:', error.message);
        process.exit(1);
    });
}

module.exports = { Builder, BUILD_CONFIG };