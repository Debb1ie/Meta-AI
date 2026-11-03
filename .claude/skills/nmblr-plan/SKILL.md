---
name: nmblr:plan
description: |
  Create an implementation plan for an approved RFC.
  Analyzes the RFC, researches the codebase, and creates a context file with task breakdown.
user-invocable: true
argument-hint: "<RFC-ID> [--preview] [--force]"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - Task
---

<skill_info>
<name>nmblr:plan</name>
<summary>Create an implementation plan for an approved RFC.</summary>
<agent>rfc-planner</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:plan &lt;rfc-id&gt;</syntax>
<syntax>nmblr:plan &lt;rfc-id&gt; --preview</syntax>
<syntax>nmblr:plan &lt;rfc-id&gt; --force</syntax>
</usage>

<arguments>
<argument name="rfc-id" required="true">
<description>RFC ID to plan (e.g., RFC-0015)</description>
</argument>
</arguments>

<options>
<option name="--preview">Preview plan without creating context file</option>
<option name="--force">Plan even if RFC is not yet approved (for early planning)</option>
<option name="--detailed">Include more detailed task breakdown</option>
</options>

<execution_instructions>
When this skill is invoked:

1. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Determine project language and patterns
   - Get document locations

2. **Delegate to rfc-planner agent**
   - Spawn `rfc-planner` agent with RFC ID and options
   - Pass configuration context including:
     - Language-specific guide paths
     - Pattern file paths
     - Document locations

3. **The rfc-planner will**:
   - Validate RFC exists and status
   - Analyze RFC requirements
   - Research codebase for related patterns
   - Create implementation phases with task breakdown
   - Annotate tasks with layer types (component/infrastructure/entrypoint/wiring)
   - Perform wave analysis for parallel execution
   - Generate context file with phase manifests
</execution_instructions>

<config_usage>
The planner reads config.yaml to:

```yaml
project:
  language: go              # Affects code pattern research

patterns:
  architecture: hexagonal   # Guides task structure

guides:
  patterns_path: patterns   # Abstract patterns for task annotation
  languages:
    go: guides/go           # Language-specific patterns

documents:
  rfcs: docs/engineering/RFCs  # Where to find RFC files
```
</config_usage>

<process>
<step number="1" name="Validate RFC">
- Check RFC exists in configured location
- Verify status is Approved (unless --force)
- Check for existing plan
</step>

<step number="2" name="Analyze RFC">
- Parse requirements and constraints
- Identify implementation phases
- Extract acceptance criteria
</step>

<step number="3" name="Research Codebase">
- Find related code patterns
- Identify files to modify
- Locate reusable components
- Reference language guides for patterns
</step>

<step number="4" name="Create Context File">
- Generate `.claude/nmblr/execution/RFC-{NNNN}-context.md`
- Include task breakdown with layer annotations
- Document dependencies
</step>

<step number="5" name="Wave Analysis">
- Analyze task dependencies within each phase
- Detect file conflicts between tasks
- Assign wave numbers for parallel execution
- Create phase manifests for subagent execution
</step>
</process>

<task_layer_annotations>
Each task in the context file includes a layer annotation for the phase-executor:

```markdown
**Task 1.1:**
- Description: Create transfer service interface
- File: internal/component/transfer/interface.go
- Layer: component
- Pattern reference: internal/component/wallet/interface.go
```

Valid layers:
- **component**: Business logic, service interfaces, domain models
- **infrastructure**: Repositories, external clients, database
- **entrypoint**: HTTP handlers, routes, validation
- **wiring**: Dependency injection, wire.go updates
</task_layer_annotations>

<examples>
<example>
<command>/nmblr:plan RFC-0015</command>
<description>Plan an approved RFC</description>
</example>
<example>
<command>/nmblr:plan RFC-0015 --preview</command>
<description>Preview planning without saving</description>
</example>
<example>
<command>/nmblr:plan RFC-0015 --force</command>
<description>Plan a draft RFC for early estimation</description>
</example>
</examples>

<output>
Creates:
- `.claude/nmblr/execution/RFC-{NNNN}-context.md` - Implementation context with tasks
- Wave analysis summary
- Phase manifests for parallel execution

Next step: Run `/nmblr:execute RFC-{NNNN}` to start implementation
</output>

<output_example>
# Planning Complete: RFC-0015

## Summary
- **RFC:** RFC-0015 - Wallet Infrastructure
- **Status:** Planned
- **Phases:** 3
- **Estimated Tasks:** 12

## Context File Created
`.claude/nmblr/execution/RFC-0015-context.md`

## Key Findings

### Relevant Patterns Found
- Similar: `internal/infrastructure/postgres/customer.go`
- Testing: `internal/infrastructure/postgres/customer_test.go`

### Files to Modify/Create
- `internal/infrastructure/postgres/wallet.go` (new)
- `internal/component/wallet/service.go` (new)
- `internal/entrypoint/api/handler/wallet.go` (new)
- `docs/openapi.yaml` (modify)

### Migrations Needed
- `{timestamp}_v0.1.0_create_wallets.sql`

## Task Breakdown

### Phase 1: Infrastructure (4 tasks)
- Database migration
- Repository implementation
- Repository tests

### Phase 2: Business Logic (4 tasks)
- Service implementation
- Service tests
- Error handling

### Phase 3: API Layer (4 tasks)
- Handler implementation
- Handler tests
- OpenAPI updates

## Wave Analysis Summary

| Phase | Total Tasks | Waves | Parallelizable |
|-------|-------------|-------|----------------|
| 1 - Infrastructure | 4 | 2 | 3 tasks in Wave 1 |
| 2 - Business Logic | 4 | 2 | 2 tasks in Wave 1 |
| 3 - API Layer | 4 | 2 | 3 tasks in Wave 1 |

**Total Parallelization:** 8 of 12 tasks can run in parallel waves

## Dependencies
- None blocking

## Risks
- External API integration complexity (medium)

## Next Steps
Run `/nmblr:execute RFC-0015` to start implementation
</output_example>

<context_file_structure>
The context file created by planning contains these sections:
- RFC summary
- Related documents
- Codebase analysis results
- Implementation tasks by phase (with wave annotations)
- Phase manifests for subagent execution
- Wave analysis summary
- Dependencies and risks
- Integration points
</context_file_structure>
