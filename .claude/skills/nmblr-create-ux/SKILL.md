---
name: nmblr:create-ux
description: |
  Create or update UX specifications aligned with PRDs.
  Based on the ux-writer agent. Operates in two modes:
  - **Generate** (default): Creates a new UX spec from a PRD with screen layouts, navigation, and copy.
  - **Update**: Revises an existing UX spec when the source PRD changes — detects story drift, flags screens that need updating, and handles additions/removals.
user-invocable: true
argument-hint: "<PRD-ID|UX-ID> [--mode generate|update] [--story story-id] [--screens-only] [--copy-only]"
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
<name>nmblr:create-ux</name>
<summary>Create or update UX specification documents from PRDs. Generates screen layouts (ASCII wireframes), component lists, navigation maps, and all user-facing copy. Detects PRD story drift on update and flags screens needing revision.</summary>
<agent>ux-writer</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:create-ux &lt;PRD-ID&gt;</syntax>
<syntax>nmblr:create-ux &lt;PRD-ID&gt; --mode generate</syntax>
<syntax>nmblr:create-ux &lt;UX-ID&gt; --mode update</syntax>
<syntax>nmblr:create-ux &lt;PRD-ID&gt; --story &lt;story-id&gt;</syntax>
<syntax>nmblr:create-ux &lt;UX-ID&gt; --mode update --screens-only</syntax>
<syntax>nmblr:create-ux &lt;UX-ID&gt; --mode update --copy-only</syntax>
</usage>

<arguments>
<argument name="PRD-ID or UX-ID" required="true">
<description>
For generate mode: the PRD ID to create UX specs from (e.g., PRD-0003).
For update mode: the UX document ID to update (e.g., UX-0003-01).
Mode is inferred from whether a PRD-ID or UX-ID is provided if --mode is not specified.
</description>
</argument>
</arguments>

<options>
<option name="--mode">
Execution mode. Default: inferred from argument.
Options:
  - generate — Create a new UX spec from a PRD (default when PRD-ID is given)
  - update   — Revise an existing UX spec (default when UX-ID is given)
</option>
<option name="--story">Scope generation or update to a specific user story ID within the PRD (e.g., --story 2.1). Only screens related to this story are generated or updated.</option>
<option name="--screens-only">Update mode only. Limit update to screen layouts, components, and navigation — skip copy/text content review.</option>
<option name="--copy-only">Update mode only. Limit update to copy/text content — skip screen layout and navigation review.</option>
<option name="--design-system">Path to the project's design system document. If not provided, the agent searches for it automatically. Used to reference component names in screen specs.</option>
</options>

<mode_detection>
If --mode is not explicitly provided, mode is inferred from the argument:

| Argument pattern | Inferred mode |
|------------------|---------------|
| PRD-NNNN         | generate      |
| UX-NNNN-NN       | update        |
| "create UX for PRD-NNNN" | generate |
| "update UX-NNNN-NN" | update     |
| "screens for PRD-NNNN" | generate |
| "refresh UX specs" | update      |
</mode_detection>

<execution_instructions>
When this skill is invoked:

1. **Parse arguments**
   - Extract PRD-ID or UX-ID
   - Infer mode if --mode not provided (see mode_detection table)
   - Resolve optional filters: --story, --screens-only, --copy-only, --design-system

2. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Get document directory locations

3. **Resolve file paths**
   - For generate mode: locate PRD file by PRD-ID in configured docs directory
   - For update mode: locate UX file by UX-ID; also locate its source PRD from the UX document's `related_prd` frontmatter
   - If --design-system not provided, search for design system docs automatically
   - Abort with clear message if required files cannot be found

4. **Validate prerequisites**
   - Generate mode: PRD must exist
   - Update mode: UX document must exist; source PRD must still exist

5. **Delegate to ux-writer agent**

   **Generate mode**:
   - Pass PRD file, story filter (if any), and design-system reference
   - Agent reads PRD user stories and acceptance criteria
   - Agent derives screen list from stories
   - Agent confirms screen list with user before detailing each one
   - Agent creates UX spec with:
     * Feature context (description, design goals, user types, copy tone)
     * Screen specifications (ASCII wireframe, components, behavior, copy/text)
     * Navigation map
   - Agent creates file using UX template

   **Update mode** (with approval gate):
   - Pass existing UX file, source PRD, filters, and design-system reference
   - Agent diffs the UX spec against current PRD state:
     * Detects new stories → flags screens to add
     * Detects removed stories → flags screens to remove or update
     * Detects modified stories → flags screens needing revision
     * Detects copy changes → flags text content to update
   - Agent presents a **UX Update Report** for approval:
     * Source Document Drift (PRD changed sections)
     * Screens to Add (new stories without screens)
     * Screens to Update (modified stories)
     * Screens to Remove (removed stories)
     * Copy Changes (text content needing revision)
     * Navigation Impact (flow changes)
   - Wait for user approval before writing changes
   - User may approve fully, partially (exclude specific screens), or reject
   - After approval, apply changes and update UX document metadata (version bump)

6. **Report results**
   - Output UX file path (created or updated)
   - Screen count (total, new, updated, removed)
   - Navigation flows documented
   - For update mode: summary of changes applied
   - Next steps (review with product team, combine with design system)
</execution_instructions>

<examples>
<example>
<command>/nmblr:create-ux PRD-0003</command>
<description>Generate a full UX specification for PRD-0003 with screen layouts, navigation, and copy for all stories.</description>
</example>
<example>
<command>/nmblr:create-ux PRD-0003 --story 3.1</command>
<description>Generate UX specs scoped to story 3.1 within PRD-0003. The leading number names the owning PRD, so a story in PRD-0003 begins with 3.</description>
</example>
<example>
<command>/nmblr:create-ux PRD-0003 --design-system docs/design/design-system.md</command>
<description>Generate UX specs referencing a specific design system for component names.</description>
</example>
<example>
<command>/nmblr:create-ux UX-0003-01 --mode update</command>
<description>Update UX-0003-01 to reflect changes in its source PRD. Presents drift report for approval.</description>
</example>
<example>
<command>/nmblr:create-ux UX-0003-01 --mode update --screens-only</command>
<description>Update only screen layouts and navigation in UX-0003-01, skip copy review.</description>
</example>
<example>
<command>/nmblr:create-ux UX-0003-01 --mode update --copy-only</command>
<description>Update only copy/text content in UX-0003-01, skip layout review.</description>
</example>
<example>
<command>/nmblr:create-ux UX-0003-01 --mode update --story 3.2</command>
<description>Update only screens related to story 3.2 in UX-0003-01.</description>
</example>
</examples>
