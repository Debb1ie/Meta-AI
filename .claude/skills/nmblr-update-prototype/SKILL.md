---
name: nmblr:update-prototype
description: |
  Execute a wave of prototype updates from the Prototype Update Tracker.
  Reads the tracker, identifies items, edits HTML/CSS/JS prototype files, and tracks progress.
  Also supports initializing new trackers (from scratch or a narrative) and archiving completed ones.
user-invocable: true
argument-hint: "<wave-number> [--item <letter>] [--status] [--next] [--dry-run] [--archive] [--init]"
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
<name>nmblr:update-prototype</name>
<summary>Execute a wave of prototype updates from the Prototype Update Tracker. Reads the tracker, identifies items, edits HTML/CSS/JS prototype files, and tracks progress. Also supports initializing new trackers and archiving completed ones.</summary>
<agent>prototype-updater</agent>
<tracker_file>{prototype_path}/prototype-update-tracker.md</tracker_file>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<path_resolution>
Resolve `{prototype_path}` from `.claude/nmblr/config.yaml` key `paths.prototype`
before doing anything else. If the key is absent, fall back to
`docs/design/prototype/` (the kit's historical default) — do not fail.

**`paths.prototype` is deliberately singular — one prototype per invocation.** A
project holding several prototypes (e.g. a member app and an operator console)
points the key at the one being worked on and runs this skill again for another.
Never widen a run to a sibling directory.
</path_resolution>

<usage>
<syntax>nmblr:update-prototype &lt;wave-number&gt;</syntax>
<syntax>nmblr:update-prototype &lt;wave-number&gt; --item &lt;letter&gt;</syntax>
<syntax>nmblr:update-prototype --status</syntax>
<syntax>nmblr:update-prototype --next</syntax>
<syntax>nmblr:update-prototype &lt;wave-number&gt; --dry-run</syntax>
<syntax>nmblr:update-prototype --archive</syntax>
<syntax>nmblr:update-prototype --init</syntax>
<syntax>nmblr:update-prototype --init "&lt;narrative or list of changes&gt;"</syntax>
</usage>

<arguments>
<argument name="wave-number" required="false">
<description>The wave number to execute (e.g., 1, 2, 3). Required for execution unless using --status, --next, --archive, or --init.</description>
</argument>
</arguments>

<options>
<option name="--item">Execute only a specific item within a wave, identified by its letter (e.g., --item A, --item D).</option>
<option name="--status">Show current completion status of all waves without making any changes.</option>
<option name="--next">Show the next incomplete wave and its items without executing.</option>
<option name="--dry-run">Preview which files would be changed and what edits would be made, without writing any changes.</option>
<option name="--archive">Archive the current completed tracker to a sequential file and reset the live tracker.</option>
<option name="--init">Initialize a new Prototype Update Tracker. Optionally pass a narrative or list of changes as an argument and the agent will organize them into waves for approval before writing.</option>
</options>

<prerequisites>
- The Prototype Update Tracker must exist at `{prototype_path}/prototype-update-tracker.md` (except when using --init).
- All dependency waves listed in the tracker must be marked complete before executing a wave.
- Prototype HTML/CSS/JS files referenced in tracker items must exist at their listed paths.
- An `AI-GUIDE.md` must exist at `{prototype_path}/AI-GUIDE.md` for editing conventions.
- `{prototype_path}` itself must exist; if it does not, stop and report the resolved path and the config key it came from.
</prerequisites>

<execution_instructions>
When this skill is invoked:

1. **Parse arguments**
   - Extract wave-number (if provided)
   - Detect flags: --item, --status, --next, --dry-run, --archive, --init
   - If --init, capture any trailing text as the narrative/list input

2. **Handle special modes**

   **--status**: Read the tracker and display all waves with item-level completion (`[x]`/`[ ]`) and exit.

   **--next**: Identify the first wave with incomplete items (respecting dependencies) and display it, then exit.

   **--archive workflow**:
   - Read the tracker and verify all waves are 100% complete; warn if not and ask to confirm
   - Find the highest existing archive number in `{prototype_path}/archive/`
   - Copy tracker to `{prototype_path}/archive/prototype-update-tracker-{NNN}.md`
   - Reset the live tracker to an initialized blank state
   - Report the archive path

   **--init workflow**:
   - If the live tracker has incomplete items, warn the user before overwriting
   - If a narrative or list was provided as an argument, pass it to the agent to organize into logical waves (structural changes first, copy/polish last) and present the grouping for approval before writing
   - If no input was provided, create a blank tracker ready to be filled
   - Continue wave numbering from the last archived tracker
   - Carry forward any Cross-Cutting Issues from the last archive
   - Write to `{prototype_path}/prototype-update-tracker.md`
   - Report the tracker was initialized

3. **Validate wave execution** (normal execution path)
   - Confirm wave-number is provided
   - Confirm dependency waves are complete; abort with clear message if not
   - Confirm all target files in the wave exist; list missing files and abort if any are missing
   - If --item is provided, confirm the letter exists in the wave

4. **Delegate to prototype-updater agent**
   - Pass wave number, optional item filter, dry-run flag, tracker data, and resolved file paths
   - The agent reads the AI-GUIDE.md for editing conventions before making any changes
   - The agent marks each item in progress before editing and complete after — one at a time
   - After the wave, the agent appends to BUILD-LOG.md

5. **Report results**
   - Files modified (with change summary per item)
   - Items completed vs. skipped
   - Whether the wave is now fully complete
   - Next wave to execute (if any remain)
</execution_instructions>

<examples>
<example>
<command>/nmblr:update-prototype 1</command>
<description>Execute all items in Wave 1.</description>
</example>
<example>
<command>/nmblr:update-prototype 2 --item D</command>
<description>Execute only item D from Wave 2.</description>
</example>
<example>
<command>/nmblr:update-prototype --status</command>
<description>Show completion status of all waves and items without making changes.</description>
</example>
<example>
<command>/nmblr:update-prototype --next</command>
<description>Show the next incomplete wave and list its items.</description>
</example>
<example>
<command>/nmblr:update-prototype 3 --dry-run</command>
<description>Preview which files Wave 3 would edit and what changes would be made.</description>
</example>
<example>
<command>/nmblr:update-prototype --archive</command>
<description>Archive the completed tracker to a sequential file and reset the live tracker.</description>
</example>
<example>
<command>/nmblr:update-prototype --init</command>
<description>Initialize a blank Prototype Update Tracker.</description>
</example>
<example>
<command>/nmblr:update-prototype --init "update the send flow copy, fix the empty state on history, add badge component to home screen"</command>
<description>Initialize a tracker from a narrative — the agent organizes the changes into waves for approval before writing.</description>
</example>
</examples>
