---
name: maestro-flow
description: Unified workflow command collection — intent routing, minimal closed-loop chain selection, script-loaded execution. All 52 maestro commands in one skill.
argument-hint: "\"intent\" [-y] [--chain <name>] [--cmd <name> <args>] | list | status | continue | --role executor [session-id]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Skill
  - AskUserQuestion
---

<purpose>
Single-entry skill packaging all 52 Maestro workflow commands.

Three execution modes:
1. **Router** (default): Analyze intent → match chain template → create session → execute
2. **Executor** (`--role executor`): Step-by-step session runner with script-loaded commands
3. **Direct** (`--cmd <name> <args>`): Load and execute a specific command (delegate entry point)

Commands are organized in `commands/` by category (lifecycle, quality, manage, learn, spec, wiki, milestone).
Execution uses `maestro-flow resolve` for command discovery and `Read()` for inline loading.

Session path: `.workflow/.maestro/flow-{YYYYMMDD-HHmmss}/status.json`
</purpose>

<context>
$ARGUMENTS — intent text, flags, or special keywords.

**Skill directory** (for Read/Bash paths): Determine by reading the location of this SKILL.md file. All relative paths below are relative to this skill directory.

**State files:**
- `.workflow/state.json` — project artifact registry (optional, may not exist)
- `.workflow/.maestro/flow-*/status.json` — flow session state
- `chains/templates.json` — chain templates (within skill directory)
</context>

<execution>

## Step 0: CLI Prerequisite

The global CLI `maestro-flow` must be installed (`npm install -g maestro-flow-one`).
All command discovery, session tracking, and path resolution go through this CLI.

## Step 1: Parse & Route

```
Parse $ARGUMENTS:

  --role executor [session-id]
    → Read executor.md (in same directory as this SKILL.md)
    → Follow its execution instructions
    → Core loop:
      1. Bash: maestro-flow next [session-id]
         → Loads next pending step, marks running, outputs command content
      2. Execute by type (internal: inline, external: delegate, decision: Agent)
      3. Bash: maestro-flow done [session-id]
         → Marks completed, shows next step
      4. Self-invoke until SESSION_COMPLETE
    → End.

  --cmd <name> <remaining-args>
    → Step 1a: Direct Command Execution (also used by delegate sessions)
    → End.

  list
    → Bash: maestro-flow list
    → End.

  status [session-id]
    → Bash: maestro-flow status [session-id]
    → End.

  chains
    → Bash: maestro-flow chains
    → End.

  continue
    → Find latest running flow session (.workflow/.maestro/flow-*/status.json, status=="running")
    → If not found: "无运行中的 flow 会话". End.
    → Skill({ skill: "maestro-flow", args: "--role executor" })
    → End.

  --chain <name> [-y] <remaining>
    → Force chain selection (skip intent analysis), go to Step 4

  -y / --yes
    → auto_confirm = true (extract from args, pass remaining as intent)

  Other text
    → intent = remaining text → Step 2
```

### Step 1a: Direct Command Execution (--cmd)

This is the entry point for delegate sessions and single-command execution.

```
1. Resolve command path:
   Bash: maestro-flow resolve <name>
   → Returns absolute path to command .md file

2. If NOT_FOUND → Error: "Command not found: <name>". End.

3. Read() the command .md file

4. Parse $ARGUMENTS from <remaining-args>:
   - Treat <remaining-args> as the command's $ARGUMENTS
   - The command file's <context> section defines expected args

5. Follow the command file's <execution> section completely
   - Respect <required_reading> and <deferred_reading> references
   - For @~/.maestro/workflows/* references: these need maestro workflows installed separately

End.
```

---

## Step 2: Read Project State (optional)

```
If .workflow/state.json exists:
  Read it → extract: current_milestone, milestones, artifacts, accumulated_context
  Build state_summary for chain context

If not exists:
  state_summary = "Project not initialized"
```

## Step 3: Intent Analysis & Chain Matching

### 3.1: Extract intent structure

```
Parse intent text for:
  - action keywords: fix, build, implement, review, test, debug, analyze, plan, execute, ...
  - object references: phase N, issue ID (ISS-*), module names
  - phase number: regex phase\s*(\d+) or bare number
  - issue_id: regex ISS-\d+ or issue/ticket keywords
```

### 3.2: Match chain templates

```
Bash: maestro-flow chains

For each template:
  Score = sum of matching trigger keyword lengths in intent
  
Sort by score DESC, take top 3

Also check single_commands map:
  If intent exactly matches a single_command key → add as option
```

### 3.3: Present options to user

```
Display:
  ============================================================
    MAESTRO FLOW — Chain Selection
  ============================================================
  Intent: {intent}
  State:  {state_summary}

  Suggested chains:
    1. quick-fix         — Diagnose and fix (4 steps)  [match: fix, bug]
    2. analyze-plan-exec — Fast track build (3 steps)  [match: build]
    3. (single) debug    — Direct: quality-debug

  Or enter a command name for single execution.
  ============================================================

AskUserQuestion: 选择 chain / 输入命令名 / Cancel
```

- If auto_confirm: pick highest scoring chain
- If user selects single command: `--cmd <name> <intent>` → Step 1a
- If user selects chain: → Step 4

---

## Step 4: Build Session

### 4.1: Resolve chain steps

```
Load selected template from templates.json
Convert template steps to session steps:

steps = []
for i, tmpl_step in enumerate(template.steps):
  steps.append({
    "index": i,
    "type": tmpl_step.type,       // "internal" or "external"
    "skill": tmpl_step.cmd,       // e.g., "maestro-plan"
    "args": tmpl_step.args,       // with placeholders
    "status": "pending",
    "started_at": null,
    "completed_at": null,
    "error": null
  })
```

### 4.2: Resolve placeholders

```
{phase}       → extracted phase number or null
{intent}      → user intent text
{issue_id}    → extracted issue ID or null
{scratch_dir} → null (resolved at execution time)
{plan_dir}    → null (resolved at execution time)
```

### 4.3: Create session

```
session_id = "flow-{YYYYMMDD-HHmmss}"
session_dir = .workflow/.maestro/{session_id}/

Write {session_dir}/status.json:
{
  "session_id": "{session_id}",
  "source": "flow",
  "created_at": "{ISO}",
  "updated_at": "{ISO}",
  "intent": "{intent}",
  "status": "running",
  "chain_name": "{template_name}",
  "task_type": "{template.category}",
  "phase": {phase},
  "milestone": "{current_milestone}",
  "auto_mode": {auto_confirm},
  "quality_mode": "standard",
  "passed_gates": [],
  "context": {
    "issue_id": null,
    "milestone_num": null,
    "spec_session_id": null,
    "scratch_dir": null,
    "plan_dir": null,
    "analysis_dir": null,
    "brainstorm_dir": null
  },
  "steps": [...],
  "waves": [],
  "current_step": 0
}
```

### 4.4: Display + confirm

```
============================================================
  MAESTRO FLOW SESSION
============================================================
  Session:  {session_id}
  Chain:    {chain_name} ({total} steps)
  Phase:    {phase}

  [ ] 0. maestro-plan {phase}                [internal]
  [ ] 1. maestro-execute {phase}             [external]⚡
  [ ] 2. maestro-verify {phase}              [internal]
  ...
============================================================
```

- If auto_confirm: proceed directly
- Else: AskUserQuestion → Execute / Edit / Cancel
  - Edit: allow removing steps or changing args
  - Cancel: delete session directory. End.

### 4.5: Launch execution

```
Skill({ skill: "maestro-flow", args: "--role executor" })
End.
```

</execution>

<error_codes>
| Code | Severity | Description | Recovery |
|------|----------|-------------|----------|
| E001 | error | No intent and no running session | Prompt for intent |
| E002 | error | Command not found for --cmd | Show available commands via list |
| E003 | error | No matching chain template | Show all chains, suggest single command |
| E004 | error | Phase number required but not found | AskUserQuestion for phase |
| W001 | warning | Multiple chains match equally | Show top 3, let user choose |
| W002 | warning | Project not initialized | Suggest roadmap-driven chain |
</error_codes>

<success_criteria>
- [ ] --role executor routes to executor.md inline execution
- [ ] --cmd resolves via maestro-flow CLI and executes command inline
- [ ] list/status/chains route to maestro-flow CLI
- [ ] Intent analysis extracts action, phase, issue_id
- [ ] Chain matching scores templates by trigger keywords
- [ ] Session status.json created with correct schema
- [ ] Placeholder resolution handles {phase}, {intent}, {issue_id}
- [ ] Auto mode (-y) skips confirmation and picks top chain
- [ ] Single command fallback works for exact keyword matches
</success_criteria>
