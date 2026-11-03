---
name: nmblr:create
description: |
  Create a new project document from template.
  Routes to specialized writer agents based on document type.
user-invocable: true
argument-hint: "<type> \"<title>\" [--owner NAME] [--related IDs]"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - Task
---

<skill_info>
<name>nmblr:create</name>
<summary>Create a new project document from template.</summary>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:create &lt;type&gt; "&lt;title&gt;"</syntax>
<syntax>nmblr:create &lt;type&gt; "&lt;title&gt;" --owner "&lt;owner&gt;"</syntax>
<syntax>nmblr:create &lt;type&gt; "&lt;title&gt;" --related "&lt;doc-ids&gt;"</syntax>
</usage>

<arguments>
<argument name="type" required="true">
<description>Document type: PRD, PRD-Platform, DS, PD, PPD, PSR, AD, ADR, TD, RFC, TP, TC</description>
</argument>
<argument name="title" required="true">
<description>Document title (use quotes for multi-word titles)</description>
</argument>
</arguments>

<options>
<option name="--owner" value_type="name">Set document owner</option>
<option name="--related" value_type="doc-ids">Comma-separated list of related document IDs</option>
<option name="--author" value_type="name">Set author (defaults to current user)</option>
</options>

<agent_routing>
Routes to specialized writer agents based on document type:

| Type | Agent | Creates |
|------|-------|---------|
| PD | pd-writer | Problem Document |
| PRD | prd-writer | Product Requirement Document |
| PRD-Platform | platform-prd-writer | Platform PRD Main |
| DS | design-system-writer | Design System Foundation |
| RFC | rfc-writer | Request for Comments |
| TD | td-writer | Technical Debt |
| ADR | adr-writer | Architecture Decision Record |
| AD | ad-writer | Architecture Document |
| PPD | ppd-writer | Project Plan Document |
| PSR | psr-writer | Project Status Report |
| TP | tp-writer | Test Plan |
| TC | tc-writer | Test Cases |
| UX | ux-writer | UX Specification |
</agent_routing>

<execution_instructions>
When this skill is invoked:

1. **Parse arguments**
   - Extract document type and title
   - Extract optional owner and related document IDs
   - If `--author` not provided, resolve default: run `git config user.name` to get the current git user. Pass the resolved author to the writer agent.

2. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Get document locations from config

3. **Route to appropriate writer agent**
   - Look up writer agent from routing table
   - Spawn agent with title and options

4. **Writer agent process**
   - Gathers context through interactive questions
   - Reviews related documents
   - Researches codebase (for technical documents)
   - Scans target directory to determine next ID
   - Populates template with gathered information
   - Creates file with naming convention
</execution_instructions>

<config_usage>
The skill reads config.yaml for document locations:

```yaml
documents:
  rfcs: docs/engineering/RFCs
  pds: docs/project/PDs
  adrs: docs/architecture/ADRs
  prds: docs/product/PRDs
  ads: docs/architecture/ADs
  tds: docs/engineering/TDs
  ppds: docs/project/PPDs
  psrs: docs/project/PSRs
  tps: docs/qa/TPs
  tcs: docs/qa/TCs
```
</config_usage>

<supported_types>
<type code="PRD" location="docs/product/PRDs/" agent="prd-writer">
Product vision, features, stories, data models, APIs
</type>
<type code="PRD-Platform" location="docs/product/PRDs/" agent="platform-prd-writer">
Platform vision, all products, user roles, dependencies
</type>
<type code="DS" location="docs/design/" agent="design-system-writer">
Brand colors, typography, component library, design tokens
</type>
<type code="PD" location="docs/project/PDs/" agent="pd-writer">
Problem details, impact, personas, root cause
</type>
<type code="RFC" location="docs/engineering/RFCs/" agent="rfc-writer">
Related docs, codebase patterns, implementation approach
</type>
<type code="TD" location="docs/engineering/TDs/" agent="td-writer">
Code analysis, impact assessment, resolution approach
</type>
<type code="ADR" location="docs/architecture/ADRs/" agent="adr-writer">
Decision context, options, consequences
</type>
<type code="AD" location="docs/architecture/ADs/" agent="ad-writer">
Architecture overview, components, patterns
</type>
<type code="PPD" location="docs/project/PPDs/" agent="ppd-writer">
Project goals, phases, resources, timeline
</type>
<type code="PSR" location="docs/project/PSRs/" agent="psr-writer">
Progress, completed items, blockers
</type>
<type code="TP" location="docs/qa/TPs/" agent="tp-writer">
Test strategy, scope, test case outline
</type>
<type code="TC" location="docs/qa/TCs/" agent="tc-writer">
Test steps, expected results, automation
</type>
<type code="UX" location="docs/ux/" agent="ux-writer">
Screen layouts, navigation flows, copy content. Requires --related PRD-NNNN.
</type>
</supported_types>

<examples>
<example>
<command>/nmblr:create RFC "Add Customer Notification System"</command>
<description>Create a new RFC</description>
</example>
<example>
<command>/nmblr:create PRD "Payment Processing" --owner "Jane Doe"</command>
<description>Create a PRD with owner</description>
</example>
<example>
<command>/nmblr:create PD "Slow API Responses" --related "PRD-0001"</command>
<description>Create a PD related to a PRD</description>
</example>
<example>
<command>/nmblr:create ADR "Use PostgreSQL for Primary Database"</command>
<description>Create an ADR</description>
</example>
<example>
<command>/nmblr:create TD "Legacy Authentication Code"</command>
<description>Create a Technical Debt document</description>
</example>
</examples>

<naming_convention>
Files are created with naming: `{NNNN}-{kebab-case-title}.md`

Example: `/nmblr:create RFC "Add Caching Layer"`
Creates: `docs/engineering/RFCs/0024-add-caching-layer.md`
</naming_convention>
