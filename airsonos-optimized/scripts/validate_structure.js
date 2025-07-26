#!/usr/bin/env node

/**
 * File Structure Validation Script for AirSonos Optimized
 * 
 * This script validates the complete file structure of the project,
 * ensuring all required files are present, properly formatted, and
 * ready for HACS submission and distribution.
 * 
 * Usage:
 *   node scripts/validate_structure.js [options]
 *   npm run release:validate
 * 
 * Options:
 *   --strict             Enable strict validation mode
 *   --fix               Attempt to fix issues automatically
 *   --output <file>     Output validation report to file
 *   --format <format>   Output format (text|json|html)
 *   --verbose           Enable verbose output
 *   --help              Show help message
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

// Expected file structure for HACS addon
const EXPECTED_STRUCTURE = {
    // Root files
    files: {
        'package.json': { required: true, type: 'json', description: 'Package configuration' },
        'config.yaml': { required: true, type: 'yaml', description: 'Home Assistant addon configuration' },
        'README.md': { required: true, type: 'markdown', description: 'Project documentation' },
        'CHANGELOG.md': { required: true, type: 'markdown', description: 'Version history' },
        'DOCS.md': { required: true, type: 'markdown', description: 'Technical documentation' },
        'LICENSE': { required: true, type: 'text', description: 'License file' },
        'run.sh': { required: true, type: 'shell', description: 'Startup script', executable: true },
        'apparmor.txt': { required: true, type: 'text', description: 'AppArmor security profile' },
        'hacs.json': { required: false, type: 'json', description: 'HACS metadata (optional)' },
        'icon.png': { required: false, type: 'image', description: 'Addon icon (optional)' },
        'logo.png': { required: false, type: 'image', description: 'Addon logo (optional)' }
    },
    
    // Directory structure
    directories: {
        'lib': { required: true, description: 'Compiled application code' },
        'src': { required: true, description: 'Source code' },
        'config': { required: true, description: 'Configuration templates' },
        'translations': { required: true, description: 'UI translations' },
        'test': { required: true, description: 'Test suite' },
        'scripts': { required: true, description: 'Utility scripts' },
        '.github': { required: true, description: 'GitHub workflows' },
        'data': { required: false, description: 'Runtime data (created at runtime)' },
        'logs': { required: false, description: 'Log files (created at runtime)' }
    },
    
    // Critical files in subdirectories
    criticalFiles: {
        'lib/index.js': { required: true, type: 'javascript', description: 'Main entry point' },
        'config/options.json': { required: true, type: 'json', description: 'HA addon options schema' },
        'config/services.yaml': { required: true, type: 'yaml', description: 'HA service definitions' },
        'translations/en.json': { required: true, type: 'json', description: 'English translations' },
        '.github/workflows/hacs.yaml': { required: true, type: 'yaml', description: 'CI/CD workflow' },
        'test/unit_tests.js': { required: true, type: 'javascript', description: 'Unit tests' },
        'test/integration_tests.js': { required: true, type: 'javascript', description: 'Integration tests' },
        'scripts/validate_config.js': { required: true, type: 'javascript', description: 'Config validation', executable: true },
        'scripts/verify_installation.js': { required: true, type: 'javascript', description: 'Installation verification', executable: true }
    }
};

class StructureValidator {
    constructor(options = {}) {
        this.options = {
            strict: options.strict || false,
            fix: options.fix || false,
            format: options.format || 'text',
            verbose: options.verbose || false,
            output: options.output || null,
            ...options
        };
        
        this.projectRoot = path.join(__dirname, '..');
        this.results = {
            overall: 'unknown',
            timestamp: new Date().toISOString(),
            structure: {
                files: {},
                directories: {},
                criticalFiles: {}
            },
            issues: [],
            fixes: [],
            metrics: {
                totalFiles: 0,
                requiredFiles: 0,
                presentFiles: 0,
                missingFiles: 0,
                invalidFiles: 0
            }
        };
    }

    async validate() {
        try {
            this.log('🔍 Validating AirSonos Optimized file structure...');
            
            // Validate root files
            await this.validateFiles();
            
            // Validate directories
            await this.validateDirectories();
            
            // Validate critical files
            await this.validateCriticalFiles();
            
            // Validate file contents
            await this.validateFileContents();
            
            // Check file permissions
            await this.validatePermissions();
            
            // HACS-specific validation
            await this.validateHACSCompliance();
            
            // Package-specific validation
            await this.validatePackageConfiguration();
            
            // Apply fixes if requested
            if (this.options.fix && this.results.fixes.length > 0) {
                await this.applyFixes();
            }
            
            // Generate assessment
            this.generateAssessment();
            
            // Output results
            await this.outputResults();
            
        } catch (error) {
            this.addIssue('critical', 'Validation failed', error.message);
            this.results.overall = 'failed';
            await this.outputResults();
            process.exit(1);
        }
    }

    async validateFiles() {
        this.log('📄 Validating root files...');
        
        for (const [filename, spec] of Object.entries(EXPECTED_STRUCTURE.files)) {
            const filePath = path.join(this.projectRoot, filename);
            const result = await this.validateFile(filePath, spec, filename);
            
            this.results.structure.files[filename] = result;
            this.updateMetrics(result, spec);
        }
    }

    async validateDirectories() {
        this.log('📁 Validating directory structure...');
        
        for (const [dirname, spec] of Object.entries(EXPECTED_STRUCTURE.directories)) {
            const dirPath = path.join(this.projectRoot, dirname);
            const result = await this.validateDirectory(dirPath, spec, dirname);
            
            this.results.structure.directories[dirname] = result;
        }
    }

    async validateCriticalFiles() {
        this.log('🔑 Validating critical files...');
        
        for (const [filepath, spec] of Object.entries(EXPECTED_STRUCTURE.criticalFiles)) {
            const fullPath = path.join(this.projectRoot, filepath);
            const result = await this.validateFile(fullPath, spec, filepath);
            
            this.results.structure.criticalFiles[filepath] = result;
            this.updateMetrics(result, spec);
        }
    }

    async validateFile(filePath, spec, displayName) {
        const result = {
            path: displayName,
            exists: false,
            valid: false,
            size: 0,
            type: spec.type,
            required: spec.required,
            issues: []
        };
        
        try {
            const stats = await fs.stat(filePath);
            result.exists = true;
            result.size = stats.size;
            result.modified = stats.mtime;
            
            // Check if file is empty
            if (stats.size === 0) {
                result.issues.push('File is empty');
                this.addIssue('warning', 'Empty file', `${displayName} is empty`);
            }
            
            // Validate file type and content
            const content = await fs.readFile(filePath, 'utf8');
            result.valid = await this.validateFileContent(content, spec, displayName);
            
            // Check executable permissions if required
            if (spec.executable && process.platform !== 'win32') {
                const isExecutable = (stats.mode & parseInt('111', 8)) !== 0;
                if (!isExecutable) {
                    result.issues.push('Not executable');
                    this.addIssue('warning', 'File permissions', `${displayName} should be executable`);
                    this.addFix(`Make ${displayName} executable`, `chmod +x "${filePath}"`);
                }
            }
            
            this.log(`✓ ${displayName} (${this.formatSize(stats.size)})`);
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                if (spec.required) {
                    result.issues.push('Required file missing');
                    this.addIssue('critical', 'Missing file', `Required file ${displayName} not found`);
                } else {
                    this.log(`- ${displayName} (optional, not present)`);
                }
            } else {
                result.issues.push(`Access error: ${error.message}`);
                this.addIssue('error', 'File access error', `Cannot access ${displayName}: ${error.message}`);
            }
        }
        
        return result;
    }

    async validateDirectory(dirPath, spec, displayName) {
        const result = {
            path: displayName,
            exists: false,
            fileCount: 0,
            required: spec.required,
            issues: []
        };
        
        try {
            const stats = await fs.stat(dirPath);
            if (stats.isDirectory()) {
                result.exists = true;
                
                // Count files in directory
                const entries = await fs.readdir(dirPath);
                result.fileCount = entries.length;
                
                if (entries.length === 0) {
                    result.issues.push('Directory is empty');
                    this.addIssue('warning', 'Empty directory', `${displayName} directory is empty`);
                }
                
                this.log(`✓ ${displayName}/ (${entries.length} items)`);
            } else {
                result.issues.push('Path exists but is not a directory');
                this.addIssue('error', 'Invalid directory', `${displayName} exists but is not a directory`);
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                if (spec.required) {
                    result.issues.push('Required directory missing');
                    this.addIssue('critical', 'Missing directory', `Required directory ${displayName} not found`);
                    this.addFix(`Create ${displayName} directory`, `mkdir -p "${dirPath}"`);
                } else {
                    this.log(`- ${displayName}/ (optional, not present)`);
                }
            } else {
                result.issues.push(`Access error: ${error.message}`);
                this.addIssue('error', 'Directory access error', `Cannot access ${displayName}: ${error.message}`);
            }
        }
        
        return result;
    }

    async validateFileContent(content, spec, displayName) {
        try {
            switch (spec.type) {
                case 'json':
                    JSON.parse(content);
                    break;
                case 'yaml':
                    yaml.load(content);
                    break;
                case 'javascript':
                    // Basic syntax check - try to parse as JS
                    new Function(content);
                    break;
                case 'markdown':
                    // Check for basic markdown structure
                    if (!content.includes('#')) {
                        this.addIssue('warning', 'Markdown format', `${displayName} may not be properly formatted as Markdown`);
                        return false;
                    }
                    break;
                case 'shell':
                    // Check for shebang
                    if (!content.startsWith('#!')) {
                        this.addIssue('warning', 'Shell script format', `${displayName} missing shebang line`);
                        return false;
                    }
                    break;
            }
            
            return true;
        } catch (error) {
            this.addIssue('error', 'Invalid file format', `${displayName} has invalid ${spec.type} format: ${error.message}`);
            return false;
        }
    }

    async validateFileContents() {
        this.log('📝 Validating file contents...');
        
        // Validate package.json
        await this.validatePackageJson();
        
        // Validate config.yaml
        await this.validateConfigYaml();
        
        // Validate README.md
        await this.validateReadme();
        
        // Validate CHANGELOG.md
        await this.validateChangelog();
    }

    async validatePackageJson() {
        try {
            const packagePath = path.join(this.projectRoot, 'package.json');
            const packageContent = JSON.parse(await fs.readFile(packagePath, 'utf8'));
            
            const requiredFields = ['name', 'version', 'description', 'author', 'license', 'scripts', 'dependencies'];
            
            for (const field of requiredFields) {
                if (!packageContent[field]) {
                    this.addIssue('critical', 'Package.json invalid', `Missing required field: ${field}`);
                }
            }
            
            // Check version format
            if (packageContent.version && !/^\d+\.\d+\.\d+/.test(packageContent.version)) {
                this.addIssue('error', 'Invalid version', 'Version must follow semantic versioning (x.y.z)');
            }
            
            // Check HACS-specific fields
            if (this.options.strict) {
                const hacsFields = ['keywords', 'hacs', 'homeAssistant'];
                for (const field of hacsFields) {
                    if (!packageContent[field]) {
                        this.addIssue('warning', 'HACS compatibility', `Recommended field missing: ${field}`);
                    }
                }
            }
            
            this.log('✓ package.json content validation');
            
        } catch (error) {
            this.addIssue('critical', 'Package.json error', error.message);
        }
    }

    async validateConfigYaml() {
        try {
            const configPath = path.join(this.projectRoot, 'config.yaml');
            const configContent = yaml.load(await fs.readFile(configPath, 'utf8'));
            
            const requiredFields = ['name', 'version', 'slug', 'description', 'arch', 'startup'];
            
            for (const field of requiredFields) {
                if (!configContent[field]) {
                    this.addIssue('critical', 'Config.yaml invalid', `Missing required field: ${field}`);
                }
            }
            
            // Check architecture support
            if (configContent.arch && Array.isArray(configContent.arch)) {
                const supportedArch = ['amd64', 'armv7', 'aarch64'];
                const hasValidArch = configContent.arch.some(arch => supportedArch.includes(arch));
                
                if (!hasValidArch) {
                    this.addIssue('error', 'Architecture support', 'No supported architectures defined');
                }
            }
            
            this.log('✓ config.yaml content validation');
            
        } catch (error) {
            this.addIssue('critical', 'Config.yaml error', error.message);
        }
    }

    async validateReadme() {
        try {
            const readmePath = path.join(this.projectRoot, 'README.md');
            const readmeContent = await fs.readFile(readmePath, 'utf8');
            
            const requiredSections = [
                'Installation',
                'Configuration',
                'Usage',
                'Features'
            ];
            
            for (const section of requiredSections) {
                const sectionRegex = new RegExp(`##? ${section}`, 'i');
                if (!sectionRegex.test(readmeContent)) {
                    this.addIssue('warning', 'README incomplete', `Missing recommended section: ${section}`);
                }
            }
            
            // Check for HACS badges
            if (this.options.strict && !readmeContent.includes('hacs_badge')) {
                this.addIssue('warning', 'HACS branding', 'Consider adding HACS badge to README');
            }
            
            this.log('✓ README.md content validation');
            
        } catch (error) {
            this.addIssue('error', 'README validation error', error.message);
        }
    }

    async validateChangelog() {
        try {
            const changelogPath = path.join(this.projectRoot, 'CHANGELOG.md');
            const changelogContent = await fs.readFile(changelogPath, 'utf8');
            
            // Check for Keep a Changelog format
            if (!changelogContent.includes('## [') && !changelogContent.includes('### ')) {
                this.addIssue('warning', 'Changelog format', 'CHANGELOG.md should follow Keep a Changelog format');
            }
            
            // Check for current version
            const packagePath = path.join(this.projectRoot, 'package.json');
            const packageContent = JSON.parse(await fs.readFile(packagePath, 'utf8'));
            const currentVersion = packageContent.version;
            
            if (!changelogContent.includes(`[${currentVersion}]`)) {
                this.addIssue('warning', 'Changelog outdated', `Current version ${currentVersion} not found in CHANGELOG.md`);
            }
            
            this.log('✓ CHANGELOG.md content validation');
            
        } catch (error) {
            this.addIssue('error', 'CHANGELOG validation error', error.message);
        }
    }

    async validatePermissions() {
        if (process.platform === 'win32') {
            return; // Skip on Windows
        }
        
        this.log('🔐 Validating file permissions...');
        
        const executableFiles = [
            'run.sh',
            'scripts/validate_config.js',
            'scripts/verify_installation.js',
            'scripts/cleanup.js',
            'scripts/run_tests.sh'
        ];
        
        for (const file of executableFiles) {
            const filePath = path.join(this.projectRoot, file);
            
            try {
                const stats = await fs.stat(filePath);
                const isExecutable = (stats.mode & parseInt('111', 8)) !== 0;
                
                if (!isExecutable) {
                    this.addIssue('warning', 'File permissions', `${file} should be executable`);
                    this.addFix(`Make ${file} executable`, `chmod +x "${filePath}"`);
                }
            } catch (error) {
                // File doesn't exist, already reported elsewhere
            }
        }
    }

    async validateHACSCompliance() {
        this.log('🏠 Validating HACS compliance...');
        
        // Check for required HACS files
        const hacsRequiredFiles = [
            'README.md',
            'config.yaml',
            'run.sh'
        ];
        
        for (const file of hacsRequiredFiles) {
            const filePath = path.join(this.projectRoot, file);
            try {
                await fs.access(filePath);
            } catch (error) {
                this.addIssue('critical', 'HACS compliance', `HACS required file missing: ${file}`);
            }
        }
        
        // Check HACS.json if present
        const hacsJsonPath = path.join(this.projectRoot, 'hacs.json');
        try {
            const hacsContent = JSON.parse(await fs.readFile(hacsJsonPath, 'utf8'));
            
            const requiredHacsFields = ['name', 'content_in_root'];
            for (const field of requiredHacsFields) {
                if (hacsContent[field] === undefined) {
                    this.addIssue('warning', 'HACS metadata', `HACS.json missing field: ${field}`);
                }
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                this.addIssue('error', 'HACS metadata', `Invalid hacs.json: ${error.message}`);
            }
        }
        
        // Check repository structure for HACS
        const repoStructureChecks = [
            { path: '.github/workflows', description: 'CI/CD workflows' },
            { path: 'translations', description: 'Internationalization' },
            { path: 'config', description: 'Configuration templates' }
        ];
        
        for (const check of repoStructureChecks) {
            const checkPath = path.join(this.projectRoot, check.path);
            try {
                await fs.access(checkPath);
            } catch (error) {
                this.addIssue('warning', 'HACS structure', `Recommended for HACS: ${check.description} (${check.path})`);
            }
        }
    }

    async validatePackageConfiguration() {
        this.log('📦 Validating package configuration...');
        
        try {
            const packagePath = path.join(this.projectRoot, 'package.json');
            const packageContent = JSON.parse(await fs.readFile(packagePath, 'utf8'));
            
            // Check scripts
            const recommendedScripts = [
                'start', 'test', 'build', 'lint', 'verify'
            ];
            
            for (const script of recommendedScripts) {
                if (!packageContent.scripts || !packageContent.scripts[script]) {
                    this.addIssue('warning', 'Package scripts', `Recommended script missing: ${script}`);
                }
            }
            
            // Check dependencies
            const criticalDependencies = [
                'express', 'winston', 'ws', 'node-cache'
            ];
            
            for (const dep of criticalDependencies) {
                if (!packageContent.dependencies || !packageContent.dependencies[dep]) {
                    this.addIssue('error', 'Dependencies', `Critical dependency missing: ${dep}`);
                }
            }
            
            // Check files field for npm packaging
            if (!packageContent.files) {
                this.addIssue('warning', 'Package configuration', 'Consider adding "files" field to control npm package contents');
            }
            
        } catch (error) {
            this.addIssue('error', 'Package validation', error.message);
        }
    }

    async applyFixes() {
        this.log('🔧 Applying fixes...');
        
        for (const fix of this.results.fixes) {
            try {
                this.log(`Applying: ${fix.description}`);
                
                if (fix.command) {
                    const { execSync } = require('child_process');
                    execSync(fix.command, { stdio: 'pipe' });
                    this.log(`✓ ${fix.description}`);
                }
            } catch (error) {
                this.log(`❌ Failed to apply fix: ${fix.description} - ${error.message}`);
            }
        }
    }

    generateAssessment() {
        const criticalIssues = this.results.issues.filter(i => i.severity === 'critical').length;
        const errorIssues = this.results.issues.filter(i => i.severity === 'error').length;
        const warningIssues = this.results.issues.filter(i => i.severity === 'warning').length;
        
        if (criticalIssues > 0) {
            this.results.overall = 'failed';
        } else if (errorIssues > 0) {
            this.results.overall = 'error';
        } else if (warningIssues > 0) {
            this.results.overall = 'warning';
        } else {
            this.results.overall = 'passed';
        }
        
        // Calculate completion percentage
        const totalRequired = this.results.metrics.requiredFiles;
        const present = this.results.metrics.presentFiles;
        this.results.metrics.completionPercentage = totalRequired > 0 ? Math.round((present / totalRequired) * 100) : 0;
    }

    async outputResults() {
        const output = await this.formatResults();
        
        if (this.options.output) {
            await fs.writeFile(this.options.output, output);
            this.log(`Results saved to: ${this.options.output}`);
        } else {
            console.log(output);
        }
        
        // Exit with appropriate code
        if (this.results.overall === 'failed') {
            process.exit(1);
        } else if (this.results.overall === 'error') {
            process.exit(2);
        }
    }

    async formatResults() {
        switch (this.options.format) {
            case 'json':
                return JSON.stringify(this.results, null, 2);
            case 'html':
                return this.formatAsHTML();
            default:
                return this.formatAsText();
        }
    }

    formatAsText() {
        const statusIcon = {
            'passed': '✅',
            'warning': '⚠️',
            'error': '🚨',
            'failed': '❌'
        }[this.results.overall];
        
        let output = `
📋 AirSonos Optimized Structure Validation Report
================================================

Overall Status: ${statusIcon} ${this.results.overall.toUpperCase()}
Completion: ${this.results.metrics.completionPercentage}%
Timestamp: ${this.results.timestamp}

📊 Metrics:
-----------
Required Files: ${this.results.metrics.requiredFiles}
Present Files: ${this.results.metrics.presentFiles}
Missing Files: ${this.results.metrics.missingFiles}
Invalid Files: ${this.results.metrics.invalidFiles}

`;
        
        // Issues summary
        if (this.results.issues.length > 0) {
            output += `\n🚨 Issues Found (${this.results.issues.length}):\n`;
            output += '------------------------\n';
            
            const groupedIssues = this.groupIssuesBySeverity();
            
            ['critical', 'error', 'warning'].forEach(severity => {
                if (groupedIssues[severity] && groupedIssues[severity].length > 0) {
                    const icon = { critical: '💥', error: '🚨', warning: '⚠️' }[severity];
                    output += `\n${icon} ${severity.toUpperCase()} (${groupedIssues[severity].length}):\n`;
                    
                    groupedIssues[severity].forEach(issue => {
                        output += `  • ${issue.category}: ${issue.message}\n`;
                    });
                }
            });
        }
        
        // File status summary
        output += `\n📄 File Structure:\n`;
        output += '------------------\n';
        
        // Root files
        output += '\nRoot Files:\n';
        Object.entries(this.results.structure.files).forEach(([name, info]) => {
            const icon = info.exists ? (info.valid ? '✅' : '⚠️') : '❌';
            const sizeInfo = info.exists ? ` (${this.formatSize(info.size)})` : '';
            output += `  ${icon} ${name}${sizeInfo}\n`;
        });
        
        // Directories
        output += '\nDirectories:\n';
        Object.entries(this.results.structure.directories).forEach(([name, info]) => {
            const icon = info.exists ? '✅' : '❌';
            const countInfo = info.exists ? ` (${info.fileCount} items)` : '';
            output += `  ${icon} ${name}/${countInfo}\n`;
        });
        
        // Critical files
        output += '\nCritical Files:\n';
        Object.entries(this.results.structure.criticalFiles).forEach(([name, info]) => {
            const icon = info.exists ? (info.valid ? '✅' : '⚠️') : '❌';
            const sizeInfo = info.exists ? ` (${this.formatSize(info.size)})` : '';
            output += `  ${icon} ${name}${sizeInfo}\n`;
        });
        
        // Fixes
        if (this.results.fixes.length > 0) {
            output += `\n🔧 Suggested Fixes (${this.results.fixes.length}):\n`;
            output += '---------------------\n';
            this.results.fixes.forEach(fix => {
                output += `  • ${fix.description}\n`;
                if (fix.command) {
                    output += `    Command: ${fix.command}\n`;
                }
            });
        }
        
        output += '\n================================================\n';
        
        if (this.results.overall === 'passed') {
            output += '🎉 Structure validation passed! Ready for HACS submission.\n';
        } else {
            output += '⚠️  Please address the issues above before submission.\n';
        }
        
        return output;
    }

    formatAsHTML() {
        // HTML formatting implementation would go here
        return this.formatAsText(); // Fallback to text for now
    }

    groupIssuesBySeverity() {
        const grouped = { critical: [], error: [], warning: [] };
        
        this.results.issues.forEach(issue => {
            if (grouped[issue.severity]) {
                grouped[issue.severity].push(issue);
            }
        });
        
        return grouped;
    }

    updateMetrics(result, spec) {
        this.results.metrics.totalFiles++;
        
        if (spec.required) {
            this.results.metrics.requiredFiles++;
            
            if (result.exists) {
                this.results.metrics.presentFiles++;
                
                if (!result.valid) {
                    this.results.metrics.invalidFiles++;
                }
            } else {
                this.results.metrics.missingFiles++;
            }
        }
    }

    addIssue(severity, category, message) {
        this.results.issues.push({ severity, category, message });
    }

    addFix(description, command) {
        this.results.fixes.push({ description, command });
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
        if (this.options.verbose) {
            console.log(`[VALIDATE] ${message}`);
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
            case '--strict':
                options.strict = true;
                break;
            case '--fix':
                options.fix = true;
                break;
            case '--verbose':
                options.verbose = true;
                break;
            case '--output':
                options.output = args[++i];
                break;
            case '--format':
                options.format = args[++i];
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
AirSonos Optimized File Structure Validation

Usage: node scripts/validate_structure.js [options]

Options:
  --strict             Enable strict validation mode
  --fix               Attempt to fix issues automatically
  --output <file>     Output validation report to file
  --format <format>   Output format (text|json|html)
  --verbose           Enable verbose output
  --help              Show this help message

Examples:
  node scripts/validate_structure.js                    # Basic validation
  node scripts/validate_structure.js --strict           # Strict HACS validation
  node scripts/validate_structure.js --fix --verbose    # Fix issues with details
  node scripts/validate_structure.js --format json > report.json  # JSON output
`);
}

// Run if called directly
if (require.main === module) {
    const options = parseArgs();
    const validator = new StructureValidator(options);
    validator.validate();
}

module.exports = { StructureValidator, EXPECTED_STRUCTURE };