---
name: nmblr:status
description: |
  Show project or document status.
  Use when user wants project overview, document status, or RFC execution status.
user-invocable: true
argument-hint: "[scope] [--refresh] [--json] [--kanban] [--metrics] [--dependencies] [--stale]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Task
---

<skill_info>
<name>nmblr:status</name>
<summary>Display status information for the project or specific documents.</summary>
<agent>status-reporter</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:status</syntax>
<syntax>nmblr:status docs</syntax>
<syntax>nmblr:status rfcs</syntax>
<syntax>nmblr:status &lt;doc-id&gt;</syntax>
<syntax>nmblr:status --refresh</syntax>
</usage>

<arguments>
<argument name="scope" required="false">
<description>Optional scope (docs, rfcs, or specific doc-id)</description>
</argument>
</arguments>

<options>
<option name="--refresh">Force regeneration of index files</option>
<option name="--json">Output in JSON format</option>
<option name="--kanban">Render kanban board view of all PDs organized by workflow state (Backlog, Ready, In Progress, Done, Won't Fix)</option>
<option name="--metrics">Render flow metrics summary (throughput, cycle time, lead time, WIP count) for the default period (30 days)</option>
<option name="--dependencies">Render dependency chain tree for all documents with dependency relationships</option>
<option name="--stale">Render stale/aging items report using configurable thresholds from kanban.stale_thresholds in config.yaml</option>
</options>

<execution_instructions>
When this skill is invoked:

1. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Get document locations

2. **Delegate to status-reporter agent**
   - Spawn `status-reporter` agent with scope and options
   - Pass configuration context

3. **The status-reporter will**:
   - For project status: Generate health summary, quick stats, attention items
   - For docs: Scan all document directories and summarize
   - For rfcs: Check execution state files for progress
   - For specific doc-id: Show detailed info including execution state
   - If --refresh: Regenerate index files
   - If --kanban: Render kanban board view with PDs classified into columns, flow metrics summary, and WIP limit check
   - If --metrics: Compute and render flow metrics (throughput, cycle time, lead time, queue time, WIP count, WIP age) for the last 30 days
   - If --dependencies: Build dependency graph from PD frontmatter, detect cycles, identify blocked items, render text tree
   - If --stale: Evaluate stale thresholds from config.yaml, group items by alert level (Critical, Warning, Info), render stale report
   - Flags are composable: --kanban --stale renders the board with stale annotations inline plus a dedicated stale report
</execution_instructions>

<examples>
<example>
<command>/nmblr:status</command>
<description>Get project overview</description>
</example>
<example>
<command>/nmblr:status docs</command>
<description>Get all document status</description>
</example>
<example>
<command>/nmblr:status rfcs</command>
<description>Get RFC execution status</description>
</example>
<example>
<command>/nmblr:status RFC-0015</command>
<description>Get specific document status</description>
</example>
<example>
<command>/nmblr:status --refresh</command>
<description>Refresh indexes and show status</description>
</example>
<example>
<command>/nmblr:status --kanban</command>
<description>Show kanban board view of all PDs</description>
</example>
<example>
<command>/nmblr:status --metrics</command>
<description>Show flow metrics summary for the last 30 days</description>
</example>
<example>
<command>/nmblr:status --dependencies</command>
<description>Show dependency chain tree for all documents</description>
</example>
<example>
<command>/nmblr:status --stale</command>
<description>Show stale/aging items report</description>
</example>
<example>
<command>/nmblr:status --kanban --stale</command>
<description>Show kanban board with stale annotations and stale report</description>
</example>
<example>
<command>/nmblr:status --kanban --metrics --dependencies --stale</command>
<description>Full dashboard: board, metrics, dependency tree, and stale report</description>
</example>
</examples>

<index_files>
This skill reads/generates indexes in `.claude/nmblr/index/`:
- `master-index.md` - All documents
- Updated on `--refresh` or when needed
</index_files>
