# Flow Executor -- CLI-Driven Step Execution (Claude Variant)

Single-step executor for flow sessions. Each invocation: `maestro-flow next` -> execute -> `maestro-flow done` -> self-invoke.

**Core loop:**
```
maestro-flow next  ->  route by type  ->  execute  ->  maestro-flow done  ->  self-invoke
```

## Execution

### Step 1: Load Next Step

```
Bash: maestro-flow next [session-id]

Parse output lines:
  "NO_SESSION"       -> "No running flow session." End.
  "SESSION_COMPLETE" -> Display completion summary. End.
  Otherwise parse structured output:
    STEP: {idx}/{total}
    TYPE: internal | external | decision
    SKILL: {command-name}
    ARGS: {arguments}
    DECISION: {post-verify|post-review|...}   (decision only)
    RETRY: {N}/{M}                             (decision only)
    PATH: {/absolute/path/to/command.md}       (internal/external only)
    ---COMMAND---
    {full .md file content follows}
```

Display step banner:
```
------------------------------------------------------------
  [{idx}/{total}] {SKILL} [{TYPE}]
------------------------------------------------------------
  Args: {ARGS}
```

Context weight hint (after 4+ completed steps):
```
Note: {completed} steps done. Use /maestro-flow execute in fresh context to resume.
```

### Step 2: Route by Type

```
TYPE == "decision"  -> Step 3 (Decision Evaluation)
TYPE == "internal"  -> Step 4 (Internal Execution)
TYPE == "external"  -> Step 5 (External Execution)
```

---

### Step 3: Decision Evaluation

#### 3.1: Parse decision metadata

```
decision_type = DECISION field    // e.g., "post-verify"
retry_count / max_retries = from RETRY field
```

#### 3.2: Resolve artifact directory

```
Read .workflow/state.json
Filter artifacts: milestone == session.milestone, phase == session.phase
Sort by created_at DESC -> take first

artifact_dir = .workflow/scratch/{artifact.path}/
Fallback: glob .workflow/scratch/*-P{phase}-*/ sorted by date DESC
```

#### 3.3: Route by decision class

```
decision_type == "post-milestone"   -> Structural (evaluate directly)
decision_type == "post-goal-audit"  -> Goal-gate (audit sub-goals, grow steps)
otherwise                            -> Quality-gate (delegate analyzer)
```

**Structural decisions (post-milestone)** -- evaluate directly:

```
post-milestone:
  Read .workflow/state.json -> check next milestone (status "pending"/"active")
  If found:
    Read session status.json
    Update: milestone, phase, reset passed_gates
    Insert full-lifecycle steps for next milestone after current position
    Reindex all steps, write status.json
    Display: post-milestone: advancing to {next_milestone}
  If none:
    Display: post-milestone: all milestones complete
    -> proceed (mark done, continue)
```

**Goal-gate decision (post-goal-audit)** -- shares contract with maestro-ralph `A_GOAL_AUDIT_EVALUATE`:

```
Read session.task_decomposition + session.goal_checklist_path
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
  For each met sub-goal -> set task_decomposition[i].status="done" + flip [ ]→[x] in goal-checklist.md
  STATUS == all_met:
    Append line `ALL_GOALS_DONE` to goal-checklist.md
    Mark decision completed, write status.json
    -> Step 3.8 (continue; satisfies user /goal Stop hook)
  STATUS == has_unmet:
    For each unmet sub-goal G{n} (grouped by target_phase), insert before this decision node:
      maestro-plan {target_phase} --gaps "G{n}: {gap}"   [internal] [goal_ref: G{n}]
      maestro-execute {target_phase}                      [external] [goal_ref: G{n}]
      maestro-verify {target_phase}                       [internal] [goal_ref: G{n}]
    Re-append: decision:post-goal-audit {retry+1}          [decision]
    Reindex steps, increment retry_count, write status.json
    Display: Decision: post-goal-audit -> {k} unmet, +{N} steps inserted (G{ids})
    -> Step 3.8 (continue)
  GUARD: retry_count >= max_retries AND still unmet ->
    insert quality-debug "{unmet gaps}" [internal]; set session.status="paused"; End.
```

**Quality-gate decisions** -- delegate to external analyzer:

Result file mapping:

| Decision | Files |
|----------|-------|
| post-verify | `{artifact_dir}/verification.json` |
| post-business-test | `{artifact_dir}/business-test-results.json` |
| post-review | `{artifact_dir}/review.json` |
| post-test | `{artifact_dir}/uat.md`, `{artifact_dir}/.tests/test-results.json` |

```
Bash({
  command: `maestro delegate "PURPOSE: evaluate ${decision_type} quality gate result
TASK: read result files | analyze pass/fail status | assess severity | recommend
MODE: analysis
CONTEXT: @${result_files}
EXPECTED: strict format:
---VERDICT---
STATUS: proceed | fix | escalate
REASON: one-line explanation
GAP_SUMMARY: problem details (fix/escalate only)
CONFIDENCE: high | medium | low
---END---
CONSTRAINTS: evaluate only | STATUS must be one of three | if retry ${retry_count}/${max_retries} at max and still failing, must escalate" --role analyze --mode analysis`,
  run_in_background: true
})
STOP -- wait for background callback.
```

#### 3.4: Parse verdict

```
On callback: maestro delegate output <exec_id>

Extract between ---VERDICT--- and ---END---:
  verdict.status     = "proceed" | "fix" | "escalate"
  verdict.reason     = string
  verdict.gap_summary = string
  verdict.confidence = "high" | "medium" | "low"

If parse fails -> fallback: status = "fix", gap_summary = "verdict parse failed"
```

#### 3.5: Confirm (interactive mode)

```
Display: Decision: {decision_type} -> {verdict.status} ({verdict.reason})
         Confidence: {verdict.confidence}

Auto mode (session.auto_mode == true):
  Follow verdict directly, no confirmation.

Interactive mode:
  AskUserQuestion: "Follow recommendation / Override proceed / Override fix / Cancel"
  - Cancel -> session status = "paused", write status.json. End.
```

#### 3.6: Apply verdict

| Verdict | Action |
|---------|--------|
| proceed | Add gate to session.passed_gates[], mark decision completed |
| fix | Clear session.passed_gates[], insert fix-loop commands |
| escalate | Set session.status = "paused". Display escalation message. End. |

#### 3.7: Fix-loop insertion

When verdict == "fix", insert commands after current position based on decision type:

**post-verify fix-loop:**
```
quality-debug "{gap_summary}"                 [internal]
maestro-plan {phase} --gaps                   [internal]
maestro-execute {phase}                       [external]
maestro-verify {phase}                        [internal]
decision:post-verify {retry_count + 1}        [decision]
```

**post-review fix-loop:**
```
quality-debug "{gap_summary}"                 [internal]
maestro-plan {phase} --gaps                   [internal]
maestro-execute {phase}                       [external]
quality-review {phase}                        [internal]
decision:post-review {retry_count + 1}        [decision]
```

**post-test fix-loop:**
```
quality-debug --from-uat "{gap_summary}"      [internal]
maestro-plan {phase} --gaps                   [internal]
maestro-execute {phase}                       [external]
maestro-verify {phase}                        [internal]
decision:post-verify {retry: 0}               [decision]
quality-test {phase}                          [internal]
decision:post-test {retry_count + 1}          [decision]
```

**post-business-test fix-loop:**
```
quality-debug --from-business-test "{gap_summary}"  [internal]
maestro-plan {phase} --gaps                         [internal]
maestro-execute {phase}                             [external]
maestro-verify {phase}                              [internal]
decision:post-verify {retry: 0}                     [decision]
quality-auto-test {phase}                           [internal]
decision:post-business-test {retry_count + 1}       [decision]
```

```
Read session status.json
Insert new steps at position (current_step + 1)
Reindex all steps: step.index = array position
Mark current decision node: status = "completed"
Write status.json

Display: Decision: {decision_type} -> fix (+{N} commands inserted)
```

#### 3.8: Continue

```
Bash: maestro-flow done
-> Skill({ skill: "maestro-flow", args: "execute" })
End.
```

---

### Step 4: Internal Execution

The command .md content was loaded by `maestro-flow next` (after `---COMMAND---`).

```
1. The command content is already in context from Step 1 output
2. Set $ARGUMENTS = ARGS from step output
3. Apply auto-flag if session.auto_mode == true (see table below)
4. Follow the command's <execution> section completely
   - Respect <required_reading> and <deferred_reading> references
```

**Auto flag propagation:**

| Skill | Flag appended |
|-------|---------------|
| maestro-init | -y |
| maestro-analyze | -y |
| maestro-brainstorm | -y |
| maestro-roadmap | -y |
| maestro-plan | -y |
| maestro-execute | -y |
| quality-auto-test | -y |
| quality-test | -y --auto-fix |
| maestro-milestone-complete | -y |
| (all others) | (none) |

```
On success -> Step 6 (Mark Done)
On failure -> Step 7 (Handle Failure)
```

---

### Step 5: External Execution

Delegate to a new Claude Code session via maestro delegate:

```
Bash({
  command: `maestro delegate --to claude "Execute: /maestro-flow --cmd {SKILL} {ARGS}

You are a delegate session executing a flow pipeline step.
Use Skill() to invoke: /maestro-flow --cmd {SKILL} {ARGS}
Do NOT reimplement the command logic -- invoke through the skill." --mode write`,
  run_in_background: true,
  timeout: 600000
})

STOP -- wait for background callback.
```

**On callback:**
- Retrieve output: `maestro delegate output <exec_id>`
- On success -> Step 6 (Mark Done)
- On failure -> Step 7 (Handle Failure)

---

### Step 6: Mark Done & Advance

```
Bash: maestro-flow done [session-id]

Parse output:
  "COMPLETED: {idx} {skill}"  -> display confirmation
  "NEXT: {idx} {skill} [{type}]" -> more steps remain
  "SESSION_COMPLETE" -> all done, display summary. End.
```

If more steps, self-invoke:
```
Skill({ skill: "maestro-flow", args: "execute" })
End.
```

---

### Step 7: Handle Failure

```
Bash: maestro-flow step {session_id} {idx} failed
Display: [{idx}/{total}] FAIL {SKILL}: {error}
```

**Auto mode (session.auto_mode == true):**
```
If not already retried:
  Bash: maestro-flow step {session_id} {idx} pending
  -> Skill({ skill: "maestro-flow", args: "execute" })  // retry once

If already retried:
  Bash: maestro-flow step {session_id} {idx} skipped
  Display: [{idx}] skipped after retry
  -> Skill({ skill: "maestro-flow", args: "execute" })  // continue to next
```

**Interactive mode:**
```
AskUserQuestion: "retry / skip / abort"
  retry -> maestro-flow step {session_id} {idx} pending
    -> Skill({ skill: "maestro-flow", args: "execute" })
  skip  -> maestro-flow step {session_id} {idx} skipped
    -> Skill({ skill: "maestro-flow", args: "execute" })
  abort -> set session status = "paused" via status.json. End.
```
