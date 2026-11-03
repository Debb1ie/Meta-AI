---
name: nmblr:init
description: |
  Initialize or reinitialize a project for nmblr workflow.
  Bootstraps new projects or adapts existing ones to work with nmblr agents and skills.
user-invocable: true
argument-hint: "[--force] [--check-only]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - AskUserQuestion
  - WebFetch
---

<skill_info>
<name>nmblr:init</name>
<summary>Initialize or reinitialize a project for nmblr workflow.</summary>
<agent>project-init</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<agent_kit>
<repository>talino-labs/nmblr.agent-kit</repository>
<default_version>latest</default_version>
<contents>
  - scaffolds/ - Project templates for all project types
  - guides/ - Architecture and pattern documentation
  - templates/ - Document templates (PRD, RFC, PD, etc.)
  - manifest.json - Index of available scaffolds, guides, and templates
</contents>
<version_resolution>
  - "latest" = fetch most recent tag from repository
  - "v1.0.0" = pin to specific version
  - Version stored in .claude/nmblr/config.yaml as agent_kit_version
</version_resolution>
<fetch_version_command>
  # Get latest version tag
  gh api repos/talino-labs/nmblr.agent-kit/releases/latest --jq '.tag_name'

  # List all available versions
  gh api repos/talino-labs/nmblr.agent-kit/tags --jq '.[].name'
</fetch_version_command>
</agent_kit>

<guide_mapping>
<!-- Which guides to download based on project type and language -->
<mapping type="api" language="go">guides/go</mapping>
<mapping type="api" language="typescript">guides/typescript</mapping>
<mapping type="api" language="python">guides/python</mapping>
<mapping type="frontend" variant="react-vite">guides/frontend</mapping>
<mapping type="frontend" variant="react-native-expo">guides/frontend</mapping>
<mapping type="webapp" variant="nextjs">guides/frontend, guides/typescript</mapping>
<mapping type="api-frontends">guides/{api_language}, guides/frontend</mapping>
<mapping type="apps-services">guides/{primary_language}, guides/frontend</mapping>
<mapping type="library" language="go">guides/go</mapping>
<mapping type="library" language="typescript">guides/typescript</mapping>
<mapping type="library" language="python">guides/python</mapping>
<mapping type="library-monorepo">guides/typescript</mapping>
</guide_mapping>

<usage>
<syntax>nmblr:init</syntax>
<syntax>nmblr:init --force</syntax>
<syntax>nmblr:init --check-only</syntax>
</usage>

<options>
<option name="--force">Reinitialize even if config exists (will ask for confirmation)</option>
<option name="--check-only">Analyze project without making changes</option>
</options>

<execution_instructions>
When this skill is invoked:

1. **Detect Project State**
   - Check for existing `.claude/nmblr/config.yaml`
   - Scan for existing code structure (package.json, go.mod, pyproject.toml)
   - Detect existing patterns and frameworks

2. **Route Based on State**
   - **New Project**: Full interactive setup and scaffolding
   - **Existing Project**: Analyze, propose adaptations, update config
   - **Already Initialized**: Offer reinitialization with --force

3. **Fetch Scaffolds from Agent Kit** (for new projects)
   - Scaffolds and guides are stored in the remote `nmblr.agent-kit` repository
   - Fetch the required scaffold based on project type and language:
   ```bash
   # Fetch manifest to check available scaffolds
   gh api repos/talino-labs/nmblr.agent-kit/contents/manifest.json | jq -r '.content' | base64 -d

   # Download specific scaffold (e.g., api/go)
   gh api repos/talino-labs/nmblr.agent-kit/tarball/v1.0.0 | tar xz --strip-components=2 -C /tmp/scaffold scaffolds/api/go

   # Or fetch individual files
   gh api repos/talino-labs/nmblr.agent-kit/contents/scaffolds/api/go/manifest.yaml | jq -r '.content' | base64 -d
   ```
   - Process templates: Replace `{{variable}}` placeholders with user-provided values
   - Copy processed files to project directory

4. **Download Architecture Guides** (required)
   - Guides are essential for Claude to understand project patterns during development
   - Download relevant guides based on project language/type to `.claude/nmblr/guides/`
   - Fetch from agent-kit: `guides/{language}/` (e.g., guides/go/, guides/typescript/)
   - For frontend projects, also fetch: `guides/frontend/`
   - For monorepos with mixed languages, fetch all relevant guides
   ```bash
   # Download guides for a Go project
   gh api repos/talino-labs/nmblr.agent-kit/tarball/v1.2.0 | \
     tar xz --strip-components=2 -C .claude/nmblr/guides "*/guides/go"

   # Download frontend guides
   gh api repos/talino-labs/nmblr.agent-kit/tarball/v1.2.0 | \
     tar xz --strip-components=2 -C .claude/nmblr/guides "*/guides/frontend"
   ```

5. **Download Document Templates** (required)
   - Templates are needed for creating nmblr documents (PRD, RFC, PD, etc.)
   - Download all templates to `.claude/nmblr/templates/`
   ```bash
   # Download all document templates
   gh api repos/talino-labs/nmblr.agent-kit/tarball/v1.2.0 | \
     tar xz --strip-components=1 -C .claude/nmblr/templates "*/templates"
   ```

6. **Delegate to project-init agent**
   - Pass detected state and fetched scaffold
   - Agent handles interactive questioning
   - Agent processes templates and creates files
</execution_instructions>

<project_types>
<type id="api">
<name>API Only</name>
<description>Backend API server without frontend</description>
<languages>Go, TypeScript (Express/Fastify), Python (FastAPI)</languages>
<pattern>Hexagonal Architecture</pattern>
</type>

<type id="frontend">
<name>Frontend Only</name>
<description>Single-page application or static site</description>
<frameworks>React (Vite), React Native (Expo)</frameworks>
<pattern>Bulletproof React</pattern>
</type>

<type id="webapp">
<name>Webapp</name>
<description>Full-stack application with integrated backend and frontend</description>
<frameworks>Next.js (App Router)</frameworks>
<pattern>Next.js conventions + Bulletproof React structure</pattern>
</type>

<type id="api-frontends">
<name>API with Frontends</name>
<description>Central API serving multiple frontend applications</description>
<structure>Monorepo with apps/ and packages/</structure>
<pattern>Hexagonal API + Bulletproof React frontends</pattern>
<reference>Current project structure (gahi-platform)</reference>
</type>

<type id="apps-services">
<name>Apps and Services</name>
<description>Multiple frontends and backends as independent services</description>
<structure>Monorepo with multiple apps and shared packages</structure>
<pattern>Service-oriented architecture</pattern>
<reference>https://github.com/talino-labs/tds.wallet</reference>
</type>

<type id="library">
<name>Library / Package</name>
<description>Publishable library for npm, PyPI, or Go modules</description>
<languages>TypeScript, Go, Python</languages>
<pattern>Standard library structure with exports, docs, and examples</pattern>
<publishable>true</publishable>
</type>

<type id="library-monorepo">
<name>Library Monorepo</name>
<description>Multiple related libraries in a single repository</description>
<structure>Monorepo with packages/ directory</structure>
<pattern>Changesets for versioning, shared tooling</pattern>
<examples>@tanstack/*, lodash-es, etc.</examples>
</type>
</project_types>

<scaffolding_requirements>
<requirement id="standardized-commands">
All projects MUST have consistent commands regardless of language/tool:

**Standard Commands (required):**
| Command | Make | PNPM/NPM | Go | Description |
|---------|------|----------|-----|-------------|
| build | `make build` | `pnpm build` | `go build ./...` | Build the project |
| test | `make test` | `pnpm test` | `go test ./...` | Run unit tests |
| lint | `make lint` | `pnpm lint` | `golangci-lint run` | Run linter |
| dev | `make dev` | `pnpm dev` | `go run ./cmd/server` | Start dev server |
| docker-build | `make docker-build` | - | - | Build Docker image |
| docker-up | `make docker-up` | - | - | Start with docker-compose |

**Monorepo Commands (Turborepo):**
| Command | Description |
|---------|-------------|
| `turbo build` | Build all packages/apps |
| `turbo test` | Test all packages/apps |
| `turbo lint` | Lint all packages/apps |
| `turbo dev` | Start all dev servers |

**Makefile Template (for Go projects):**
```makefile
.PHONY: build test lint dev docker-build docker-up

build:
	go build -o bin/server ./cmd/server

test:
	go test -v ./...

lint:
	golangci-lint run

dev:
	go run ./cmd/server

docker-build:
	docker build -t $(PROJECT_NAME) .

docker-up:
	docker-compose --profile dev up -d
```
</requirement>

<requirement id="docker">
All applications (except React Native Expo) must be packageable as Docker images.
Include multi-stage Dockerfile for production builds.
</requirement>

<requirement id="expo-eas">
React Native Expo projects configured for EAS Build and EAS Submit.
Include eas.json configuration.
</requirement>

<requirement id="docker-compose">
Include docker-compose.yml with TWO profiles:

**Profiles:**
- `dev` - For manual testing by developers
- `test` - For automated/manual integration tests

**Usage:**
```bash
# Start dev environment
docker-compose --profile dev up -d

# Start test environment
docker-compose --profile test up -d

# Stop all
docker-compose down
```

**Standard Credentials (for all local dev/test):**
- Username: `dev`
- Password: `dev`
- Database name: `{project_name}_dev` or `{project_name}_test`

**Example docker-compose.yml:**
```yaml
services:
  postgres:
    image: postgres:16-alpine
    profiles: [dev, test]
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: myproject_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    profiles: [dev, test]
    ports:
      - "6379:6379"

  # App container for integration tests
  app:
    build: .
    profiles: [test]
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgres://dev:dev@postgres:5432/myproject_test
      REDIS_URL: redis://redis:6379

volumes:
  postgres_data:
```
</requirement>

<requirement id="readme">
Comprehensive README.md with:
- Project overview and purpose
- Prerequisites and system requirements
- Quick start guide
- Development setup instructions
- Testing instructions
- Deployment guide
- Architecture overview
- Contributing guidelines
</requirement>

<requirement id="claude-md">
CLAUDE.md MUST be created during scaffolding with:
- Project structure explanation
- Build and development commands (using standardized commands)
- Code conventions
- Testing approach
- Key architectural decisions
- Docker-compose usage (profiles: dev, test)

**Creation:** CLAUDE.md is generated from scaffold template during Phase 8 (Scaffolding).
If not created, the init process should fail or warn.
</requirement>

<requirement id="architecture-guides">
Architecture guides in `.claude/nmblr/guides/` with:
- Language-specific implementation patterns (e.g., guides/go/, guides/typescript/)
- Framework-specific guides (e.g., guides/frontend/ for React projects)
- These guides help Claude understand project conventions during development
- Downloaded from nmblr.agent-kit during initialization
</requirement>

<requirement id="library-exports" applies_to="library,library-monorepo">
Clear package exports with:
- Main entry point (index.ts/js, main.go, __init__.py)
- TypeScript declarations (.d.ts) for TS libraries
- Proper exports field in package.json
- Subpath exports if applicable
</requirement>

<requirement id="library-docs" applies_to="library,library-monorepo">
API documentation with:
- Comprehensive README with usage examples
- API reference (auto-generated or manual)
- Examples directory with working code
- CHANGELOG.md for version history
- CONTRIBUTING.md for contributors
</requirement>

<requirement id="library-ci" applies_to="library,library-monorepo">
CI/CD for libraries:
- Automated testing on PR
- Automated publishing on release
- Version bump automation
- Documentation generation
</requirement>
</scaffolding_requirements>

<dependency_options>
<category name="Database">
<option>PostgreSQL</option>
<option>MySQL</option>
<option>MongoDB</option>
<option>SQLite (dev only)</option>
<option>None</option>
</category>

<category name="Cache">
<option>Redis</option>
<option>Memcached</option>
<option>None</option>
</category>

<category name="Message Queue">
<option>RabbitMQ</option>
<option>Redis Pub/Sub</option>
<option>AWS SQS</option>
<option>None</option>
</category>

<category name="Object Storage">
<option>S3 / MinIO</option>
<option>GCS</option>
<option>Local filesystem</option>
<option>None</option>
</category>

<category name="Authentication">
<option>None (internal service)</option>
<option>API Key</option>
<option>JWT</option>
<option>OAuth2 / OIDC</option>
</category>
</dependency_options>

<additional_configuration>
<config name="Package Manager" applies_to="typescript">
<option default="true">pnpm (recommended for monorepos)</option>
<option>npm</option>
<option>yarn</option>
<option>bun</option>
</config>

<config name="Testing Framework">
<option language="go">Go testing + testify</option>
<option language="typescript">Vitest (recommended)</option>
<option language="typescript">Jest</option>
<option language="python">pytest</option>
<option type="e2e-web">Playwright</option>
<option type="e2e-mobile">Maestro</option>
<option type="mobile-unit">Jest + React Native Testing Library</option>
<option type="mobile-component">Storybook for React Native</option>
</config>

<config name="Deployment Target">
<option>Docker only (self-managed)</option>
<option>Vercel (Next.js)</option>
<option>AWS (ECS/Lambda)</option>
<option>GCP (Cloud Run)</option>
<option>Kubernetes</option>
</config>

<config name="Monorepo Tool" applies_to="api-frontends,apps-services">
<option language="typescript" default="true">Turborepo</option>
<option language="go">Go Workspaces</option>
<option language="python">Poetry workspaces</option>
</config>

<config name="License">
<option>MIT</option>
<option>Apache 2.0</option>
<option>Proprietary (no LICENSE file)</option>
</config>

<config name="Git Hooks">
<option default="true">Pre-commit (lint, format)</option>
<option>Conventional commits validation</option>
<option>None</option>
</config>

<config name="Publishing Registry" applies_to="library,library-monorepo">
<option language="typescript" default="true">npm (public)</option>
<option language="typescript">npm (private/scoped)</option>
<option language="typescript">GitHub Packages</option>
<option language="go">Go Proxy (proxy.golang.org)</option>
<option language="python">PyPI (public)</option>
<option language="python">PyPI (private)</option>
</config>

<config name="Versioning Strategy" applies_to="library,library-monorepo">
<option default="true">Semantic Versioning (semver)</option>
<option language="typescript">Changesets (monorepo)</option>
<option>CalVer (calendar versioning)</option>
</config>

<config name="Documentation" applies_to="library,library-monorepo">
<option language="typescript" default="true">TypeDoc</option>
<option language="go">Go Doc</option>
<option language="python">Sphinx</option>
<option language="python">MkDocs</option>
<option>README only</option>
</config>

<config name="Build Target" applies_to="library" language="typescript">
<option default="true">ESM + CJS (dual)</option>
<option>ESM only</option>
<option>CJS only</option>
</config>
</additional_configuration>

<examples>
<example>
<command>/nmblr:init</command>
<description>Initialize a new or existing project interactively</description>
</example>

<example>
<command>/nmblr:init --check-only</command>
<description>Analyze project structure without making changes</description>
</example>

<example>
<command>/nmblr:init --force</command>
<description>Reinitialize project (asks for confirmation before overwriting)</description>
</example>
</examples>

<workflow_new_project>
<phase number="1" name="Project Context">
<description>Start by understanding the project to inform subsequent choices</description>
<question>What are you building? (describe your project)</question>
<note>Free text description - e.g., "E-commerce platform for local artisans"</note>

<question>What domain is this project in?</question>
<options>
- **E-commerce** - Online shopping, marketplace, payments
- **Social/Community** - Social network, forums, messaging
- **Productivity** - Task management, collaboration, documents
- **Content/Media** - CMS, streaming, publishing
- **Fintech** - Banking, payments, trading
- **Healthcare** - Medical records, appointments, telehealth
- **Real-time** - Chat, live updates, gaming
- **Developer Tools** - APIs, SDKs, developer platforms
- **Internal Service** - Microservice, background jobs
- **Other** - Custom domain
</options>
<note>Domain is used to suggest appropriate infrastructure and architecture</note>
</phase>

<phase number="2" name="Research">
<description>Optional research before making technical decisions</description>
<question>Would you like me to research before we continue?</question>
<options>
- **Research best practices** - Best practices for {domain} projects
- **Research architectures** - Common architectures for similar projects
- **Research technologies** - Recommended tech stack for {domain}
- **Skip research** - I know what I need, continue to setup
</options>

<condition choice="research">
<action>Spawn research agent with domain context</action>
<action>Present research findings</action>
<action>Continue to next phase after review</action>
</condition>
</phase>

<phase number="3" name="High-Level Intent">
<description>Determine project type - may suggest based on context</description>
<suggestion>Based on "{description}", this sounds like: {suggested_type}</suggestion>
<question>What are you building?</question>
<options>
- **App** - User-facing application (web or mobile)
- **API** - Backend service/API
- **Library** - Reusable package/library
</options>
</phase>

<phase number="4" name="Type-Specific Questions">
<!-- APP FLOW -->
<condition intent="app">
<question>What type of app?</question>
<options>
- **Web App** - Browser-based application
- **Mobile App** - iOS/Android application
</options>

<question>What's the architecture?</question>
<options>
- **Standalone** - Frontend only (no backend) → scaffold: frontend
- **With Backend** - Single frontend + single API → scaffold: api-frontends
- **Multiple Frontends** - Multiple apps sharing a backend → scaffold: api-frontends
- **Multiple Apps & Services** - Multiple frontends + multiple backends → scaffold: apps-services
</options>
</condition>

<!-- API FLOW -->
<condition intent="api">
<question>Does this API serve frontends?</question>
<options>
- **API Only** - Standalone backend service → scaffold: api/{language}
- **API + Frontends** - Backend with one or more frontends → scaffold: api-frontends
</options>

<condition choice="api_frontends">
<question>How many frontends?</question>
<question>For each: type (web/mobile) and name</question>
</condition>
</condition>

<!-- LIBRARY FLOW -->
<condition intent="library">
<question>Single package or monorepo?</question>
<options>
- **Single Library** - One publishable package → scaffold: library/{language}
- **Library Monorepo** - Multiple related packages → scaffold: library-monorepo
</options>
</condition>
</phase>

<phase number="5" name="Component Configuration">
<description>For monorepos and multi-component projects, configure each component</description>

<!-- API Component -->
<component type="api">
<question>What should the API be called? (default: "api")</question>
<question>API language?</question>
<options>
- Go (Chi framework) - Recommended for high-performance
- TypeScript (Express framework)
- Python (FastAPI framework)
</options>
</component>

<!-- Frontend Components -->
<component type="frontend" repeatable="true">
<question>Frontend name? (e.g., "web", "mobile", "dashboard")</question>
<question>Platform?</question>
<options>
- Web (React + Vite)
- Mobile (React Native + Expo)
- Web Full-stack (Next.js)
</options>
</component>

<!-- Service Components (apps-services only) -->
<component type="service" repeatable="true" applies_to="apps-services">
<question>Service name? (e.g., "auth-service", "payment-service")</question>
<question>Service language?</question>
<options>
- Go (Chi framework)
- TypeScript (Express framework)
- Python (FastAPI framework)
</options>
</component>

<note>Mixed languages supported: e.g., Go API + TypeScript React frontends</note>
</phase>

<phase number="6" name="Infrastructure">
<description>Context-aware infrastructure suggestions based on domain</description>

<domain_suggestions>
<!-- Suggest infrastructure based on domain -->
<domain name="e-commerce">
  <suggested>PostgreSQL, Redis, S3, JWT</suggested>
  <optional>RabbitMQ (order processing), Elasticsearch (product search)</optional>
</domain>
<domain name="social">
  <suggested>PostgreSQL, Redis, S3, OAuth</suggested>
  <optional>Redis Pub/Sub (notifications), Elasticsearch (search)</optional>
</domain>
<domain name="real-time">
  <suggested>PostgreSQL, Redis, JWT</suggested>
  <optional>Redis Pub/Sub (real-time updates)</optional>
</domain>
<domain name="fintech">
  <suggested>PostgreSQL, Redis, OAuth + MFA</suggested>
  <optional>RabbitMQ (transactions), Audit logging</optional>
</domain>
<domain name="content">
  <suggested>PostgreSQL, Redis, S3, OAuth</suggested>
  <optional>CDN, Search</optional>
</domain>
<domain name="productivity">
  <suggested>PostgreSQL, Redis, S3, OAuth</suggested>
  <optional>WebSockets (collaboration)</optional>
</domain>
<domain name="developer-tools">
  <suggested>PostgreSQL, API Key</suggested>
  <optional>Redis (rate limiting)</optional>
</domain>
<domain name="internal-service">
  <suggested>PostgreSQL</suggested>
  <optional>Redis, RabbitMQ</optional>
</domain>
</domain_suggestions>

<question>For {domain}, you'll likely need the following. Accept or customize?</question>
<presentation>
Suggested (pre-selected based on {domain}):
  ✓ {suggested_database} - {reason}
  ✓ {suggested_cache} - {reason}
  ✓ {suggested_storage} - {reason}
  ✓ {suggested_auth} - {reason}

Optional (select if needed):
  ○ {optional_queue} - {reason}
  ○ {optional_search} - {reason}
</presentation>

<options>
- **Accept suggestions** - Use recommended infrastructure
- **Customize** - Select specific infrastructure options
</options>

<condition choice="customize">
<question>Database? (PostgreSQL, MySQL, MongoDB, SQLite, None)</question>
<question>Cache? (Redis, None)</question>
<question>Message queue? (RabbitMQ, Redis Pub/Sub, None)</question>
<question>Object storage? (S3/MinIO, None)</question>
<question>Authentication? (None, API Key, JWT, OAuth2/OIDC)</question>
</condition>
</phase>

<phase number="7" name="Additional Config">
<question>Package manager? (pnpm, npm, yarn, bun) - for JS/TS projects</question>
<question>Deployment target?</question>
<options>
- Docker only (self-managed)
- Vercel (Next.js)
- AWS (ECS/Lambda)
- GCP (Cloud Run)
</options>
<question>License?</question>
<options>
- MIT
- Apache 2.0
- Proprietary
</options>
</phase>

<phase number="8" name="GitHub & Scaffolding">
<question>GitHub repository? (auto-detect or specify owner/repo)</question>
<question>GitHub Project board number? (optional, for issue tracking)</question>
<question>Agent kit version? (default: latest)</question>

<action>Resolve agent-kit version (latest → actual tag, or use pinned version)</action>
<action>Fetch scaffold(s) from nmblr.agent-kit repository at resolved version</action>
<action>For monorepos: fetch each component's scaffold based on language/framework</action>
<action>Process templates with user-provided variables</action>
<action>Create directory structure from scaffold</action>
<action>Initialize package manager / go mod / pyproject</action>
<action>Create Dockerfiles (from scaffold)</action>
<action>Create docker-compose.yml (from scaffold)</action>
<action>Create README.md (from scaffold)</action>
<action>Create CLAUDE.md (from scaffold)</action>
<action>Create .claude/nmblr/config.yaml with component configuration</action>
<action>Initialize git (if not exists)</action>
<action>Create .gitignore (from scaffold)</action>
<action>Create .env.example (from scaffold)</action>
<action>Download architecture guides to .claude/nmblr/guides/</action>
<action>Download document templates to .claude/nmblr/templates/</action>
</phase>

<phase number="9" name="Document Creation">
<question>Would you like to create initial planning documents?</question>
<options>
- **Yes, create documents** - Select which documents to create
- **No, skip for now** - Complete initialization without documents
- **Bare minimum + implement** - Create anchor documents (PRD + AD for prd-first, AD only for ad-first), then RFC, then start execution
</options>

<condition choice="yes">
<note>Read document_flow from .claude/nmblr/config.yaml (default: prd-first). Present the anchor document type first based on document_flow: PRD for prd-first, AD for ad-first.</note>
<question>Select documents to create (multi-select):</question>
<options multiselect="true" document_flow="prd-first">
- [ ] PRD - Product Requirements Document (product goals, features, user stories)
- [ ] PD - Problem Documents (bugs, issues, requirements gaps)
- [ ] AD - Architecture Documents (system architecture, components)
- [ ] PPD - Project Plan Document (timeline, milestones, team)
- [ ] TP - Test Plan (testing strategy and scope)
- [ ] TC - Test Cases (individual test definitions)
</options>
<options multiselect="true" document_flow="ad-first">
- [ ] AD - Architecture Documents (system architecture, components)
- [ ] PD - Problem Documents (bugs, issues, requirements gaps)
- [ ] PRD - Product Requirements Document (product goals, features, user stories)
- [ ] PPD - Project Plan Document (timeline, milestones, team)
- [ ] TP - Test Plan (testing strategy and scope)
- [ ] TC - Test Cases (individual test definitions)
</options>
<action>Spawn writer agent for each selected document type</action>
<action>Each agent conducts interactive Q&A and creates document</action>
</condition>

<condition choice="bare_minimum">
<note>Read document_flow from .claude/nmblr/config.yaml (default: prd-first)</note>
<condition document_flow="prd-first">
<action>Spawn prd-writer agent for basic PRD</action>
<action>Spawn ad-writer agent for architecture overview</action>
<action>Spawn rfc-writer agent to create RFC from PRD + AD</action>
<action>Spawn rfc-planner agent to plan the RFC</action>
<action>Spawn rfc-executor agent to begin implementation</action>
</condition>
<condition document_flow="ad-first">
<action>Spawn ad-writer agent for architecture overview (skip PRD)</action>
<action>Spawn rfc-writer agent to create RFC from AD</action>
<action>Spawn rfc-planner agent to plan the RFC</action>
<action>Spawn rfc-executor agent to begin implementation</action>
</condition>
</condition>
</phase>

<phase number="10" name="RFC & Implementation">
<condition choice="yes_documents">
<question>Ready to start implementation?</question>
<options>
- **Create RFC and start now** - Create RFC from documents, plan, and execute
- **Create RFC only** - Create RFC but don't start execution
- **Do it later** - Complete init without RFC (use /nmblr:create RFC later)
</options>
</condition>

<condition choice="rfc_now">
<action>Spawn rfc-writer agent referencing created documents</action>
<action>Spawn rfc-planner agent to create execution plan</action>
<action>Spawn rfc-executor agent to begin implementation</action>
</condition>

<condition choice="rfc_only">
<action>Spawn rfc-writer agent referencing created documents</action>
<action>Report RFC created, user can run /nmblr:plan and /nmblr:execute later</action>
</condition>
</phase>
</workflow_new_project>

<workflow_existing_project>
<phase number="1" name="Analysis">
<action>Scan for package.json, go.mod, pyproject.toml</action>
<action>Detect frameworks (Next.js, Express, Chi, etc.)</action>
<action>Identify project structure pattern</action>
<action>Check for Docker, README, CLAUDE.md</action>
<action>Map to closest project type</action>
</phase>

<phase number="2" name="Gap Analysis">
<action>Compare against nmblr requirements</action>
<action>Identify missing files (CLAUDE.md, docker-compose, etc.)</action>
<action>Note structural differences from patterns</action>
</phase>

<phase number="3" name="Proposal">
<question>Present findings to user</question>
<options>
- Restructure project to match pattern (more invasive)
- Adapt nmblr config to match project (less invasive)
- Hybrid approach (fill gaps without restructuring)
</options>
</phase>

<phase number="4" name="Execution">
<action>Create missing files (CLAUDE.md, config.yaml, etc.)</action>
<action>Update config to match project structure</action>
<action>Optionally restructure if user approves</action>
</phase>
</workflow_existing_project>
