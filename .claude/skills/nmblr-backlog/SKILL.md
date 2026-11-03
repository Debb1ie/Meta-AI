---
name: nmblr:backlog
description: |
  Display kanban board view of all PDs organized by workflow state.
  Use when user wants to see work items on a kanban board, check flow metrics, find stale items, or visualize dependencies.
user-invocable: true
argument-hint: "[--assignee NAME] [--priority LEVEL] [--stale] [--period DURATION]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Task
---

<skill_info>
<name>nmblr:backlog</name>
<summary>Display kanban board view of all PDs organized by workflow state, with flow metrics, stale detection, and dependency visualization.</summary>
<agent>status-reporter</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:backlog</syntax>
<syntax>nmblr:backlog --assignee &lt;name&gt;</syntax>
<syntax>nmblr:backlog --priority &lt;level&gt;</syntax>
<syntax>nmblr:backlog --stale</syntax>
<syntax>nmblr:backlog --period &lt;duration&gt;</syntax>
<syntax>nmblr:backlog --assignee &lt;name&gt; --priority &lt;level&gt; --stale</syntax>
</usage>

<arguments>
None required. All parameters are optional filters.
</arguments>

<options>
<option name="--assignee" value_type="name">Show only PDs where assignee matches the given name (case-insensitive partial match)</option>
<option name="--priority" value_type="level">Show only PDs at or above the given priority level (low, medium, high, critical). Priority ordering: critical > high > medium > low.</option>
<option name="--stale">Show only PDs that meet at least one stale detection threshold</option>
<option name="--period" value_type="duration">Set the lookback window for the Done column (e.g., "7d", "30d", "90d"). Default: 30d. PDs completed before this window are excluded from the Done column.</option>
</options>

<execution_instructions>
When this skill is invoked:

1. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Read `documents.pds` for PD directory location
   - Read `kanban.stale_thresholds` for stale detection configuration
   - Read `kanban.wip_limits` for WIP limit configuration
   - If `kanban` block is missing, use defaults: no_commits_days=2, no_rfc_days=7, unassigned_days=14, no_review_days=3, in_progress=5

2. **Scan all PD files**
   - Use Glob to find all `*.md` files in the configured PD directory
   - Read YAML frontmatter from each PD file
   - Extract fields: id, title, status, assignee, priority, target_date, started_at, completed_at, created, dependencies, related_rfcs (or related RFCs from frontmatter)
   - If a field is missing, treat it as empty/null -- do not error

3. **Classify each PD into a kanban column**
   - Apply the column classification rules defined in `<column_classification>`
   - Each PD maps to exactly one column

4. **Apply filters** (if any flags provided)
   - `--assignee`: Keep only PDs where assignee matches (case-insensitive substring)
   - `--priority`: Keep only PDs at or above the given level. Priority ordering: critical=4, high=3, medium=2, low=1. If a PD has no priority set, it is excluded when this filter is active.
   - `--stale`: Keep only PDs that trigger at least one stale threshold rule
   - `--period`: Set the lookback window for Done column filtering (default 30d)

5. **Compute flow metrics**
   - Calculate all six metrics per the `<flow_metrics>` section
   - Items without complete timestamps are excluded from averages (do not error)

6. **Evaluate stale thresholds**
   - For each PD, check all applicable stale rules per the `<stale_detection>` section
   - Attach stale flags to matching PDs

7. **Build dependency graph**
   - Read `dependencies` field from each PD frontmatter
   - Construct a directed graph per the `<dependency_visualization>` section
   - Detect cycles using visited-node tracking in DFS
   - Identify blocked items (dependencies not Completed)

8. **Render kanban board**
   - Output the board in the format defined in `<board_format>`
   - Each column is a section with PDs listed as table rows
   - Stale PDs are annotated with their alert level inline
   - Blocked PDs are annotated with a BLOCKED flag

9. **Append flow metrics summary**
   - Below the board, render the metrics summary table

10. **Check WIP limits**
    - If the count of PDs in the "In Progress" column exceeds `kanban.wip_limits.in_progress`, emit a WIP limit warning line below the metrics summary
</execution_instructions>

<column_classification>
Each PD is assigned to exactly one column based on its frontmatter fields. Rules are evaluated in order; the first match wins.

| Column | Rule | Condition |
|--------|------|-----------|
| Won't Fix | Status match | `status` is "Rejected" or "Cancelled" |
| Done | Status match + period filter | `status` is "Completed" AND `completed_at` is within the `--period` window (default 30d). PDs completed before the window are excluded entirely. |
| In Progress | Status + RFC linkage | `status` is "Active" AND at least one entry exists in `related_rfcs` (or an RFC references this PD) |
| Ready | Status + assignee + no RFC | `status` is "Approved" AND `assignee` is set AND no linked RFC exists |
| Backlog | Default | `status` is "Draft" or "Approved" with no assignee set. Also catches any PD not matching above rules. |

**Edge cases:**
- Active PD with no linked RFC: Still classified as In Progress (the status "Active" is the primary signal)
- Approved PD with assignee but with linked RFC: Classify as In Progress if the RFC is active, otherwise Ready
- PD with unknown/unrecognized status: Place in Backlog with a note
- PD with no status field: Place in Backlog
</column_classification>

<flow_metrics>
All metrics are computed from PD frontmatter timestamp fields. Items with missing timestamps are excluded from that metric's calculation (no error, no NaN -- just skip).

| Metric | Formula | Aggregation | Notes |
|--------|---------|-------------|-------|
| Cycle Time | `completed_at - started_at` | Per item (days) + rolling average across completed items | Only for PDs where both fields are present |
| Lead Time | `completed_at - created` | Per item (days) + rolling average across completed items | Only for PDs where both fields are present |
| Throughput | Count of PDs with `status = Completed` within the period window | Items per week (total completed / weeks in period) | Default period: 30 days |
| WIP Count | Count of PDs with `status = Active` | Current snapshot (integer) | No timestamp needed |
| WIP Age | `now - started_at` for each Active PD | Per item (days), sorted descending | Only for Active PDs with `started_at` set |
| Queue Time | `started_at - created` for each PD | Per item (days) + rolling average | Only for PDs where both fields are present |

**Display format for metrics summary:**

```
## Flow Metrics (last {period})

| Metric | Value |
|--------|-------|
| Throughput | {n} items/week |
| Avg Cycle Time | {n} days |
| Avg Lead Time | {n} days |
| Avg Queue Time | {n} days |
| WIP Count | {n} |
| Longest WIP Age | {n} days ({PD-ID}) |
```

If no completed PDs exist in the period, note "Insufficient data for throughput/cycle time/lead time calculations."
</flow_metrics>

<stale_detection>
Stale detection evaluates each PD against threshold rules read from `kanban.stale_thresholds` in config.yaml. Each rule has a condition, a threshold (in days), and an alert level.

| Rule | Condition | Threshold Config Key | Default | Alert Level |
|------|-----------|---------------------|---------|-------------|
| No commits on RFC branch | PD is Active, has a linked RFC, and the RFC's implementation branch has no commits in the last N days | `no_commits_days` | 2 | Warning |
| No RFC created | PD is Active, `started_at` is set, but no linked RFC exists, and `now - started_at` exceeds N days | `no_rfc_days` | 7 | Warning |
| Unassigned too long | PD is Approved (in Backlog or Ready column), no `assignee` set, and `now - created` exceeds N days | `unassigned_days` | 14 | Info |
| No review activity | PD or linked document is in "In-Review" status and `now - updated` exceeds N days | `no_review_days` | 3 | Warning |
| Blocked not progressing | PD is blocked (dependency not Completed) and the blocking item is also not progressing (stale itself) | N/A (always flagged) | N/A | Critical |

**Stale annotation format** (inline on board rows):
- Info: `[STALE: unassigned 14d]`
- Warning: `[STALE: no commits 3d]` or `[STALE: no RFC 8d]`
- Critical: `[BLOCKED+STALE: blocker not progressing]`

**Checking RFC branch commits:**
To check for recent commits on a linked RFC branch, use:
```bash
git log --oneline --since="{N} days ago" {branch_name} 2>/dev/null | head -1
```
If the branch does not exist or the command fails, treat as "no commits" (stale).
</stale_detection>

<dependency_visualization>
Dependencies are read from the `dependencies` field in PD frontmatter, which is an array of document IDs (e.g., `["PD-0001", "RFC-0003"]`).

**Graph construction:**
1. For each PD, read its `dependencies` array
2. Create a directed edge from each dependency to the dependent PD (dependency -> PD means "PD depends on dependency")
3. Build an adjacency list representation

**Cycle detection:**
- Use depth-first search with a "visited" set and a "recursion stack" set
- When a node is encountered that is already in the recursion stack, a cycle exists
- Record all detected cycles as warnings
- Set a max traversal depth of 50 to prevent runaway on malformed data

**Blocked item identification:**
- A PD is "blocked" if any of its dependencies has a status other than "Completed"
- Transitively blocked: if a dependency is itself blocked, the dependent PD is also blocked

**Text tree rendering:**
```
Dependency Chains:

PD-0005: Improve API performance (Active)
  depends on: PD-0003: Database indexing (Active) [IN PROGRESS]
    depends on: PD-0001: Schema migration (Completed) [DONE]

PD-0008: Frontend refactor (Approved) [BLOCKED]
  depends on: PD-0006: API v2 endpoints (Active) [IN PROGRESS]
  depends on: PD-0007: Auth service update (Draft) [NOT STARTED]
```

**Cycle warning format:**
```
WARNING: Circular dependency detected:
  PD-0010 -> PD-0011 -> PD-0010
```

Items with no dependencies and no dependents are omitted from the tree (they have no chain to display).
</dependency_visualization>

<board_format>
The kanban board is rendered as a series of column sections, each containing a table of PDs.

```
# Kanban Board

## In Progress ({count}) {WIP_WARNING}
| PD | Title | Priority | Assignee | RFC | WIP Age | Stale |
|----|-------|----------|----------|-----|---------|-------|
| PD-0005 | Improve API performance | high | @alice | RFC-0012 | 5d | |
| PD-0003 | Database indexing | medium | @bob | RFC-0010 | 12d | [no commits 3d] |

## Ready ({count})
| PD | Title | Priority | Assignee | Created | Stale |
|----|-------|----------|----------|---------|-------|
| PD-0006 | API v2 endpoints | high | @carol | 2026-02-15 | |

## Backlog ({count})
| PD | Title | Priority | Assignee | Created | Stale |
|----|-------|----------|----------|---------|-------|
| PD-0009 | Logging improvements | low | -- | 2026-01-20 | [unassigned 49d] |
| PD-0010 | Cache layer | -- | -- | 2026-03-01 | |

## Done ({count}, last {period})
| PD | Title | Priority | Assignee | Cycle Time |
|----|-------|----------|----------|------------|
| PD-0002 | Auth bugfix | critical | @alice | 3d |

## Won't Fix ({count})
| PD | Title | Reason |
|----|-------|--------|
| PD-0004 | Legacy migration | Rejected -- superseded by PD-0005 |
```

**Column ordering:** In Progress, Ready, Backlog, Done, Won't Fix
- This ordering puts active work first for quick scanning

**WIP_WARNING format** (appended to In Progress header):
```
-- WIP LIMIT EXCEEDED (6/5)
```
Only shown when count exceeds `kanban.wip_limits.in_progress`.

**Empty columns:** If a column has zero items after filtering, show:
```
## Ready (0)
No items.
```
</board_format>

<examples>
<example>
<command>/nmblr:backlog</command>
<description>Show full kanban board with all PDs, flow metrics, and dependency chains</description>
</example>
<example>
<command>/nmblr:backlog --stale</command>
<description>Show only stale items across all columns</description>
</example>
<example>
<command>/nmblr:backlog --assignee alice</command>
<description>Show only PDs assigned to alice</description>
</example>
<example>
<command>/nmblr:backlog --priority high</command>
<description>Show only PDs with priority high or critical</description>
</example>
<example>
<command>/nmblr:backlog --period 7d</command>
<description>Show board with Done column limited to last 7 days</description>
</example>
<example>
<command>/nmblr:backlog --assignee bob --stale</command>
<description>Show stale items assigned to bob</description>
</example>
</examples>

<error_handling>
- **No PD directory configured:** Report "PD directory not configured in .claude/nmblr/config.yaml" and exit
- **No PD files found:** Render empty board with "No PD documents found." message
- **PD with malformed frontmatter:** Skip the PD, log a warning noting the file path and parse error
- **Missing kanban config block:** Use all default threshold values (documented in stale_detection section)
- **Missing timestamp fields on PDs:** Exclude from metric calculations; show "N/A" in metric-dependent columns (WIP Age, Cycle Time)
- **Git branch not found for commit check:** Treat as "no commits" (stale if threshold exceeded)
- **Circular dependencies detected:** Render cycle warnings but do not abort; continue with rest of board
</error_handling>
