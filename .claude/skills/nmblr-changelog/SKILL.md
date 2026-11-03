---
name: nmblr:changelog
description: |
  Maintain a Keep a Changelog CHANGELOG.md: initialize/migrate it, add entries
  to [Unreleased], or promote [Unreleased] into a dated release section.
  Use to bootstrap a changelog, record a change by hand or from an RFC, or cut a release.
user-invocable: true
argument-hint: "init | add | release [options]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

<skill_info>
<name>nmblr:changelog</name>
<summary>Maintain a Keep a Changelog CHANGELOG.md through three modes — init (create/migrate a conformant file), add (append/update an [Unreleased] entry, explicitly or drafted from an RFC), and release (promote [Unreleased] into a dated version section). All file mutation is done by deterministic scripts under .claude/nmblr/scripts/docs/; there is no agent.</summary>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:changelog init [--migrate] [--force] [--path CHANGELOG.md]</syntax>
<syntax>nmblr:changelog add --category CAT --message "MSG" [--ref RFC-NNNN] [--path CHANGELOG.md]</syntax>
<syntax>nmblr:changelog add --from RFC-NNNN [--path CHANGELOG.md]</syntax>
<syntax>nmblr:changelog release --version X.Y.Z [--date YYYY-MM-DD] [--previous-tag T] [--allow-empty] [--path CHANGELOG.md]</syntax>
</usage>

<arguments>
<argument name="mode" required="true">
<description>One of: init, add, release.</description>
</argument>
</arguments>

<options>
<option name="--path">Path to the changelog file (default: changelog.path config, else CHANGELOG.md)</option>
<option name="--migrate">(init) Non-destructively add a [Unreleased] heading + link list to an existing changelog</option>
<option name="--force">(init) Overwrite the existing changelog with a fresh conformant file</option>
<option name="--category">(add) Keep a Changelog category: Added | Changed | Deprecated | Removed | Fixed | Security</option>
<option name="--message">(add) Single-line entry text</option>
<option name="--ref">(add) Doc reference (e.g., RFC-0015) stored as a dedup marker</option>
<option name="--from">(add) RFC ID — read it inline, draft a category+message, confirm, then write</option>
<option name="--version">(release) The version being cut (X.Y.Z, no leading v)</option>
<option name="--date">(release) Release date (default: today, local)</option>
<option name="--previous-tag">(release) Previous git tag for the compare link (default: latest tag, else first commit)</option>
<option name="--allow-empty">(release) Allow promoting an empty [Unreleased]</option>
</options>

<scripts>
The skill drives four deterministic scripts (JSON stdout, stderr logs, exit 0/1):

| Script | Purpose |
|--------|---------|
| `.claude/nmblr/scripts/docs/changelog-init.sh` | Create/migrate a conformant CHANGELOG.md (link list incl. `[Unreleased]`) |
| `.claude/nmblr/scripts/docs/changelog-add-entry.sh` | Append/update an `[Unreleased]` entry (marker-keyed idempotency, single-line/injection-safe, fail-closed) |
| `.claude/nmblr/scripts/docs/changelog-release.sh` | Promote `[Unreleased]` → dated section; refresh both links; fail-closed |
| `.claude/nmblr/scripts/docs/changelog-parse.sh` | Parse CHANGELOG.md → JSON; `--extract-version` returns raw Markdown |

Never hand-edit the file for structural changes — always call the scripts so the
format stays conformant. Config reads must tolerate a missing config.yaml:
`bash .claude/nmblr/scripts/util/read-config.sh changelog.path 2>/dev/null | jq -r .value` and default to `CHANGELOG.md`.
</scripts>

<execution_instructions>
When this skill is invoked, dispatch on the first argument (the mode).

## Resolve the path (all modes)

1. If `--path` was given, use it.
2. Else read `changelog.path` from config, tolerating a missing file:
   ```bash
   bash .claude/nmblr/scripts/util/read-config.sh changelog.path 2>/dev/null | jq -r '.value' 2>/dev/null
   ```
   If that yields nothing/`null`, default to `CHANGELOG.md`.

## Mode: init

### Step 1: Run the script
```bash
bash .claude/nmblr/scripts/docs/changelog-init.sh --path {PATH} [--migrate] [--force]
```

### Step 2: Interpret the JSON status
- `created` — report that a conformant CHANGELOG.md was created (show the `[Unreleased]` link).
- `noop` — already conformant; nothing to do.
- `overwritten` — created fresh via `--force`.
- `migrated` — report which anchors were added (`added` array); existing content untouched.
- `gaps` — the file exists but is not conformant. **Do not overwrite.** Show the `gaps` array and offer the choice: re-run with `--migrate` (non-destructive) or `--force` (overwrite). If interactive, confirm via AskUserQuestion before re-running.

## Mode: add

### Path A — explicit (`--category` + `--message` given)

Call the script directly (it does all validation and idempotency):
```bash
bash .claude/nmblr/scripts/docs/changelog-add-entry.sh \
  --path {PATH} --category {CAT} --message "{MSG}" [--ref {REF}]
```
Report the `action` (`appended` or `updated`). If it exits 1 because there is no
`[Unreleased]` section, tell the user to run `nmblr:changelog init` (or `init --migrate`).

### Path B — derived from an RFC (`--from RFC-NNNN`)

1. **Locate the RFC** with `find-document.sh`:
   ```bash
   bash .claude/nmblr/scripts/docs/find-document.sh {RFC-NNNN}
   ```
2. **Read the RFC inline** (Read tool). From its Summary/Proposal and its source-doc
   type, draft:
   - a **category** — map the RFC's source-doc type via `changelog.source_doc_category`
     (default: `{PRD: Added, PD: Fixed, TD: Changed, ADR: Changed}`); if none applies,
     use `changelog.default_category` (default `Changed`).
   - a **one-line message** — a crisp, user-facing summary of what shipped (not a commit log).
3. **Confirm via AskUserQuestion** (main-thread skills can prompt): present the drafted
   category + message and let the user accept or adjust. Offer the six categories as options.
4. **Write it** with the RFC id as the marker (idempotent — re-running updates the same entry):
   ```bash
   bash .claude/nmblr/scripts/docs/changelog-add-entry.sh \
     --path {PATH} --category {CAT} --message "{MSG}" --ref {RFC-NNNN}
   ```
5. Report the entry and the `action` taken.

## Mode: release

### Step 1: Pre-flight parse (surface fail-closed conditions early)
```bash
bash .claude/nmblr/scripts/docs/changelog-parse.sh --path {PATH}
```
If `has_unreleased` is false, tell the user to run `init --migrate` and stop.

### Step 2: Run the release
```bash
bash .claude/nmblr/scripts/docs/changelog-release.sh \
  --path {PATH} --version {X.Y.Z} [--date {DATE}] [--previous-tag {TAG}] [--allow-empty]
```

### Step 3: Interpret
- Success (`released`) — report the new version, date, and both refreshed links.
- Exit 1 — relay the specific reason (empty `[Unreleased]`, version already released,
  missing heading/anchor) and the suggested fix (`--allow-empty`, or `init --migrate`).

**Note:** `release` does NOT create a git tag, bump `manifest.json`/`package.json`, or
publish. The human supplies the version; tagging/publishing stay in the existing release flow.

## Do NOT

- Spawn an agent — this skill runs inline on the main thread.
- Hand-edit the file to add/rename structure — always call the scripts.
- Hard-fail if `config.yaml` is absent — every config read defaults gracefully.
</execution_instructions>

<config_reference>
An optional `changelog:` block in `.claude/nmblr/config.yaml`. All keys are optional
and default as shown; the skill and hooks work with zero configuration.

```yaml
changelog:
  path: "CHANGELOG.md"
  compare_url_template: "https://github.com/{owner}/{repo}/compare/{previous_tag}...{tag}"
  default_category: "Changed"
  source_doc_category:
    PRD: Added
    PD: Fixed
    TD: Changed
    ADR: Changed
```

| Key | Default | Purpose |
|-----|---------|---------|
| `changelog.path` | `CHANGELOG.md` | Repo-relative changelog file; its `[Unreleased]` presence is the opt-in signal |
| `changelog.compare_url_template` | `https://github.com/{owner}/{repo}/compare/{previous_tag}...{tag}` | Reference-link template (`{tag}` may be `HEAD`) |
| `changelog.default_category` | `Changed` | Best-effort category when finalize can't confidently pick one |
| `changelog.source_doc_category` | `{PRD: Added, PD: Fixed, TD: Changed, ADR: Changed}` | Category hint for finalize / `add --from` |

There is no `enabled` flag — opt-in is purely the presence of a `CHANGELOG.md` with an `[Unreleased]` section.
</config_reference>

<examples>
<example>
<command>/nmblr:changelog init</command>
<description>Create a conformant CHANGELOG.md (header, [Unreleased], link list incl. the [Unreleased] compare link)</description>
</example>
<example>
<command>/nmblr:changelog init --migrate</command>
<description>Non-destructively bring an existing hand-maintained changelog up to Keep a Changelog conformance</description>
</example>
<example>
<command>/nmblr:changelog add --category Added --message "Changelog maintenance capability" --ref RFC-0015</command>
<description>Append (or idempotently update) a marked entry under [Unreleased]/Added</description>
</example>
<example>
<command>/nmblr:changelog add --from RFC-0015</command>
<description>Read RFC-0015, draft a category+message, confirm, then write the entry keyed by the RFC marker</description>
</example>
<example>
<command>/nmblr:changelog release --version 3.4.0</command>
<description>Promote [Unreleased] into ## [3.4.0] - today, reset [Unreleased], and refresh both compare links</description>
</example>
</examples>
