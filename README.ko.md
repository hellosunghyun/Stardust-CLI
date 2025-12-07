# Stardust CLI

[English](README.md) | 한국어

> 이 프로젝트가 유용하셨다면 스타를 눌러주세요! 큰 힘이 됩니다.

AI 기반 CLI 도구로 GitHub Stars를 자동으로 Lists에 정리합니다.

## 주요 기능

- **자동 카테고리 계획**: Gemini AI가 Star한 저장소를 분석하여 최적의 32개 카테고리 생성
- **스마트 분류**: 각 저장소의 제목, 설명, README를 분석하여 적절한 카테고리에 배치
- **계층적 네이밍**: `Major: Minor` 형식 사용 (예: `Lang: Python`, `AI: LLM & Chatbot`, 최대 20자)
- **단계별 또는 자동화 실행**: 개별 단계 실행 또는 전체 워크플로우 한 번에 실행
- **배치 처리**: 한 번에 20개 저장소를 병렬 처리하여 빠른 분류

## 카테고리 예시

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

## 설치

### npm을 통한 전역 설치 (권장)

```bash
npm install -g stardust-cli
```

설치 후 `stardust` 명령어를 바로 사용할 수 있습니다:

```bash
stardust run
```

### 소스에서 설치

```bash
# 저장소 클론
git clone https://github.com/hellosunghyun/stardust-cli.git
cd stardust-cli

# 의존성 설치
npm install

# 빌드
npm run build

# 전역 링크
npm link
```

## 설정

Stardust CLI는 세 가지 방법으로 설정할 수 있습니다:

### 방법 1: CLI 인수 (일회성 사용에 권장)

```bash
stardust --token ghp_xxx --username your-name --gemini-key AIza_xxx run
```

### 방법 2: 환경 변수

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

# 실행
stardust run
```

### 방법 3: `.env` 파일 (반복 사용에 권장)

현재 디렉토리에 `.env` 파일을 생성합니다:

```env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_USERNAME=your-username
GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxxxxx
```

### 전역 CLI 옵션

| 옵션 | 설명 |
|------|------|
| `--token <token>` | GitHub Personal Access Token |
| `--username <username>` | GitHub 사용자명 |
| `--gemini-key <key>` | Google Gemini API 키 |
| `--max-categories <n>` | 최대 카테고리 수 (기본값: 32) |
| `--batch-size <n>` | 분류 배치 크기 (기본값: 20) |
| `--private` | 비공개 Lists 생성 |
| `--debug` | 디버그 모드 활성화 |

### GitHub Token 발급

1. [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens) 이동
2. "Generate new token (classic)" 클릭
3. 스코프 선택: `repo`, `read:user`
4. 토큰 생성 및 복사

### Gemini API 키 발급

1. [Google AI Studio](https://aistudio.google.com/app/apikey) 이동
2. "API 키 만들기" 클릭
3. API 키 복사

## 사용법

### 전체 자동화 (`run` 명령)

```bash
# 전체 워크플로우 실행 (계획 → 삭제 → 생성 → 분류)
stardust run

# 인라인 인증 정보 사용
stardust --token ghp_xxx --username myname --gemini-key AIza_xxx run

# 새로 Star한 저장소만 처리 (기존 Lists 유지)
stardust run --only-new

# 시뮬레이션 모드 (카테고리 계획만 미리보기)
stardust run --dry-run
```

### 단계별 실행

#### 1. 카테고리 계획 (`plan`)

```bash
# Stars 분석 및 카테고리 계획 (파일에 저장)
stardust plan

# 저장된 계획 보기
stardust plan --show

# 저장된 계획 삭제
stardust plan --delete
```

#### 2. Lists 관리 (`lists`)

```bash
# 모든 Lists 보기
stardust lists

# 새 List 생성
stardust lists --create "Lang: Python" -d "Python 프로젝트"

# 특정 List 삭제
stardust lists --delete "Lang: Python"

# 모든 Lists 삭제
stardust lists --delete-all
```

#### 3. Lists 생성 (`create-lists`)

```bash
# 계획된 카테고리로 Lists 생성
stardust create-lists

# 일부 이미 존재해도 추가 생성
stardust create-lists --force
```

#### 4. Stars 분류 (`classify`)

```bash
# Stars를 Lists에 분류
stardust classify

# 미분류된 Stars만 처리
stardust classify --only-new

# 기존 Lists를 카테고리로 사용 (계획 파일 불필요)
stardust classify --use-existing

# 기존 Lists 사용하여 새 Stars만 분류
stardust classify --use-existing --only-new

# 초기화: 모든 Stars를 Lists에서 제거
stardust classify --reset
```

### 명령 옵션 요약

| 명령 | 옵션 | 설명 |
|------|------|------|
| `run` | (없음) | 전체 자동화 |
| `run` | `--only-new` | 새 Stars만 처리 |
| `run` | `--dry-run` | 시뮬레이션 모드 |
| `plan` | (없음) | 카테고리 계획 |
| `plan` | `--show` | 저장된 계획 보기 |
| `plan` | `--delete` | 저장된 계획 삭제 |
| `lists` | (없음) | 모든 Lists 보기 |
| `lists` | `--create <name>` | 새 List 생성 |
| `lists` | `--delete <name>` | 특정 List 삭제 |
| `lists` | `--delete-all` | 모든 Lists 삭제 |
| `lists` | `-d, --description` | List 설명 (--create와 함께) |
| `create-lists` | (없음) | 계획에서 Lists 생성 |
| `create-lists` | `--force` | Lists 존재해도 생성 |
| `classify` | (없음) | Stars 분류 |
| `classify` | `--only-new` | 미분류만 처리 |
| `classify` | `--use-existing` | 기존 Lists를 카테고리로 사용 |
| `classify` | `--reset` | 모든 Stars를 Lists에서 제거 |

### 수동 워크플로우 예시

```bash
# 1. 카테고리 계획
stardust plan

# 2. 계획 검토
stardust plan --show

# 3. 기존 Lists 삭제 (필요시)
stardust lists --delete-all

# 4. Lists 생성
stardust create-lists

# 5. Stars 분류
stardust classify
```

## 실행 예시

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

## 프로젝트 구조

```
stardust-cli/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
└── src/
    ├── index.ts              # CLI 진입점
    ├── types.ts              # 타입 정의
    ├── api/
    │   ├── index.ts          # API exports
    │   ├── client.ts         # GitHub API 클라이언트
    │   ├── types.ts          # API 타입
    │   ├── lists.ts          # Lists CRUD
    │   ├── repos.ts          # 저장소 쿼리
    │   └── readme.ts         # README 조회
    ├── commands/
    │   ├── lists.ts          # lists 명령
    │   ├── plan.ts           # plan 명령
    │   ├── create-lists.ts   # create-lists 명령
    │   ├── classify.ts       # classify 명령
    │   └── run.ts            # run 명령 (전체 자동화)
    ├── services/
    │   ├── index.ts          # Services exports
    │   ├── gemini.ts         # Gemini AI 서비스
    │   └── classifier.ts     # 분류 서비스
    ├── prompts/
    │   ├── category-planner.ts
    │   └── classifier.ts
    └── utils/
        ├── config.ts         # 환경 설정
        ├── rate-limiter.ts   # Rate limiting
        └── plan-storage.ts   # 계획 저장/로드
```

## 환경 변수 참조

사용 가능한 모든 환경 변수:

```env
# 필수
GITHUB_TOKEN=ghp_xxxxxxxxxxxx        # GitHub Personal Access Token
GITHUB_USERNAME=your-username         # GitHub 사용자명
GEMINI_API_KEY=AIzaxxxxxxxxxx         # Google Gemini API 키

# 카테고리 설정
MAX_CATEGORIES=32                     # 최대 카테고리 수 (GitHub 제한: 32)
MAX_CATEGORIES_PER_REPO=3             # 저장소당 최대 카테고리 수
MIN_CATEGORIES_PER_REPO=1             # 저장소당 최소 카테고리 수

# 배치 처리
CLASSIFY_BATCH_SIZE=20                # 분류당 배치 저장소 수
BATCH_DELAY=2000                      # 배치 간 딜레이 (ms)

# List 설정
LIST_IS_PRIVATE=false                 # 비공개 Lists 생성

# Gemini 설정
GEMINI_MODEL=gemini-2.5-flash         # 사용할 모델
GEMINI_RPM=15                         # 분당 요청 수 (무료 티어)

# 디버그
DEBUG=false                           # 디버그 출력 활성화
LOG_API_RESPONSES=false               # 원시 API 응답 로깅
```

## 기술 스택

- **런타임**: Node.js / [Bun](https://bun.sh/)
- **언어**: TypeScript
- **AI**: Google Gemini (gemini-2.5-flash)
- **CLI**: Commander.js, @inquirer/prompts, ora

## 제한 사항

- GitHub Lists는 최대 32개로 제한
- 각 List 이름은 20자 제한
- Gemini API 무료 티어: 분당 15 요청

## 라이선스

MIT
