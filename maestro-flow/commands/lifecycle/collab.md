---
name: maestro-collab
description: Multi-CLI collaborative analysis -- fan-out to multiple CLI tools, cross-verify, synthesize
argument-hint: "\"<requirement>\" [--tools gemini,qwen,claude] [--mode analysis|write] [--rule <template>] [-y]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
---

<purpose>
Multi-CLI collaboration: fan-out the same requirement to multiple CLI tools in parallel, cross-verify outputs for consensus/conflicts, then synthesize into a unified report with standard downstream artifacts (context.md + conclusions.json).

Each CLI tool independently analyzes the requirement. Results are compared and merged via evidence-weighted synthesis.
</purpose>

<context>
$ARGUMENTS — requirement text and optional flags.

```bash
/maestro-collab "analyze the auth module for security vulnerabilities"
/maestro-collab "design a caching strategy" --tools gemini,qwen,claude
/maestro-collab -y "review error handling patterns"
/maestro-collab "refactor user service" --mode write --tools gemini,claude
```

**Flags**:
- `--tools <list>`: Comma-separated CLI tools (default: auto-select first 3 enabled)
- `--mode analysis|write`: Delegate mode (default: analysis)
- `--rule <template>`: Shared rule template for all delegates
- `-y` / `--yes`: Skip plan confirmation

**Output**: `.workflow/scratch/{YYYYMMDD}-collab-{slug}/`
- `collab-report.md` — full collaboration report
- `context.md` — standard Locked/Free/Deferred decisions (plan/analyze compatible)
- `conclusions.json` — structured conclusions (plan fast-track compatible)
- `per-tool/{tool}-output.md` — raw per-tool outputs
</context>

<execution>

### Step 1: Parse Arguments

Extract from `$ARGUMENTS`:
- `requirement` — remaining text after flag removal (error if empty)
- `--tools` → `selectedTools` (comma-split)
- `--mode` → `delegateMode` (default: `analysis`)
- `--rule` → `ruleTemplate`
- `-y` / `--yes` → `autoYes`

### Step 2: Discover Available CLI Tools

```bash
Bash("maestro tools list --json 2>/dev/null || cat ~/.maestro/cli-tools.json")
```

Parse tool entries. Build eligible list:
- `enabled == true`
- If `--mode write`: exclude `type == "api-endpoint"`

Auto-select (when `--tools` omitted): first 3 eligible in config order.
Validate: minimum 2 eligible tools (abort if fewer).

### Step 3: Present Collaboration Plan

**(Skip if `-y`)**

Display plan, then ask user:

```
============================================================
  COLLABORATION PLAN
============================================================
  Requirement: {requirement}
  Mode:        {delegateMode}
  Rule:        {ruleTemplate || "none"}

  Available CLI Tools (from cli-tools.json):
    [✓] gemini    — gemini-3.1-pro-preview     [fullstack, frontend]
    [✓] claude    — claude-sonnet-4-6           [fullstack]
    [✓] codex     — gpt-5.5                    [fullstack, backend]
    [ ] opencode  — (no model)                  [fullstack]

  Selected: gemini, claude, codex (3 tools)

  Pipeline:
    1. Fan-out → parallel delegate to each tool
    2. Cross-verification → consensus/conflict analysis
    3. Synthesis → context.md + conclusions.json
============================================================
```

Use `AskUserQuestion` with options:
- **执行** — proceed with selected tools
- **修改工具选择** — let user specify different tool combination
- **取消** — abort

If **修改工具选择**: ask user which tools to use (show eligible list), validate ≥ 2, re-display plan.

### Step 4: Setup Session

```
slug = requirement kebab-cased, max 40 chars
outputDir = .workflow/scratch/{YYYYMMDD}-collab-{slug}/
```

Create `outputDir` + `outputDir/per-tool/`.

### Step 5: Build Delegate Prompt

Shared prompt for all tools:

```
PURPOSE: {requirement}; success = actionable findings with evidence
TASK: {auto-decomposed into 3-5 specific verbs}
MODE: {delegateMode}
CONTEXT: @**/*
EXPECTED: Structured findings with file:line references, confidence score (0-100), prioritized recommendations. Sections: ## Findings, ## Recommendations, ## Confidence
CONSTRAINTS: {extracted from requirement}
```

### Step 6: Parallel Fan-Out

Launch ALL delegate calls simultaneously using multiple `Bash(run_in_background: true)` in a **single message**:

```
// Launch all in ONE message — do NOT wait between calls
Bash({
  command: `maestro delegate "${prompt}" --to gemini --mode ${mode} ${rule}`,
  run_in_background: true
})
Bash({
  command: `maestro delegate "${prompt}" --to claude --mode ${mode} ${rule}`,
  run_in_background: true
})
Bash({
  command: `maestro delegate "${prompt}" --to codex --mode ${mode} ${rule}`,
  run_in_background: true
})
```

**After launching all calls → STOP immediately. Do not output anything. Wait for background completion callbacks.**

### Step 7: Collect Results

As each background callback arrives:
1. Extract exec ID from output (`[MAESTRO_EXEC_ID=...]`)
2. Run `maestro delegate output <id>` to get full result
3. Write raw output to `per-tool/{tool}-output.md`

**Wait until ALL callbacks have arrived before proceeding.**

### Step 8: Cross-Verify

Read all `per-tool/{tool}-output.md` files. Compare findings across tools:

For each finding, classify:
- **[CONSENSUS]**: 2+ tools agree on same finding/recommendation
- **[CONFLICT]**: Tools disagree on approach or assessment
- **[UNIQUE]**: Finding from only one tool

Compute `consensus_level = (consensus_count / total_findings) * 100`.

### Step 9: Synthesize Outputs

Resolve conflicts via evidence-weighted voting:
- Higher confidence tool's position wins
- More specific evidence (file:line refs) wins over general statements
- If tied: mark as `[SUGGESTED]`

Generate three output files:

#### collab-report.md

```markdown
# Multi-CLI Collaboration Report — {requirement}

## Summary
- Tools: {tool_list}
- Consensus level: {N}%
- Key finding: {top finding}

## Consensus Findings
{findings agreed by 2+ tools}

## Resolved Conflicts
{conflicts resolved with rationale and winning tool}

## Unresolved Items
{items requiring human judgment}

## Unique Insights
{valuable unique findings with source tool attribution}

## Recommendations
{prioritized, merged recommendations}

## Per-Tool Confidence
| Tool | Confidence | Key Strength |
|------|-----------|--------------|
```

#### context.md (standard downstream format)

```markdown
# Context: {requirement}

**Date**: {date}
**Mode**: collab ({tool_list})
**Consensus Level**: {N}%

## Decisions

### Decision N: {TITLE}
- **Context**: {what and why}
- **Options**: 1. {opt1} 2. {opt2}
- **Chosen**: {selected}
- **Reason**: {rationale — which tools agreed/disagreed}

## Constraints

### Locked
{[CONSENSUS] items — treat as confirmed decisions}

### Free
{[UNIQUE] items with strong evidence — implementer discretion}

### Deferred
{[UNRESOLVED] conflicts — require human judgment}

## Code Context
{file:line references from per-tool findings}
```

#### conclusions.json

```json
{
  "session_id": "{sessionId}",
  "subject": "{requirement}",
  "mode": "collab",
  "tools": ["gemini", "claude", "codex"],
  "consensus_level": 85,
  "recommendation": "Go|No-Go|Conditional",
  "confidence": "high|medium|low",
  "dimensions": [
    { "name": "gemini", "score": 80, "findings": "...", "recommendations": "..." }
  ],
  "decisions": [
    { "title": "...", "classification": "locked|free|deferred", "source_tools": [], "rationale": "..." }
  ],
  "timestamp": "<ISO>"
}
```

### Step 10: Register Artifact

Append to `.workflow/state.json`:

```json
{
  "id": "CLB-{next_id}",
  "type": "collab",
  "milestone": "{current_milestone}",
  "phase": null,
  "scope": "adhoc",
  "path": "scratch/{YYYYMMDD}-collab-{slug}",
  "status": "completed",
  "depends_on": null,
  "harvested": false,
  "created_at": "<ISO>",
  "completed_at": "<ISO>"
}
```

### Step 11: Display Summary

```
============================================================
  MULTI-CLI COLLABORATION COMPLETE
============================================================
  Requirement:     {requirement}
  Tools:           {tool_list}
  Consensus Level: {N}%

  Per-Tool:
    gemini:  completed (confidence: {N}%)
    claude:  completed (confidence: {N}%)
    codex:   completed (confidence: {N}%)

  Artifact: CLB-{id}
  Output:   {outputDir}/

  Next steps:
    /maestro-analyze "{topic}"            — Deep feasibility analysis
    /maestro-plan "{phase} --dir {dir}"   — Plan from collab conclusions
    /maestro-brainstorm "{topic}"         — Expand with multi-role brainstorm
============================================================
```

</execution>

<error_codes>

| Code | Severity | Condition | Recovery |
|------|----------|-----------|----------|
| E001 | error | Requirement argument missing | Prompt for requirement |
| E002 | error | Fewer than 2 CLI tools eligible | Check cli-tools.json, enable more tools |
| E003 | error | Specified tool not found/enabled | Show available tools |
| E004 | error | All delegates failed | Abort with per-tool error details |
| W001 | warning | One tool failed | Continue with remaining tools |
| W002 | warning | >50% conflicts in cross-verify | Highlight in report, recommend manual review |
| W003 | warning | Low consensus level (<40%) | Flag in summary |

</error_codes>

<success_criteria>
- [ ] Available tools discovered from cli-tools.json with eligibility filtering
- [ ] Plan presented via AskUserQuestion with tool modification option (unless -y)
- [ ] All delegates launched in parallel via Bash(run_in_background: true)
- [ ] Execution stopped after launch — waited for all callbacks
- [ ] Per-tool outputs written to per-tool/{tool}-output.md
- [ ] Cross-verification: consensus/conflict/unique classification complete
- [ ] collab-report.md produced with merged findings
- [ ] context.md produced in Locked/Free/Deferred format (downstream compatible)
- [ ] conclusions.json produced (plan fast-track compatible)
- [ ] CLB artifact registered in state.json
- [ ] Partial degradation: continued if 1+ tools succeeded
</success_criteria>
