---
name: maestro-flow
description: Unified workflow command collection — intent routing, minimal closed-loop chain selection, sequential direct step execution. All 49 maestro commands in one skill.
argument-hint: "\"intent\" [-y] [--chain <name>] [--cmd <name> <args>] | list | status | continue | execute"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

<purpose>
Single-entry skill packaging all 49 Maestro workflow commands (Codex variant).

Two execution modes:
1. **Router** (default): Analyze intent -> decompose (broad intents) -> match chain -> create session -> sequential step execution
2. **Direct** (`--cmd <name> <args>`): Load and execute a specific command inline

Execution invokes each step DIRECTLY in coordinator context (no agent spawning).
Step lifecycle managed by `maestro-flow next/done` CLI. Commands loaded via `maestro-flow resolve`.
Goal tracking via built-in `create_goal` / `update_plan` / `update_goal`.

Session path: `.workflow/.maestro/flow-{YYYYMMDD-HHmmss}/status.json`
</purpose>

<context>
$ARGUMENTS -- intent text, flags, or special keywords.

**Skill directory structure** (relative to this SKILL.md):
```
maestro-flow/
  SKILL.md              <- this file (router + sequential executor)
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

<invariants>
1. **Steps invoked DIRECTLY in-context** -- coordinator runs `$maestro-flow --cmd <skill> <args>` itself, sequentially. NO spawn_agents_on_csv, NO wave, NO CSV.
2. **Coordinator owns the loop** -- classify -> decompose -> build -> for each step: resolve args -> invoke -> read result -> persist -> next.
3. **Decision nodes evaluate, never execute** -- quality-gate via `maestro delegate --role analyze`; goal-gate audits sub-goals; structural evaluated directly.
4. **Goal is tool-created** -- broad intents call `create_goal` with sub-goal success criteria; `update_goal` on convergence.
5. **task_decomposition drives DYNAMIC step growth** -- sub-goals are the convergence spec; `steps[]` is a living array. `post-goal-audit` re-checks the checklist and inserts scoped steps for unmet sub-goals.
6. **Status JSON: schema-additive + step-dynamic** -- decomposition fields OPTIONAL (absent -> old behavior); `steps[]` grown at runtime; `goal_ref` traces dynamically-added steps. Never remove/rename existing fields.
7. **Sequential execution** -- one step at a time in index order; each step's result read before the next starts.
</invariants>

<execution>

## Step 1: Parse & Route

```
Parse $ARGUMENTS:

  --cmd <name> <remaining-args>
    -> Step 1a: Direct Command Execution
    -> End.

  list      -> Bash: maestro-flow list. End.
  status [session-id] -> Bash: maestro-flow status [session-id]. End.
  chains    -> Bash: maestro-flow chains. End.

  execute | continue
    -> Phase 2 (Sequential Execution Loop)

  --chain <name> [-y] <remaining>
    -> Force chain selection (skip intent analysis), go to Step 4

  -y / --yes
    -> auto_confirm = true

  Other text
    -> intent = remaining text -> Step 2
```

### Step 1a: Direct Command Execution (--cmd)

Entry point for single-command execution.

```
1. Bash: maestro-flow resolve <name>   -> absolute path to command .md
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
Bash: maestro-flow suggest "{intent}"  -> parse suggested chains
Display top 3 chain options
AskUserQuestion: select chain / single command / Cancel

If auto_confirm: pick highest scoring chain
If single command: --cmd -> Step 1a
If chain selected: -> Step 3.5
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
  Register goal via built-in tool:
    create_goal({ objective: "Flow {chain}: {intent} — converge {N} sub-goals within boundary",
      success_criteria: task_decomposition.map(g => `${g.id}: ${g.done_when}`),
      constraints: [...execution_criteria, "stay within boundary_contract"] })
  Stage additive block + goal_checklist_path for Step 4.
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

### 4.1: Load template & build steps

```
Bash: maestro-flow chain {template_name}  -> parse step list
Build session steps[] from template. Each step type ∈ {internal, external, decision}.
Decision steps get extra fields: decision, retry_count, max_retries.
```

### 4.2: Create session

```
session_id = "flow-{YYYYMMDD-HHmmss}"
session_dir = .workflow/.maestro/{session_id}/

Write {session_dir}/status.json:
{
  "session_id": "{session_id}", "source": "flow",
  "created_at": "{ISO}", "updated_at": "{ISO}",
  "intent": "{intent}", "status": "running",
  "chain_name": "{template_name}", "task_type": "{category}",
  "phase": {phase}, "milestone": "{current_milestone}",
  "auto_mode": {auto_confirm}, "quality_mode": "standard", "passed_gates": [],
  "context": { "scratch_dir": null, "plan_dir": null, "analysis_dir": null },
  "steps": [ { ..., "goal_ref": null } ],
  "waves": [], "current_step": 0,

  "_comment": "↓ OPTIONAL additive block — present only if Step 3.5 ran; absent = flat-chain behavior",
  "boundary_contract": {}, "execution_criteria": [], "task_decomposition": [], "goal_checklist_path": ""
}

If Step 3.5 produced a decomposition:
  - Fill the additive block (never remove/rename existing fields)
  - Append a decision step
      { "cmd":"decision:post-goal-audit", "type":"decision",
        "decision":"post-goal-audit", "retry_count":0, "max_retries":2 }
    as the FINAL node — after the last evidence-producing step (verify/review/test),
    before a milestone-complete/close-out step if the chain ends with one
  - update_plan({ plan: steps.map(s => ({ step: s.cmd, status: "pending" })) })
Else:
  - create_goal({ objective: "Flow {chain}: {N} steps" })
  - update_plan({ plan: steps.map(s => ({ step: s.cmd, status: "pending" })) })
```

### 4.3: Display + confirm

```
============================================================
  MAESTRO FLOW SESSION
============================================================
  Session:  {session_id}
  Chain:    {chain_name} ({total} steps)   Sub-goals: {n if decomposed}
  Phase:    {phase}

  [ ] 0. maestro-plan {phase}
  [ ] 1. maestro-execute {phase}
  [ ] 2. maestro-verify {phase}
  [ ] 3. > post-goal-audit                   [decision]
  ...
============================================================

If auto_confirm: proceed directly
Else: AskUserQuestion -> Execute / Cancel
```

Fall through to Phase 2.

---

## Phase 2: Sequential Execution Loop

Core loop: `maestro-flow next` -> route by type -> execute directly -> `maestro-flow done` -> self-invoke.

### 2.1: Load next step

```
Bash: maestro-flow next [session-id]
Parse:
  "NO_SESSION"       -> "No running flow session." End.
  "SESSION_COMPLETE" -> Phase 3.
  Else:
    STEP / TYPE / SKILL / ARGS
    DECISION / RETRY        (decision only)
    PATH                    (internal/external only)
    ---COMMAND--- + content (internal/external only)

Display banner: [{idx}/{total}] {SKILL} [{TYPE}]  Args: {ARGS}

Route:
  TYPE == "decision"  -> Step 2.2
  TYPE == "internal"  -> Step 2.3 (direct)
  TYPE == "external"  -> Step 2.4 (direct)
```

### 2.2: Decision Evaluation

```
Route by decision class:
  decision == "post-milestone"   -> Structural (2.2d)
  decision == "post-goal-audit"  -> Goal-gate (2.2g)
  otherwise                       -> Quality-gate (2.2a)
```

Resolve `artifact_dir`: read state.json, filter artifacts by session.milestone+phase, latest;
fallback glob `.workflow/scratch/*-P{phase}-*/`.

#### 2.2a: Quality-gate delegate assessment

```
Result file mapping:
  post-verify         -> {artifact_dir}/verification.json
  post-business-test  -> {artifact_dir}/business-test-results.json
  post-review         -> {artifact_dir}/review.json
  post-test           -> {artifact_dir}/uat.md, {artifact_dir}/.tests/test-results.json

Bash({
  command: `maestro delegate "PURPOSE: evaluate ${decision} quality gate
TASK: read result files | analyze pass/fail | assess severity | recommend
MODE: analysis
CONTEXT: @${result_files}
EXPECTED:
---VERDICT---
STATUS: proceed | fix | escalate
REASON: one-line
GAP_SUMMARY: problem details (fix/escalate only)
CONFIDENCE: high | medium | low
---END---
CONSTRAINTS: evaluate only | retry ${retry_count}/${max_retries}" --role analyze --mode analysis`,
  run_in_background: true
})
STOP -- wait for callback.

On callback: maestro delegate output <exec_id> -> extract STATUS/REASON/GAP_SUMMARY/CONFIDENCE
If parse fails -> fallback STATUS = "fix"

Verdict:
  proceed   -> add gate to passed_gates[], mark decision completed
  fix       -> clear passed_gates[], insert fix-loop (2.2c)
  escalate  -> session.status = "paused". End.
Interactive (non-auto): AskUserQuestion before applying. Auto (-y): follow directly.
```

#### 2.2c: Fix-loop templates

When verdict == "fix", insert after current position, reindex:

- **post-verify:** quality-debug -> maestro-plan --gaps -> maestro-execute -> maestro-verify -> decision:post-verify {retry+1}
- **post-review:** quality-debug -> maestro-plan --gaps -> maestro-execute -> quality-review -> decision:post-review {retry+1}
- **post-test:** quality-debug --from-uat -> maestro-plan --gaps -> maestro-execute -> maestro-verify -> decision:post-verify {0} -> quality-test -> decision:post-test {retry+1}
- **post-business-test:** quality-debug --from-business-test -> maestro-plan --gaps -> maestro-execute -> maestro-verify -> decision:post-verify {0} -> quality-auto-test -> decision:post-business-test {retry+1}

#### 2.2d: Structural (post-milestone)

```
Read state.json -> next milestone (pending/active)?
If found: update session (milestone, phase, reset passed_gates), insert lifecycle steps, reindex
If none: proceed (session completes naturally)
```

#### 2.2g: Goal-gate (post-goal-audit)

Shares contract with maestro-ralph `A_GOAL_AUDIT_EVALUATE`.

```
Read session.task_decomposition + goal_checklist_path
For each sub-goal status != "done": resolve its evidence artifact under {artifact_dir}

Bash({
  command: `maestro delegate "PURPOSE: 审计子目标达成, 决定是否补充执行步骤
TASK: 逐个读取未完成子目标 evidence | 对照 done_when 判定 met/unmet | 给出 unmet 差距与 target_phase
MODE: analysis
CONTEXT: @{goal_checklist_path} @{evidence files} | 执行准则: {execution_criteria} | 边界: {boundary_contract}
EXPECTED: ---VERDICT--- STATUS: all_met | has_unmet / UNMET: [{id,gap,target_phase}] ---END---
CONSTRAINTS: 只评估不修改 | 严格按 done_when | 不越 boundary_contract" --role analyze --mode analysis`,
  run_in_background: true
})
STOP -- wait for callback.

On callback:
  For each met sub-goal -> task_decomposition[i].status="done" + flip [ ]→[x] in goal-checklist.md
  STATUS == all_met:
    Append `ALL_GOALS_DONE` to goal-checklist.md
    Set all task_decomposition[*].status="done"; update_goal({ status:"complete" })
    Mark decision completed, write status.json -> 2.2e
  STATUS == has_unmet:
    For each unmet G{n} (grouped by target_phase), insert before this decision node:
      maestro-plan {target_phase} --gaps "G{n}: {gap}"   [internal] [goal_ref: G{n}]
      maestro-execute {target_phase}                      [external] [goal_ref: G{n}]
      maestro-verify {target_phase}                       [internal] [goal_ref: G{n}]
    Re-append: decision:post-goal-audit {retry+1}          [decision]
    Reindex, increment retry_count, write status.json + update_plan -> 2.2e
  GUARD: retry_count >= max_retries AND still unmet ->
    insert quality-debug "{unmet gaps}" [internal]; session.status="paused"; End.
```

#### 2.2e: Finalize decision

```
Mark decision step "completed"; write status.json
Bash: maestro-flow done  -> Skill({ skill: "maestro-flow", args: "execute" })  End.
(auto_mode == false on quality-gate: STOP first, display "Use $maestro-flow execute to continue")
```

### 2.3: Internal Execution (direct)

```
Command content already in context (after ---COMMAND--- from `maestro-flow next`).
Set $ARGUMENTS = ARGS. Apply auto-flag if session.auto_mode (table below).
Follow the command's <execution> section completely (respect its required/deferred reading).
On success -> 2.5. On failure -> 2.6.
```

### 2.4: External Execution (direct)

```
External steps run in coordinator context too (no spawn). Append -y.
Invoke directly: follow `$maestro-flow --cmd {SKILL} {ARGS} -y` — i.e., resolve the
command .md (already provided after ---COMMAND---) and follow its <execution> completely.
On success -> 2.5. On failure -> 2.6.
```

**Auto flag propagation (session.auto_mode == true):**

| Skill | Flag |
|-------|------|
| maestro-init / maestro-analyze / maestro-brainstorm / maestro-roadmap / maestro-plan / maestro-execute / quality-auto-test / maestro-milestone-complete | -y |
| quality-test | -y --auto-fix |
| (all others) | (none) |

### 2.5: Mark Done & Advance

```
Bash: maestro-flow done [session-id]
Parse:
  "COMPLETED: {idx} {skill}" / "NEXT: ..." -> Skill({ skill: "maestro-flow", args: "execute" }) End.
  "SESSION_COMPLETE" -> Phase 3.

Context propagation (after a context-producing skill): read its artifacts, update
session.context (analyze->analysis_dir, plan->plan_dir, execute->scratch_dir,
brainstorm->brainstorm_dir, roadmap->spec_session_id); write status.json.
```

### 2.6: Handle Failure

```
Bash: maestro-flow step {session_id} {idx} failed
Auto mode:
  not retried -> step ... pending -> Skill({ skill:"maestro-flow", args:"execute" })  (retry once)
  retried     -> step ... skipped -> Skill({ skill:"maestro-flow", args:"execute" })  (continue)
Interactive: AskUserQuestion retry / skip / abort
  abort -> session.status = "paused". End.
```

---

## Phase 3: Completion

```
session.status = "completed"; write status.json
update_plan: all steps -> "completed"
update_goal({ status: "complete" })   (idempotent if released by 2.2g)

Display:
============================================================
  FLOW COMPLETE
============================================================
  Session:  {session_id}
  Chain:    {chain_name}   Steps: {completed}/{total} ({skipped} skipped)
  Sub-goals: {done}/{total}

  [+] 0. maestro-plan 1
  [+] 1. maestro-execute 1
  [+] 2. maestro-verify 1
  [+] 3. > post-goal-audit -> all_met  [decision]
  ...
============================================================
```

</execution>

<error_codes>
| Code | Severity | Description | Recovery |
|------|----------|-------------|----------|
| E001 | error | No intent and no running session | Prompt for intent |
| E002 | error | Command not found for --cmd | maestro-flow list |
| E003 | error | No matching chain template | maestro-flow chains |
| E004 | error | Delegate verdict parse failed | Fallback: treat as "fix" |
| E005 | error | Step execution failed | auto: retry once then skip; interactive: ask |
</error_codes>

<success_criteria>
- [ ] --cmd resolves via maestro-flow CLI, executes command inline
- [ ] list/status/chains/suggest route to maestro-flow CLI
- [ ] Intent analysis -> decomposition (broad) -> chain matching -> session creation
- [ ] Broad intents decomposed (≤3 boundary questions); goal registered via create_goal
- [ ] status.json schema-additive (decomposition fields optional) + step-dynamic (steps[] grows)
- [ ] post-goal-audit appended as final node; unmet sub-goals grow steps[] (goal_ref tagged)
- [ ] Steps invoked DIRECTLY in-context — NO spawn_agents_on_csv, NO wave/CSV
- [ ] Sequential execution; status.json + update_plan persisted after every step/decision
- [ ] Quality-gate delegate-evaluated; goal-gate audits sub-goals; structural direct
- [ ] Fix-loop / goal-fix insertion + reindex; passed_gates + retry_count enforced
- [ ] Context propagation after context-producing skills
- [ ] update_goal released on convergence (2.2g / Phase 3); held while paused
- [ ] Auto mode: skip confirmation, auto-follow verdicts, retry+skip on failure
</success_criteria>
