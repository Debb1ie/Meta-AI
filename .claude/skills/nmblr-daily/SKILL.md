---
name: nmblr:daily
description: |
  Generate a daily standup report.
  Use when user wants an automated daily status report with completed items, WIP, blockers, and stale detection.
user-invocable: true
argument-hint: "[--date YYYY-MM-DD]"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - Task
---

<skill_info>
<name>nmblr:daily</name>
<summary>Generate a fully automated daily standup report with completed items, WIP by assignee, blockers, stale detection, and GitHub discussion highlights.</summary>
<agent>daily-report-writer</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:daily</syntax>
<syntax>nmblr:daily --date YYYY-MM-DD</syntax>
</usage>

<arguments>
<argument name="date" required="false">
<description>Optional date override in YYYY-MM-DD format. Defaults to today.</description>
</argument>
</arguments>

<options>
<option name="--date" value_type="YYYY-MM-DD">Generate the daily report for a specific date instead of today</option>
</options>

<execution_instructions>
When this skill is invoked:

1. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Get document locations and GitHub repository info

2. **Delegate to daily-report-writer agent**
   - Spawn `daily-report-writer` agent with date context
   - Pass configuration and any --date argument

3. **The daily-report-writer will**:
   - Invoke status-reporter backbone for raw data (RFC/PD states, git commits last 24h, GitHub data)
   - Apply stale detection rules to flag inactive items
   - Group WIP items by assignee
   - Extract discussion highlights from GitHub comments
   - Render PSR-Daily template
   - Write report to `docs/project/PSRs/daily/YYYY-MM-DD.md`
   - Return report path and summary statistics
</execution_instructions>

<examples>
<example>
<command>/nmblr:daily</command>
<description>Generate today's daily standup report</description>
</example>
<example>
<command>/nmblr:daily --date 2026-03-09</command>
<description>Generate the daily report for March 9, 2026</description>
</example>
</examples>
