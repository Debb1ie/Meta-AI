---
name: nmblr:tc-create
description: |
  Create or update test cases for front-end and back-end aligned with PRDs, verified against RFCs and codebase.
  Based on the tc-writer agent (.claude/agents/tc-writer.md).
  Operates in two modes:
  - **Generate** (default): Creates a new TC document from a PRD with full discrepancy detection.
  - **Update**: Revises an existing TC document when source documents (PRD, RFC, UX spec) change. Detects drift, adds new TCs, flags orphaned TCs, updates discrepancies.
  Includes UX/UI visual verification test cases that check typography, colors, spacing, and copy against the design system (DS-0001) and UX specs.
  Use when user wants to generate or update test cases for a feature, story, or endpoint.
user-invocable: true
argument-hint: '<PRD-ID|TC-ID> [--mode generate|update] [--story story-id] [--type functional|api|e2e|ux-visual] [--layer frontend|backend|both] [--rfc RFC-ID]'
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
<name>nmblr:tc-create</name>

<summary>Create test cases for front-end and back-end aligned with PRDs, verified against RFCs and codebase. Based on the tc-writer agent (.claude/agents/tc-writer.md). Includes UX/UI visual verification against the design system and UX specs (typography, colors, spacing, components, copy). Generates comprehensive TC documents with discrepancy detection, test summary tables, and full traceability.</summary>
<agent>tc-writer</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:tc-create &lt;PRD-ID&gt;</syntax>
<syntax>nmblr:tc-create &lt;PRD-ID&gt; --story "1.1"</syntax>
<syntax>nmblr:tc-create &lt;PRD-ID&gt; --layer backend --type api</syntax>
<syntax>nmblr:tc-create &lt;PRD-ID&gt; --rfc RFC-0003</syntax>
<syntax>nmblr:tc-create &lt;PRD-ID&gt; --layer frontend --type ux-visual</syntax>
<syntax>nmblr:tc-create &lt;PRD-ID&gt; --author "Angel Castillo"</syntax>
<syntax>nmblr:tc-create &lt;TC-ID&gt; --mode update</syntax>
<syntax>nmblr:tc-create &lt;TC-ID&gt; --mode update --rfc RFC-0008</syntax>
</usage>

<arguments>
<argument name="PRD-ID or TC-ID" required="true">
<description>
For **Generate** mode: PRD-ID (e.g., PRD-0001). The PRD provides user stories, acceptance criteria, and API definitions that drive test case creation.
For **Update** mode: TC-ID (e.g., TC-0001) of the existing TC document to revise.
</description>
</argument>
</arguments>

<options>
<option name="--mode" value_type="mode">
Operating mode: `generate` (default) or `update`.
- **generate**: Creates a new TC document from a PRD. Full 9-step workflow with discrepancy detection, codebase verification, and all test case patterns.
- **update**: Revises an existing TC document when source documents change. Detects PRD/RFC/UX/DS drift, adds new TCs for new stories, flags orphaned TCs for removed stories, updates discrepancies. Includes approval gate before applying changes.
</option>
<option name="--story" value_type="story-id">Target a specific story (e.g., "1.1", "2.3"). If omitted, covers all stories.</option>
<option name="--type" value_type="test-type">Test case type filter: functional, api, integration, e2e, performance, security, regression, ux-visual. If omitted, generates all applicable types for the target layer.</option>
<option name="--layer" value_type="layer">Target layer: frontend, backend, or both (default: both).</option>
<option name="--rfc" value_type="rfc-id">Related RFC to cross-reference.
- **Generate mode:** If omitted, the agent scans `docs/engineering/RFCs/` for RFCs that reference the PRD.
- **Update mode:** If provided, overrides the existing TC's `related_rfcs`. Useful when a new RFC supersedes the original.
</option>
<option name="--design-system" value_type="path">Path to design system file. Defaults to `docs/product/PRDs/design/talino-wallet-design-system.md`.</option>
<option name="--author" value_type="name">Set author name. Defaults to the current git user (`git config user.name`).</option>
</options>

<mode_detection>
If --mode is not explicitly provided, infer from the user's input:

| User says                                                           | Inferred mode |
| ------------------------------------------------------------------- | ------------- |
| Provides PRD-ID (e.g., `PRD-0001`)                                  | Generate      |
| "create TCs", "generate test cases", "write TCs for PRD"            | Generate      |
| Provides TC-ID (e.g., `TC-0001`) with "update"                      | Update        |
| "update TCs", "TCs need updating", "PRD changed, update test cases" | Update        |
| "refresh TCs", "sync TCs with PRD"                                  | Update        |

If ambiguous: if the first argument matches `TC-NNNN`, default to Update. If it matches `PRD-NNNN`, default to Generate.
</mode_detection>

<execution_instructions>
When this skill is invoked:

1. **Parse arguments and resolve paths**
   - Extract PRD-ID from the first argument
   - Extract optional --story, --layer, --type, --rfc, --design-system, --author

   **PRD-ID to file path resolution:**
   - Extract the numeric portion: `PRD-0001` → `0001`
   - Glob for the file: `docs/product/PRDs/0001-*.md`
   - If exactly one match: use it (e.g., `docs/product/PRDs/0001-account-creation-authentication.md`)
   - If no match: report "PRD document not found at docs/product/PRDs/0001-\*.md" and stop
   - If multiple matches: list them and ask the user to specify

   **UX spec resolution:**
   - Extract the numeric portion from the PRD-ID: `PRD-0001` → `0001`
   - Glob for the file: `docs/product/PRDs/ux/0001-*.md`
   - If exactly one match: use it (e.g., `docs/product/PRDs/ux/0001-01-account-creation-authentication-ux.md`)
   - If multiple matches: use all (some PRDs have multiple UX spec files)
   - If no match: note "No UX spec found" — agent will generate TCs without UX-specific visual checks and add a discrepancy noting the missing UX spec

   **RFC resolution (if --rfc provided):**
   - Extract the numeric portion: `RFC-0003` → `0003`
   - Glob for the file: `docs/engineering/RFCs/0003-*.md`
   - If no match: report "RFC document not found at docs/engineering/RFCs/0003-\*.md" and stop

   **RFC auto-scan (if --rfc NOT provided):**
   - Grep `docs/engineering/RFCs/*.md` for files referencing the PRD-ID (e.g., `PRD-0004`)
   - Collect all matching RFC paths to pass to the agent

2. **Validate prerequisites**
   - PRD document must exist (resolved in step 1)
   - Design system file must exist at the specified or default path
   - If --rfc provided, RFC document must exist
   - UX spec is optional but always resolved — missing UX spec is logged, not a blocker

   **Error handling:**
   - If PRD not found: report expected path and stop
   - If RFC not found: report expected path and stop
   - If design system not found: report expected path and stop

3. **Delegate to tc-writer agent**

   ***

   ### Generate mode

   Spawn the `tc-writer` agent (subagent_type: `tc-writer`) with:

   ```
   Mode: Generate
   Create test cases for {PRD-ID}.

   PRD: {resolved PRD path}
   UX Spec: {resolved UX spec path, or "No UX spec found — skip UX/UI visual TCs and add discrepancy"}
   RFC: {resolved RFC path(s), or "scan docs/engineering/RFCs/ for RFCs referencing this PRD"}
   Story filter: {--story value, or "all stories"}
   Layer: {--layer value, or "both"}
   Type filter: {--type value, or "all applicable types"}
   Design system: {--design-system path, or default}
   Author: {--author value, or result of `git config user.name`}

   Follow your Generate workflow (steps 1-9) defined in your agent instructions. Do not ask questions — use the PRD as the primary driver. Use the <per_tc_template> table format for every individual test case. Use the <document_structure> template for the overall document layout.
   ```

   The agent handles everything autonomously:
   - Resolves inputs and scans for existing TCs
   - If existing TC found for the same PRD: agent returns TC info (path, version, count) and STOPs. **Relay this to the user and ask:** "TC-{NNNN} already exists. Reply **'Create new'** to create a separate TC document, **'Update'** to switch to Update mode, or **'Abort'** to cancel." Then re-invoke the agent based on the user's choice.
   - Reads PRD, UX spec, design system, RFC
   - Verifies against codebase (backend + frontend)
   - Generates test cases organized by story and category
   - Builds discrepancy table
   - Creates the TC document with full structure (version 1.0)
   - Reports summary

   ***

   ### Update mode — with approval gate

   **TC-ID to file path resolution:**
   - Extract the numeric portion: `TC-0001` → `0001`
   - Glob for the file: `docs/qa/TCs/0001-*.md`
   - If no match: report "TC document not found at docs/qa/TCs/0001-\*.md" and stop. Suggest Generate mode.

   Spawn the `tc-writer` agent with:

   ```
   Mode: Update
   Update existing test cases for {TC-ID}.

   TC Document: {resolved TC path}
   RFC override: {--rfc value, or "use existing related_rfcs from TC frontmatter"}
   Story filter: {--story value, or "all stories"}
   Layer: {--layer value, or "both"}
   Type filter: {--type value, or "all applicable types"}
   Design system: {--design-system path, or default}

   Follow your Update workflow (steps 1-7) defined in your agent instructions. Detect source document drift, diff PRD stories against existing TCs, audit the discrepancy table against current codebase, output the TC Update Report, then STOP and wait for approval. Use the <per_tc_template> table format for any new test cases.
   ```

   The agent returns a **TC Update Report** containing:
   - Source Document Drift table (PRD / RFC / UX Spec / Design System — changed or unchanged)
   - Change Summary (new TCs, modified TCs, orphaned TCs, discrepancies resolved/added)
   - Orphaned TCs table (TCs whose story was removed from PRD)
   - Version impact (proposed version bump with reason)

   **Relay the TC Update Report to the user and wait for approval.**

   The user may respond with:
   - **"Approved"** — apply all changes (add new TCs, modify existing, mark orphaned)
   - **"Approved, keep orphaned TCs"** — apply changes but don't mark orphaned TCs
   - **"Reject"** — no changes made

   After approval, re-invoke the agent with:

   ```
   Mode: Update — Apply changes
   TC Document: {path}
   Approval: {full / keep orphaned / reject}

   TC Update Report (approved by user — use as reference):
   ---
   {paste the TC Update Report here}
   ---

   Apply the approved changes, bump version, update frontmatter. Use the <per_tc_template> table format for all new and modified test cases. Follow the <semantic_versioning> rules for the version bump.

   Changelog: Prepend a new row (newest first) to the ## Changelog table summarizing all changes in this update. If the ## Changelog section does not exist yet (pre-existing TC document), create it after ## Test Summary with a backfilled "Version X.0 — Generate" entry reconstructed from frontmatter (version, updated, prd_version, related_rfcs, author), then prepend the current update entry above it.

   Version Traceability: Prepend a new row (newest first) to the ## Version Traceability table with the current versions of all source documents (PRD, UX spec, design system, RFCs) and codebase HEAD commit. If the section doesn't exist yet (pre-existing TC document), create it after ## Changelog and backfill the initial row from frontmatter and git history, then prepend the current update row.

   Frontmatter guard: After reading the TC frontmatter, check that these fields exist: created, related_prd, related_ux, related_design_system, related_rfcs, prd_version, ux_spec_version. If any are missing, resolve them (e.g., `created` from `git log --diff-filter=A --format='%as'`, `related_prd` from the Overview or Discrepancy Table) and add the missing fields to the frontmatter before proceeding. If `author` is "QA Team", replace it with the result of `git config user.name`. If the existing Changelog table is missing the Author column, migrate it by adding the column. Report any fields or columns that were added in the update summary.

   Format migrations (mandatory): Apply these on every Update — (1) If the discrepancy table is missing the `Found` column, add it after `ID` and backfill dates from the Changelog (match D-ID ranges to the version that introduced them); (2) If `## Changelog` appears after `## Archived Test Cases` or at the end of the document, move it to after `## Test Summary`; (3) If `## Version Traceability` appears after `## Related Documents`, move it to after `## Changelog`. Report migrations in the update summary.
   ```

   ***

4. **Report results**
   - **Generate mode:** Show summary table (TC count, breakdown by category/layer/type, discrepancies), file path, next steps
   - **Update mode:** Show update summary (TCs added/modified/orphaned, version bump, discrepancies resolved/added), next steps

</execution_instructions>

<examples>

## Quick reference

| Command / User says                                           | Mode            | What it does                            |
| ------------------------------------------------------------- | --------------- | --------------------------------------- |
| `/nmblr:tc-create PRD-0001`                                   | Generate        | Create TCs for all stories, both layers |
| `/nmblr:tc-create PRD-0001 --story "1.1"`                     | Generate        | Create TCs for Story 1.1 only           |
| `/nmblr:tc-create PRD-0001 --layer backend --type api`        | Generate        | Backend API test cases only             |
| `/nmblr:tc-create PRD-0001 --layer frontend --type ux-visual` | Generate        | UX/UI visual verification TCs only      |
| `/nmblr:tc-create PRD-0001 --rfc RFC-0003`                    | Generate        | Create TCs with RFC cross-reference     |
| `/nmblr:tc-create PRD-0001 --author "Angel Castillo"`         | Generate        | Set custom author                       |
| `/nmblr:tc-create TC-0001 --mode update`                      | Update          | Update existing TCs after PRD changes   |
| `/nmblr:tc-create TC-0001 --mode update --rfc RFC-0008`       | Update          | Update TCs with new RFC override        |
| `Update TCs for account creation`                             | Update          | Natural language trigger                |
| `Approved`                                                    | Update (apply)  | Apply changes after reviewing report    |
| `Approved, keep orphaned TCs`                                 | Update (apply)  | Apply but preserve orphaned TCs         |
| `Reject`                                                      | Update (reject) | Cancel, no changes                      |

---

<example>
<command>/nmblr:tc-create PRD-0001</command>
<description>Create test cases for all stories in PRD-0001 (Account Creation & Authentication), covering both frontend and backend, with UX/UI visual verification for every frontend-facing story.</description>
</example>

<example>
<command>/nmblr:tc-create PRD-0001 --story "1.1" --layer backend --type api</command>
<description>Create backend API test cases for Story 1.1 (User Signup with Email/Password) only. Includes endpoint validation, error codes, and Zod schema boundary tests.</description>
</example>

<example>
<command>/nmblr:tc-create PRD-0003 --layer frontend --type e2e</command>
<description>Create frontend E2E test cases for PRD-0003 (Wallet Funding). Covers full user flows with navigation, loading states, and error handling.</description>
</example>

<example>
<command>/nmblr:tc-create PRD-0005 --rfc RFC-0010 --layer both</command>
<description>Create test cases for PRD-0005 (Transfers), cross-referencing RFC-0010 for endpoint specs, error codes, and sandbox magic numbers.</description>
</example>

<example>
<command>/nmblr:tc-create PRD-0001 --layer frontend --type ux-visual</command>
<description>Create UX/UI visual verification test cases for PRD-0001, checking typography, colors, spacing, and copy against the design system and UX spec. Expected Results include exact hex codes, px values, and verbatim copy.</description>
</example>

<example>
<command>/nmblr:tc-create PRD-0002 --story "2.1" --layer backend --rfc RFC-0005</command>
<description>Create backend test cases for KYC story 2.1, verified against RFC-0005 implementation details.</description>
</example>

## Update mode — revise existing TCs after source changes

<example>
<command>/nmblr:tc-create TC-0001 --mode update</command>
<description>Update TC-0001 after PRD/UX/RFC changes. Detects drift, adds TCs for new stories, flags orphaned TCs for removed stories, updates discrepancies. Outputs a TC Update Report for approval before applying.</description>
</example>

<example>
<command>/nmblr:tc-create TC-0001 --mode update --rfc RFC-0008</command>
<description>Update TC-0001 with a new RFC override. Re-validates all TCs against RFC-0008 instead of the original RFCs.</description>
</example>

<example>
<command>Update TCs for account creation, the PRD changed</command>
<description>Natural language trigger — inferred as Update mode for TC-0001 (the TC covering account creation).</description>
</example>

## Update mode — approval follow-ups

<example>
<command>Approved</command>
<description>Apply all changes from the TC Update Report — add new TCs, modify existing, mark orphaned, bump version.</description>
</example>

<example>
<command>Approved, keep orphaned TCs</command>
<description>Apply changes but don't mark orphaned TCs — useful if the user plans to repurpose them.</description>
</example>

</examples>
