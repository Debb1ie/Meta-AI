---
name: nmblr:install
description: |
  Install nmblr agent-kit into the current project.
  Downloads agents, skills, templates, guides, patterns, hooks, and scripts.
  Creates an install manifest for future upgrades.
  Checks and installs required dependencies (gh, yq, jq) if missing.
  Use when setting up nmblr in a new project or reinstalling.
user-invocable: true
argument-hint: "[--version <tag>] [--force] [--profile <product|infrastructure|library|tooling>]"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
---

<skill_info>
<name>nmblr:install</name>
<summary>Install nmblr agent-kit into the current project's .claude/ directory. Handles dependency installation, downloads the kit, and creates an install manifest.</summary>
<config_file>.claude/nmblr/config.yaml</config_file>
<install_script>.claude/nmblr/scripts/kit-install.sh</install_script>
</skill_info>

<usage>
<syntax>nmblr:install</syntax>
<syntax>nmblr:install --version v2.0.0</syntax>
<syntax>nmblr:install --force</syntax>
<syntax>nmblr:install --version main --force</syntax>
<syntax>nmblr:install --profile infrastructure</syntax>
<syntax>nmblr:install --profile library --version v2.4.0</syntax>
</usage>

<options>
<option name="--version &lt;tag&gt;">Pin installation to a specific git tag or branch (e.g., v2.0.0, main). Defaults to latest tag.</option>
<option name="--force">Reinstall even if nmblr is already installed. Overwrites existing files.</option>
<option name="--profile" value_type="PROFILE">Installation profile: product (default, all components), infrastructure (excludes UX/PRD agents), library (minimal set), tooling (internal tools). Determines which agents and skills are installed. Saved to config.yaml for upgrades.</option>
</options>

<execution_instructions>
When this skill is invoked, the entire installation is handled by a single bash command block.
Your ONLY job is to: (1) check dependencies, (2) run the install command, (3) report the result.

IMPORTANT: The recommended way to install is via bootstrap.sh, not this skill directly.
This skill exists as a fallback for environments where bootstrap.sh cannot be used.

## Step 1: Check dependencies

Run this single command to check all dependencies:
```bash
command -v gh && command -v yq && command -v jq && gh auth status 2>&1 | head -3
```

If any tool is missing, tell the user to install it:
- **gh**: macOS `brew install gh` / other: https://cli.github.com
- **yq**: macOS `brew install yq` / Linux: `sudo curl -fsSL https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 -o /usr/local/bin/yq && sudo chmod +x /usr/local/bin/yq`
- **jq**: macOS `brew install jq` / Linux: `sudo apt-get install -y jq`
- If gh is not authenticated, tell the user to run `! gh auth login`.

Do NOT proceed until all dependencies are available.

## Step 2: Run the installer

Run this EXACT command block as a SINGLE bash invocation. Do NOT split it into separate
commands, do NOT modify variable names, and do NOT attempt to do the installation manually.

Substitute {VERSION_FLAG}, {FORCE_FLAG}, and {PROFILE_FLAG} based on the user's arguments:
- If `--version X` was passed: `VERSION="X"`, otherwise omit the VERSION= line (uses auto-detect)
- If `--force` was passed: add `--force` to the kit-install.sh call
- If `--profile X` was passed: add `--profile X` to the kit-install.sh call

```bash
set -e
REPO="talino-labs/nmblr.agent-kit"
{VERSION_FLAG or: VERSION=$(gh api "repos/$REPO/tags" --jq '.[0].name' 2>/dev/null || echo "main")}
[ -z "$VERSION" ] || ! echo "$VERSION" | grep -q '^v' && VERSION="main"
TMPDIR=$(mktemp -d)
gh api "repos/$REPO/tarball/$VERSION" > "$TMPDIR/kit.tar.gz"
mkdir -p "$TMPDIR/extract"
tar xzf "$TMPDIR/kit.tar.gz" -C "$TMPDIR/extract"
EXTRACTED=$(find "$TMPDIR/extract" -maxdepth 1 -type d -name '*nmblr*' | head -1)
[ -z "$EXTRACTED" ] && echo "ERROR: extraction failed" && exit 1
bash "$EXTRACTED/scripts/nmblr/kit-install.sh" --source-dir "$EXTRACTED" --version "$VERSION" {FORCE_FLAG} {PROFILE_FLAG}
rm -rf "$TMPDIR"
```

## Step 3: Validate and report

After the command completes successfully, verify installation:
```bash
echo "Agents: $(find .claude/agents -name '*.md' 2>/dev/null | wc -l | tr -d ' ')" && echo "Skills: $(find .claude/skills -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"
```

If agents < 10 or skills < 10, report an error and suggest the user run bootstrap.sh instead.

Otherwise, display the counts and suggest:
- `/nmblr:help` — See available commands
- `/nmblr:init` — Configure your project
</execution_instructions>

<examples>
<example>
<command>/nmblr:install</command>
<description>Install the latest version of nmblr agent-kit</description>
</example>
<example>
<command>/nmblr:install --version v2.1.0</command>
<description>Install a specific version</description>
</example>
<example>
<command>/nmblr:install --force</command>
<description>Reinstall, overwriting existing files</description>
</example>
</examples>
