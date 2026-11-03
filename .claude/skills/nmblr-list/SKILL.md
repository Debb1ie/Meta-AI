---
name: nmblr:list
description: |
  List documents by type with filtering.
  Use when user wants to see documents filtered by type, status, owner, or date.
user-invocable: true
argument-hint: "<type> [--status STATUS] [--owner OWNER] [--since DATE]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Task
---

<skill_info>
<name>nmblr:list</name>
<summary>List documents of a specific type with optional filtering.</summary>
<agent>status-reporter</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:list &lt;type&gt;</syntax>
<syntax>nmblr:list &lt;type&gt; --status &lt;status&gt;</syntax>
<syntax>nmblr:list &lt;type&gt; --owner &lt;owner&gt;</syntax>
<syntax>nmblr:list &lt;type&gt; --since &lt;date&gt;</syntax>
</usage>

<arguments>
<argument name="type" required="true">
<description>Document type (PRD, PD, PPD, PSR, AD, ADR, TD, RFC, TP, TC, or "all")</description>
</argument>
</arguments>

<options>
<option name="--status" value_type="status">Filter by status (Draft, In-Review, Approved, Active, Completed, Archived)</option>
<option name="--owner" value_type="owner">Filter by owner name</option>
<option name="--since" value_type="date">Show documents updated since date (YYYY-MM-DD)</option>
<option name="--sort" value_type="field">Sort by field (id, title, status, updated) - default: id</option>
<option name="--limit" value_type="n">Limit results to n documents</option>
</options>

<execution_instructions>
When this skill is invoked:

1. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Get document locations for the requested type

2. **Delegate to status-reporter agent**
   - Spawn `status-reporter` agent with type and filter options
   - Pass configuration context

3. **The status-reporter will**:
   - Scan document directories for matching type
   - Parse frontmatter for status, owner, dates
   - Apply filters
   - Generate formatted table output with summary counts
</execution_instructions>

<examples>
<example>
<command>/nmblr:list RFC</command>
<description>List all RFCs</description>
</example>
<example>
<command>/nmblr:list RFC --status Approved</command>
<description>List approved RFCs</description>
</example>
<example>
<command>/nmblr:list all --owner "Jane Doe"</command>
<description>List all documents by owner</description>
</example>
<example>
<command>/nmblr:list PRD --since 2026-01-01</command>
<description>List recent PRDs</description>
</example>
<example>
<command>/nmblr:list TD --status Draft</command>
<description>List draft Technical Debts</description>
</example>
</examples>

<type_shortcuts>
<shortcut code="rfc" full="RFC"/>
<shortcut code="prd" full="PRD"/>
<shortcut code="pd" full="PD"/>
<shortcut code="adr" full="ADR"/>
<shortcut code="td" full="TD"/>
<shortcut code="all" full="All types"/>
</type_shortcuts>
