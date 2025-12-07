# Stardust CLI

English | [한국어](README.ko.md)

> If you find this project useful, please consider giving it a star! Your support means a lot.

AI-powered CLI tool to automatically organize your GitHub Stars into Lists.

## Features

- **Automatic Category Planning**: Gemini AI analyzes your starred repositories and creates 32 optimal categories
- **Smart Classification**: Analyzes each repository's title, description, and README to place them in appropriate categories
- **Hierarchical Naming**: Uses `Major: Minor` format like `Lang: Python`, `AI: LLM & Chatbot` (20 char limit)
- **Step-by-Step or Full Automation**: Run individual steps or execute the entire workflow at once
- **Batch Processing**: Parallel processing of 20 repositories at a time for faster classification

## Category Examples

```
Lang: Python       Lang: JS & TS      Lang: Go           Lang: Rust
Lang: Java         Lang: C & C++      Lang: ETC

AI: LLM & Chatbot  AI: Agent          AI: Image & Video  AI: RAG & Data
AI: Voice & Audio  AI: ETC

Web: Frontend      Web: Backend       Web: Crawler       Web: Mobile App
Web: ETC

Infra: Docker      Infra: Security    Infra: DB          Infra: Data & ML
Infra: ETC

Type: Self-Hosted  Type: App & Tool   Type: Starter      Type: Resource
Type: ETC
```

## Installation

### Global Install via npm (Recommended)

```bash
npm install -g stardust-cli
```

After installation, you can use the `stardust` command directly:

```bash
stardust run
```

### From Source

```bash
# Clone the repository
git clone https://github.com/hellosunghyun/stardust-cli.git
cd stardust-cli

# Install dependencies
npm install

# Build
npm run build

# Link globally
npm link
```

## Configuration

You can configure Stardust CLI in three ways:

### Option 1: CLI Arguments (Recommended for one-time use)

```bash
stardust --token ghp_xxx --username your-name --gemini-key AIza_xxx run
```

### Option 2: Environment Variables

```bash
# Linux/macOS
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
export GITHUB_USERNAME=your-username
export GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxxxxx

# Windows (PowerShell)
$env:GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
$env:GITHUB_USERNAME="your-username"
$env:GEMINI_API_KEY="AIzaxxxxxxxxxxxxxxxxxxxxxxxx"

# Windows (CMD)
set GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
set GITHUB_USERNAME=your-username
set GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxxxxx

# Then run
stardust run
```

### Option 3: `.env` File (Recommended for repeated use)

Create a `.env` file in your current directory:

```env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_USERNAME=your-username
GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxxxxx
```

### Global CLI Options

| Option | Description |
|--------|-------------|
| `--token <token>` | GitHub Personal Access Token |
| `--username <username>` | GitHub Username |
| `--gemini-key <key>` | Google Gemini API Key |
| `--max-categories <n>` | Maximum categories (default: 32) |
| `--batch-size <n>` | Batch size for classification (default: 20) |
| `--private` | Create private Lists |
| `--debug` | Enable debug mode |

### Getting a GitHub Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `read:user`
4. Generate and copy the token

### Getting a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the API key

## Usage

### Full Automation (`run` command)

```bash
# Run the full workflow (plan → delete → create → classify)
stardust run

# With inline credentials
stardust --token ghp_xxx --username myname --gemini-key AIza_xxx run

# Process only newly starred repositories (keep existing Lists)
stardust run --only-new

# Simulation mode (preview categories only)
stardust run --dry-run
```

### Step-by-Step Execution

#### 1. Plan Categories (`plan`)

```bash
# Analyze Stars and plan categories (saved to file)
stardust plan

# View saved plan
stardust plan --show

# Delete saved plan
stardust plan --delete
```

#### 2. Manage Lists (`lists`)

```bash
# View all Lists
stardust lists

# Create a new List
stardust lists --create "Lang: Python" -d "Python projects"

# Delete a specific List
stardust lists --delete "Lang: Python"

# Delete all Lists
stardust lists --delete-all
```

#### 3. Create Lists (`create-lists`)

```bash
# Create Lists from planned categories
stardust create-lists

# Create Lists even if some already exist
stardust create-lists --force
```

#### 4. Classify Stars (`classify`)

```bash
# Classify Stars into Lists
stardust classify

# Process only unclassified Stars
stardust classify --only-new

# Use existing Lists as categories (no plan file needed)
stardust classify --use-existing

# Classify new Stars using existing Lists
stardust classify --use-existing --only-new

# Reset: Remove all Stars from Lists
stardust classify --reset
```

### Command Options Summary

| Command | Option | Description |
|---------|--------|-------------|
| `run` | (none) | Full automation |
| `run` | `--only-new` | Process new Stars only |
| `run` | `--dry-run` | Simulation mode |
| `plan` | (none) | Plan categories |
| `plan` | `--show` | View saved plan |
| `plan` | `--delete` | Delete saved plan |
| `lists` | (none) | View all Lists |
| `lists` | `--create <name>` | Create new List |
| `lists` | `--delete <name>` | Delete specific List |
| `lists` | `--delete-all` | Delete all Lists |
| `lists` | `-d, --description` | List description (with --create) |
| `create-lists` | (none) | Create Lists from plan |
| `create-lists` | `--force` | Create even if Lists exist |
| `classify` | (none) | Classify Stars |
| `classify` | `--only-new` | Process unclassified only |
| `classify` | `--use-existing` | Use existing Lists as categories |
| `classify` | `--reset` | Remove all Stars from Lists |

### Manual Workflow Example

```bash
# 1. Plan categories
stardust plan

# 2. Review the plan
stardust plan --show

# 3. Delete existing Lists (if needed)
stardust lists --delete-all

# 4. Create Lists
stardust create-lists

# 5. Classify Stars
stardust classify
```

## Execution Example

```
🚀 Starting GitHub Stars auto-organization.

✔ Fetched 523 starred repositories.
✔ 32 categories have been planned.

? Delete existing 32 Lists? Yes
✔ 32 Lists deleted
✔ 32 Lists created

📂 Classifying 523 repositories in batches of 20...

── Batch 1/27 (1-20) ──
✔ README fetched
✔ Classification complete
  ✅ facebook/react → Web: Frontend
  ✅ tensorflow/tensorflow → AI: Data & ML
  ...

📊 Results:
  ✅ Success: 520
  ❌ Failed: 3

✅ Done! Stars have been organized into Lists.
```

## Project Structure

```
stardust-cli/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
└── src/
    ├── index.ts              # CLI entry point
    ├── types.ts              # Type definitions
    ├── api/
    │   ├── index.ts          # API exports
    │   ├── client.ts         # GitHub API client
    │   ├── types.ts          # API types
    │   ├── lists.ts          # Lists CRUD
    │   ├── repos.ts          # Repository queries
    │   └── readme.ts         # README fetching
    ├── commands/
    │   ├── lists.ts          # lists command
    │   ├── plan.ts           # plan command
    │   ├── create-lists.ts   # create-lists command
    │   ├── classify.ts       # classify command
    │   └── run.ts            # run command (full automation)
    ├── services/
    │   ├── index.ts          # Services exports
    │   ├── gemini.ts         # Gemini AI service
    │   └── classifier.ts     # Classification service
    ├── prompts/
    │   ├── category-planner.ts
    │   └── classifier.ts
    └── utils/
        ├── config.ts         # Environment config
        ├── rate-limiter.ts   # Rate limiting
        └── plan-storage.ts   # Plan save/load
```

## Environment Variables Reference

All available environment variables:

```env
# Required
GITHUB_TOKEN=ghp_xxxxxxxxxxxx        # GitHub Personal Access Token
GITHUB_USERNAME=your-username         # Your GitHub username
GEMINI_API_KEY=AIzaxxxxxxxxxx         # Google Gemini API Key

# Category Settings
MAX_CATEGORIES=32                     # Maximum categories (GitHub limit: 32)
MAX_CATEGORIES_PER_REPO=3             # Max categories per repo
MIN_CATEGORIES_PER_REPO=1             # Min categories per repo

# Batch Processing
CLASSIFY_BATCH_SIZE=20                # Repos per batch for classification
BATCH_DELAY=2000                      # Delay between batches (ms)

# List Settings
LIST_IS_PRIVATE=false                 # Create private Lists

# Gemini Settings
GEMINI_MODEL=gemini-2.5-flash         # Model to use
GEMINI_RPM=15                         # Requests per minute (Free tier)

# Debug
DEBUG=false                           # Enable debug output
LOG_API_RESPONSES=false               # Log raw API responses
```

## Tech Stack

- **Runtime**: Node.js / [Bun](https://bun.sh/)
- **Language**: TypeScript
- **AI**: Google Gemini (gemini-2.5-flash)
- **CLI**: Commander.js, @inquirer/prompts, ora

## Limitations

- GitHub Lists are limited to 32 maximum
- Each List name has a 20 character limit
- Gemini API Free tier: 15 requests per minute

## License

MIT
