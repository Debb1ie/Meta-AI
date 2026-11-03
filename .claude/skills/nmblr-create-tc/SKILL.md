---
name: nmblr:create-tc
description: |
  Create or update test cases aligned with PRDs, verified against RFCs and codebase.
  Based on the tc-writer agent. Operates in two modes:
  - **Generate** (default): Creates a new TC document from a PRD with discrepancy detection.
  - **Update**: Revises an existing TC document when source documents change.
user-invocable: true
argument-hint: "<PRD-ID|TC-ID> [--mode generate|update] [--story story-id] [--type functional|api|e2e] [--layer frontend|backend|both] [--rfc RFC-ID]"
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
<name>nmblr:create-tc</name>
<summary>Create or update test cases aligned with PRDs, verified against RFCs and the codebase. Generates structured TC documents covering functional, API, E2E, integration, and UX/visual test cases with discrepancy detection between specs and implementation.</summary>
<agent>tc-writer</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:create-tc &lt;PRD-ID&gt;</syntax>
<syntax>nmblr:create-tc &lt;PRD-ID&gt; --mode generate</syntax>
<syntax>nmblr:create-tc &lt;TC-ID&gt; --mode update</syntax>
<syntax>nmblr:create-tc &lt;PRD-ID&gt; --story &lt;story-id&gt; --type functional --layer backend</syntax>
<syntax>nmblr:create-tc &lt;PRD-ID&gt; --rfc &lt;RFC-ID&gt; --layer both</syntax>
<syntax>nmblr:create-tc &lt;TC-ID&gt; --mode update --rfc &lt;RFC-ID&gt;</syntax>
</usage>

<arguments>
<argument name="PRD-ID or TC-ID" required="true">
<description>
For generate mode: the PRD ID to generate test cases from (e.g., PRD-0004).
For update mode: the TC document ID to update (e.g., TC-0004).
Mode is inferred from whether a PRD-ID or TC-ID is provided if --mode is not specified.
</description>
</argument>
</arguments>

<options>
<option name="--mode">
Execution mode. Default: inferred from argument.
Options:
  - generate — Create a new TC document from a PRD (default when PRD-ID is given)
  - update   — Revise an existing TC document (default when TC-ID is given)
</option>
<option name="--story">Scope generation or update to a specific user story ID within the PRD (e.g., --story US-003).</option>
<option name="--type">
Filter test case types to generate or update.
Options: functional, api, e2e, integration, ux-visual.
Can be specified multiple times for multiple types.
Default: all applicable types.
</option>
<option name="--layer">
Filter by implementation layer.
Options: frontend, backend, both.
Default: both.
</option>
<option name="--rfc">RFC ID to cross-reference during generation or update (e.g., --rfc RFC-0023). Used to align test cases with implementation scope.</option>
<option name="--design-system">Path or reference to the design system document. If not provided, the agent searches for it automatically.</option>
<option name="--author">Author name to record in the TC document header. Defaults to the value in config.yaml if set.</option>
</options>

<mode_detection>
If --mode is not explicitly provided, mode is inferred from the argument:

| Argument pattern | Inferred mode |
|------------------|---------------|
| PRD-NNNN         | generate      |
| TC-NNNN          | update        |
| "create tc for PRD-NNNN" | generate |
| "update TC-NNNN" | update        |
| "regenerate TC-NNNN" | update     |
| "add tests for PRD-NNNN" | generate |
</mode_detection>

<execution_instructions>
When this skill is invoked:

1. **Parse arguments**
   - Extract PRD-ID or TC-ID
   - Infer mode if --mode not provided (see mode_detection table)
   - Resolve optional filters: --story, --type, --layer, --rfc, --design-system, --author

2. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Get document directory locations and author default

3. **Resolve file paths**
   - For generate mode: locate PRD file by PRD-ID in configured docs directory
   - For update mode: locate TC file by TC-ID; also locate its source PRD
   - If --rfc is provided, locate the RFC file
   - If --design-system is not provided, search for design system docs automatically
   - Abort with clear message if required files cannot be found

4. **Validate prerequisites**
   - Generate mode: PRD must exist and be in an approved or in-progress state
   - Update mode: TC document must exist; source PRD must still exist
   - If --rfc is provided, RFC file must exist

5. **Delegate to tc-writer agent**

   **Generate mode**:
   - Pass PRD file, RFC file (if any), filters, design-system reference, and author
   - Agent reads PRD user stories and acceptance criteria
   - Agent cross-references RFC implementation scope (if provided)
   - Agent scans codebase for existing implementations to detect discrepancies
   - Agent generates structured TC document with all applicable test case types
   - Agent notes any spec-vs-implementation discrepancies in a separate section

   **Update mode** (with approval gate):
   - Pass existing TC file, source PRD, RFC (if any), and filters
   - Agent diffs the TC against current PRD and RFC state
   - Agent presents proposed changes (additions, modifications, deprecations) for approval
   - Wait for user approval before writing changes
   - After approval, apply changes and update TC document metadata

6. **Report results**
   - Output TC file path (created or updated)
   - Test case counts by type (functional, api, e2e, integration, ux-visual)
   - Discrepancies detected (if any), with severity
   - For update mode: counts of added, modified, and deprecated test cases
</execution_instructions>

<examples>
<example>
<command>/nmblr:create-tc PRD-0004</command>
<description>Generate a full TC document for PRD-0004 covering all test types and layers.</description>
</example>
<example>
<command>/nmblr:create-tc PRD-0004 --rfc RFC-0018</command>
<description>Generate test cases for PRD-0004 cross-referenced against RFC-0018 implementation scope.</description>
</example>
<example>
<command>/nmblr:create-tc PRD-0004 --type functional --layer backend</command>
<description>Generate only backend functional test cases for PRD-0004.</description>
</example>
<example>
<command>/nmblr:create-tc PRD-0004 --story US-002</command>
<description>Generate test cases scoped to user story US-002 within PRD-0004.</description>
</example>
<example>
<command>/nmblr:create-tc TC-0004 --mode update</command>
<description>Update an existing TC document to reflect changes in its source PRD.</description>
</example>
<example>
<command>/nmblr:create-tc TC-0004 --mode update --rfc RFC-0025</command>
<description>Update TC-0004 incorporating changes from RFC-0025.</description>
</example>
<example>
<command>/nmblr:create-tc TC-0004 --mode update --type e2e</command>
<description>Update only the E2E test cases in TC-0004.</description>
</example>
<example>
<command>/nmblr:create-tc PRD-0007 --type ux-visual --design-system docs/design/design-system.md</command>
<description>Generate UX/visual test cases for PRD-0007 using a specific design system reference.</description>
</example>
<example>
<command>/nmblr:create-tc PRD-0004 --layer frontend --type functional --type e2e</command>
<description>Generate frontend functional and E2E test cases for PRD-0004.</description>
</example>
<example>
<command>/nmblr:create-tc TC-0004 --mode update --story US-005 --type functional</command>
<description>Update only functional test cases for story US-005 in TC-0004.</description>
</example>
</examples>
