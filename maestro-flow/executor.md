# Flow Executor — Script-Loaded Step Execution

Single-step executor for flow sessions. Each invocation: find next pending step → load command via script → execute inline → update status → self-invoke for next step.

**Key difference from ralph-execute:** Commands are NOT registered slash commands. They are loaded from `commands/` via `flow_cli.py resolve` and executed inline via `Read()`.

## Execution

### Step 1: Locate Session

```
If session-id provided (from --role executor args):
  session_path = .workflow/.maestro/{session-id}/status.json
Else:
  Scan .workflow/.maestro/flow-*/status.json
  Filter: status == "running"
  Sort: updated_at DESC (or dir mtime DESC)
  Take first

If no session found:
  Output: "无运行中的 flow 会话。使用 /maestro-flow 创建新会话。"
  End.
```

Read status.json → extract: `session_id`, `steps[]`, `current_step`, `status`, `phase`, `milestone`, `intent`, `auto_mode`, `context`.

### Step 2: Find Next Pending Step

```
next = steps.find(step => step.status == "pending")
If no pending step → Step 7 (Complete)
```

### Step 3: Resolve Args

**Placeholder substitution:**

| Placeholder | Source |
|-------------|--------|
| `{phase}` | session.phase |
| `{milestone}` | session.milestone |
| `{intent}` | session.intent |
| `{scratch_dir}` | session.context.scratch_dir |
| `{plan_dir}` | session.context.plan_dir |
| `{analysis_dir}` | session.context.analysis_dir |
| `{issue_id}` | session.context.issue_id |

Replace all placeholders in `next.args`. If a placeholder resolves to null, leave the placeholder as-is (downstream command handles it).

### Step 4: Mark Running

```
next.status = "running"
next.started_at = ISO timestamp
session.current_step = next.index
session.updated_at = ISO timestamp
Write status.json
```

Display step banner:
```
------------------------------------------------------------
  [{next.index}/{steps.length - 1}] {next.skill} [{next.type}]
------------------------------------------------------------
  Session: {session_id}
  Args: {next.args}
```

Context weight hint (after 4+ completed steps):
```
⚡ 已执行 {completed_count} 步，上下文较重。可 /maestro-flow continue 在新上下文恢复。
```

### Step 5: Route by Type

```
If next.type == "decision" → Step 6 (Decision Evaluation)
Else → Step 7 (Command Execution)
```

---

### Step 6: Decision Evaluation (via Agent)

Decision nodes evaluate quality gate results and determine whether to proceed, fix, or escalate.

#### 6.1: Parse decision metadata

```
decision_type = next.decision    // e.g., "post-verify", "post-review"
retry_count = next.retry_count   // 0, 1, 2...
max_retries = next.max_retries   // default 2

Read chains/templates.json → decision_types[decision_type]
  → evaluates: result file name(s)
  → fix_loop: commands to insert on "fix" verdict
  → structural: true if direct evaluation (no Agent needed)
```

#### 6.2: Resolve artifact directory

```
Read .workflow/state.json
Filter artifacts: milestone == session.milestone, phase == session.phase
Sort by created_at DESC → take first

artifact_dir = .workflow/scratch/{artifact.path}/
Fallback: glob .workflow/scratch/*-P{phase}-*/ sorted by date DESC
```

#### 6.3: Evaluate

**Structural decisions (post-milestone)** — evaluate directly:

```
post-milestone:
  Read .workflow/state.json → check next milestone (status "pending"/"active")
  If found:
    Update session: milestone, phase, reset passed_gates
    Insert full-lifecycle steps for next milestone
    Display: ◆ post-milestone: advancing to {next_milestone}
  If none:
    Display: ◆ post-milestone: all milestones complete
    → proceed
```

**Quality-gate decisions** — delegate to Agent for analysis:

```
Agent({
  subagent_type: "general-purpose",
  prompt: "评估 {decision_type} 质量门结果。

读取以下文件:
- {artifact_dir}/{evaluates}

分析结果后，严格按以下格式输出:
---VERDICT---
STATUS: proceed | fix | escalate
REASON: 一句话解释
GAP_SUMMARY: 具体问题描述（仅 fix/escalate 时填写）
CONFIDENCE: high | medium | low
---END---

规则:
- proceed: 质量门通过，可以继续
- fix: 存在可修复的问题，需要修复循环
- escalate: 问题严重或重试次数已达上限 ({retry_count}/{max_retries})
- 如果 retry_count >= max_retries 且仍有问题，必须 escalate",
  description: "evaluate {decision_type} gate"
})
```

#### 6.4: Parse verdict & apply

```
Parse Agent output:
  Extract STATUS / REASON / GAP_SUMMARY / CONFIDENCE from ---VERDICT--- block
  If parse fails → fallback: STATUS = "fix", GAP_SUMMARY = "verdict parse failed"
```

**Interactive mode:**
```
Display: ◆ {decision_type}: {verdict.status} — {verdict.reason}
  confidence: {verdict.confidence}

If verdict.confidence != "high":
  AskUserQuestion: "按建议执行 / 覆盖 proceed / 覆盖 fix / 取消"
Else if not auto_mode:
  AskUserQuestion: "按建议执行 / 覆盖 / 取消"
```

**Auto mode:** follow verdict directly (no confirmation).

#### 6.5: Apply verdict

| Verdict | Action |
|---------|--------|
| `proceed` | Add gate to `passed_gates[]`, mark decision completed → Step 8c |
| `fix` | Clear `passed_gates[]`, insert fix-loop commands → Step 6.6 |
| `escalate` | Set session status = "paused", display escalation message → End |

#### 6.6: Insert fix-loop

```
Read fix_loop from decision_types[decision_type]

Build new steps from fix_loop template:
  - "quality-debug" → { type: "internal", cmd: "quality-debug", args: "{gap_summary}" }
  - "maestro-plan --gaps" → { type: "internal", cmd: "maestro-plan", args: "{phase} --gaps" }
  - "maestro-execute" → { type: "external", cmd: "maestro-execute", args: "{phase}" }
  - "decision:post-verify" → { type: "decision", decision: "post-verify", retry_count: retry_count + 1 }

Insert new_steps at position (current_step + 1)
Reindex all steps: step.index = array position
Mark current decision node: completed
Write status.json

Display: ◆ {decision_type} → fix (+{N} commands inserted)
```

Then continue:
```
Skill({ skill: "maestro-flow", args: "--role executor" })
End.
```

---

### Step 7: Command Execution

#### 7.1: Resolve command path

```
Bash: python {skill_dir}/tools/flow_cli.py resolve {next.skill}
→ Returns absolute path to command .md file

If NOT_FOUND:
  → Step 8d (Handle Failure) with error "Command not found: {next.skill}"
```

#### 7a. internal (script-loaded execution)

```
1. Read() the command .md file from resolved path
2. Set $ARGUMENTS = next.args (with resolved placeholders)
3. Follow the command's <execution> section completely

Auto flag propagation (when session.auto_mode == true):
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

  Append flag to $ARGUMENTS before execution.

On success → Step 8c (Mark Complete)
On failure → Step 8d (Handle Failure)
```

#### 7b. external (delegate via /maestro-flow --cmd)

```
Bash({
  command: `maestro delegate --to claude "Execute: /maestro-flow --cmd {next.skill} {next.args}

You are a delegate session executing a flow pipeline step.
Use Skill() to invoke: /maestro-flow --cmd {next.skill} {next.args}
Do NOT reimplement the command logic — invoke through the skill." --mode write`,
  run_in_background: true,
  timeout: 600000
})

STOP — wait for background callback.
```

**On callback:**
- Retrieve output: `maestro delegate output <exec_id>`
- On success → Step 8c
- On failure → Step 8d

---

### Step 8: Status Update

#### 8c. Mark Complete

```
next.status = "completed"
next.completed_at = ISO timestamp

Scan output for context propagation signals:
  PHASE: N         → session.phase = N
  scratch_dir: path → session.context.scratch_dir = path
  plan_dir: path    → session.context.plan_dir = path
  analysis_dir: path → session.context.analysis_dir = path

session.updated_at = ISO timestamp
Write status.json

Display: [{next.index}/{total}] ✓ {next.skill} completed {next.type == "external" ? "[delegate]" : ""}
```

Then self-invoke:
```
Skill({ skill: "maestro-flow", args: "--role executor" })
End.
```

#### 8d. Handle Failure

```
next.status = "failed"
next.error = "{error message}"
next.completed_at = ISO timestamp
Write status.json

Display: [{next.index}/{total}] ✗ {next.skill} failed: {error}
```

**Auto mode (session.auto_mode == true):**
```
If not next.retried:
  next.retried = true
  next.status = "pending"
  next.error = null
  Write status.json
  → Skill({ skill: "maestro-flow", args: "--role executor" })  // retry once
Else:
  next.status = "skipped"
  Write status.json
  Display: [{next.index}/{total}] ⏭ {next.skill} auto-skipped after retry
  → Skill({ skill: "maestro-flow", args: "--role executor" })  // continue
```

**Interactive mode:**
```
AskUserQuestion: "retry / skip / abort"
  retry → next.status = "pending", next.error = null
    → Skill({ skill: "maestro-flow", args: "--role executor" })
  skip  → next.status = "skipped"
    → Skill({ skill: "maestro-flow", args: "--role executor" })
  abort → session.status = "paused" → Write status.json → End.
```

### Step 9: Complete Session

When no pending steps remain:

```
session.status = "completed"
session.updated_at = ISO timestamp
Write status.json
```

Display completion report:
```
============================================================
  FLOW SESSION COMPLETE
============================================================
  Session:  {session_id}
  Chain:    {chain_name}
  Phase:    {phase}
  Steps:    {completed}/{total}

  [✓] 0.   maestro-plan 1            [internal]
  [✓] 1. ⚡ maestro-execute 1         [external]
  [✓] 2.   maestro-verify 1          [internal]
  [—] 3.   quality-auto-test 1       [skipped]
  ...
============================================================
```

Status icons: `✓` completed, `—` skipped, `✗` failed, ` ` pending.
Type badges: `⚡` external, (none) internal.

**End.**
