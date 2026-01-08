# AH_Appium_TS

TypeScript mobile automation framework with WebDriverIO, Appium, Cucumber, and BrowserStack.

## Overview

A production-ready framework for automated mobile testing of 4 app variants:
- **Android Store** - Production build
- **Android Inhouse** - Internal testing build
- **iOS Store** - Production build
- **iOS Sandbox** - Internal testing build

## Key Features

- **Tag-based filtering** - Control which scenarios run via `.env` tags
- **Parallel execution** - Configurable number of concurrent workers
- **1 scenario = 1 session** - Each scenario gets its own BrowserStack session
- **Device rotation** - Round-robin across 10 devices in pool
- **Multi-locale support** - Per-scenario locale/language/timezone configuration
- **100% configurable** - Everything controlled via `.env` file

## Quick Start

```bash
# Install dependencies
npm install

# Run tests on BrowserStack
npm run test:ios-sandbox:browserstack
npm run test:android-store:browserstack

# Run tests locally
npm run test:ios-sandbox:local
npm run test:android-inhouse:local
```

## Configuration

All configuration is done via the `.env` file:

```bash
# Example: iOS Sandbox BrowserStack
IOS_SANDBOX_BS_APP_URL=           # App to test (optional, uses cache)
IOS_SANDBOX_BS_BUILD_TYPE=DAILY   # DAILY or RELEASE
IOS_SANDBOX_BS_PARALLEL_SESSIONS=2  # Number of parallel workers
IOS_SANDBOX_BS_TEST_ENVIRONMENT=rec2  # Test environment
IOS_SANDBOX_BS_TAGS=@smoke        # Cucumber tags to filter
IOS_SANDBOX_BS_DEVICE_NAME=       # Specific device (optional)
IOS_SANDBOX_BS_RANDOM_DEVICES=    # Random selection (optional)
```

## Tag Filtering

Filter scenarios using Cucumber tag expressions:

```bash
# Simple tag
IOS_SANDBOX_BS_TAGS=@smoke

# Combined tags
IOS_SANDBOX_BS_TAGS=@login and @android

# Complex expressions
IOS_SANDBOX_BS_TAGS=(@smoke or @regression) and not @wip
```

## Multi-Locale Testing

Define locale per scenario using tags:

```gherkin
@locale:de_DE @language:de @timezone:Berlin
Scenario: Test German locale
  Given The app is launched
```

## Project Structure

```
AH_Appium_TS/
├── config/
│   ├── base.conf.ts              # Base WebDriverIO config
│   ├── platforms/                # Platform-specific configs
│   └── capabilities/             # Capability builders
├── tools/
│   ├── run-parallel-tests.ts     # Test orchestration
│   ├── split-scenarios.ts        # Scenario splitting
│   ├── cache-manager.ts          # Cache CLI
│   └── cache/                    # Cache modules
├── tests/
│   ├── features/                 # Cucumber feature files
│   ├── step-definitions/         # Step implementations
│   ├── page-objects/             # Page Object Model
│   └── support/                  # Utilities and types
└── docs/                         # Documentation
```

## Cache Management

```bash
# View cached apps and devices
npm run show-cache

# Update app cache
npm run update-apps:ios-sandbox
npm run update-apps:android-inhouse

# Update device cache
npm run update-devices:ios
npm run update-devices:android

# Clear cache
npm run clear-cache
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `test:ios-sandbox:browserstack` | Run iOS Sandbox tests on BrowserStack |
| `test:ios-store:browserstack` | Run iOS Store tests on BrowserStack |
| `test:android-inhouse:browserstack` | Run Android Inhouse tests on BrowserStack |
| `test:android-store:browserstack` | Run Android Store tests on BrowserStack |
| `test:ios-sandbox:local` | Run iOS Sandbox tests locally |
| `test:android-inhouse:local` | Run Android Inhouse tests locally |
| `typecheck` | Run TypeScript type checking |
| `lint` | Run ESLint |
| `lint:fix` | Fix ESLint issues |

## Tech Stack

- **[WebDriverIO](https://webdriver.io/)** - Test framework
- **[Appium](https://appium.io/)** - Mobile automation
- **[Cucumber](https://cucumber.io/)** - BDD framework
- **[BrowserStack](https://www.browserstack.com/)** - Cloud testing platform
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Detailed architecture analysis
- [OBJECTIFS.md](./OBJECTIFS.md) - Project objectives
- [IOS_ANDROID_RESET_DIFFERENCES.md](./docs/IOS_ANDROID_RESET_DIFFERENCES.md) - Platform differences

## License

MIT
