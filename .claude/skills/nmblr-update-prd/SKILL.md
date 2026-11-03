---
name: nmblr:update-prd
description: |
  Execute a wave of PRD updates from the PRD Update Tracker.
  Reads the tracker, identifies items, edits PRD and UX files, and tracks progress.
  Also supports archiving completed trackers and initializing new ones.
user-invocable: true
argument-hint: "<wave-number> [--item <letter>] [--status] [--archive] [--init]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
---

<skill_info>
<name>nmblr:update-prd</name>
<summary>Execute a wave of PRD updates from the PRD Update Tracker. Reads the tracker, identifies items, edits PRD and UX files, and tracks progress. Also supports archiving completed trackers and initializing new ones.</summary>
<agent>prd-updater</agent>
<tracker_file>{prds_path}/prd-update-tracker.md</tracker_file>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<path_resolution>
Resolve `{prds_path}` from `.claude/nmblr/config.yaml` key `documents.prds` (and
`{ux_path}` from `documents.ux`) before doing anything else. If a key is absent,
fall back to `docs/product/PRDs/` and `docs/product/PRDs/ux/` respectively — do
not fail. Every edit in a run belongs to the one `{prds_path}` names; never follow
a tracker item into a sibling product's tree.
</path_resolution>

<usage>
<syntax>nmblr:update-prd &lt;wave-number&gt;</syntax>
<syntax>nmblr:update-prd &lt;wave-number&gt; --item &lt;letter&gt;</syntax>
<syntax>nmblr:update-prd --status</syntax>
<syntax>nmblr:update-prd --next</syntax>
<syntax>nmblr:update-prd &lt;wave-number&gt; --dry-run</syntax>
<syntax>nmblr:update-prd --archive</syntax>
<syntax>nmblr:update-prd --init</syntax>
<syntax>nmblr:update-prd --init --from-archive &lt;archive-file&gt;</syntax>
</usage>

<arguments>
<argument name="wave-number" required="false">
<description>The wave number to execute (e.g., 1, 2, 3). Required for execution unless using --status, --archive, or --init.</description>
</argument>
</arguments>

<options>
<option name="--item">Execute only a specific item within a wave, identified by its letter (e.g., --item A, --item C). Cannot be combined with --dry-run.</option>
<option name="--status">Show current completion status of all waves without making any changes.</option>
<option name="--next">Show the next incomplete wave and its items without executing.</option>
<option name="--dry-run">Preview which files would be changed and what edits would be made, without writing any changes.</option>
<option name="--archive">Archive the current tracker to a timestamped file and clear the active tracker.</option>
<option name="--init">Initialize a new blank PRD Update Tracker at the default tracker path.</option>
<option name="--from-archive">Used with --init to pre-populate the new tracker from a previous archive file.</option>
</options>

<prerequisites>
- The PRD Update Tracker must exist at `{prds_path}/prd-update-tracker.md` (except when using --init).
- `{prds_path}` itself must exist; if it does not, stop and report the resolved path and the config key it came from.
- All dependency waves listed in the tracker must be marked complete before executing a wave.
- PRD and UX files referenced in tracker items must exist at their listed paths.
</prerequisites>

<execution_instructions>
When this skill is invoked:

1. **Parse arguments**
   - Extract wave-number (if provided)
   - Detect flags: --item, --status, --next, --dry-run, --archive, --init, --from-archive

2. **Read the tracker**
   - Load `{prds_path}/prd-update-tracker.md`
   - Parse wave structure: wave number, dependencies, items (letter, target file, description, status)

3. **Handle special modes**

   **--status**: Display all waves with item-level completion (✅/⬜) and exit.

   **--next**: Identify the first wave with incomplete items (respecting dependencies) and display it, then exit.

   **--archive workflow**:
   - Verify all waves in the tracker are complete; warn if not
   - Copy tracker to `{prds_path}/archive/prd-update-tracker-{YYYY-MM-DD}.md`
   - Clear the active tracker (reset to empty template)
   - Report the archive path

   **--init workflow**:
   - If `--from-archive` is provided, read the archive file and extract wave structure as a starting template
   - Otherwise create a blank tracker with standard wave-template scaffolding
   - Write to `{prds_path}/prd-update-tracker.md`
   - Report that the tracker was initialized

4. **Validate wave execution** (for normal execution path)
   - Confirm wave-number is provided
   - Confirm dependency waves are complete; abort with clear message if not
   - Confirm all target files in the wave exist; list missing files and abort if any are missing
   - If --item is provided, confirm the letter exists in the wave

5. **Delegate to prd-updater agent**
   - Pass wave number, optional item filter, dry-run flag, tracker data, and resolved file paths
   - The agent performs edits to PRD and UX files per each item's instructions
   - After each item the agent marks it complete in the tracker

6. **Report results**
   - Files modified (with change summary per item)
   - Items completed vs. skipped
   - Whether the wave is now fully complete
   - Next wave to execute (if any remain)
</execution_instructions>

<examples>
<example>
<command>/nmblr:update-prd 1</command>
<description>Execute all items in Wave 1.</description>
</example>
<example>
<command>/nmblr:update-prd 2 --item B</command>
<description>Execute only item B from Wave 2.</description>
</example>
<example>
<command>/nmblr:update-prd --status</command>
<description>Show completion status of all waves and items without making changes.</description>
</example>
<example>
<command>/nmblr:update-prd --next</command>
<description>Show what the next incomplete wave is and list its items.</description>
</example>
<example>
<command>/nmblr:update-prd 3 --dry-run</command>
<description>Preview which files Wave 3 would edit and what changes would be made.</description>
</example>
<example>
<command>/nmblr:update-prd --archive</command>
<description>Archive the completed tracker to a timestamped file and reset the active tracker.</description>
</example>
<example>
<command>/nmblr:update-prd --init</command>
<description>Initialize a new blank PRD Update Tracker.</description>
</example>
<example>
<command>/nmblr:update-prd --init --from-archive docs/product/PRDs/archive/prd-update-tracker-2025-06-01.md</command>
<description>Initialize a new tracker pre-populated from a previous archive.</description>
</example>
</examples>
