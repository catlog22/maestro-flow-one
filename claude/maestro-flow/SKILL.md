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

**Skill directory structure** (relative to this SKILL.md):
```
maestro-flow/
  SKILL.md              <- this file (router)
  executor.md           <- step execution loop (deferred read)
  commands/
    lifecycle/          <- 17 commands: init, analyze, plan, execute, verify, ...
    quality/            <- 7 commands: debug, review, test, auto-test, ...
    manage/             <- 10 commands: status, issue, wiki, harvest, ...
    learn/              <- 5 commands: decompose, follow, investigate, ...
    milestone/          <- 3 commands: audit, complete, release
    spec/               <- 4 commands: add, load, remove, setup
    wiki/               <- 2 commands: connect, digest
  chains/
    templates.json      <- 14 chain templates + decision types
```

**State files:**
- `.workflow/state.json` -- project artifact registry (optional)
- `.workflow/.maestro/flow-*/status.json` -- flow session state

**CLI prerequisite:** `maestro-flow` command must be globally available (`npm install -g maestro-flow-one`)
</context>

<deferred_reading>
- [executor.md](executor.md) -- read when entering Phase 2 (step execution loop)
</deferred_reading>

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
    -> Read executor.md from deferred_reading
    -> Follow executor.md completely
    -> End.

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

## Step 3.5: Task Decomposition (broad lifecycle intents)

Shares the decomposition contract with maestro-ralph `A_DECOMPOSE_TASKS` — reference that spec; do not duplicate.

```
Classify intent breadth:
  broad   = 重构/全面/重写/重做/整体/迁移 · overhaul/migrate/rewrite/revamp
  narrow  = single file/function/bug, "fix X", "add Y to Z"
  other   = medium

Skip decomposition (-> Step 4 directly) WHEN:
  narrow intent  OR  single-command chain  OR  chain ∈ {status, init, quick}

Else (broad MUST clarify even if auto_confirm; medium clarify unless auto_confirm):
  AskUserQuestion ≤3 rounds (options pre-filled from intent + quick Glob/Grep of target module):
    1. Scope        -> in_scope / out_of_scope
    2. Constraints  -> constraints + execution_criteria (compat/API/perf/test bar)
    3. Done         -> definition_of_done

  Derive:
    execution_criteria  = 3-6 imperative rules every step obeys
    task_decomposition  = outcome sub-goals; each:
      { id:"G1", goal, boundary, done_when, evidence, lifecycle:[...], status:"pending" }
      RULE: done_when objectively verifiable, mapped to a ralph evidence artifact
            (verification.json | review.json | uat.md | <test path>)

  Write {session_dir}/goal-checklist.md (template below) with ALL_GOALS_DONE sentinel.
  Stage additive block + goal_checklist_path for Step 4.
  Emit the /goal bind prompt:
    📋 任务分解完成。复制下面一行设定目标(推荐)：
    /goal 当 {session_dir}/goal-checklist.md 子目标全 [x] 且含 ALL_GOALS_DONE 时达成；
          否则按执行准则继续推进且不越边界契约
```

**goal-checklist.md template:**
```markdown
# Flow Goal Checklist — {session_id}
> Intent: {intent}
## 执行准则 / Execution Criteria
- {criterion}
## 边界契约 / Boundary Contract
- In scope / Out of scope / Constraints / Definition of Done
## 子目标 / Sub-goals
- [ ] G1: {goal} — done when: {done_when} (evidence: {evidence})
<!-- executor flips [ ]→[x] when evidence confirms; appends ALL_GOALS_DONE when all [x] -->
```

---

## Step 4: Build Session

### 4.1: Create session from template

```
session_id = "flow-{YYYYMMDD-HHmmss}"
session_dir = .workflow/.maestro/{session_id}/

Build steps[] from selected chain template.

If Step 3.5 produced a decomposition:
  - Add additive block to status.json (OPTIONAL keys; absent = old behavior;
    never remove/rename existing fields — status JSON is schema-additive + step-dynamic):
      boundary_contract, execution_criteria, task_decomposition, goal_checklist_path
  - Each step gains optional "goal_ref": null
  - Append a decision step
      { "cmd":"decision:post-goal-audit", "type":"decision",
        "decision":"post-goal-audit", "retry_count":0, "max_retries":2 }
    as the FINAL node — after the last evidence-producing step (verify/review/test),
    before a milestone-complete/close-out step if the chain ends with one
    (audit needs evidence artifacts to exist)

Write status.json.
Display chain steps (+ Sub-goals: {n} if decomposed), confirm (or auto if -y).
```

Fall through to Phase 2.

---

## Phase 2: Step Execution Loop

Read [executor.md](executor.md) from deferred_reading and follow it completely.

Executor loop: `maestro-flow next` -> route by type -> execute -> `maestro-flow done` -> `Skill({ skill: "maestro-flow", args: "execute" })` until SESSION_COMPLETE.

</execution>

<error_codes>
| Code | Severity | Description | Recovery |
|------|----------|-------------|----------|
| E001 | error | No intent and no running session | Prompt for intent |
| E002 | error | Command not found for --cmd | maestro-flow list |
| E003 | error | No matching chain template | maestro-flow chains |
| E004 | error | Delegate verdict parse failed | Fallback: treat as "fix" |
</error_codes>
