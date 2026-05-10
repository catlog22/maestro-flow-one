---
name: maestro-tools-register
description: Register tool specs - extract, generate, or optimize
argument-hint: "[description]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Agent
---
<purpose>
Codify reusable business processes as tool specs into `.workflow/specs/tools.md`. Once registered, entries are auto-discovered by downstream agents via `spec load --role` and spec-injector — plan agents pick up design/architecture flows, test agents pick up verification methods, implement agents pick up execution steps.

When to register: during planning to standardize a business process (e.g. payment reconciliation, OAuth integration steps); after execution to capture a validated procedure (e.g. database migration rollback); before testing to register verification methods for test agents (e.g. E2E checkout flow, API idempotency verification); during retrospective/harvest to extract reusable process knowledge from artifacts.

Three modes: Extract (from code/docs), Generate (from description), Optimize (improve existing).
Short processes (<10 steps) inline; long processes (>=10 steps) use ref mode with knowhow detail doc.
</purpose>

<required_reading>
@~/.maestro/workflows/tools-spec.md
</required_reading>

<context>
$ARGUMENTS — Intent description

**Examples**:
```
/maestro-tools-register extract OAuth PKCE token exchange flow from src/auth/
/maestro-tools-register generate Stripe webhook idempotency verification --roles implement,test
/maestro-tools-register generate E2E checkout flow with payment gateway mock setup --roles test
/maestro-tools-register optimize e2e-checkout tool
```
</context>

<execution>

### Step 1: Intent Detection

Parse $ARGUMENTS to determine mode:
- Contains "extract" → extract mode
- Contains "optimize/improve" → optimize mode
- Other → generate mode
- Empty → ask user with AskUserQuestion

### Step 2: Gather Information

**Extract mode**:
- Identify source (current conversation, specified files, codebase scan)
- Extract step sequence, prerequisites, expected outputs

**Generate mode**:
- Confirm tool name, applicable roles, target scenario
- If unclear, ask user with AskUserQuestion

**Optimize mode**:
- Load existing tool: `maestro spec load --role implement --keyword <name>`
- Analyze improvement points (step splitting, prerequisites, error handling)

**For all modes** — identify the usage timing: when should an agent or user invoke this tool? This becomes the first line of the entry description (see Step 5).

### Step 3: Determine Roles

Infer applicable roles from context, or ask user:
- implement — execution tools (build, deploy, integrate)
- test — testing tools (test flows, verification steps)
- review — review tools (checklists, audit standards)
- plan — planning tools (design flows, analysis steps)
- analyze — analysis tools (diagnostic flows, investigation steps)

### Step 4: Decide Inline vs Ref

- Steps <10 and no code blocks → **inline mode**
- Steps >=10 or contains code examples/config → **ref mode**

### Step 5: Write

**Description format**: First line after `### Title` must state **when to use** this tool (the usage timing from Step 2). This is critical for ref entries — `spec load` only shows the first 200 chars after the heading as the summary.

```
### {Title}

Use when {timing/trigger condition}.

1. Step one ...
```

**Inline mode**:
```bash
maestro spec add tools "<title>" "Use when <timing>.\n\n1. <step1>\n2. <step2>" --roles "<csv>" --keywords "<csv>"
```

**Ref mode**:
1. Generate knowhow detail document (RCP- or DOC- prefix). YAML frontmatter must include `summary` with usage timing — this is what `wiki list` and wiki-role-loader show to agents:
```yaml
---
title: <Title>
type: recipe
summary: "Use when <timing>. <scope description>"
tags: [<keywords>]
roles: [<roles>]
---
```
2. Register spec index entry — description must also include usage timing within 200 chars (this is what `spec load` shows):
```bash
maestro spec add tools "<title>" "Use when <timing>. <scope summary>" --roles "<csv>" --keywords "<csv>" \
  --ref "knowhow/RCP-<slug>.md" --knowhow-type recipe
```

### Step 6: Verify

- `maestro spec load --role <role> --keyword <keyword>` to confirm loadable
- Display result: title, roles, keywords, storage location

</execution>

<error_codes>
| Code | Severity | Description |
|------|----------|-------------|
| E001 | fatal | `.workflow/specs/` does not exist — run `maestro spec init` |
| E002 | warning | Duplicate tool name detected — confirm overwrite/optimize |
| E003 | fatal | roles parameter empty — tools must declare applicable roles |
</error_codes>

<success_criteria>
- [ ] Tool definition written to tools.md (or ref to knowhow)
- [ ] roles attribute correctly set
- [ ] keywords auto-extracted (3-5 terms)
- [ ] Description starts with "Use when ..." (usage timing)
- [ ] Loadable via `spec load --role <role>`
- [ ] Long processes use ref mode with knowhow file created
- [ ] Ref knowhow YAML includes `summary` with usage timing
</success_criteria>
