---
name: nmblr:upgrade
description: |
  Upgrade nmblr agent-kit to a newer version.
  Detects local customizations and prompts before overwriting.
  Handles legacy installations (no manifest) gracefully.
  Use when a new version of nmblr is available.
user-invocable: true
argument-hint: "[--version <tag>] [--force]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
---

<skill_info>
<name>nmblr:upgrade</name>
<summary>Upgrade nmblr agent-kit with per-file conflict resolution and local customization detection. Uses a deterministic diff script and interactive conflict prompts.</summary>
<config_file>.claude/nmblr/install-manifest.json</config_file>
<upgrade_script>.claude/nmblr/scripts/kit-upgrade.sh</upgrade_script>
</skill_info>

<usage>
<syntax>nmblr:upgrade</syntax>
<syntax>nmblr:upgrade --version &lt;tag&gt;</syntax>
<syntax>nmblr:upgrade --force</syntax>
</usage>

<options>
<option name="--version &lt;tag&gt;">Upgrade to a specific version tag (e.g., v2.3.0). Defaults to latest.</option>
<option name="--force">Skip all conflict prompts and use the upstream version for every conflicting file.</option>
</options>

<execution_instructions>
When this skill is invoked, follow these steps. The file diffing is done by a deterministic bash script — your role is to orchestrate, handle interactive conflict resolution, and report results.

## Step 1: Check current state

Read `.claude/nmblr/install-manifest.json`:
- If exists: extract `version` as current version.
- If not exists but `.claude/agents/` has .md files: legacy install, warn user.
- If neither: nmblr not installed, suggest `/nmblr:install` and stop.

## Step 2: Resolve target version

If `--version` was specified, use that value.

Otherwise, fetch the latest tag:
```bash
gh api repos/talino-labs/nmblr.agent-kit/tags --jq '.[0].name' 2>/dev/null
```

If target version == current version and not legacy, report "Already on {version}. Nothing to upgrade." and stop.

## Step 3: Download and extract

```bash
TMPDIR=$(mktemp -d)
gh api repos/talino-labs/nmblr.agent-kit/tarball/{version} > "$TMPDIR/nmblr-upgrade.tar.gz"
mkdir -p "$TMPDIR/extract"
tar xzf "$TMPDIR/nmblr-upgrade.tar.gz" -C "$TMPDIR/extract"
EXTRACTED=$(find "$TMPDIR/extract" -maxdepth 1 -type d -name '*nmblr*' | head -1)
```

## Step 4: Run the diff script

The extracted kit contains the upgrade script. Run it in diff mode:

```bash
bash "$EXTRACTED/scripts/nmblr/kit-upgrade.sh" \
  --source-dir "$EXTRACTED" \
  --version {target_version} 2>/dev/null
```

Capture the JSON output. It contains categorized file lists:
- `new` — files to auto-install
- `updated` — files to auto-update (unchanged locally)
- `unchanged` — files to skip
- `customized` — locally modified, no upstream change (keep local)
- `conflict` — both sides changed (needs user decision)
- `removed_upstream` — exists locally but not in new version

Each file entry includes an `is_core` boolean flag. Core components (execution engine, templates, hooks, scripts) auto-update without prompting. Custom components (patterns, guides, writer agents, specialized skills) present diffs for user review.

## Step 5: Present upgrade summary

Display a clear summary to the user, separating core and custom components:

```
Upgrading nmblr {current_version} → {target_version}

Core components (auto-update):
  {count} files will be updated automatically
  (templates, execution engine, hooks, scripts)

Custom components:
  New files (auto-install): {count}
    + {path}
    ...

  Updated files (auto-update): {count}
    ~ {path}
    ...

  Unchanged files (skip): {count}

  Locally customized, no upstream change (keep yours): {count}
    = {path}
    ...

  Conflicts (need your decision): {count}
    ! {path}
    ...

  Removed upstream (keeping your copy): {count}
    - {path}
    ...
```

Core components with `is_core: true` are always auto-updated regardless of conflict status. Only custom components with conflicts need user decisions.

If there are no custom conflicts (or `--force` is set), ask the user to confirm before proceeding.

## Step 6: Resolve conflicts interactively

Skip if `--force` is set (all conflicts use upstream) or if there are no conflicts.

**Important:** Core components (`is_core: true`) are never presented for conflict resolution — they always use the upstream version. Only prompt for custom component conflicts.

For each conflicting **custom** file:

1. Show a diff preview:
```bash
diff -u {local_path} {source_path} | head -40
```

2. Ask the user:
```
Conflict: {path}
  [k] Keep your local version
  [u] Use upstream version
  [d] Show full diff
```

3. Record each decision.

## Step 7: Build decisions file and apply

Construct a JSON decisions file combining all categories:
- new files → action: "install"
- updated files → action: "update"
- customized files (custom) → action: "keep"
- customized files (core, `is_core: true`) → action: "update" (core always updates)
- conflict files (core, `is_core: true`) → action: "update" (core always updates)
- conflict files (custom) → action based on user decision ("update" or "keep")
- `--force` conflicts → action: "update"

Write the decisions to a temp file, then run:

```bash
bash "$EXTRACTED/scripts/nmblr/kit-upgrade.sh" \
  --source-dir "$EXTRACTED" \
  --version {target_version} \
  --apply "$TMPDIR/decisions.json" 2>/dev/null
```

The script applies changes, regenerates the manifest, and outputs a JSON summary.

## Step 8: Cleanup and report

```bash
rm -rf "$TMPDIR"
```

Display final report:
```
Upgrade complete: nmblr {current_version} → {target_version}

  {X} files updated
  {Y} new files installed
  {Z} files kept local (customized)
  {W} conflicts resolved
```

Then invoke `/nmblr:help`.
</execution_instructions>

<conflict_resolution_reference>
| Scenario | Category | Core Action | Custom Action |
|----------|----------|-------------|---------------|
| File is new in upstream | New | Auto-install | Auto-install |
| File unchanged locally, changed upstream | Updated | Auto-update | Auto-update |
| File unchanged locally, unchanged upstream | Unchanged | Skip | Skip |
| File changed locally, unchanged upstream | Customized | Auto-update | Keep local |
| File changed locally, changed upstream | Conflict | Auto-update | Prompt user (or upstream if --force) |
| File exists locally, removed upstream | Removed upstream | Keep local, warn | Keep local, warn |
</conflict_resolution_reference>

<examples>
<example>
<command>/nmblr:upgrade</command>
<description>Upgrade to latest version with interactive conflict resolution</description>
</example>
<example>
<command>/nmblr:upgrade --version v2.3.0</command>
<description>Upgrade to a specific version</description>
</example>
<example>
<command>/nmblr:upgrade --force</command>
<description>Upgrade to latest, using upstream for all conflicts without prompting</description>
</example>
</examples>
