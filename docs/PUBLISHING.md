# Publishing to NPM

This project uses GitHub Actions to automatically publish to NPM when a new version tag is pushed.

## Setup

### 1. NPM Token

You need to create an NPM access token:

1. Go to [NPM](https://www.npmjs.com/) and log in
2. Go to your profile settings
3. Click on "Access Tokens"
4. Create a new token with "Automation" type
5. Copy the token

### 2. GitHub Secrets

Add the NPM token to your GitHub repository secrets:

1. Go to your GitHub repository
2. Click on "Settings" tab
3. Click on "Secrets and variables" → "Actions"
4. Click "New repository secret"
5. Name: `NPM_TOKEN`
6. Value: Your NPM access token from step 1

### 3. Update Repository URLs

Update the repository URLs in `package.json`:

```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/YOUR_USERNAME/comfy-mqtt.git"
  },
  "bugs": {
    "url": "https://github.com/YOUR_USERNAME/comfy-mqtt/issues"
  },
  "homepage": "https://github.com/YOUR_USERNAME/comfy-mqtt#readme"
}
```

## Publishing a New Version

### 1. Update Version

```bash
npm version patch   # 1.0.0 → 1.0.1
npm version minor   # 1.0.0 → 1.1.0
npm version major   # 1.0.0 → 2.0.0
```

This will:
- Update the version in `package.json`
- Create a git tag
- Build the project
- Add the built files to git
- Push the changes and tags

### 2. Automatic Publishing

The GitHub Actions workflow will automatically:
- Trigger when the tag is pushed
- Build the project
- Publish to NPM
- Create a GitHub release

## Manual Publishing

If you want to publish manually:

```bash
npm run build
npm publish
```

## Workflows

### CI Workflow (`.github/workflows/ci.yml`)
- Runs on every push to main and pull requests
- Tests on Node.js 16, 18, and 20
- Builds the project
- Runs linting and tests (if configured)

### Publish Workflow (`.github/workflows/publish.yml`)
- Runs when a tag starting with `v` is pushed
- Builds the project
- Publishes to NPM
- Creates a GitHub release

## Package Configuration

The package is configured for global installation:

```json
{
  "bin": {
    "comfy-mqtt": "dist/cli.js"
  },
  "preferGlobal": true,
  "files": [
    "dist",
    "database",
    "README.md"
  ]
}
```

This means:
- Users can install globally with `npm install -g comfy-mqtt`
- The CLI can be run with `comfy-mqtt`
- Only necessary files are included in the package 