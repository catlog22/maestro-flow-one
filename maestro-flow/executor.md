# Flow Executor -- CLI-Driven Step Execution

Single-step executor for flow sessions. Uses `flow_cli.py next` to load the next command and `flow_cli.py done` to mark completion and advance.

**Execution loop:**
```
flow_cli.py next  ->  load command  ->  execute  ->  flow_cli.py done  ->  self-invoke
```

## Execution

### Step 1: Load Next Step

```
result = Bash: python {skill_dir}/tools/flow_cli.py next

Parse output lines:
  "NO_SESSION"       -> "No running flow session. Use /maestro-flow to create." End.
  "SESSION_COMPLETE" -> Display completion summary. End.
  "STEP: idx/total"  -> continue parsing
  "TYPE: internal|external|decision"
  "SKILL: command-name"
  "ARGS: arguments"
  "DECISION: post-verify|post-review|..."  (decision only)
  "RETRY: N/M"                             (decision only)
  "PATH: /absolute/path/to/command.md"     (internal/external only)
  "---COMMAND---"
  ... command .md content follows ...
```

Display step banner:
```
------------------------------------------------------------
  [idx/total] skill-name [type]
------------------------------------------------------------
  Session: (from status)
  Args: arguments
```

### Step 2: Route by Type

```
If TYPE == "decision" -> Step 3 (Decision Evaluation)
If TYPE == "internal" -> Step 4 (Internal Execution)
If TYPE == "external" -> Step 5 (External Execution)
```

---

### Step 3: Decision Evaluation (via Agent)

#### 3.1: Resolve artifact directory

```
Read .workflow/state.json
Filter artifacts: milestone == session.milestone, phase == session.phase
Sort by created_at DESC -> take first

artifact_dir = .workflow/scratch/{artifact.path}/
Fallback: glob .workflow/scratch/*-P{phase}-*/ sorted by date DESC
```

#### 3.2: Structural vs Quality-gate

**Structural decisions (post-milestone)** -- evaluate directly:

```
post-milestone:
  Read .workflow/state.json -> check next milestone
  If found: advance session, insert new steps
  If none: proceed
```

**Quality-gate decisions** -- delegate to Agent:

```
Read chains/templates.json -> decision_types[DECISION]
  -> evaluates: result file name(s)

Agent({
  subagent_type: "general-purpose",
  prompt: "Evaluate {DECISION} quality gate.

Read: {artifact_dir}/{evaluates}

Output strictly:
---VERDICT---
STATUS: proceed | fix | escalate
REASON: one-line
GAP_SUMMARY: details (fix/escalate only)
CONFIDENCE: high | medium | low
---END---

Rules:
- proceed: gate passed
- fix: fixable issues found
- escalate: critical or retry {RETRY} at max
",
  description: "evaluate {DECISION} gate"
})
```

#### 3.3: Apply verdict

| Verdict | Action |
|---------|--------|
| `proceed` | Mark done -> Step 6 |
| `fix` | Insert fix-loop from decision_types -> mark done -> Step 6 |
| `escalate` | Set session paused. End. |

**Interactive (non-auto):** AskUserQuestion before applying.

**Fix-loop insertion:**
```
Read fix_loop commands from decision_types[DECISION]
Insert as new pending steps after current position
Reindex all steps
Write status.json
```

Mark decision done -> Step 6.

---

### Step 4: Internal Execution (script-loaded)

The command content was already loaded by `flow_cli.py next` (after `---COMMAND---`).

```
1. Parse the loaded command .md content
2. Set $ARGUMENTS = ARGS from step output
3. Follow the command's <execution> section completely

Auto flag propagation (when session.auto_mode == true):
  | Skill              | Flag appended     |
  |--------------------|-------------------|
  | maestro-init       | -y                |
  | maestro-analyze    | -y                |
  | maestro-brainstorm | -y                |
  | maestro-roadmap    | -y                |
  | maestro-plan       | -y                |
  | maestro-execute    | -y                |
  | quality-auto-test  | -y                |
  | quality-test       | -y --auto-fix     |
  | maestro-milestone-complete | -y        |

  Append flag to $ARGUMENTS before execution.

On success -> Step 6 (Mark Done)
On failure -> Step 7 (Handle Failure)
```

---

### Step 5: External Execution (delegate via /maestro-flow --cmd)

```
Bash({
  command: `maestro delegate --to claude "Execute: /maestro-flow --cmd {SKILL} {ARGS}

You are a delegate session executing a flow pipeline step.
Use Skill() to invoke: /maestro-flow --cmd {SKILL} {ARGS}
Do NOT reimplement the command logic." --mode write`,
  run_in_background: true,
  timeout: 600000
})

STOP -- wait for background callback.
```

**On callback:**
- Retrieve output: `maestro delegate output <exec_id>`
- On success -> Step 6
- On failure -> Step 7

---

### Step 6: Mark Done & Advance

```
Bash: python {skill_dir}/tools/flow_cli.py done

Parse output:
  "COMPLETED: idx skill-name"  -> display confirmation
  "NEXT: idx skill-name [type]" -> there are more steps
  "SESSION_COMPLETE"           -> all steps done, display summary. End.
```

If more steps, self-invoke:
```
Skill({ skill: "maestro-flow", args: "--role executor" })
End.
```

---

### Step 7: Handle Failure

```
Bash: python {skill_dir}/tools/flow_cli.py step {session_id} {idx} failed
```

**Auto mode:**
```
Reset step to pending:
  Bash: python flow_cli.py step {session_id} {idx} pending
  -> Skill({ skill: "maestro-flow", args: "--role executor" })  // retry once

If already retried:
  Bash: python flow_cli.py step {session_id} {idx} skipped
  -> Skill({ skill: "maestro-flow", args: "--role executor" })  // continue
```

**Interactive mode:**
```
AskUserQuestion: "retry / skip / abort"
  retry -> step pending -> self-invoke
  skip  -> step skipped -> self-invoke
  abort -> session paused -> End.
```
