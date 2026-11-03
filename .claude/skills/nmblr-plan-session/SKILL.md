---
name: nmblr:plan-session
description: |
  Guide a structured kanban planning session for PD triage and flow review.
  Use when the team wants to review the backlog, triage untriaged PDs, check flow health, and produce a planning session summary.
user-invocable: true
argument-hint: "[--attendees NAMES]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
---

<skill_info>
<name>nmblr:plan-session</name>
<summary>Guide a structured kanban planning session for PD triage and flow review. This is a self-contained interactive workflow -- no agent delegation.</summary>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:plan-session</syntax>
<syntax>nmblr:plan-session --attendees "Alice, Bob, Carol"</syntax>
</usage>

<arguments>
None required.
</arguments>

<options>
<option name="--attendees" value_type="names">Comma-separated list of attendee names for the session record. If omitted, the summary will note "Not specified".</option>
</options>

<execution_instructions>
When this skill is invoked, run a five-step interactive planning session. Each step produces output and pauses for the user to review before proceeding.

**Step 0: Load configuration**
- Read `.claude/nmblr/config.yaml`
- Get `documents.pds` for PD directory location
- Get `kanban.stale_thresholds` and `kanban.wip_limits` (use defaults if missing)
- Scan all PD files in the configured directory
- Parse YAML frontmatter from each PD: id, title, status, assignee, priority, target_date, started_at, completed_at, created, dependencies, related_rfcs

---

**Step 1: Identify untriaged PDs**

Untriaged PDs are those missing both `priority` AND `assignee` (either field empty/null/missing).

- Scan all PDs and filter to untriaged items
- Present a numbered list:

```
## Step 1: Untriaged PDs

Found {count} PDs without priority or assignee:

| # | PD | Title | Status | Created | Age |
|---|-----|-------|--------|---------|-----|
| 1 | PD-0009 | Logging improvements | Draft | 2026-01-20 | 49d |
| 2 | PD-0010 | Cache layer | Approved | 2026-03-01 | 9d |
```

If no untriaged PDs exist:
```
## Step 1: Untriaged PDs

All PDs have priority and assignee set. Nothing to triage.
```

---

**Step 2: Show current WIP with age**

List all Active PDs sorted by WIP age (now - started_at) descending.

```
## Step 2: Current WIP

{count} items in progress:

| PD | Title | Assignee | Started | WIP Age |
|----|-------|----------|---------|---------|
| PD-0003 | Database indexing | @bob | 2026-02-26 | 12d |
| PD-0005 | API performance | @alice | 2026-03-05 | 5d |
```

If WIP count exceeds `kanban.wip_limits.in_progress`, append:
```
WARNING: WIP limit exceeded ({count}/{limit}). Consider completing existing work before starting new items.
```

If no Active PDs exist:
```
## Step 2: Current WIP

No active work items. WIP count is 0.
```

---

**Step 3: Show flow metrics summary**

Compute and display aggregate flow metrics for the last 30 days.

```
## Step 3: Flow Metrics (last 30 days)

| Metric | Value |
|--------|-------|
| Throughput | {n} items/week |
| Avg Cycle Time | {n} days |
| Avg Lead Time | {n} days |
| Avg Queue Time | {n} days |
| WIP Count | {n} |
| Longest WIP Age | {n} days ({PD-ID}) |
```

If no completed PDs exist in the period:
```
## Step 3: Flow Metrics (last 30 days)

Insufficient data: No PDs completed in the last 30 days. Throughput, cycle time, and lead time cannot be calculated.

| Metric | Value |
|--------|-------|
| WIP Count | {n} |
| Longest WIP Age | {n} days ({PD-ID}) |
```

---

**Step 4: Triage each untriaged PD**

For each untriaged PD from Step 1, prompt the user interactively to set:

1. **Priority** (required): low, medium, high, or critical
2. **Assignee** (required): name of the person responsible
3. **Target date** (optional): YYYY-MM-DD or "none"
4. **RFC needed** (optional): yes or no -- whether this PD needs an RFC to implement

Present the prompt for each PD:

```
### Triaging PD-{NNNN}: {title}

**Current status:** {status}
**Created:** {created}
**Summary:** {first 2 lines of document body, if readable}

Please provide:
1. Priority (low / medium / high / critical):
2. Assignee:
3. Target date (YYYY-MM-DD or skip):
4. RFC needed (yes / no / skip):
```

After the user responds, update the PD frontmatter using the Edit tool:
- Set `priority: {value}` in frontmatter
- Set `assignee: "{value}"` in frontmatter
- Set `target_date: "{value}"` in frontmatter (if provided)
- Do NOT modify any other frontmatter fields

Record the decision for the session summary.

If there are no untriaged PDs (Step 1 found none), skip this step entirely:
```
## Step 4: Triage

No untriaged PDs to process. Skipping.
```

---

**Step 5: Write planning session summary**

Create a timestamped summary note at `.claude/nmblr/sessions/YYYY-MM-DD-planning.md` using today's date.

If a file with that name already exists (multiple sessions in one day), append a counter: `YYYY-MM-DD-planning-2.md`.

Use the session summary format defined in `<session_summary_format>`.

After writing:
```
## Step 5: Session Summary

Planning session summary written to:
  .claude/nmblr/sessions/{filename}

Session complete.
```
</execution_instructions>

<session_summary_format>
```markdown
---
type: planning-session
date: "{YYYY-MM-DD}"
attendees: ["{name1}", "{name2}"]
---

# Planning Session - {YYYY-MM-DD}

**Attendees:** {attendees or "Not specified"}

## Flow Metrics Snapshot

| Metric | Value |
|--------|-------|
| Throughput (30d) | {n} items/week |
| Avg Cycle Time | {n} days |
| Avg Lead Time | {n} days |
| WIP Count | {n} |
| Longest WIP Age | {n} days ({PD-ID}) |

## Triage Decisions

| PD | Title | Priority | Assignee | Target Date | RFC Needed |
|----|-------|----------|----------|-------------|------------|
| PD-{NNNN} | {title} | {priority} | {assignee} | {date or --} | {yes/no/--} |

## WIP Status

| PD | Title | Assignee | WIP Age |
|----|-------|----------|---------|
| PD-{NNNN} | {title} | {assignee} | {n} days |

## Notes

- {Any observations or decisions noted during the session}
```
</session_summary_format>

<flow_metrics_reference>
The planning session computes the same metrics as the backlog skill. All calculations are performed at query time from PD frontmatter.

| Metric | Formula | Notes |
|--------|---------|-------|
| Cycle Time | `completed_at - started_at` | Per item + rolling average. Only for PDs with both fields. |
| Lead Time | `completed_at - created` | Per item + rolling average. Only for PDs with both fields. |
| Throughput | Count of Completed PDs / weeks in period | Default period: 30 days |
| WIP Count | Count of Active PDs | Current snapshot |
| WIP Age | `now - started_at` for Active PDs | Per item, sorted descending |
| Queue Time | `started_at - created` | Per item + rolling average. Only for PDs with both fields. |

Items without complete timestamps are excluded from averages. No error, no NaN.
</flow_metrics_reference>

<triage_prompts>
Each untriaged PD receives a structured prompt. The skill waits for user input before proceeding.

**Priority prompt:**
```
Priority (low / medium / high / critical):
```
Accepted values: low, medium, high, critical. If the user provides an unrecognized value, re-prompt.

**Assignee prompt:**
```
Assignee:
```
Free-text name. The skill writes it as-is to the `assignee` frontmatter field.

**Target date prompt:**
```
Target date (YYYY-MM-DD or skip):
```
If "skip" or empty, do not set target_date. If a date is provided, validate it is a valid YYYY-MM-DD format.

**RFC needed prompt:**
```
RFC needed (yes / no / skip):
```
This is informational for the session summary. It does NOT create an RFC. If "yes", note it in the summary so the team can follow up.
</triage_prompts>

<error_handling>
- **No PD directory configured:** Report error and exit: "PD directory not configured in .claude/nmblr/config.yaml"
- **No PD files found:** Run session with empty data: "No PD documents found. Session has nothing to review."
- **No untriaged PDs:** Skip Step 4 gracefully (documented above)
- **No Active PDs:** Skip Step 2 WIP display: "No active work items."
- **No completed PDs for metrics:** Note insufficient data in Step 3 (documented above)
- **PD frontmatter edit fails:** Report which PD could not be updated, continue with remaining PDs
- **Sessions directory missing:** Create `.claude/nmblr/sessions/` before writing summary
- **Duplicate session file:** Append counter to filename (e.g., `-2`, `-3`)
</error_handling>

<examples>
<example>
<command>/nmblr:plan-session</command>
<description>Start a planning session with default settings. Walk through all five steps.</description>
</example>
<example>
<command>/nmblr:plan-session --attendees "Alice, Bob"</command>
<description>Start a planning session and record Alice and Bob as attendees in the summary note.</description>
</example>
</examples>
