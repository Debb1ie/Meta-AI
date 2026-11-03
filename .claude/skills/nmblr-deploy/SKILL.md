---
name: nmblr:deploy
description: |
  Deploy and manage releases.
  Use when user wants to check deployment readiness, create releases, or manage versions.
user-invocable: true
argument-hint: "[version] [--check] [--patch|--minor|--major] [--dry-run]"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - Task
---

<skill_info>
<name>nmblr:deploy</name>
<summary>Manage deployment and release workflow with version tagging.</summary>
<agent>deployment-manager</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:deploy --check</syntax>
<syntax>nmblr:deploy</syntax>
<syntax>nmblr:deploy &lt;version&gt;</syntax>
<syntax>nmblr:deploy --patch</syntax>
<syntax>nmblr:deploy --minor</syntax>
<syntax>nmblr:deploy --major</syntax>
</usage>

<arguments>
<argument name="version" required="false">
<description>Specific version to deploy (e.g., v1.2.0)</description>
</argument>
</arguments>

<options>
<option name="--check">Check readiness without deploying</option>
<option name="--patch">Increment patch version (X.Y.Z+1)</option>
<option name="--minor">Increment minor version (X.Y+1.0)</option>
<option name="--major">Increment major version (X+1.0.0)</option>
<option name="--dry-run">Show what would happen without creating tag</option>
<option name="--force">Skip readiness checks (dangerous)</option>
</options>

<execution_instructions>
When this skill is invoked:

1. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Get GitHub settings and document locations

2. **Delegate to deployment-manager agent**
   - Spawn `deployment-manager` agent with version/options
   - Pass configuration context

3. **The deployment-manager will**:
   - Check deployment readiness (RFC status, tests, docs)
   - Determine version based on changes since last tag
   - Run final quality checks (test, lint, build)
   - Generate release notes
   - Create annotated git tag and push
   - Create GitHub release
   - Update RFC statuses to "Deployed"
</execution_instructions>

<examples>
<example>
<command>/nmblr:deploy --check</command>
<description>Check if ready to deploy</description>
</example>
<example>
<command>/nmblr:deploy</command>
<description>Deploy with auto-suggested version</description>
</example>
<example>
<command>/nmblr:deploy v1.2.0</command>
<description>Deploy specific version</description>
</example>
<example>
<command>/nmblr:deploy --patch</command>
<description>Auto-increment patch version</description>
</example>
<example>
<command>/nmblr:deploy --minor --dry-run</command>
<description>Dry run of minor version bump</description>
</example>
</examples>

<version_determination>
<semver_rules>
| Change Type | Bump | Example |
|-------------|------|---------|
| Breaking API changes | MAJOR | 1.0.0 → 2.0.0 |
| New features | MINOR | 1.0.0 → 1.1.0 |
| Bug fixes only | PATCH | 1.0.0 → 1.0.1 |
</semver_rules>
</version_determination>

<safety_features>
<feature>Requires confirmation before creating tag</feature>
<feature>Cannot deploy if tests failing</feature>
<feature>Cannot deploy with open critical issues</feature>
<feature>Cannot force-push or delete tags</feature>
</safety_features>
