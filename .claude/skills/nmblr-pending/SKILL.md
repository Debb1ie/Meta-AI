---
name: nmblr:pending
description: |
  Show items pending review or approval.
  Use when user wants to see what documents need review or are awaiting approval.
user-invocable: true
argument-hint: "[--type TYPE] [--reviewer NAME] [--days N] [--urgent]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Task
---

<skill_info>
<name>nmblr:pending</name>
<summary>Show all items pending review or approval.</summary>
<agent>status-reporter</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:pending</syntax>
<syntax>nmblr:pending --type &lt;type&gt;</syntax>
<syntax>nmblr:pending --reviewer &lt;name&gt;</syntax>
<syntax>nmblr:pending --days &lt;n&gt;</syntax>
</usage>

<options>
<option name="--type" value_type="type">Filter by document type</option>
<option name="--reviewer" value_type="name">Filter by assigned reviewer</option>
<option name="--days" value_type="n">Show items pending more than n days</option>
<option name="--urgent">Show only items pending > 7 days</option>
</options>

<execution_instructions>
When this skill is invoked:

1. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Get document locations

2. **Delegate to status-reporter agent**
   - Spawn `status-reporter` agent with filter options
   - Pass configuration context

3. **The status-reporter will**:
   - Scan documents with status "In-Review"
   - Check for assigned reviewers with incomplete approvals
   - Calculate pending duration
   - Generate report with urgency levels and reviewer workload
   - Provide recommended actions
</execution_instructions>

<examples>
<example>
<command>/nmblr:pending</command>
<description>Show all pending items</description>
</example>
<example>
<command>/nmblr:pending --type RFC</command>
<description>Show pending RFCs</description>
</example>
<example>
<command>/nmblr:pending --reviewer "Jane Doe"</command>
<description>Show items waiting for specific reviewer</description>
</example>
<example>
<command>/nmblr:pending --urgent</command>
<description>Show urgent items (pending > 7 days)</description>
</example>
</examples>

<pending_detection>
<condition>Status is "In-Review"</condition>
<condition>Has reviewers assigned but not all approved</condition>
<condition>Approval checklist incomplete</condition>
</pending_detection>
