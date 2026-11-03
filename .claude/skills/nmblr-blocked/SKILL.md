---
name: nmblr:blocked
description: |
  Show blocked RFCs and documents.
  Use when user wants to see what items are blocked and why.
user-invocable: true
argument-hint: "[--type TYPE] [--owner OWNER]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Task
---

<skill_info>
<name>nmblr:blocked</name>
<summary>Show all blocked items across the project.</summary>
<agent>status-reporter</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:blocked</syntax>
<syntax>nmblr:blocked --type &lt;type&gt;</syntax>
<syntax>nmblr:blocked --owner &lt;owner&gt;</syntax>
</usage>

<options>
<option name="--type" value_type="type">Filter by document type (RFC, TD, etc.)</option>
<option name="--owner" value_type="owner">Filter by owner</option>
</options>

<execution_instructions>
When this skill is invoked:

1. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Get document locations

2. **Delegate to status-reporter agent**
   - Spawn `status-reporter` agent with options
   - Agent scans documents for blocked status

3. **The status-reporter will**:
   - Scan document frontmatter for status = "Blocked"
   - Check execution state files for blocker entries
   - Check for open questions marked as blocking
   - Generate report with blocked items, blocker types, and recommended actions
</execution_instructions>

<examples>
<example>
<command>/nmblr:blocked</command>
<description>Show all blocked items</description>
</example>
<example>
<command>/nmblr:blocked --type RFC</command>
<description>Show blocked RFCs only</description>
</example>
<example>
<command>/nmblr:blocked --owner "John Doe"</command>
<description>Show items blocked for a specific owner</description>
</example>
</examples>

<blocker_detection>
<source>Document status = "Blocked"</source>
<source>Execution state files with blocker entries</source>
<source>Open questions marked as blocking</source>
</blocker_detection>
