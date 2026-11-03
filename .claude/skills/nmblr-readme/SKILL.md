---
name: nmblr:readme
description: |
  Audit or generate a project README against gold-standard best practices.
  Use when onboarding a project, after major changes, or to check README quality.
user-invocable: true
argument-hint: "[--generate] [--fix]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

<skill_info>
<name>nmblr:readme</name>
<summary>Audit an existing README against best practices or generate a new one from project context. Two modes: audit (default) reports gaps, generate scaffolds a complete README.</summary>
</skill_info>

<usage>
<syntax>nmblr:readme</syntax>
<syntax>nmblr:readme --generate</syntax>
<syntax>nmblr:readme --fix</syntax>
</usage>

<options>
<option name="--generate">Generate a new README from project context (overwrites existing)</option>
<option name="--fix">Audit and automatically fix gaps (adds missing sections, does not rewrite existing content)</option>
</options>

<gold_standard_checklist>
The following checklist defines the gold-standard README structure, derived from The Good Docs Project, Best-README-Template, and patterns from Vault, Grafana, and Supabase.

## Required Sections (scored)

| # | Section | What to check | Weight |
|---|---------|---------------|--------|
| 1 | **Title + Description** | H1 with project name. 1-2 sentence description answering "what is this?". A "why" statement explaining the problem it solves. | High |
| 2 | **Built With** | Quick-glance list of key technologies with links | Medium |
| 3 | **Table of Contents** | Present if README > 150 lines. Links resolve to actual headings. | Medium |
| 4 | **Features** | Scannable bullet list of capabilities (not tech stack) | High |
| 5 | **Prerequisites** | Tools and versions required to develop | High |
| 6 | **Quick Start** | Copy-pasteable commands from clone to running. No `<placeholder>` URLs — use real repo URL. | High |
| 7 | **Project Structure** | Directory tree with annotations explaining each directory's purpose | Medium |
| 8 | **Development** | Commands (build, lint, dev, CI). Environment variables table. Docker/services setup. | High |
| 9 | **Architecture** | High-level description of backend and frontend patterns and key libraries | Medium |
| 10 | **Testing** | How to run tests. How to write tests. Integration test setup if applicable. | High |
| 11 | **API** | Endpoint table or reference. At minimum, health/readiness endpoints. | Medium |
| 12 | **Deployment** | Environments, hostnames, how deploys are triggered | Medium |
| 13 | **Contributing** | How to get started. Workflow/process (branch naming, PR process). Code conventions. | High |
| 14 | **Security** | How secrets/auth/encryption are handled. Security contact if applicable. | Medium |
| 15 | **Documentation** | Pointer to docs/ or external docs. Table of doc types if using nmblr. | Low |
| 16 | **Troubleshooting** | 3-5 common issues and fixes | Medium |
| 17 | **Getting Help** | Where to file issues, ask questions, find docs | Low |
| 18 | **License** | Copyright or license statement | High |

## Quality Checks (scored)

| # | Check | What to look for |
|---|-------|-----------------|
| Q1 | **No placeholders** | No `<repo-url>`, `<your-name>`, `{placeholder}` left in content |
| Q2 | **Real repo URL** | Clone command uses actual git URL, not a placeholder |
| Q3 | **Env file reference correct** | References `.env.example` (or whatever actually exists), not a wrong filename |
| Q4 | **Referenced files exist** | All file paths mentioned in README actually exist on disk |
| Q5 | **Makefile targets exist** | All `make X` commands reference real Makefile targets |
| Q6 | **ToC links resolve** | Every ToC link matches an actual heading |
| Q7 | **No sensitive values** | No API keys, passwords, or secrets in examples |
| Q8 | **Description has "why"** | Intro explains the problem solved, not just "what" |
| Q9 | **Commands are copy-pasteable** | Quick Start works end-to-end without hidden steps |
</gold_standard_checklist>

<execution_instructions>
When this skill is invoked, follow these steps based on the mode:

## Mode: Audit (default — no flags)

### Step 1: Gather project context

Read these files (skip any that don't exist):
- `README.md`
- `CLAUDE.md`
- `Makefile` (or `justfile`, `taskfile.yml`)
- `.env.example` (or `env-example`, `.env.sample`)
- `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml` (detect language)
- `.claude/nmblr/config.yaml`
- `.claude/nmblr/install-manifest.json`

### Step 2: Check each section

For each item in the **Required Sections** checklist:
1. Search the README for the section heading (or equivalent)
2. If found, check that it has substantive content (not just a heading with placeholder text)
3. Score: **Present** (has content), **Partial** (heading exists but content is thin/placeholder), or **Missing**

### Step 3: Run quality checks

For each item in the **Quality Checks**:
1. Q1-Q2: Grep README for `<.*>`, `{.*}`, placeholder patterns
2. Q3: Check which env file actually exists, compare to what README references
3. Q4: Extract file paths from README, verify each exists on disk
4. Q5: Extract `make` targets from README, verify each exists in Makefile
5. Q6: If ToC exists, verify each link matches a heading
6. Q7: Scan for patterns that look like secrets (base64 strings > 20 chars, `sk-`, `pk_`)
7. Q8: Check if intro has a "why" or "problem" statement (not just "X is a Y")
8. Q9: Check Quick Start has no hidden steps (references env setup before using env)

### Step 4: Output audit report

```markdown
## README Audit Report

**Overall Score:** {X}/18 sections present, {Y}/9 quality checks passing

### Section Checklist

| # | Section | Status | Notes |
|---|---------|--------|-------|
| 1 | Title + Description | ✅ Present | |
| 2 | Built With | ❌ Missing | |
| ... | ... | ... | ... |

### Quality Checks

| # | Check | Status | Notes |
|---|-------|--------|-------|
| Q1 | No placeholders | ✅ Pass | |
| Q2 | Real repo URL | ⚠️ Fail | Line 29: `<repo-url>` |
| ... | ... | ... | ... |

### Recommendations

1. **[High]** Add "Built With" section — ...
2. **[Medium]** Add Table of Contents — README is {N} lines
3. ...
```

## Mode: Generate (`--generate`)

### Step 1: Gather project context (same as audit Step 1)

### Step 2: Detect project characteristics

From the gathered files, determine:
- **Project name** — from `config.yaml`, `package.json`, `go.mod`, or directory name
- **Description** — from `CLAUDE.md` overview or `package.json` description
- **Language/framework** — from `go.mod`, `package.json`, `Cargo.toml`, etc.
- **Tech stack** — from dependencies in manifest files
- **Commands** — from Makefile targets
- **Env vars** — from `.env.example`
- **Repo URL** — from `git remote get-url origin`
- **Endpoints** — grep for route registrations
- **Doc types** — from `docs/` directory structure
- **Deploy config** — from `.github/workflows/`, `.deployment/`

### Step 3: Ask user for missing context

Use AskUserQuestion for anything that can't be auto-detected:
- Project description / "why" statement (if not in CLAUDE.md)
- Target audience
- Any sections to skip

### Step 4: Generate README

Produce a complete README following the gold-standard section order:
1. Title + Description (with "why") + Built With
2. Table of Contents
3. Features
4. Prerequisites
5. Quick Start (with real repo URL and env setup)
6. Project Structure
7. Development (Commands, Env Vars, Docker)
8. Architecture
9. Testing
10. API
11. Deployment
12. Contributing (detect nmblr workflow if config exists)
13. Security
14. Documentation
15. Troubleshooting (generate 3-5 based on detected tech)
16. Getting Help
17. License

### Step 5: Write and verify

Write the generated README and run the audit checklist against it to confirm all sections are present and quality checks pass.

## Mode: Fix (`--fix`)

### Step 1: Run audit (Steps 1-4 from Audit mode)

### Step 2: For each missing or partial section

- **Missing sections**: Generate the section content from project context (same detection as Generate mode) and append it in the correct position
- **Partial sections**: Leave existing content, add missing elements (e.g., add ToC if README > 150 lines)
- **Quality failures**: Fix automatically where possible (e.g., replace `<repo-url>` with actual repo URL from git remote)

### Step 3: Do NOT rewrite existing content

The fix mode is additive — it fills gaps but respects what's already written. It should never rewrite a section that already has substantive content.

### Step 4: Report changes made

List each change with before/after or addition summary.
</execution_instructions>

<examples>
<example>
<command>/nmblr:readme</command>
<description>Audit the existing README against the gold-standard checklist and report gaps</description>
</example>
<example>
<command>/nmblr:readme --generate</command>
<description>Generate a new README from scratch using project context (CLAUDE.md, Makefile, package.json, etc.)</description>
</example>
<example>
<command>/nmblr:readme --fix</command>
<description>Audit and automatically add missing sections without rewriting existing content</description>
</example>
</examples>
