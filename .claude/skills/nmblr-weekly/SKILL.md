---
name: nmblr:weekly
description: |
  Generate a weekly review report.
  Use when user wants an automated weekly status report with rollup from dailies, commit velocity, build health, and pending approvals.
user-invocable: true
argument-hint: "[--week YYYY-WNN]"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - Task
---

<skill_info>
<name>nmblr:weekly</name>
<summary>Generate a weekly review report with rollup from daily reports, commit velocity per RFC, build health, pending approvals, and lessons learned prompt.</summary>
<agent>weekly-report-writer</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:weekly</syntax>
<syntax>nmblr:weekly --week YYYY-WNN</syntax>
</usage>

<arguments>
<argument name="week" required="false">
<description>Optional ISO week override in YYYY-WNN format (e.g., 2026-W11). Defaults to current week.</description>
</argument>
</arguments>

<options>
<option name="--week" value_type="YYYY-WNN">Generate the weekly report for a specific ISO week instead of the current week</option>
</options>

<execution_instructions>
When this skill is invoked:

1. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Get document locations and GitHub repository info

2. **Delegate to weekly-report-writer agent**
   - Spawn `weekly-report-writer` agent with week context
   - Pass configuration and any --week argument

3. **The weekly-report-writer will**:
   - Read daily reports for the week from `docs/project/PSRs/daily/`
   - Invoke status-reporter backbone for weekly-scope data
   - Roll up completed items and carry unresolved blockers
   - Calculate commit velocity per RFC (trending up/down/stalled)
   - Aggregate pending approvals and build health
   - Include Lessons Learned prompt
   - Render PSR-Weekly template
   - Write report to `docs/project/PSRs/weekly/YYYY-WNN.md`
   - Return report path and summary statistics
</execution_instructions>

<examples>
<example>
<command>/nmblr:weekly</command>
<description>Generate this week's weekly review report</description>
</example>
<example>
<command>/nmblr:weekly --week 2026-W11</command>
<description>Generate the weekly report for ISO week 11 of 2026</description>
</example>
</examples>
