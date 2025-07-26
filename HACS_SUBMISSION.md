# HACS Submission Checklist

This document provides the complete checklist and instructions for submitting AirSonos Optimized to the Home Assistant Community Store (HACS).

## 📋 Pre-Submission Checklist

### ✅ **Repository Requirements**

- [ ] **Repository is public** on GitHub
- [ ] **Repository name**: `airsonos-optimized`
- [ ] **Repository URL**: https://github.com/HansonTan/airsonos-optimized
- [ ] **License**: MIT (LICENSE file present)
- [ ] **README.md** with comprehensive documentation
- [ ] **No binary files** in repository (except images <100KB)

### ✅ **HACS-Specific Files**

- [ ] **config.yaml** - Home Assistant add-on configuration
  ```yaml
  name: AirSonos Optimized
  version: "0.3.0"
  slug: airsonos_optimized
  description: High-performance AirPlay to Sonos bridge with Home Assistant integration
  arch:
    - amd64
    - armv7
    - aarch64
  startup: services
  ```

- [ ] **README.md** - Must include:
  - [ ] Installation instructions via HACS
  - [ ] Configuration examples
  - [ ] Feature descriptions
  - [ ] Troubleshooting section
  - [ ] HACS badge (optional but recommended)

- [ ] **run.sh** - Executable startup script
- [ ] **apparmor.txt** - AppArmor security profile (optional for add-ons)
- [ ] **.github/workflows/hacs.yaml** - CI/CD validation

### ✅ **Optional HACS Files**

- [ ] **hacs.json** - HACS metadata (optional but recommended)
  ```json
  {
    "name": "AirSonos Optimized",
    "content_in_root": true,
    "filename": "config.yaml",
    "iot_class": "Local Polling"
  }
  ```

- [ ] **icon.png** - Add-on icon (max 100KB)
- [ ] **logo.png** - Add-on logo (max 100KB)

### ✅ **Add-on Specific Requirements**

- [ ] **config.yaml validation**
  ```bash
  # Validate syntax
  python -c "import yaml; yaml.safe_load(open('config.yaml'))"
  ```

- [ ] **Required config.yaml fields**:
  - [ ] `name` - Add-on name
  - [ ] `version` - Semantic version
  - [ ] `slug` - Unique identifier
  - [ ] `description` - Brief description
  - [ ] `arch` - Supported architectures
  - [ ] `startup` - Startup type

- [ ] **Architecture support**:
  - [ ] `amd64` - Intel/AMD 64-bit
  - [ ] `armv7` - ARM 32-bit (Raspberry Pi)
  - [ ] `aarch64` - ARM 64-bit

### ✅ **Documentation Requirements**

- [ ] **README.md sections**:
  - [ ] Clear project description
  - [ ] Installation instructions (HACS + manual)
  - [ ] Configuration examples
  - [ ] Usage instructions
  - [ ] Feature list with benefits
  - [ ] Troubleshooting section
  - [ ] Support information

- [ ] **Technical documentation**:
  - [ ] API documentation (if applicable)
  - [ ] Configuration reference
  - [ ] Development guide (optional)

### ✅ **Quality Assurance**

- [ ] **Code quality**:
  - [ ] No obvious security issues
  - [ ] Error handling implemented
  - [ ] Logging implemented
  - [ ] Resource cleanup

- [ ] **Testing**:
  - [ ] Installation testing
  - [ ] Basic functionality testing
  - [ ] Error condition testing

- [ ] **Performance**:
  - [ ] Reasonable resource usage
  - [ ] No memory leaks
  - [ ] Graceful degradation

## 🔍 HACS Validation

### **Automated Validation**

Run the HACS validation workflow:

```bash
# GitHub Actions workflow
.github/workflows/hacs.yaml

# Local validation using HACS action
docker run --rm -v $(pwd):/workspace \
  ghcr.io/hacs/action:main \
  --category addon \
  --ignore brands
```

### **Manual HACS Validation Checklist**

- [ ] **Repository structure**:
  ```
  ✅ config.yaml (required)
  ✅ README.md (required)
  ✅ run.sh (required, executable)
  ✅ apparmor.txt (recommended)
  ✅ Dockerfile (required for add-ons)
  ✅ .github/workflows/ (recommended)
  ```

- [ ] **Content validation**:
  - [ ] No malicious code
  - [ ] No binary executables
  - [ ] No hardcoded credentials
  - [ ] Proper license

- [ ] **Metadata validation**:
  - [ ] Valid semantic versioning
  - [ ] Accurate description
  - [ ] Proper category classification
  - [ ] Supported architectures listed

### **HACS Compatibility Test**

```bash
# Test HACS installation simulation
pip install homeassistant
pip install hacs

# Validate add-on structure
python -c "
import yaml
import json
import os

# Validate config.yaml
with open('config.yaml') as f:
    config = yaml.safe_load(f)
    required_fields = ['name', 'version', 'slug', 'description', 'arch']
    for field in required_fields:
        assert field in config, f'Missing required field: {field}'
    print('✅ config.yaml validation passed')

# Validate options.json if present
if os.path.exists('config/options.json'):
    with open('config/options.json') as f:
        options = json.load(f)
        assert 'schema' in options, 'Missing schema in options.json'
        print('✅ options.json validation passed')

print('✅ HACS compatibility validation passed')
"
```

## 📝 Submission Process

### **Step 1: Prepare Repository**

1. **Final repository cleanup**:
   ```bash
   # Remove unnecessary files
   git rm -r --cached node_modules/
   git rm -r --cached .DS_Store
   git rm -r --cached *.log
   
   # Update .gitignore
   echo "node_modules/" >> .gitignore
   echo "*.log" >> .gitignore
   echo ".DS_Store" >> .gitignore
   ```

2. **Version consistency check**:
   ```bash
   # Ensure version consistency across files
   grep -r "0.3.0" package.json config.yaml CHANGELOG.md
   ```

3. **Final validation**:
   ```bash
   npm run verify:full
   npm run release:validate
   node scripts/validate_structure.js --strict
   ```

### **Step 2: Create Release**

1. **Tag the release**:
   ```bash
   git tag -a v0.3.0 -m "AirSonos Optimized v0.3.0 - HACS Release"
   git push origin v0.3.0
   ```

2. **Create GitHub release**:
   - Go to: https://github.com/HansonTan/airsonos-optimized/releases
   - Click "Create a new release"
   - Tag: `v0.3.0`
   - Title: `AirSonos Optimized v0.3.0`
   - Description: Copy from CHANGELOG.md highlights

### **Step 3: Submit to HACS**

1. **Navigate to HACS Default Repository**:
   - URL: https://github.com/hacs/default

2. **Fork the repository**:
   - Click "Fork" button
   - Clone your fork locally

3. **Add your repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/default.git
   cd default
   
   # Add to add-ons category
   # Edit: addons.json
   ```

4. **Edit addons.json**:
   ```json
   {
     "HansonTan/airsonos-optimized": {
       "category": "addon",
       "description": "High-performance AirPlay to Sonos bridge with Home Assistant integration"
     }
   }
   ```

5. **Create pull request**:
   ```bash
   git checkout -b add-airsonos-optimized
   git add addons.json
   git commit -m "Add AirSonos Optimized addon"
   git push origin add-airsonos-optimized
   ```

6. **Open pull request**:
   - Go to your fork on GitHub
   - Click "Compare & pull request"
   - Fill out the PR template

### **Pull Request Template**

```markdown
## Add AirSonos Optimized

**Repository**: https://github.com/HansonTan/airsonos-optimized
**Category**: Add-on
**Description**: High-performance AirPlay to Sonos bridge with Home Assistant integration

### Features:
- 🚀 50% CPU reduction with worker thread processing
- 🎵 80% fewer audio dropouts with adaptive buffering  
- 🏠 Complete Home Assistant integration (8 sensors, 12 services)
- ⚙️ Intelligent auto-configuration system
- 📊 Real-time performance monitoring
- 🛡️ AppArmor security profile

### Validation:
- [x] Repository is public
- [x] README.md with installation instructions
- [x] config.yaml with proper metadata
- [x] All required files present
- [x] HACS validation workflow passes
- [x] No security issues identified
- [x] Tested installation and basic functionality

### Additional Information:
- Maintains backward compatibility with original AirSonos
- Includes comprehensive test suite
- Production ready with error handling
- Active maintenance and support
```

## 🔄 Post-Submission Process

### **1. HACS Review Process**

- **Initial Review** (1-3 days): Automated checks
- **Manual Review** (3-7 days): HACS team review
- **Feedback** (if needed): Address any issues
- **Approval**: Repository added to HACS

### **2. Monitoring Submission**

- **Check PR status**: Monitor comments and reviews
- **Respond promptly**: Address any feedback quickly
- **Update if needed**: Push fixes if required

### **3. Post-Approval Actions**

1. **Update documentation**:
   ```bash
   # Add HACS badge to README
   echo "[![hacs_badge](https://img.shields.io/badge/HACS-Default-orange.svg)](https://github.com/custom-components/hacs)" >> README.md
   ```

2. **Monitor installations**:
   - Track HACS download statistics
   - Monitor GitHub issues
   - Respond to user feedback

3. **Maintain repository**:
   - Keep dependencies updated
   - Address security issues
   - Implement user-requested features

## 🚨 Common Rejection Reasons

### **Technical Issues**
- [ ] Invalid config.yaml syntax
- [ ] Missing required files
- [ ] Security vulnerabilities
- [ ] Non-functional add-on
- [ ] Poor error handling

### **Documentation Issues**
- [ ] Incomplete README.md
- [ ] Missing installation instructions
- [ ] No configuration examples
- [ ] Unclear feature descriptions

### **Quality Issues**
- [ ] Duplicate functionality
- [ ] Poor code quality
- [ ] No testing evidence
- [ ] Resource abuse
- [ ] Stability issues

## ✅ Success Criteria

**Submission is likely to be approved when:**

1. **✅ All validation passes**
   - HACS workflow passes
   - Structure validation passes
   - Configuration validation passes

2. **✅ Quality documentation**
   - Clear installation instructions
   - Comprehensive feature list
   - Working configuration examples

3. **✅ Functional add-on**
   - Installs without errors
   - Basic functionality works
   - Graceful error handling

4. **✅ Security compliance**
   - No security vulnerabilities
   - Appropriate permissions
   - Safe defaults

5. **✅ Community value**
   - Solves real problems
   - Provides clear benefits
   - Active maintenance planned

## 📞 Support and Resources

### **HACS Resources**
- **HACS Documentation**: https://hacs.xyz/docs/
- **HACS Discord**: https://discord.gg/apgchf8
- **HACS GitHub**: https://github.com/hacs/

### **Home Assistant Resources**
- **Add-on Development**: https://developers.home-assistant.io/docs/add-ons/
- **Add-on Tutorial**: https://developers.home-assistant.io/docs/add-ons/tutorial/
- **Community Forum**: https://community.home-assistant.io/

### **Getting Help**
- **HACS Issues**: https://github.com/hacs/default/issues
- **HA Developer Discord**: https://discord.gg/c5DvZ4e
- **Repository Issues**: https://github.com/HansonTan/airsonos-optimized/issues

---

**🎯 Following this checklist ensures a smooth HACS submission process and quick approval for the Home Assistant Community Store.**

*Generated with Claude Code - Co-Authored-By: Claude <noreply@anthropic.com>*