---
name: maestro-flow
description: Unified workflow command collection — intent routing, minimal closed-loop chain selection, step-by-step execution. All 49 maestro commands in one skill.
argument-hint: "\"intent\" [-y] [--chain <name>] [--cmd <name> <args>] | list | status | continue | execute"
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
Single-entry skill packaging all 49 Maestro workflow commands (Claude Code variant).

Two execution modes:
1. **Router** (default): Analyze intent -> match chain template -> create session -> step execution
2. **Direct** (`--cmd <name> <args>`): Load and execute a specific command inline

Execution uses `maestro-flow next/done` CLI for step lifecycle management.
Commands loaded via `maestro-flow resolve` + `Read()` for inline execution.
External steps delegated via `maestro delegate --to claude "/maestro-flow --cmd ..."`.

Session path: `.workflow/.maestro/flow-{YYYYMMDD-HHmmss}/status.json`
</purpose>

<context>
$ARGUMENTS -- intent text, flags, or special keywords.

**State files:**
- `.workflow/state.json` -- project artifact registry (optional)
- `.workflow/.maestro/flow-*/status.json` -- flow session state
</context>

<execution>

## Step 1: Parse & Route

```
Parse $ARGUMENTS:

  --cmd <name> <remaining-args>
    -> Step 1a: Direct Command Execution
    -> End.

  list
    -> Bash: maestro-flow list
    -> End.

  status [session-id]
    -> Bash: maestro-flow status [session-id]
    -> End.

  chains
    -> Bash: maestro-flow chains
    -> End.

  execute | continue
    -> Find latest running flow session
    -> If not found: "No running flow session." End.
    -> Phase 2 (Step Execution Loop)

  --chain <name> [-y] <remaining>
    -> Force chain selection, go to Step 4

  -y / --yes
    -> auto_confirm = true

  Other text
    -> intent = remaining text -> Step 2
```

### Step 1a: Direct Command Execution (--cmd)

```
1. Bash: maestro-flow resolve <name>
   -> Returns absolute path to command .md file

2. If NOT_FOUND -> Error. End.

3. Read() the command .md file

4. Set $ARGUMENTS = <remaining-args>

5. Follow the command's <execution> section completely

End.
```

---

## Step 2: Read Project State (optional)

```
If .workflow/state.json exists:
  Read -> extract: current_milestone, milestones, artifacts
If not: state_summary = "Project not initialized"
```

## Step 3: Intent Analysis & Chain Matching

```
Bash: maestro-flow suggest "{intent}"

Display top 3 chain options
AskUserQuestion: select chain / single command / Cancel

If auto_confirm: pick highest scoring chain
If single command: --cmd -> Step 1a
If chain selected: -> Step 4
```

---

## Step 4: Build Session

### 4.1: Create session from template

```
session_id = "flow-{YYYYMMDD-HHmmss}"
session_dir = .workflow/.maestro/{session_id}/

Build steps[] from selected chain template.
Write status.json.
Display chain steps, confirm (or auto if -y).
```

Fall through to Phase 2.

---

## Phase 2: Step Execution Loop

### 2.1: Load next step

```
Bash: maestro-flow next
```

Parse output:
- `NO_SESSION` -> End.
- `SESSION_COMPLETE` -> Display summary. End.
- `STEP: idx/total` + `TYPE` + `SKILL` + `ARGS` + `PATH` + `---COMMAND---` -> continue

### 2.2: Route by type

```
If TYPE == "decision" -> Step 2.3 (Decision Evaluation)
If TYPE == "internal" -> Step 2.4 (Internal Execution)
If TYPE == "external" -> Step 2.5 (External Execution)
```

### 2.3: Decision Evaluation

**Quality-gate decisions** (post-verify, post-review, post-test, post-business-test):

```
Resolve artifact dir from .workflow/state.json

Bash({
  command: `maestro delegate "evaluate ${decision} quality gate
CONTEXT: @${result_files}
---VERDICT---
STATUS: proceed | fix | escalate
REASON: one-line
GAP_SUMMARY: details
CONFIDENCE: high | medium | low
---END---" --role analyze --mode analysis`,
  run_in_background: true
})
STOP -- wait for callback.
```

On callback: parse verdict, apply (proceed/fix-loop/escalate).

**Structural decisions** (post-milestone): evaluate directly.

After decision: `Bash: maestro-flow done` -> loop to 2.1.

### 2.4: Internal Execution

The command content was loaded by `maestro-flow next` (after `---COMMAND---`).

```
1. Parse loaded command .md
2. Set $ARGUMENTS = ARGS (with auto-flag if session.auto_mode)
3. Follow <execution> section completely

Auto flags: maestro-init -y, maestro-plan -y, maestro-execute -y,
            quality-test -y --auto-fix, etc.

On complete: Bash: maestro-flow done -> loop to 2.1
On failure: -> Step 2.6
```

### 2.5: External Execution

```
Bash({
  command: `maestro delegate --to claude "Execute: /maestro-flow --cmd {SKILL} {ARGS}" --mode write`,
  run_in_background: true,
  timeout: 600000
})
STOP -- wait for callback.

On callback:
  On success: Bash: maestro-flow done -> loop to 2.1
  On failure: -> Step 2.6
```

### 2.6: Handle Failure

```
Auto mode: retry once (maestro-flow step {id} {idx} pending), then skip
Interactive: AskUserQuestion retry/skip/abort
```

---

## Phase 3: Completion

```
Display session summary with step statuses.
End.
```

</execution>

<error_codes>
| Code | Severity | Description | Recovery |
|------|----------|-------------|----------|
| E001 | error | No intent and no running session | Prompt for intent |
| E002 | error | Command not found for --cmd | maestro-flow list |
| E003 | error | No matching chain template | maestro-flow chains |
| E004 | error | Delegate verdict parse failed | Fallback: treat as "fix" |
</error_codes>
