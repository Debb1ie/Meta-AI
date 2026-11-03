---
name: nmblr:ts-create
description: |
  Generate, maintain, and validate Robot Framework + Appium automation test scripts from Test Cases (TCs) and PRD requirements.
  Based on the robot-appium-writer agent (.claude/agents/ts-writer.md).
  Scripts are aligned 1-to-1 with TCs and validated against RFC specs when provided.
  Operates in three modes (plus a combined orchestration):
  - **Generate** (default): 3-phase workflow (Trace & Scenario -> Logic Review -> Scripting) for new features. Produces a manifest baseline.
  - **Locator Check**: Detects testID drift between codebase and generated scripts. Pre-flight check before test execution.
  - **Update**: Incrementally updates scripts when TCs change — diffs against manifest and regenerates only affected files.
  - **Check & Update**: Skill-level orchestration that runs Locator Check then Update sequentially.
  Use when user wants to generate Robot Framework test scripts, check locator drift, or update scripts after TC changes.
user-invocable: true
argument-hint: '<TC-ID|feature> [--mode generate|locator-check|update|check-and-update] [--rfc RFC-ID]'
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - Task
  - Agent
---

<skill_info>
<name>nmblr:ts-create</name>

<summary>Generate, maintain, and validate Robot Framework + Appium automation test scripts from Test Cases (TCs) and PRD requirements. Based on the robot-appium-writer agent (.claude/agents/ts-writer.md). Includes 1-to-1 TC-to-script traceability, cross-platform locator management (iOS/Android), RFC spec validation, UX/UI visual verification assertions, test evidence capture, and manifest-driven incremental updates.</summary>
<agent>robot-appium-writer</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:ts-create &lt;TC-ID&gt;</syntax>
<syntax>nmblr:ts-create &lt;TC-ID&gt; --rfc RFC-0003</syntax>
<syntax>nmblr:ts-create &lt;TC-ID&gt; --prd PRD-0001</syntax>
<syntax>nmblr:ts-create &lt;feature-name&gt; --mode locator-check</syntax>
<syntax>nmblr:ts-create &lt;feature-name&gt; --mode update</syntax>
<syntax>nmblr:ts-create &lt;feature-name&gt; --mode check-and-update</syntax>
<syntax>nmblr:ts-create &lt;TC-ID&gt; --mode generate --rfc RFC-0003</syntax>
</usage>

<arguments>
<argument name="TC-ID or feature-name" required="true">
<description>
For **Generate** mode: TC document ID (e.g., TC-0001) or feature name. The TC document at `docs/qa/TCs/{NNNN}-{slug}.md` is the primary source of truth.
For **Locator Check**, **Update**, or **Check & Update** mode: feature directory name under `tests/e2e/` (e.g., `account-creation-authentication`). The feature must have an existing `.ts-manifest.json`.
</description>
</argument>
</arguments>

<options>
<option name="--mode" value_type="mode">
Operating mode: `generate` (default), `locator-check`, `update`, or `check-and-update`.
- **generate**: Full 3-phase workflow — Trace & Scenario, Logic Review (approval gate), Scripting. Requires TCs + PRD.
- **locator-check**: Scans codebase testIDs against manifest snapshot. Detects removed, renamed, moved, and new testIDs. Requires existing manifest.
- **update**: Diffs current TCs against manifest, regenerates only changed scripts. Requires existing manifest.
- **check-and-update**: Skill-level orchestration — runs Locator Check first, then Update sequentially. Ensures testIDs are current before applying TC changes. This is NOT a fourth agent mode; it chains the agent's Locator Check and Update modes.
</option>
<option name="--rfc" value_type="rfc-id">Related RFC for spec validation. The `--rfc` flag itself is optional — but RFC validation always runs if an RFC exists (from this flag or from the manifest). This flag does NOT toggle validation on/off; it controls WHICH RFC is used.
- **Generate mode:** Provides the RFC for Phase 1 trace and Phase 2 validation. Stored in the manifest after generation. If omitted, the agent uses the RFC from the TC document's `related_rfcs` frontmatter (if any).
- **Update mode:** Overrides the RFC stored in the manifest's `source_documents.rfc`. The override is **permanent** — after apply, the manifest is updated to point to the new RFC. Useful when the original RFC has been superseded. If omitted, the agent uses the manifest's stored RFC.
- **Locator Check mode:** Not used — locator drift is codebase-only, no RFC involved.
</option>
<option name="--prd" value_type="prd-id">PRD to cross-reference for coverage gap analysis. Defaults to the PRD referenced in the TC document's frontmatter.</option>
</options>

<mode_detection>
If --mode is not explicitly provided, infer the mode from the user's natural language:

| User says                                                                | Inferred mode  |
| ------------------------------------------------------------------------ | -------------- |
| "generate scripts", "write scripts", "create automation", "write .robot" | Generate       |
| User provides TCs + PRD for a new feature                                | Generate       |
| "check locators", "locator drift", "testID health", "pre-flight check"   | Locator Check  |
| "update scripts", "sync scripts", "TCs changed", "incremental update"    | Update         |
| "check and update", "locator check then update", "full sync"             | Check & Update |

If the mode is ambiguous and no manifest exists for the feature, default to **Generate**.
If a manifest exists and the user says "update" or "check", route accordingly.
</mode_detection>

<tc_filtering_rules>
The agent applies these rules to determine which TCs become .robot scripts. The `Automated` flag (set by tc-writer at TC generation time) is the primary filter.

**Included (scripted):**

- TCs with `Automated: Yes` — the primary filter. Covers: Functional (UI), API (frontend-facing), E2E, Integration, Security (frontend), UX/UI Visual (copy, layout, spacing, colors)

**Excluded (not scripted — listed in Phase 2 report):**

- TCs with `Automated: No` — requires manual execution. Covers: UX/UI Visual (typography), Accessibility (VoiceOver/TalkBack), Performance (load testing)
- TCs with `Type: API` and `Layer: Backend` — automated with Jest/Supertest, not Appium
- TCs with `Type: Security` and `Layer: Backend` — same reason

**Special handling:**

- TCs with `Type: UX/UI Visual` and `Automated: Yes` — generate visual assertion keywords for copy, layout, spacing, and color checks
- TCs with parameterized test data — generate using Robot Framework `[Template]` with data-driven rows
- TCs referencing sandbox mode magic numbers — use sandbox test data variables
  </tc_filtering_rules>

<execution_instructions>
When this skill is invoked:

1. **Parse arguments and resolve paths**
   - Extract TC-ID or feature name from the first argument
   - Determine mode from --mode flag or natural language (see mode_detection)
   - Extract optional --rfc and --prd references

   **TC-ID to file path resolution (Generate mode):**
   When the user provides a TC-ID (e.g., `TC-0001`), resolve it to the actual file path:
   - Extract the numeric portion: `TC-0001` → `0001`
   - Glob for the file: `docs/qa/TCs/0001-*.md`
   - If exactly one match: use it (e.g., `docs/qa/TCs/0001-account-creation-authentication.md`)
   - If no match: report "TC document not found at docs/qa/TCs/0001-\*.md" and stop
   - If multiple matches: list them and ask the user to specify
   - Read the TC document's YAML frontmatter to extract `related_prd` and `related_rfcs` (used as defaults if --prd / --rfc not provided)

   **Feature name resolution (Locator Check / Update / Check & Update modes):**
   When the user provides a feature name (e.g., `account-creation-authentication`):
   - Check that `tests/e2e/{feature-name}/` directory exists
   - Read the manifest at `tests/e2e/{feature-name}/.ts-manifest.json`
   - Extract the TC document path from the manifest: `manifest.source_documents.tc_document.path`
   - Extract the feature name from the manifest: `manifest.feature`

2. **Validate prerequisites by mode**

   **Generate mode prerequisites:**
   - TC document must exist at `docs/qa/TCs/{NNNN}-{slug}.md`
   - PRD must be identifiable (from TC frontmatter `related_prd` or --prd flag)
   - If --rfc provided, RFC document must exist

   **Re-generation guard:** Before running Generate, check if a manifest already exists at `tests/e2e/{feature-name}/.ts-manifest.json`. If it does, the feature has already been generated. Warn the user:

   > "Scripts already exist for this feature (manifest dated {manifest.updated_at}). Running Generate will **overwrite all existing scripts and the manifest**. If you only need to update changed TCs, use `--mode update` instead. Reply **'Regenerate'** to confirm full re-generation, or **'Update'** to switch to Update mode."
   - If user confirms "Regenerate": proceed with Generate (overwrites everything)
   - If user says "Update": switch to Update mode flow
   - This guard prevents accidental loss of manually-applied locator fixes or custom tweaks

   **Common files reuse:** `tests/e2e/common/` files (appium_config.resource, common_keywords.resource, variables_global.resource) are **shared across all features**. The agent checks if they already exist before generating them. If they exist, they are NOT overwritten — generating scripts for Feature B will not break Feature A's shared resources. Only create or update common files if they are missing or if the agent detects they need new keywords/variables for the current feature.

   **Locator Check mode prerequisites:**
   - Feature directory must exist at `tests/e2e/{feature-name}/`
   - Manifest must exist at `tests/e2e/{feature-name}/.ts-manifest.json`
   - If no manifest found, inform user that Generate mode must run first

   **Update mode prerequisites:**
   - Same as Locator Check (manifest required)
   - TC document must exist (path from manifest's `source_documents.tc_document`)

   **Check & Update mode prerequisites:**
   - Same as Update (manifest + TC document required)

   **Error handling:**
   - If TC document not found: report the expected path and stop. Do not guess.
   - If manifest not found for Locator Check / Update: inform user that Generate mode must run first to establish the baseline manifest. Offer to run Generate instead.
   - If manifest exists but cannot be parsed: report the error and suggest re-running Generate mode to rebuild.

3. **Delegate to robot-appium-writer agent — multi-step approval flow**

   The agent has approval gates that require user interaction between phases. Each mode below describes the invocation pattern and how to handle the gate.

   **Context preservation:** When a mode requires re-invocation after user approval (Generate Phase 3, Update Apply), the re-invocation prompt MUST include the previous report output. This gives the agent the full context from the prior run (testID mappings, TC scope decisions, diff results) so it can proceed without re-tracing the entire codebase from scratch.

   ***

   ### Generate mode — 2-step flow with approval gate

   **Step A — Run Phase 1 + Phase 2 (Trace & Scenario + Logic Review):**

   Spawn the `robot-appium-writer` agent (subagent_type: `robot-appium-writer`) with:

   ```
   Mode: Generate
   TC Document: docs/qa/TCs/{NNNN}-{slug}.md
   PRD: {PRD-ID and path}
   RFC: {RFC-ID and path, or "not provided"}
   Feature name: {derived from TC document title, kebab-case}

   Run Phase 1 (Trace & Scenario) and Phase 2 (Logic Review):
   - Phase 1: Parse TCs, apply filtering rules, trace codebase for testIDs, read UX spec and design system for visual TCs, cross-reference PRD for coverage gaps, validate against RFC if provided
   - Phase 2: Output the structured Logic Review report
   STOP after Phase 2 — do NOT generate .robot files yet.
   ```

   The agent returns a **Phase 2 Logic Review report** containing:
   - Source Documents table (TC, PRD, RFC, UX, DS with version hashes)
   - TC Automation Scope (included vs excluded TCs with reasons)
   - Mapped testIDs (codebase testID → variable name → referenced TCs)
   - Blockers (missing testIDs)
   - Duplicate testIDs (same testID in multiple files, variable name collisions)
   - Coverage Gaps (PRD requirements without TCs)
   - RFC Mismatches (TC expected results conflicting with RFC specs)
   - TC vs UX Spec Mismatches (copy discrepancies)
   - Manual Visual Checks table (non-automatable properties with DS token values)
   - Test Scenarios grouped by story (with robot file names, data-driven flags, RFC validation status)

   **Relay the Phase 2 report to the user and wait for approval.**

   **Blocker rule:** If the Phase 2 report contains BLOCKERs (missing testIDs), warn the user that blocked TCs cannot be scripted until testIDs are added to the codebase. The user may still approve to proceed — blocked TCs will be skipped, and a `# BLOCKED` comment will be left in the script.

   **Step B — Run Phase 3 (Scripting) after user approves:**

   When the user explicitly approves (e.g., "Approved", "Looks good, generate", "Go ahead"), re-invoke the agent with the Phase 2 report included for context:

   ```
   Mode: Generate — Phase 3 (Scripting)
   The user approved Phase 2. Generate all .robot files, resource files, __init__.robot, README.md, and .ts-manifest.json.

   TC Document: {path}
   PRD: {path}
   RFC: {path or N/A}
   Feature name: {name}

   Phase 2 Logic Review report (approved by user — use as reference context):
   ---
   {paste the full Phase 2 report output from Step A here}
   ---

   Use the Phase 2 report as your primary reference for:
   - Which TCs are included vs excluded (TC Automation Scope)
   - testID-to-variable mappings (Mapped testIDs)
   - Story-to-robot-file assignments (Test Scenarios)
   - Any unresolved RFC Mismatches (add [RFC-MISMATCH] comments)
   - Any BLOCKERs (skip blocked TCs, add # BLOCKED comment)
   Re-read the TC document and codebase as needed for full step details and locator resolution.
   ```

   The agent generates all files and returns a **Generate Mode Summary**:
   | Attribute | Value |
   | ----------------------------------- | --------------------------- |
   | TCs Processed / Included / Excluded | counts |
   | Data-Driven TCs | count + total rows |
   | UX/UI Visual TCs | count + automated vs manual |
   | RFC Validated / Mismatches | Yes/No + count |
   | Blockers / PRD Gaps | counts |
   | Files Generated | list |
   | Manifest | path |

   **If user rejects Phase 2:** No files are generated. Inform the user to resolve the flagged issues (blockers, RFC mismatches, coverage gaps) and re-run `/nmblr:ts-create` when ready.

   ***

   ### Locator Check mode — 1-step with optional follow-up

   Spawn the agent with:

   ```
   Mode: Locator Check
   Feature: {feature-name}
   Manifest: tests/e2e/{feature-name}/.ts-manifest.json

   Run the Locator Drift Detection workflow:
   - Read manifest locator snapshot as baseline
   - Scan codebase for current testIDs in the feature's components
   - Compare baseline vs live — classify as Unchanged, Moved, Removed, Renamed, New
   - Output the Locator Drift Report
   ```

   The agent returns a **Locator Drift Report** containing:
   - Summary table (Unchanged / Moved / Removed / Renamed / New counts)
   - Removed testIDs table (BREAKING — testID, was-in file, manifest variable, affected TCs, affected scripts)
   - Renamed testIDs table (LIKELY BREAKING — old/new testID, file, confidence, affected TCs/scripts)
   - New testIDs table (not in manifest — potential new TC coverage)
   - Moved testIDs table (informational — file location changed)
   - Duplicate testIDs table (same testID value in multiple files — WARNING or BLOCKER)
   - Recommended actions
   - Locator Status: **PASS** (no Removed/Renamed/Duplicates) or **FAIL** (action required)

   **Relay the drift report to the user.**
   - If **PASS**: inform user scripts are safe to execute.
   - If **FAIL**: prompt user with "Reply **'Apply fixes'** to auto-update locator resource files for confirmed renames. Removed testIDs require manual TC/script decisions."

   **Optional follow-up — "Apply fixes":**
   If the user replies "Apply fixes", re-invoke the agent with the drift report included:

   ```
   Mode: Locator Check — Apply fixes
   Feature: {feature-name}
   Manifest: tests/e2e/{feature-name}/.ts-manifest.json

   Locator Drift Report (from previous scan — use as reference):
   ---
   {paste the Locator Drift Report output here}
   ---

   Apply the auto-fix workflow:
   - Update ${ELEMENT_ID} variable values in the locator resource file for confirmed Renamed testIDs
   - Add warning comments for Removed testIDs: # DRIFT: testID removed from codebase — TC needs review
   - Add commented-out entries for New testIDs (until TCs reference them)
   - Update the manifest locators section and updated_at timestamp
   Report all changes made.
   ```

   ***

   ### Update mode — 1-step with approval gate, supports partial approval

   Spawn the agent with:

   ```
   Mode: Update
   Feature: {feature-name}
   Manifest: tests/e2e/{feature-name}/.ts-manifest.json
   TC Document: {path from manifest}

   Run the Incremental Update workflow:
   - Check for RFC override (use provided RFC if --rfc flag differs from manifest)
   - Check source document drift (PRD, RFC, UX spec, design system)
   - Parse current TCs and compute content hashes
   - Apply TC filtering rules to all current TCs
   - Diff against manifest — classify as Unchanged, Modified, Added, Removed, Status Changed
   - Re-validate Added/Modified TCs against PRD, RFC, UX spec
   - Trace codebase for testIDs needed by Added/Modified TCs
   - Detect orphaned TCs (source requirement removed from PRD/UX/RFC)
   - Re-check blocked TCs (previously missing/duplicate testIDs now resolved)
   - Output the TC Update Report
   STOP — do NOT regenerate scripts yet.
   ```

   The agent returns a **TC Update Report** containing:
   - RFC active indicator (which RFC is being used — manifest's or override, shown prominently in header)
   - Source Document Drift table (PRD / RFC / UX Spec / Design System — changed or unchanged, with warning messages)
   - Change Summary (Unchanged / Modified / Added / Removed / Status Changed counts)
   - Modified TCs table (TC ID, story, change scope, affected file, impact)
   - Added TCs table (TC ID, story, type, filtering status, robot file, new file?)
   - Removed TCs table (TC ID, story, robot file, action, **impact** — TCs remaining in file or file deletion)
   - Status Changed TCs table (old vs new status, action)
   - Unblocked TCs (previously blocked TCs whose testID issues are now resolved — ready to generate)
   - Orphaned TCs (TCs whose source requirement was removed from PRD/UX/RFC — needs user decision)
   - New Blockers, Duplicate testIDs, Coverage Gaps, RFC Mismatches, TC-UX Mismatches
   - Files Affected table (file, action, reason — includes downstream cleanup of orphaned locators/keywords/variables)

   **Relay the TC Update Report to the user and wait for approval.**

   If source documents drifted, highlight: "Source documents (PRD/RFC/UX) have changed since last generation. TCs may not fully reflect current requirements. Consider reviewing TCs before approving."

   The user may respond with:
   - **Full approval**: "Approved" / "Apply all" — regenerate all affected scripts
   - **Partial approval**: "Approve all except TC-NNNN-025" — regenerate everything except the excluded TCs
   - **Reject**: "Hold off" / "Don't apply" — no changes made, user should resolve issues first

   After approval, re-invoke the agent with the TC Update Report included:

   ```
   Mode: Update — Apply changes
   Feature: {feature-name}
   Manifest: tests/e2e/{feature-name}/.ts-manifest.json
   TC Document: {path from manifest}
   Approval: {full / partial — list excluded TC IDs if partial}

   TC Update Report (approved by user — use as reference context):
   ---
   {paste the full TC Update Report output here}
   ---

   Use the TC Update Report as your primary reference for:
   - Which TCs are Modified, Added, Removed, Status Changed (Change Summary)
   - Which files to modify, create, or delete (Files Affected)
   - Change scope for each Modified TC (steps, expected results, test data, metadata)
   - Filtering status for Added TCs (included vs excluded)
   - If partial approval: skip the excluded TC IDs listed above
   Re-read the TC document and codebase as needed for full step details and locator resolution.
   Regenerate affected scripts and update the manifest.
   ```

   **If user rejects:** No files are modified. Inform the user to resolve blockers, mismatches, or source document drift, then re-run `/nmblr:ts-create {feature} --mode update` when ready.

   ***

   ### Check & Update mode — skill-level sequential orchestration

   This is NOT a fourth agent mode — it chains the agent's Locator Check and Update modes sequentially. Ensures testIDs are current before applying TC changes.

   **Flow:**
   1. Run Locator Check (as described above)
   2. If drift detected → show report, wait for "Apply fixes" or skip
   3. After Locator Check is resolved → run Update mode (as described above)
   4. Show TC Update Report, wait for approval
   5. After approval → apply changes

   Each step follows its own approval gate independently. The user reviews and approves each report separately.

4. **Report results**
   - Show the agent's output (Phase 2 report, drift report, or update report)
   - Show the mode-appropriate summary table (see agent's `<output_summary_format>`)
   - List next steps, blockers, or mismatches requiring attention
   - For Generate Phase 2: explicitly ask user to review and approve before proceeding
   - For Locator Check: report locator status (PASS/FAIL); if FAIL, prompt "Apply fixes"
   - For Update: explicitly ask user to approve (full, partial, or reject) before applying

</execution_instructions>

<source_of_truth>

- **Primary:** Test Cases (TCs) — defines the exact scenarios, steps, preconditions, and expected results to automate. Every generated test script must correspond 1-to-1 with a TC.
- **Secondary:** PRD — used to validate TC coverage and clarify acceptance criteria. Flag any PRD requirements not covered by a TC as a Coverage Gap.
- **Supplementary (when provided):** RFC — used to validate that TC expected results are aligned with the RFC's defined specs. If a TC's expected result conflicts with the RFC, flag it as an RFC Mismatch.
- **Design System (when applicable):** `docs/product/PRDs/design/talino-wallet-design-system.md` — referenced for UX/UI visual verification TCs to validate design tokens, colors, typography, and spacing.
- **UX Spec (when applicable):** `docs/product/PRDs/ux/{NNNN}-01-{slug}-ux.md` — referenced for copy, layout, and component behavior verification.
- Use Glob, Grep, and Read tools to trace the app's codebase and map testID attributes to locators.
- If a testID is missing for a TC-required element, flag it as a BLOCKER.
  </source_of_truth>

<manifest_reference>
The manifest at `tests/e2e/{feature-name}/.ts-manifest.json` is the contract between all modes. The orchestrator needs these JSON paths when reading the manifest:

| What you need                    | JSON path                                               | Used by       |
| -------------------------------- | ------------------------------------------------------- | ------------- |
| Feature name                     | `manifest.feature`                                      | All modes     |
| Last generated/updated timestamp | `manifest.updated_at`                                   | All modes     |
| TC document path                 | `manifest.source_documents.tc_document.path`            | Update        |
| TC document content hash         | `manifest.source_documents.tc_document.content_hash`    | Update        |
| PRD path                         | `manifest.source_documents.prd.path`                    | Update        |
| RFC path                         | `manifest.source_documents.rfc.path`                    | Update        |
| UX spec path                     | `manifest.source_documents.ux_spec.path`                | Update        |
| Design system path               | `manifest.source_documents.design_system.path`          | Update        |
| TC entry (per TC)                | `manifest.test_cases["TC-NNNN-001"]`                    | Update        |
| TC content hash                  | `manifest.test_cases["TC-NNNN-001"].content_hash`       | Update        |
| TC robot file                    | `manifest.test_cases["TC-NNNN-001"].robot_file`         | Update        |
| Locator entry (per testID)       | `manifest.locators["signup.email_input"]`               | Locator Check |
| Locator source file + line       | `manifest.locators["..."].source_file` / `.source_line` | Locator Check |
| Locator referenced TCs           | `manifest.locators["..."].referenced_by`                | Locator Check |
| Generated file list              | `manifest.generated_files`                              | All modes     |
| Statistics                       | `manifest.statistics`                                   | All modes     |

See the agent's `<manifest_schema>` section for the full JSON schema with field descriptions.
</manifest_reference>

<key_standards>
These standards are enforced by the robot-appium-writer agent. They are listed here for reference when reviewing generated scripts:

- Every .robot test case maps 1-to-1 to a source TC — no extra or missing test cases
- One .robot file per story — all scenario types (happy, negative, alternate, edge) grouped together
- Only TCs passing the filtering rules are scripted — API-only, manual, and performance TCs are excluded (see `<tc_filtering_rules>`)
- Pre-resolved locator pattern: `${ELEMENT_ID}` (raw testID) resolved once in Suite Setup to `${ELEMENT}` (platform-specific locator)
- Cross-platform: iOS uses `accessibility_id`, Android uses `id` — resolved transparently via `Initialize Locators` keyword
- Every element interaction MUST be preceded by an explicit wait — never tap/input/assert without waiting
- Never use `Sleep` for synchronization — always use conditional waits
- Test isolation: every test resets to a known state via Test Setup
- Evidence capture: screenshots at key checkpoints (2-4 per test), video for all tests (kept only for failures)
- Failure evidence packages include `evidence_manifest.json` — contract for bug-report-writer agent
- Parameterized TCs use `[Template]` with one named test case per data row (suffix a, b, c...)
- UX/UI visual assertions cover text content and element states only; non-automatable properties (color, font, spacing) get `# Manual Visual Check` comments with exact design token values from the design system
- RFC-backed assertions include `# RFC: {spec}` inline comments; unresolved mismatches include `# [RFC-MISMATCH]` warnings
- Manifest (`.ts-manifest.json`) is generated at end of Generate mode — baseline for Locator Check and Update modes
- Quarantined (known-flaky) tests are tagged `quarantine` with an inline comment explaining root cause
- Tags on every test: TC ID (e.g., TC-0001-001), scenario type (happy-path, negative, alternate, edge-case), platform (ios, android), priority (smoke, regression), type (functional, e2e, ux-visual), story (story-1.1)
  </key_standards>

<file_output_structure>

```
tests/e2e/
├── common/                                    # Shared across all features (generated once)
│   ├── appium_config.resource                 # Session management, Appium capabilities
│   ├── common_keywords.resource               # Shared waits, evidence capture, platform keywords
│   └── variables_global.resource              # Platform config, timeouts
├── {feature-name}/                            # Per feature (one directory per TC document)
│   ├── .ts-manifest.json                      # Agent-managed manifest (TC hashes, locator snapshots)
│   ├── __init__.robot                         # Suite setup/teardown, force tags
│   ├── tc{nnnn}_01_{story_slug}.robot         # Story X.1 — all paths (happy, negative, alternate, edge)
│   ├── tc{nnnn}_02_{story_slug}.robot         # Story X.2 — all paths
│   └── resources/
│       ├── {feature}_locators.resource        # Pre-resolved locator variables + Initialize Locators keyword
│       ├── {feature}_keywords.resource        # Feature-specific action keywords
│       ├── variables.resource                 # Feature test data, sandbox magic numbers
│       └── test_data_setup.resource           # API-assisted data provisioning (RequestsLibrary)
├── requirements.txt                           # Pinned dependencies (robotframework, appiumlibrary, etc.)
├── README.md                                  # Setup guide, execution instructions, traceability matrix
└── results/                                   # Test execution output (gitignored)
    ├── output.xml, log.html, report.html      # Standard Robot Framework reports
    ├── evidence_TC-NNNN-001_*.png             # Step screenshots (all tests — audit evidence)
    └── evidence/
        ├── videos/                            # Screen recordings (failures only)
        └── failures/{TC-ID}/                  # Failure packages with evidence_manifest.json
```

</file_output_structure>

<examples>

## Quick reference

| Command / User says                                | Mode                | What happens                             |
| -------------------------------------------------- | ------------------- | ---------------------------------------- |
| `/nmblr:ts-create TC-0001`                         | Generate            | Full 3-phase: trace, review, script      |
| `/nmblr:ts-create TC-0001 --rfc RFC-0003`          | Generate            | Same + RFC spec validation               |
| `Approved. Generate the scripts.`                  | Generate (Phase 3)  | Scripts generated after Phase 2 approval |
| `No, hold off.`                                    | Generate (reject)   | Nothing generated, resolve issues first  |
| `/nmblr:ts-create feature --mode locator-check`    | Locator Check       | testID drift scan vs manifest            |
| `Apply fixes`                                      | Locator Check (fix) | Auto-update locator resource files       |
| `/nmblr:ts-create feature --mode update`           | Update              | Diff TCs vs manifest, show report        |
| `Approved`                                         | Update (apply)      | Regenerate affected scripts              |
| `Approve all except TC-0001-025`                   | Update (partial)    | Regenerate all except excluded TCs       |
| `Don't apply`                                      | Update (reject)     | Nothing modified, resolve issues first   |
| `/nmblr:ts-create feature --mode check-and-update` | Check & Update      | Locator Check then Update sequentially   |
| `Check and update scripts for X`                   | Check & Update      | Natural language trigger                 |

---

## Generate mode — create scripts for a new feature

<example>
<command>/nmblr:ts-create TC-0001</command>
<description>Generate Robot Framework automation scripts for TC-0001 (Account Creation & Authentication). Runs the full 3-phase workflow — traces codebase, maps testIDs, outputs Logic Review for approval, then generates .robot files.</description>
</example>

<example>
<command>/nmblr:ts-create TC-0001 --rfc RFC-0003</command>
<description>Generate scripts for TC-0001 with RFC-0003 spec validation. TC expected results are cross-checked against RFC-defined behaviors — mismatches are flagged in the Phase 2 report.</description>
</example>

<example>
<command>/nmblr:ts-create TC-0005 --prd PRD-0005 --rfc RFC-0010</command>
<description>Generate scripts for TC-0005 (Transfers) with explicit PRD and RFC references for full traceability and validation.</description>
</example>

## Generate mode — Phase 2 approval follow-up

<example>
<command>Approved. Generate the scripts.</command>
<description>After reviewing the Phase 2 Logic Review report, approve to proceed to Phase 3 (Scripting). The agent generates all .robot files, resource files, and the manifest.</description>
</example>

<example>
<command>Approved, but skip TC-0001-010 — it's being rewritten.</command>
<description>Approve Phase 2 with a partial exclusion. The agent scripts all included TCs except the one being rewritten.</description>
</example>

<example>
<command>No, there are too many RFC mismatches. Hold off.</command>
<description>Reject Phase 2. No files are generated. Resolve the RFC mismatches in the TC document, then re-run /nmblr:ts-create when ready.</description>
</example>

## Locator Check mode — pre-flight testID status check

<example>
<command>/nmblr:ts-create account-creation-authentication --mode locator-check</command>
<description>Run locator drift detection for the account-creation-authentication feature. Compares codebase testIDs against the manifest snapshot — flags removed, renamed, moved, and new testIDs.</description>
</example>

<example>
<command>Check locators for wallet-funding</command>
<description>Natural language trigger — inferred as Locator Check mode for the wallet-funding feature.</description>
</example>

## Locator Check mode — apply fixes follow-up

<example>
<command>Apply fixes</command>
<description>After reviewing the Locator Drift Report, auto-update the locator resource file for confirmed renames, add warnings for removed testIDs, and update the manifest.</description>
</example>

## Update mode — incremental script regeneration

<example>
<command>/nmblr:ts-create account-creation-authentication --mode update</command>
<description>Diff current TCs against the manifest. Detects modified, added, removed, and status-changed TCs. Checks source document drift (PRD, RFC, UX spec). Outputs the TC Update Report for approval.</description>
</example>

<example>
<command>TCs changed for account creation, update the scripts</command>
<description>Natural language trigger — inferred as Update mode. Incrementally regenerates only affected .robot files after TC document changes.</description>
</example>

## Update mode — approval follow-ups

<example>
<command>Approved</command>
<description>Full approval — regenerate all affected scripts as listed in the TC Update Report.</description>
</example>

<example>
<command>Approve all except TC-0001-025</command>
<description>Partial approval — regenerate everything except the excluded TC. The excluded TC is left unchanged in the existing script.</description>
</example>

<example>
<command>Don't apply — the PRD drifted, I need to update TCs first.</command>
<description>Reject the update. No scripts are modified. User updates TCs to reflect the new PRD, then re-runs update mode.</description>
</example>

## Check & Update mode — combined workflow

<example>
<command>/nmblr:ts-create account-creation-authentication --mode check-and-update</command>
<description>Run Locator Check first to ensure testIDs are current, then run Update to regenerate scripts for changed TCs. Both reports are presented sequentially with their own approval gates.</description>
</example>

<example>
<command>Check and update scripts for wallet-funding</command>
<description>Natural language trigger — inferred as Check & Update mode. Verifies locator status before applying TC changes.</description>
</example>

</examples>
