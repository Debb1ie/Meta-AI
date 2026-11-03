---
name: nmblr:bug-report
description: |
  Generate structured defect reports from Robot Framework test execution results or manual bug findings.
  Based on the bug-report-writer agent (.claude/agents/bug-report-writer.md).
  Consumes evidence_manifest.json packages from ts-writer, cross-references TCs, PRDs, and RFCs,
  then outputs precise bug reports with root cause analysis.
  Optionally creates GitHub Issues and adds them to the project board under Backlog.
  Operates in three modes:
  - **Scan** (default): Process test results directory — triage failures, generate defect reports, optionally file GitHub Issues.
  - **Manual**: Defect report creation for bugs found outside automated test runs.
  - **Sync**: Pull GitHub Issue status back into BR markdown files to keep local reports current.
  Use when user wants to generate bug reports from test results, file defects to GitHub, write a structured defect report, or sync BR status from GitHub.
user-invocable: true
argument-hint: '<results-dir|--manual|--sync> [--file-github] [--env DEV|STG|PROD] [--assign @user]'
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - Agent
---

<skill_info>
<name>nmblr:bug-report</name>

<summary>Generate structured defect reports from Robot Framework test results or manual findings. Consumes evidence_manifest.json packages from ts-writer, cross-references TCs/PRDs/RFCs/codebase, produces markdown defect reports with root cause analysis, and optionally files GitHub Issues to the project board under Backlog. Also syncs BR status from GitHub Issues via --sync mode.</summary>
<agent>bug-report-writer</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:bug-report &lt;results-dir&gt;</syntax>
<syntax>nmblr:bug-report &lt;results-dir&gt; --file-github</syntax>
<syntax>nmblr:bug-report &lt;results-dir&gt; --file-github --assign @username</syntax>
<syntax>nmblr:bug-report &lt;results-dir&gt; --file-github --env STG</syntax>
<syntax>nmblr:bug-report &lt;results-dir&gt; --file-github --auto</syntax>
<syntax>nmblr:bug-report &lt;results-dir&gt; --file-github --auto --labels severity:critical,module:auth</syntax>
<syntax>nmblr:bug-report &lt;results-dir&gt; --build v1.2.0</syntax>
<syntax>nmblr:bug-report --manual</syntax>
<syntax>nmblr:bug-report --manual --file-github</syntax>
<syntax>nmblr:bug-report --manual --file-github --env STG --assign @username</syntax>
<syntax>nmblr:bug-report --sync</syntax>
</usage>

**Sample commands:**

```bash
# Scan mode — triage test failures, review, then generate BR files
/nmblr:bug-report results/

# Scan mode — triage + file to GitHub with assignment
/nmblr:bug-report results/ --file-github --assign @dioven --env STG

# CI pipeline — auto-file all defects, no approval gate
/nmblr:bug-report results/ --file-github --auto

# Manual mode — write a defect report from scratch
/nmblr:bug-report --manual

# Manual mode — file directly to GitHub
/nmblr:bug-report --manual --file-github --assign @dioven

# Sync mode — pull GitHub Issue status into BR markdown files
/nmblr:bug-report --sync
```

<arguments>
<argument name="results-dir" required="false">
<description>
Path to the Robot Framework test results directory (e.g., `results/`, `tests/e2e/account-creation-authentication/results/`).
The directory must contain `output.xml` and `evidence/failures/` subdirectories with `evidence_manifest.json` files.
Required for **Scan** mode. Not used in **Manual** or **Sync** mode.
</description>
</argument>
</arguments>

<options>
<option name="--file-github" value_type="flag">
Enable GitHub Issue creation. When set, the agent creates a GitHub Issue for each defect report and adds it to the project board (talino-labs/projects/84) under Backlog status.
Default label: `bug`.
Without this flag, only local markdown reports are generated.
</option>

<option name="--manual" value_type="flag">
Switch to Manual mode. The skill orchestrator gathers defect details from the user, then spawns the agent with all fields pre-populated to generate a structured report without requiring test results.
</option>

<option name="--env" value_type="environment">
Test environment where the defect was found: `DEV` (default), `STG`, or `PROD`.
</option>

<option name="--build" value_type="version">
Application build version (e.g., `v1.2.0`). If not provided, the agent reads it from the manifest `build_version` field (primary), falls back to `device_info.txt`, or leaves it as "Unknown".
</option>

<option name="--assign" value_type="github-username">
GitHub username to assign the created issues to (e.g., `@dioven`). Without this flag, issues are created unassigned.
</option>

<option name="--labels" value_type="comma-separated">
Additional GitHub labels beyond the default `bug` label (e.g., `severity:critical,module:auth`).
</option>

<option name="--author" value_type="name">
Override the "Detected By" field. Defaults to `{git config user.name} (Automated — {TC-ID})` in Scan mode, `{git config user.name}` in Manual/Sync modes.
</option>

<option name="--auto" value_type="flag">
Skip the approval gate in Scan mode. Automatically file all DEFECT-classified failures without waiting for user review.
Use for CI pipeline integration where human review is not practical.
**Warning:** May file false positives. Use only when triage rules are well-tuned.
</option>

<option name="--org" value_type="string">
GitHub organization for project board. Default: `talino-labs`.
</option>

<option name="--project" value_type="number">
GitHub Project number. Default: `84`.
</option>

<option name="--status" value_type="string">
Project board status to set for new issues. Default: `Backlog`.
</option>

<option name="--sync" value_type="flag">
Pull GitHub Issue status back into BR markdown files. Queries each linked Issue, maps the status, and updates the BR frontmatter. No results directory or defect details needed.
</option>

<option name="--archive" value_type="flag">
Used with `--sync`. After status sync, move BRs with `status: Closed` or `status: Fixed` to `docs/qa/bug-reports/archive/`. Keeps the active directory clean while preserving closed defects for audit trail. Without this flag, closed BRs stay in the active directory.
</option>
</options>

<mode_detection>
If --manual or --sync is not explicitly provided, infer the mode from the user's natural language:

| User says                                                                 | Inferred mode |
| ------------------------------------------------------------------------- | ------------- |
| "generate bug reports from results", "file test failures", "scan results" | Scan          |
| User provides a directory path                                            | Scan          |
| "write a bug report for...", "file a defect for...", "I found a bug"      | Manual        |
| "create a bug report" (no results dir, no test context)                   | Manual        |
| "sync bug reports", "pull status from GitHub", "update BR status"         | Sync          |

If ambiguous and a results directory is provided, default to **Scan**.
If ambiguous and no results directory, default to **Manual**.
</mode_detection>

<execution_instructions>
When this skill is invoked:

1. **Parse arguments and determine mode**
   - Check for `--sync` flag → Sync mode
   - Check for `--manual` flag → Manual mode
   - Otherwise extract results directory path → Scan mode
   - Parse all optional flags

2. **Validate prerequisites by mode**

   **Scan mode prerequisites:**
   - Results directory must exist
   - `output.xml` must exist in the directory (proves test run completed)
   - At least one `evidence/failures/*/evidence_manifest.json` must exist (otherwise: all tests passed, nothing to report)
   - Ensure `docs/qa/bug-reports/` directory exists — create it if not (first run on a clean repo)

   **Manual mode prerequisites:**
   - Ensure `docs/qa/bug-reports/` directory exists — create it if not
   - No other filesystem prerequisites — the skill orchestrator gathers all fields from the user before spawning the agent

   **Sync mode prerequisites:**
   - `gh` CLI must be authenticated (the agent queries GitHub Issues)
   - At least one BR file must exist in `docs/qa/bug-reports/` with a `github_issue` frontmatter field

3. **Delegate to bug-report-writer agent — approval flow**

   ***

   ### Scan mode — 2-step flow with approval gate

   **Step A — Run Phase 1 (Scan & Triage):**

   Spawn the `bug-report-writer` agent (subagent_type: `bug-report-writer`) with:

   ```
   Mode: Scan — Phase 1 (Triage)
   Results directory: {path}
   Environment: {--env value or DEV}
   Build version: {--build value or "detect from manifest build_version, fallback to device_info"}

   Run Phase 1 — Scan & Triage:
   - Validate results directory contains output.xml
   - Collect overall run statistics from output.xml
   - Scan evidence/failures/*/evidence_manifest.json
   - Triage each failure: DEFECT, INFRA, FLAKY, REVIEW
   - Cross-reference TC documents for context
   - Group cross-platform and same-root-cause failures
   - Output the Triage Summary
   STOP after Triage Summary — do NOT generate reports yet.
   ```

   The agent returns a **Triage Summary** containing:
   - Test run statistics (total/pass/fail/skip)
   - Defects to File table (TC IDs, failure summary, severity, priority, platform, category)
   - Skipped items (quarantine, infrastructure)
   - Needs Review items (ambiguous failures)

   **If `--auto` flag is set:** Skip the approval gate. Proceed directly to Step B with full approval for all DEFECT items. REVIEW items are skipped in auto mode.

   **Otherwise:** Relay the Triage Summary to the user and wait for approval.

   **Step B — Run Phase 2 (Generate & File) after user approves:**

   When the user explicitly approves (e.g., "Approved", "File all", "File #1 and #3"), re-invoke the agent with the Triage Summary included for context:

   ```
   Mode: Scan — Phase 2 (Generate & File)
   The user approved the Triage Summary. Generate defect reports and optionally file GitHub Issues.

   Results directory: {path}
   Environment: {--env value or DEV}
   Build version: {--build value or "detect from manifest build_version, fallback to device_info"}
   File to GitHub: {yes/no based on --file-github flag}
   Assignee: {--assign value or empty}
   Labels: bug{, plus --labels values if provided}
   Author: {--author value or "`git config user.name` (Automated — {TC-ID})" for each defect}
   GitHub org: {--org or talino-labs}
   Project number: {--project or 84}
   Board status: {--status or Backlog}

   Approval: {full / partial — list excluded items if partial}
   REVIEW decisions: {list any REVIEW items the user decided to include or exclude}

   Triage Summary (approved by user — use as reference context):
   ---
   {paste the full Triage Summary output from Step A here}
   ---

   For each approved defect:
   1. Auto-increment BR-NNNN ID from existing files in docs/qa/bug-reports/
   2. Read TC document, PRD, RFC for full context
   3. Populate defect report template
   4. Perform root cause analysis
   5. Write markdown file to docs/qa/bug-reports/
   6. If filing to GitHub: check for duplicates, create issue, add to project board
   Output the Batch Summary when complete.
   ```

   **If user rejects:** No reports are generated. Inform the user that no defects were filed.

   **Step C — Ask about GitHub filing (if `--file-github` was NOT passed and `--auto` was NOT passed):**

   After showing the Batch Summary to the user, ask:

   > "Would you like to file these defects to GitHub?"
   - If user says **yes**: re-invoke the agent to file all generated BRs to GitHub (create Issues, add to project board, update BR frontmatter with issue numbers).
   - If user says **no**: done — local BR files only.
   - If `--file-github` was already passed: skip this step — GitHub filing happened automatically in Step B.
   - If `--auto` was passed: skip this step — no user interaction in CI mode.

   ***

   ### Manual mode — 2-step flow with field gathering

   The agent is a subagent and cannot interact with the user directly. The **skill orchestrator** (you) must gather all required fields before spawning the agent.

   **Step A — Investigate and gather required fields:**

   First, extract what you can from the user's initial message. If the user describes a symptom rather than a root cause (e.g., "I see white screens before login", "there's a flash of text before the page loads"), investigate the codebase and specs before asking for missing fields:
   - Check the relevant UX spec and PRD for expected behavior
   - Grep the codebase for the affected screen/component
   - Determine if the observed behavior contradicts the spec

   This investigation may reframe the defect (e.g., the user reports "white screens" but the actual bug is "standalone primers screen exists when spec says it should be embedded"). Present your findings to the user for confirmation, then gather any remaining missing fields in a single batched prompt.

   If the user's message already provides a clear, specific defect description, skip investigation and proceed directly to field gathering.

   For any missing required fields, ask the user in a **single batched prompt** — do NOT ask one field at a time.

   Required fields (must have before spawning agent):
   | Field | Extract from user's message, or ask |
   | --- | --- |
   | Defect Title | Short description of the defect |
   | Defect Description | Detailed explanation of the issue |
   | Module | Affected module or functionality |
   | Steps to Replicate | Numbered steps to reproduce |
   | Expected Result | What should have happened |
   | Actual Result | What actually happened |
   | Severity | Critical / Major / Minor |
   | Priority | High / Medium / Low |

   Optional fields (use defaults if not provided):
   | Field | Default |
   | --- | --- |
   | Environment | `--env` value or DEV |
   | Platform | Both (iOS & Android) |
   | Build Version | `--build` value or ask |
   | Detected By | `--author` value or result of `git config user.name` |
   | Attachments | "To be attached manually" |

   **Example batched prompt to user:**

   > "I have the title and description from your message. To complete the bug report, I need a few more details:
   >
   > 1. **Module** — which feature area is affected? (e.g., Login, Signup, Wallet)
   > 2. **Steps to Replicate** — numbered steps to reproduce
   > 3. **Expected vs Actual Result** — what should happen vs what does happen
   > 4. **Severity** — Critical / Major / Minor
   > 5. **Priority** — High / Medium / Low"

   **Step B — Spawn agent with complete field set:**

   Once all required fields are gathered, spawn the `bug-report-writer` agent (subagent_type: `bug-report-writer`) with ALL fields pre-populated:

   ```
   Mode: Manual
   File to GitHub: {yes/no based on --file-github flag}
   Environment: {--env value or DEV}
   Assignee: {--assign value or empty}
   Labels: bug{, plus --labels values if provided}
   Author: {--author value or result of `git config user.name`}
   GitHub org: {--org or talino-labs}
   Project number: {--project or 84}
   Board status: {--status or Backlog}

   All required fields have been gathered from the user. Generate the defect report directly — do NOT ask the user any follow-up questions.

   Defect details:
   ---
   Defect Title: {title}
   Defect Description: {description}
   Module: {module}
   Steps to Replicate:
   {numbered steps}
   Expected Result: {expected}
   Actual Result: {actual}
   Severity: {severity}
   Priority: {priority}
   Platform: {platform}
   Build Version: {build version}
   Detected By: {author}
   Attachments: {attachments or "To be attached manually"}
   ---

   Generate the BR markdown file and optionally file to GitHub.
   Cross-reference the codebase for root cause analysis if the module is identifiable.
   ```

   The agent generates the report and returns it.

   **Step C — Ask about GitHub filing (if `--file-github` was NOT passed):**

   After showing the generated report to the user, ask:

   > "Would you like to file this to GitHub?"
   - If user says **yes**: re-invoke the agent with the existing BR file path and GitHub filing instructions (org, project, board status, assignee, labels). The agent reads the BR, creates the Issue, adds to project board, and updates the BR frontmatter with `github_issue: "#NNN"`.
   - If user says **no**: done — local BR file only.
   - If `--file-github` was already passed: skip this step — GitHub filing happens automatically in Step B.

   ***

   ### Sync mode — pull GitHub Issue status into BR files

   No approval gate needed. Spawn the `bug-report-writer` agent (subagent_type: `bug-report-writer`) with:

   ```
   Mode: Sync
   GitHub org: {--org or talino-labs}
   Project number: {--project or 84}
   Archive: {yes/no based on --archive flag}

   Pull GitHub Issue status back into BR markdown files.
   - Glob all BR files in docs/qa/bug-reports/
   - Read frontmatter for github_issue field
   - Skip BRs with no linked Issue or already Closed
   - Query each linked Issue status via gh CLI
   - Map GitHub state + board column to BR status
   - Update BR frontmatter status field only
   - If Archive is yes: move Closed/Fixed BRs to docs/qa/bug-reports/archive/
   - Output Sync Summary
   ```

   The agent returns a **Sync Summary** showing which BRs were updated. Relay to user.

   ***

4. **Report results**
   - Show the agent's output (Triage Summary, Batch Summary, or Sync Summary)
   - For Scan Phase 1: explicitly ask user to review and approve before proceeding
   - For Scan Phase 2: show filed defects with BR IDs, GitHub Issue links, and file paths
   - For Manual: show the generated report and GitHub Issue link if filed
   - For Sync: show the Sync Summary with updated/unchanged/skipped counts
   - List any warnings (deduplication skips, project board failures, missing evidence, gh auth errors)

</execution_instructions>

<github_defaults>
These defaults are used when filing GitHub Issues. They can be overridden with flags.

| Setting            | Default                          | Flag                  |
| ------------------ | -------------------------------- | --------------------- |
| Label              | `bug`                            | `--labels` (additive) |
| Assignee           | Unassigned                       | `--assign`            |
| Organization       | `talino-labs`                    | `--org`               |
| Project number     | `84`                             | `--project`           |
| Board status       | `Backlog`                        | `--status`            |
| Issue title format | `[BUG] {Module}: {Defect Title}` | —                     |

</github_defaults>

<examples>

## Quick reference

| Command / User says                                      | Mode               | What happens                                           |
| -------------------------------------------------------- | ------------------ | ------------------------------------------------------ |
| `/nmblr:bug-report results/`                             | Scan               | Triage failures → approval → generate markdown reports |
| `/nmblr:bug-report results/ --file-github`               | Scan + GitHub      | Same + create GitHub Issues + add to project board     |
| `/nmblr:bug-report results/ --file-github --assign @dev` | Scan + GitHub      | Same + assign issues to @dev                           |
| `/nmblr:bug-report results/ --file-github --env STG`     | Scan + GitHub      | Same + set Environment to STG                          |
| `/nmblr:bug-report results/ --file-github --auto`        | Scan + GitHub (CI) | Skip approval gate, auto-file all DEFECT items         |
| `Approved`                                               | Scan Phase 2       | Generate reports for all triaged defects               |
| `File #1 and #3 only`                                    | Scan Phase 2       | Generate reports for selected items only               |
| `/nmblr:bug-report --manual`                             | Manual             | Skill gathers details → agent generates BR file        |
| `/nmblr:bug-report --manual --file-github`               | Manual + GitHub    | Same + create GitHub Issue                             |
| `Generate bug reports from the latest test run`          | Scan               | Natural language — inferred Scan mode                  |
| `Write a bug report for the login crash I found`         | Manual             | Natural language — inferred Manual mode                |
| `/nmblr:bug-report --sync`                               | Sync               | Pull GitHub Issue status into BR markdown files        |
| `/nmblr:bug-report --sync --archive`                     | Sync + Archive     | Sync status, then move Closed/Fixed BRs to archive/    |
| `Sync bug report status from GitHub`                     | Sync               | Natural language — inferred Sync mode                  |

---

## Scan mode — process test results

<example>
<command>/nmblr:bug-report results/</command>
<description>Scan the results directory for test failures. Triages each failure, outputs a Triage Summary for review, then generates markdown defect reports after approval. No GitHub integration.</description>
</example>

<example>
<command>/nmblr:bug-report results/ --file-github</command>
<description>Same as above, plus creates GitHub Issues with the `bug` label and adds them to the project board (talino-labs/projects/84) under Backlog status.</description>
</example>

<example>
<command>/nmblr:bug-report results/ --file-github --assign @dioven --env STG</command>
<description>File defects to GitHub, assign to @dioven, and set the environment as STG.</description>
</example>

<example>
<command>/nmblr:bug-report results/ --file-github --auto</command>
<description>CI pipeline mode — skip the approval gate, auto-file all DEFECT-classified failures. REVIEW and INFRA items are skipped. Use for automated pipeline integration.</description>
</example>

## Scan mode — approval follow-ups

<example>
<command>Approved</command>
<description>Full approval — generate defect reports for all items in the Triage Summary.</description>
</example>

<example>
<command>File #1 and #3, skip #2</command>
<description>Partial approval — generate reports for selected items only. #2 is skipped.</description>
</example>

<example>
<command>Include TC-0001-020 as a defect, skip the rest of the review items</command>
<description>User decides on REVIEW items — TC-0001-020 is promoted to DEFECT, other REVIEW items are skipped.</description>
</example>

<example>
<command>Hold off, I need to check the test environment first</command>
<description>Reject — no reports generated. User investigates and re-runs when ready.</description>
</example>

## Manual mode — write a defect report

<example>
<command>/nmblr:bug-report --manual</command>
<description>Start a manual defect report. The skill gathers defect details (title, steps, expected/actual, severity) from the user, then the agent generates a structured BR markdown file.</description>
</example>

<example>
<command>/nmblr:bug-report --manual --file-github</command>
<description>Same as above, plus creates a GitHub Issue after generating the report.</description>
</example>

<example>
<command>Write a bug report for the login page accepting special characters in the email field</command>
<description>Natural language trigger — inferred as Manual mode. The skill uses the description as a starting point, gathers any missing details from the user, then spawns the agent to generate the report.</description>
</example>

## Sync mode — pull GitHub status into BR files

<example>
<command>/nmblr:bug-report --sync</command>
<description>Pull GitHub Issue status back into all BR markdown files. Queries each linked Issue, maps the board column to BR status (Open/In Progress/Fixed/Closed), and updates the frontmatter.</description>
</example>

<example>
<command>Sync bug report status from GitHub</command>
<description>Natural language trigger — inferred as Sync mode. Same as --sync flag.</description>
</example>

<example>
<command>/nmblr:bug-report --sync --archive</command>
<description>Sync status from GitHub, then move all Closed/Fixed BRs to docs/qa/bug-reports/archive/. Keeps the active directory clean while preserving closed defects for audit trail.</description>
</example>

</examples>
