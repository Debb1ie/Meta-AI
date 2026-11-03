---
name: nmblr:research
description: |
  Research domain for documents.
  Use when user needs domain research for PRDs, technical research for RFCs, or general investigation.
user-invocable: true
argument-hint: "\"<topic>\" [--for TYPE] [--technical|--business] [--depth LEVEL]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
  - Task
---

<skill_info>
<name>nmblr:research</name>
<summary>Conduct domain research to support document creation and implementation planning.</summary>
<agent>domain-researcher</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:research "&lt;topic&gt;"</syntax>
<syntax>nmblr:research "&lt;topic&gt;" --for &lt;doc-type&gt;</syntax>
<syntax>nmblr:research "&lt;topic&gt;" --for &lt;doc-type&gt; --doc-id &lt;id&gt;</syntax>
<syntax>nmblr:research "&lt;topic&gt;" --technical</syntax>
<syntax>nmblr:research "&lt;topic&gt;" --business</syntax>
</usage>

<arguments>
<argument name="topic" required="true">
<description>Research topic or question</description>
</argument>
</arguments>

<options>
<option name="--for" value_type="type">Document type this research supports (PRD, RFC, etc.)</option>
<option name="--doc-id" value_type="id">Specific document this research is for</option>
<option name="--technical">Focus on technical implementation research</option>
<option name="--business">Focus on business domain research</option>
<option name="--depth" value_type="level">Research depth (quick, standard, deep)</option>
<option name="--output" value_type="file">Save research to file</option>
</options>

<execution_instructions>
When this skill is invoked:

1. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Get document locations

2. **Delegate to domain-researcher agent**
   - Spawn `domain-researcher` agent with topic and options
   - Pass configuration context

3. **The domain-researcher will**:
   - Determine research type (business vs technical)
   - Search web for relevant information
   - Search existing codebase for similar patterns
   - Analyze related documents if --doc-id specified
   - Generate structured research report
   - Save to file if --output specified
</execution_instructions>

<examples>
<example>
<command>/nmblr:research "payment processing industry standards" --for PRD</command>
<description>Research for a PRD</description>
</example>
<example>
<command>/nmblr:research "webhook delivery patterns" --for RFC --technical</command>
<description>Technical research for an RFC</description>
</example>
<example>
<command>/nmblr:research "KYC compliance requirements" --business</command>
<description>Business domain research</description>
</example>
<example>
<command>/nmblr:research "real-time notification systems" --depth deep --output research.md</command>
<description>Deep research with output file</description>
</example>
</examples>

<research_types>
<business_domain>
<focus_area>Industry standards and regulations</focus_area>
<focus_area>Competitive landscape</focus_area>
<focus_area>User needs and personas</focus_area>
<focus_area>Market trends</focus_area>
<focus_area>Compliance requirements</focus_area>
</business_domain>

<technical>
<focus_area>Implementation approaches</focus_area>
<focus_area>Technology options</focus_area>
<focus_area>Performance considerations</focus_area>
<focus_area>Security best practices</focus_area>
<focus_area>Existing codebase patterns</focus_area>
</technical>
</research_types>

<research_depth_levels>
<quick>5-10 minutes, high-level overview, key findings only</quick>
<standard>15-20 minutes, comprehensive overview, multiple perspectives</standard>
<deep>30+ minutes, exhaustive analysis, proof of concepts</deep>
</research_depth_levels>
