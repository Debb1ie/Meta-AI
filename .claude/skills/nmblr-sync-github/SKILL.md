---
name: nmblr:sync-github
description: |
  Synchronize documents with GitHub Issues and Projects.
  Use when user wants to sync documents to GitHub, update project board status, or verify sync state.
user-invocable: true
argument-hint: "[doc-id] [--setup] [--status STATUS] [--all-unsynced] [--verify] [--import] [--sync-milestones PPD-ID] [--sync-assignees]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - AskUserQuestion
---

<skill_info>
<name>nmblr:sync-github</name>
<summary>Synchronize nmblr documents with GitHub Issues and Projects.</summary>
<agent>github-sync</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:sync-github --setup</syntax>
<syntax>nmblr:sync-github &lt;doc-id&gt;</syntax>
<syntax>nmblr:sync-github &lt;doc-id&gt; --status &lt;status&gt;</syntax>
<syntax>nmblr:sync-github --all-unsynced</syntax>
<syntax>nmblr:sync-github --verify</syntax>
<syntax>nmblr:sync-github --check-merged</syntax>
<syntax>nmblr:sync-github --sync-milestones &lt;ppd-id&gt;</syntax>
<syntax>nmblr:sync-github --sync-assignees</syntax>
<syntax>nmblr:sync-github --import</syntax>
<syntax>nmblr:sync-github --import --label bug</syntax>
<syntax>nmblr:sync-github --import-all --label bug</syntax>
<syntax>nmblr:sync-github --refresh-cache</syntax>
</usage>

<arguments>
<argument name="doc-id" required="false">
<description>Document ID to sync (e.g., PD-0005, RFC-0010, TD-0001)</description>
</argument>
</arguments>

<options>
<option name="--setup">Run configuration setup (prompts for project number)</option>
<option name="--status" value_type="status">Set project board status (backlog, ready, in_progress, in_review, done)</option>
<option name="--all-unsynced">Sync all documents that don't have github_issue/github_pr</option>
<option name="--verify">Show sync status of all documents without making changes</option>
<option name="--check-merged">Check for merged PRs, classify as document PR or implementation PR, and apply appropriate Issue lifecycle rules (cascading closure for implementation PRs)</option>
<option name="--sync-milestones" value_type="ppd-id">Create/update GitHub Milestones from PPD milestone definitions (e.g., --sync-milestones PPD-0001)</option>
<option name="--sync-assignees">Pull GitHub Issue assignees and write to PD assignee frontmatter (GitHub is source of truth)</option>
<option name="--import">List untracked GitHub Issues and interactively import selected ones as PDs or TDs</option>
<option name="--import-all">Import all untracked Issues matching filters without interactive selection</option>
<option name="--label" value_type="label">Filter Issues by label when used with --import or --import-all</option>
<option name="--refresh-cache">Force refresh of cached project field IDs</option>
</options>

<execution_instructions>
When this skill is invoked:

1. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Load GitHub config from `.claude/nmblr/github/`

2. **Delegate to github-sync agent**
   - Spawn `github-sync` agent with doc ID and options
   - Pass configuration context

3. **The github-sync will**:
   - For --setup: Prompt for project number, cache field IDs
   - For doc-id: Create branch, PR, Issue, link to project board; assign to GitHub Milestone if document has milestone field
   - For --status: Update project board status for document's Issue
   - For --all-unsynced: Run the bulk sync script for efficiency:
     ```bash
     bash .claude/nmblr/scripts/github/gh-bulk-sync.sh --all
     ```
     Or filter by type: `--type PD`, `--type TD`, etc.
     Supports `--dry-run` to preview without changes.
     The script handles iteration in a single process, avoiding per-document agent overhead.
   - For --verify: Report sync status of all documents
   - For --check-merged: Check merged PRs, classify each as document PR or implementation PR, update document status accordingly. Document PRs set status to Approved (Issue stays open, except ADR which closes). Implementation PRs trigger cascading closure (RFC Completed, parent PD/TD Completed, all Issues closed)
   - For --sync-milestones: Read PPD milestones array, create/update GitHub Milestones, store milestone numbers back in PPD frontmatter
   - For --sync-assignees: Pull GitHub Issue assignees for all PDs with github_issue, write first assignee login to PD assignee frontmatter field
   - For --import: List untracked GitHub Issues and import selected ones as PDs or TDs:
     ```bash
     bash .claude/nmblr/scripts/github/gh-list-untracked-issues.sh [--label LABEL] [--milestone M] [--assignee A]
     ```
     Present the list to the user, ask which to import and as what type (PD or TD).
     For each confirmed import:
     ```bash
     bash .claude/nmblr/scripts/github/gh-import-issue.sh --issue NUMBER --type PD|TD
     ```
   - For --import-all: Same as --import but skip interactive selection — import all matching Issues as PDs (or TDs if labeled "technical-debt")
</execution_instructions>

<examples>
<example>
<command>/nmblr:sync-github --setup</command>
<description>Configure GitHub integration for the first time</description>
</example>
<example>
<command>/nmblr:sync-github PD-0005</command>
<description>Create PR and GitHub Issue for PD-0005</description>
</example>
<example>
<command>/nmblr:sync-github RFC-0010 --status in_progress</command>
<description>Move RFC-0010's Issue to "In Progress" on project board</description>
</example>
<example>
<command>/nmblr:sync-github --all-unsynced</command>
<description>Find and sync all documents missing GitHub links</description>
</example>
<example>
<command>/nmblr:sync-github --verify</command>
<description>Show which documents are synced to GitHub</description>
</example>
<example>
<command>/nmblr:sync-github --check-merged</command>
<description>Check merged PRs, classify as document/implementation, apply cascading closure for implementation PRs</description>
</example>
<example>
<command>/nmblr:sync-github --sync-milestones PPD-0001</command>
<description>Create/update GitHub Milestones from PPD-0001 milestone definitions</description>
</example>
<example>
<command>/nmblr:sync-github --sync-assignees</command>
<description>Pull GitHub Issue assignees and write to PD assignee frontmatter fields</description>
</example>
<example>
<command>/nmblr:sync-github --import</command>
<description>List untracked GitHub Issues and interactively import selected ones as PDs or TDs</description>
</example>
<example>
<command>/nmblr:sync-github --import --label bug</command>
<description>Import Issues labeled "bug" as PDs</description>
</example>
<example>
<command>/nmblr:sync-github --import-all --label technical-debt</command>
<description>Bulk import all "technical-debt" Issues as TDs without prompting</description>
</example>
</examples>

<document_types>
Supports syncing these document types:
- **PD** - Problem Documents → Label: `problem`
- **TD** - Technical Debt → Label: `technical-debt`
- **ADR** - Architecture Decision Records → Label: `architecture`
- **RFC** - Request for Comments → Label: `rfc`
</document_types>

<config_files>
This skill reads/writes configuration:
- `.claude/nmblr/config.yaml` - User-editable project configuration (github section)
- `.claude/nmblr/github/project-cache.json` - Auto-generated field IDs (refreshed when stale)
</config_files>

<workflow_integration>
This skill integrates with the document lifecycle:

1. **Document Creation** - Writer agents call this after user reviews document
2. **RFC Execution** - Executor calls this to move Issues to "In Progress"
3. **RFC Finalization** - Executor calls this to move Issues to "In Review"
4. **PR Merge (Document PR)** - PRs containing only docs/markdown files: updates document status to "Approved", Issue stays OPEN (except ADR, which closes on approval)
5. **PR Merge (Implementation PR)** - PRs containing source code: triggers cascading closure -- RFC set to Completed, parent PD/TD Issues closed automatically
6. **Milestone Sync** - Creates/updates GitHub Milestones from PPD definitions; assigns PD/RFC Issues to milestones
7. **Assignee Sync** - Pulls GitHub Issue assignees to PD frontmatter (GitHub is source of truth)

**PR Classification Rules:**
- Document PR: all changed files match `docs/**/*.md`, `.claude/**/*.md`, `.claude/**/*.yaml`, `.claude/**/*.json`
- Implementation PR: any changed file is outside those patterns (code takes precedence)

**Issue Lifecycle Rules:**
| Document | Closes When | Trigger |
|----------|-------------|---------|
| PD | RFC implementing it is completed | Cascade from RFC |
| TD | RFC implementing it is completed | Cascade from RFC |
| RFC | Implementation PR merges | Direct |
| ADR | Document PR merges | Document PR merge |
| PRD | Never auto-closes | Manual only |
</workflow_integration>
