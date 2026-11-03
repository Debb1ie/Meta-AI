---
name: nmblr:monthly
description: |
  Generate a monthly executive summary report.
  Use when user wants an automated monthly report with health indicators, flow metrics trends, and comparison to previous month.
user-invocable: true
argument-hint: "[--month YYYY-MM]"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - Task
---

<skill_info>
<name>nmblr:monthly</name>
<summary>Generate a monthly executive summary report with health indicators, flow metrics trends, completed items aggregation, key decisions, and month-over-month trend analysis.</summary>
<agent>monthly-report-writer</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:monthly</syntax>
<syntax>nmblr:monthly --month YYYY-MM</syntax>
</usage>

<arguments>
<argument name="month" required="false">
<description>Optional month override in YYYY-MM format (e.g., 2026-02). Defaults to current month.</description>
</argument>
</arguments>

<options>
<option name="--month" value_type="YYYY-MM">Generate the monthly report for a specific month instead of the current month</option>
</options>

<execution_instructions>
When this skill is invoked:

1. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Get document locations and GitHub repository info

2. **Delegate to monthly-report-writer agent**
   - Spawn `monthly-report-writer` agent with month context
   - Pass configuration and any --month argument

3. **The monthly-report-writer will**:
   - Read weekly reports for the month from `docs/project/PSRs/weekly/`
   - Invoke status-reporter backbone for monthly-scope data
   - Aggregate completed PDs/RFCs from weekly summaries
   - Carry over unresolved risks from weekly reports
   - Calculate flow metrics trends (cycle time, throughput, WIP)
   - Compare to previous month's report for trend analysis
   - Determine health indicators (Schedule, Scope, Quality, Risk)
   - Render PSR-Monthly template
   - Write report to `docs/project/PSRs/monthly/YYYY-MM.md`
   - Return report path and summary statistics
</execution_instructions>

<examples>
<example>
<command>/nmblr:monthly</command>
<description>Generate this month's executive summary report</description>
</example>
<example>
<command>/nmblr:monthly --month 2026-02</command>
<description>Generate the monthly report for February 2026</description>
</example>
</examples>
