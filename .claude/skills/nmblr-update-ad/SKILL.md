---
name: nmblr:update-ad
description: |
  Update Architecture Documents to reflect codebase changes.
  Use when user wants to keep ADs in sync with code, scan for affected ADs, or add RFC references.
user-invocable: true
argument-hint: "<AD-ID> [--scan] [--rfc RFC-ID] [--dry-run]"
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
<name>nmblr:update-ad</name>
<summary>Update Architecture Documents (ADs) to keep them in sync with codebase changes. Can update specific ADs or scan for affected documents.</summary>
<agent>architecture-manager</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:update-ad &lt;ad-id&gt;</syntax>
<syntax>nmblr:update-ad --scan</syntax>
<syntax>nmblr:update-ad --scan --rfc RFC-XXXX</syntax>
<syntax>nmblr:update-ad &lt;ad-id&gt; --add-rfc RFC-XXXX</syntax>
</usage>

<arguments>
<argument name="ad-id" required="false">
<description>AD ID to update (e.g., AD-0003). Required unless using --scan</description>
</argument>
</arguments>

<options>
<option name="--scan">Scan codebase to find ADs that may need updates</option>
<option name="--rfc" value_type="RFC-ID">Specify an RFC to use as context for updates</option>
<option name="--add-rfc" value_type="RFC-ID">Add specific RFC to the AD's related_rfcs</option>
<option name="--add-prd" value_type="PRD-ID">Add specific PRD to the AD's related_docs</option>
<option name="--dry-run">Show what would be updated without making changes</option>
</options>

<execution_instructions>
When this skill is invoked:

1. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Get document locations

2. **Delegate to architecture-manager agent**
   - Spawn `architecture-manager` agent with AD ID or scan mode
   - Pass options and configuration

3. **The architecture-manager will**:
   - For specific AD: Load AD, analyze context from RFC, update metadata and content
   - For scan: Analyze RFC scope, map affected components to ADs, assess impact
   - Update frontmatter (related_rfcs, components, version, changelog)
   - Flag content sections needing manual review
   - Generate report of changes made and recommendations
</execution_instructions>

<examples>
<example>
<command>/nmblr:update-ad AD-0003</command>
<description>Review and update AD-0003 based on current codebase state</description>
</example>
<example>
<command>/nmblr:update-ad --scan</command>
<description>Scan for all ADs that may need updates</description>
</example>
<example>
<command>/nmblr:update-ad --scan --rfc RFC-0001</command>
<description>Find ADs affected by RFC-0001 implementation</description>
</example>
<example>
<command>/nmblr:update-ad AD-0001 --add-rfc RFC-0005</command>
<description>Add RFC-0005 to AD-0001's related documents</description>
</example>
<example>
<command>/nmblr:update-ad AD-0003 --dry-run</command>
<description>Show what updates would be made to AD-0003</description>
</example>
</examples>

<component_mapping>
Standard component-to-AD mappings for this project:

| Component | Primary AD |
|-----------|------------|
| entrypoint/api/* | AD-0001 |
| component/ledger | AD-0003 |
| component/wallet | AD-0001 (or dedicated AD if created) |
| component/tenant | AD-0001 |
| infrastructure/postgres | AD-0001, AD-0002 |
| infrastructure/bridge | AD-0001 |

Update this mapping as new ADs are created.
</component_mapping>
