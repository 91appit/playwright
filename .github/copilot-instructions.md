# GitHub Copilot Instructions for Playwright Repository

**Always follow these instructions first. Only fallback to additional search and context gathering if the information here is incomplete or found to be in error.**

## Repository Overview

Playwright is a framework for web testing and automation that supports Chromium, Firefox, and WebKit browsers. This is a multi-package repository (monorepo) using npm workspaces with 20+ packages in the `/packages/` directory.

**Key Packages:**
- `packages/playwright-core/` - Core browser automation APIs
- `packages/playwright/` - Test runner and framework
- `packages/playwright-test/` - Test runner core
- `packages/trace-viewer/` - Visual trace analysis tool
- `packages/html-reporter/` - HTML test reporter
- `packages/recorder/` - Codegen and recording functionality

## Prerequisites and Setup

**Node.js Requirements:**
- Requires Node.js 18 or later
- Tested with Node.js 18, 20, 22, and 24
- Check version: `node --version`

**Initial Setup Commands:**
```bash
npm ci
npm run build
npx playwright install --with-deps
```

## Build Process

**CRITICAL TIMING INFORMATION:**

- `npm ci` - Takes ~12 seconds
- `npm run build` - Takes ~17 seconds. NEVER CANCEL - always wait for completion.
- `npm run lint` - Takes ~2 minutes 20 seconds. NEVER CANCEL - set timeout to 180+ seconds.
- `npx playwright install --with-deps` - Takes ~3 seconds (if browsers already installed)

**Build Commands:**
- `npm run build` - Full production build (17 seconds)
- `npm run watch` - Development build with file watching and hot reload
- `npm run clean` - Clean build artifacts

**NEVER CANCEL any build commands. They may appear slow but will complete successfully.**

## Testing

**Test Suite Commands and Timing:**
- `npm run test` - Full library tests across all browsers (~LONG - allow 30+ minutes)
- `npm run ctest` - Chromium-only library tests (~10+ minutes)  
- `npm run ftest` - Firefox-only library tests (~10+ minutes)
- `npm run wtest` - WebKit-only library tests (~10+ minutes)
- `npm run ttest` - Test runner tests (~15+ minutes)
- `npm run atest` - Android tests
- `npm run etest` - Electron tests

**CRITICAL: NEVER CANCEL test commands. Full test suites can take 30+ minutes. Set timeouts to 60+ minutes.**

**Running Specific Tests:**
```bash
# Run a specific test file
npx playwright test --config=tests/library/playwright.config.ts --project=chromium-library tests/library/chromium/chromium.spec.ts

# Run with specific browser
npx playwright test --config=tests/library/playwright.config.ts --project=firefox-library

# Run test runner tests
npm run ttest
```

**Important Test Notes:**
- Tests run in headed mode by default, which requires X11 display
- In headless environments, some tests may fail due to display requirements
- Tests are hermetic and should not depend on external services
- All tests should work on Linux, macOS, and Windows

## Linting and Code Quality

**Linting Commands:**
- `npm run lint` - Full linting suite (ESLint + TypeScript + docs + deps) - Takes ~2m 20s
- `npm run eslint` - ESLint only
- `npm run tsc` - TypeScript type checking
- `npm run doc` - Documentation linting

**ALWAYS run `npm run lint` before committing changes or CI will fail.**

## Development Workflow

**Development Mode:**
```bash
npm run watch
```
This command:
- Builds in watch mode with hot reload
- Starts development servers for trace viewer, HTML reporter, and recorder
- Runs TypeScript compilation in watch mode
- Takes ~15 seconds to start, then runs continuously

**Hot Module Replacement (Experimental):**
```bash
PW_HMR=1 npm run watch
PW_HMR=1 npx playwright show-trace
PW_HMR=1 npm run ctest -- --ui
PW_HMR=1 npx playwright codegen
```

## Validation and Testing Your Changes

**ALWAYS validate changes with these steps:**

1. **Build Validation:**
   ```bash
   npm run build  # Must complete successfully
   ```

2. **Lint Validation:**
   ```bash
   npm run lint   # Must pass without errors (2m 20s timeout)
   ```

3. **Functional Validation:**
   Test basic Playwright functionality after changes:
   ```bash
   # Validate Playwright core functionality works
   node -e "
   const { chromium } = require('./packages/playwright-core');
   (async () => {
     console.log('Testing Playwright functionality...');
     const browser = await chromium.launch({ headless: true });
     const page = await browser.newPage();
     await page.setContent('<h1>Test</h1>');
     const text = await page.locator('h1').textContent();
     console.log('Test passed:', text === 'Test');
     await browser.close();
     console.log('Functional test completed successfully!');
   })().catch(console.error);
   "
   ```
   **This test MUST pass after any changes to validate core functionality.**

4. **Relevant Test Execution:**
   Run tests related to your changes:
   ```bash
   # For core changes
   npm run ctest

   # For test runner changes  
   npm run ttest
   ```

## Key Directories and Files

**Essential Files:**
- `package.json` - Root package configuration and scripts
- `eslint.config.mjs` - ESLint configuration
- `tsconfig.json` - TypeScript configuration
- `utils/build/build.js` - Main build script
- `utils/workspace.js` - Workspace management

**Test Directories:**
- `tests/library/` - Core library tests
- `tests/playwright-test/` - Test runner tests
- `tests/components/` - Component testing tests
- `tests/android/` - Android-specific tests
- `tests/electron/` - Electron-specific tests

**Configuration Files:**
- `tests/library/playwright.config.ts` - Library test configuration
- `tests/playwright-test/playwright.config.ts` - Test runner configuration

## CI/CD and GitHub Actions

**Main Workflows:**
- `.github/workflows/tests_primary.yml` - Primary test suite
- `.github/workflows/tests_secondary.yml` - Secondary test suite
- `.github/workflows/tests_others.yml` - Other specialized tests

**Before Creating PR:**
1. Run `npm run lint` (required - 2m 20s)
2. Run relevant test suites for your changes
3. Ensure all commands complete successfully
4. Never cancel long-running builds or tests

## Common Commands Reference

```bash
# Setup
npm ci                          # Install dependencies (12s)
npm run build                   # Production build (17s)
npx playwright install --with-deps  # Install browsers (3s)

# Development
npm run watch                   # Development mode with hot reload (continuous)
npm run lint                    # Full linting (2m 20s) - REQUIRED before commit

# Testing (NEVER CANCEL - set long timeouts)
npm run ctest                   # Chromium tests (10+ minutes)
npm run ttest                   # Test runner tests (15+ minutes)  
npm run test                    # All library tests (30+ minutes)

# Specific test execution
npx playwright test --config=tests/library/playwright.config.ts --project=chromium-library [test-file]

# Utilities
npm run doc                     # Generate documentation
npm run check-deps              # Check dependencies
npm run clean                   # Clean build artifacts
```

## Browser and Environment Notes

- Browsers are installed to `~/.cache/ms-playwright/`
- Headless mode is used by default in CI environments
- For headed testing, X11 display is required
- System dependencies are auto-installed with `--with-deps` flag

## Important Notes for Development

**Clean and Rebuild Workflow:**
If you need to start fresh:
```bash
npm run clean      # Clean all build artifacts
npm run build      # Rebuild everything (15-17 seconds)
```
**After cleaning, you MUST rebuild before running any functional tests.**

**Working with Modified Files:**
- Generated files are created during build (TypeScript types, channels, injected scripts)
- Do not edit generated files directly - they will be overwritten
- Some API types are generated from `docs/src` directory
- Always run a full build after modifying core files

**Network and Browser Limitations:**
- External network access may be restricted in some environments
- Use local files or data URIs for testing when network is unavailable
- Browsers run in headless mode by default in CI environments
- Some tests require X11 display and may fail in pure terminal environments

## Important Warnings

- **NEVER CANCEL** build or test commands - they will complete successfully
- **ALWAYS** run `npm run lint` before committing
- Set appropriate timeouts for long-running operations (60+ minutes for full tests)
- Tests are hermetic and should not depend on external network access
- Some tests may fail in headless environments due to display requirements
- After running `npm run clean`, you MUST run `npm run build` before testing functionality

This codebase uses complex build processes and extensive testing. Always allow sufficient time for operations to complete and follow the validation steps to ensure changes work correctly.