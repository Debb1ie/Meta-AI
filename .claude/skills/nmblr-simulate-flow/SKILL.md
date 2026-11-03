---
name: nmblr:simulate-flow
description: |
  Simulate a user flow through the app to find UX pitfalls.
  Walks through PRD and UX specs screen by screen as a specific persona,
  flagging dead ends, missing states, unclear copy, and edge cases.
user-invocable: true
argument-hint: "<flow-description> [--persona <id>] [--mode <mode>]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
---

<skill_info>
<name>nmblr:simulate-flow</name>
<summary>Simulate a user flow through the app to find UX pitfalls. Walks through PRD and UX specs screen by screen as a specific persona, flagging dead ends, missing states, unclear copy, and edge cases.</summary>
<agent>flow-simulator</agent>
</skill_info>

<usage>
<syntax>nmblr:simulate-flow "&lt;flow-description&gt;"</syntax>
<syntax>nmblr:simulate-flow "&lt;flow-description&gt;" --persona &lt;id&gt;</syntax>
<syntax>nmblr:simulate-flow "&lt;flow-description&gt;" --mode &lt;mode&gt;</syntax>
<syntax>nmblr:simulate-flow "&lt;flow-description&gt;" --persona &lt;id&gt; --mode &lt;mode&gt; --from &lt;screen&gt;</syntax>
<syntax>nmblr:simulate-flow "&lt;flow-description&gt;" --mode comprehensive --detail all</syntax>
</usage>

<arguments>
<argument name="flow-description" required="true">
<description>Natural language description of the flow to simulate (e.g., "user signs up and completes onboarding", "checkout flow from cart to confirmation").</description>
</argument>
</arguments>

<options>
<option name="--persona">
Persona ID to simulate as. Default: new-user.
Common values: new-user, returning-user, power-user, admin, guest, mobile-user.
Can be any custom persona ID defined in the project's UX documents.
</option>
<option name="--mode">
Simulation mode. Default: happy-path.
Options:
  - happy-path       — Walk through the ideal successful flow
  - error-path       — Walk through failure states and error recovery
  - edge-cases       — Probe boundary conditions and unusual inputs
  - first-impression — Focus on onboarding experience and initial clarity
  - comprehensive    — All of the above in sequence
</option>
<option name="--from">Starting screen or state for the simulation (e.g., --from dashboard, --from login-screen). Defaults to the natural entry point of the flow.</option>
<option name="--detail">
Output detail level. Default: issues-only.
Options:
  - issues-only — Report only flagged problems
  - all         — Report every simulated step plus all flagged problems
</option>
</options>

<prerequisites>
- A PRD document covering the flow must exist in the project's product docs directory.
- UX specs, wireframes, or screen-flow documents must exist (Markdown, Figma link references, or equivalent).
- The flow description must be specific enough to identify a discrete user journey.
</prerequisites>

<execution_instructions>
When this skill is invoked:

1. **Parse arguments**
   - Extract flow-description (required)
   - Resolve --persona (default: new-user)
   - Resolve --mode (default: happy-path)
   - Resolve --from if provided
   - Resolve --detail (default: issues-only)

2. **Locate relevant documents**
   - Search for PRD files matching the flow domain
   - Search for UX spec or screen-flow files
   - If neither is found, abort with a clear message listing what was searched

3. **Delegate to flow-simulator agent**
   - Pass flow-description, persona, mode, from-screen, detail level, and discovered file paths
   - The agent walks through the flow step by step against the discovered specs

4. **The flow-simulator agent will**:
   - Map the flow to discrete screens or states from the specs
   - Simulate each step from the given persona's perspective
   - Flag: dead ends, missing loading/empty/error states, unclear copy, inaccessible paths, and edge case gaps
   - Produce a structured findings report

5. **Relay results** with:
   - Output file path (if agent writes a report)
   - Findings totals by category (dead ends, missing states, copy issues, edge cases)
   - Top 3–5 highest-priority issues
   - Suggested follow-up flows to simulate
</execution_instructions>

<examples>
<example>
<command>/nmblr:simulate-flow "user signs up and completes onboarding"</command>
<description>Simulate the happy-path signup and onboarding flow as a new user.</description>
</example>
<example>
<command>/nmblr:simulate-flow "checkout from cart to order confirmation" --persona returning-user</command>
<description>Simulate checkout as a returning user who already has saved payment info.</description>
</example>
<example>
<command>/nmblr:simulate-flow "password reset" --mode error-path</command>
<description>Walk through failure states in the password reset flow (bad email, expired token, etc.).</description>
</example>
<example>
<command>/nmblr:simulate-flow "search and filter results" --mode edge-cases --detail all</command>
<description>Probe edge cases in search (empty query, special characters, zero results) with full step-by-step output.</description>
</example>
<example>
<command>/nmblr:simulate-flow "admin invites a team member" --persona admin --mode comprehensive --from settings-page</command>
<description>Comprehensive simulation of admin team-invite flow starting from the settings page.</description>
</example>
</examples>
