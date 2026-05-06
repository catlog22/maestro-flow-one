---
name: maestro-flow
description: Unified workflow command collection — intent routing, minimal closed-loop chain selection, wave-based CSV execution. All 49 maestro commands in one skill.
argument-hint: "\"intent\" [-y] [--chain <name>] [--cmd <name> <args>] | list | status | continue | execute"
allowed-tools: spawn_agents_on_csv, Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

<purpose>
Single-entry skill packaging all 49 Maestro workflow commands.

Two execution modes:
1. **Router** (default): Analyze intent -> match chain template -> create session -> wave execution
2. **Direct** (`--cmd <name> <args>`): Load and execute a specific command inline

Execution uses `spawn_agents_on_csv` for wave-based parallel/sequential step dispatch.
Commands loaded via `maestro-flow resolve` CLI for path resolution.

Session path: `.workflow/.maestro/flow-{YYYYMMDD-HHmmss}/status.json`
</purpose>

<context>
$ARGUMENTS -- intent text, flags, or special keywords.

**State files:**
- `.workflow/state.json` -- project artifact registry (optional)
- `.workflow/.maestro/flow-*/status.json` -- flow session state
</context>

<invariants>
1. **ALL steps via spawn_agents_on_csv** -- coordinator NEVER executes skill logic directly
2. **Coordinator = prompt assembler** -- classify -> enrich args -> build CSV -> spawn -> read results -> next wave
3. **Decision nodes handled by coordinator** -- delegate-evaluate for quality gates, direct for structural
4. **Barrier = solo wave** -- analyze, plan, execute, brainstorm, roadmap always run alone
5. **Non-barriers can parallel** -- consecutive non-barrier, non-decision steps grouped into one wave
6. **Wave-by-wave** -- never start wave N+1 before wave N results are read
7. **Decision nodes NEVER appear in CSV** -- processed by coordinator between waves
</invariants>

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
    -> Phase 2 (Wave Execution Loop)

  --chain <name> [-y] <remaining>
    -> Force chain selection (skip intent analysis), go to Step 4

  -y / --yes
    -> auto_confirm = true

  Other text
    -> intent = remaining text -> Step 2
```

### Step 1a: Direct Command Execution (--cmd)

Entry point for delegate sessions and single-command execution.

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
-> Parse output for suggested chains

Display top 3 chain options to user
AskUserQuestion: select chain / single command / Cancel

If auto_confirm: pick highest scoring chain
If single command: --cmd -> Step 1a
If chain selected: -> Step 4
```

---

## Step 4: Build Session

### 4.1: Load template & build steps

```
Bash: maestro-flow chain {template_name}
-> Parse step list

Build session steps[] from template.
Decision steps get extra fields: decision, retry_count, max_retries
```

### 4.2: Create session

```
session_id = "flow-{YYYYMMDD-HHmmss}"
session_dir = .workflow/.maestro/{session_id}/

Write {session_dir}/status.json:
{
  "session_id": "{session_id}",
  "source": "flow",
  "created_at": "{ISO}", "updated_at": "{ISO}",
  "intent": "{intent}",
  "status": "running",
  "chain_name": "{template_name}",
  "task_type": "{category}",
  "phase": {phase},
  "milestone": "{current_milestone}",
  "auto_mode": {auto_confirm},
  "quality_mode": "standard",
  "passed_gates": [],
  "context": {
    "scratch_dir": null, "plan_dir": null, "analysis_dir": null
  },
  "steps": [...],
  "waves": [],
  "current_step": 0
}
```

### 4.3: Display + confirm

```
============================================================
  MAESTRO FLOW SESSION
============================================================
  Session:  {session_id}
  Chain:    {chain_name} ({total} steps)
  Phase:    {phase}

  [ ] 0. maestro-plan {phase}                [barrier]
  [ ] 1. maestro-execute {phase}             [barrier]
  [ ] 2. maestro-verify {phase}
  [ ] 3. * post-verify                       [decision]
  ...
============================================================

If auto_confirm: proceed directly
Else: AskUserQuestion -> Execute / Cancel
```

Fall through to Phase 2.

---

## Phase 2: Wave Execution Loop

### 2.1: Load session + find next step

Read status.json. Find first pending step.

- If decision node -> Step 2.2 (Decision Evaluation)
- If non-decision -> Step 2.3 (Wave Execution)
- If no pending -> Phase 3 (Completion)

### 2.2: Decision Evaluation

**Route by decision type:**
- Quality-gate decisions (post-verify, post-business-test, post-review, post-test) -> delegate analysis
- Structural decisions (post-milestone) -> direct evaluation

#### 2.2a: Delegate quality-gate assessment

```
Read decision metadata: { decision, retry_count, max_retries }

Result file mapping:
  post-verify         -> {artifact_dir}/verification.json
  post-business-test  -> {artifact_dir}/business-test-results.json
  post-review         -> {artifact_dir}/review.json
  post-test           -> {artifact_dir}/uat.md, {artifact_dir}/.tests/test-results.json

Bash({
  command: `maestro delegate "PURPOSE: evaluate ${decision} quality gate
TASK: read result files | analyze pass/fail | assess severity | recommend next step
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
```

#### 2.2b: Parse verdict & apply

```
On callback: maestro delegate output <exec_id>
Extract STATUS / REASON / GAP_SUMMARY / CONFIDENCE
If parse fails -> fallback: STATUS = "fix"

Verdict actions:
  proceed   -> add gate to passed_gates[], mark decision completed, continue
  fix       -> clear passed_gates[], insert fix-loop steps, continue
  escalate  -> session status = "paused". End.

Interactive (non-auto): AskUserQuestion before applying
Auto (-y): follow verdict directly
```

#### 2.2c: Fix-loop templates

When verdict == "fix", insert fix-loop after current position:

**post-verify:**  quality-debug -> maestro-plan --gaps -> maestro-execute -> maestro-verify -> decision:post-verify {retry+1}
**post-review:**  quality-debug -> maestro-plan --gaps -> maestro-execute -> quality-review -> decision:post-review {retry+1}
**post-test:**    quality-debug -> maestro-plan --gaps -> maestro-execute -> maestro-verify -> decision:post-verify -> quality-test -> decision:post-test {retry+1}
**post-business-test:** quality-debug -> maestro-plan --gaps -> maestro-execute -> maestro-verify -> decision:post-verify -> quality-auto-test -> decision:post-business-test {retry+1}

Insert, reindex, write status.json, continue to 2.3.

#### 2.2d: Structural decisions

**post-milestone:**
```
Read .workflow/state.json -> check next milestone
If found: update session, insert lifecycle steps for next milestone
If none: proceed, session completes naturally
```

#### 2.2e: Finalize decision

```
Mark decision step "completed"
Write status.json

STOP behavior:
  auto_mode == true  -> no STOP, continue to 2.3
  auto_mode == false -> STOP. Display: "Use $maestro-flow execute to continue"
```

### 2.3: Build and Execute Wave

**Loop while pending non-decision steps exist:**

#### 1. buildNextWave

```
Scan pending steps from current position:
  - Barrier step (analyze, plan, execute, brainstorm, roadmap)
    -> solo wave (single row CSV)
  - Non-barrier step
    -> collect consecutive non-barrier, non-decision steps (multi-row CSV)
  - Stop at first decision node
```

**Barrier list:**

| Command | Barrier |
|---------|---------|
| maestro-analyze | yes |
| maestro-plan | yes |
| maestro-execute | yes |
| maestro-brainstorm | yes |
| maestro-roadmap | yes |
| All others | no |

#### 2. buildSkillCall(step, session)

Assemble fully-resolved command for CSV:

**Placeholder resolution:**
```
{phase}        -> session.phase
{intent}       -> session.intent
{scratch_dir}  -> session.context.scratch_dir or latest artifact path
{plan_dir}     -> session.context.plan_dir
{analysis_dir} -> session.context.analysis_dir
```

**Per-skill enrichment:**

| Skill | Enrichment |
|-------|-----------|
| maestro-brainstorm | args empty -> `"{intent}"` |
| maestro-roadmap | args empty -> `"{intent}"` |
| maestro-analyze | args empty -> `{phase}` |
| maestro-plan | resolve latest analyze artifact -> `--dir .workflow/scratch/{path}` |
| maestro-execute | resolve latest plan artifact -> `--dir .workflow/scratch/{path}` |
| quality-debug | append gap_summary context |
| quality-* / maestro-verify / milestone-* | args empty -> `{phase}` or empty |

**Auto flag propagation (if auto_mode == true):**

| Skill | Flag |
|-------|------|
| maestro-init | -y |
| maestro-analyze | -y |
| maestro-brainstorm | -y |
| maestro-roadmap | -y |
| maestro-plan | -y |
| maestro-execute | -y |
| quality-auto-test | -y |
| quality-test | -y --auto-fix |
| maestro-milestone-complete | -y |

Result: `$maestro-flow --cmd <skill-name> <enriched-args> [auto-flag]`

#### 3. Write wave CSV

```
Write {sessionDir}/wave-{N}.csv:

id,skill_call,topic
"0","$maestro-flow --cmd maestro-plan 1 -y","Flow step 0/8: plan phase 1"
"1","$maestro-flow --cmd maestro-execute 1 -y","Flow step 1/8: execute phase 1"
```

Rules:
- `skill_call`: `$maestro-flow --cmd <skill> <args>` (routes through this skill's --cmd)
- `topic`: human-readable step description
- Non-barrier + non-decision -> multi-row (parallel)
- Barrier -> single-row (solo)
- Decision nodes NEVER appear in CSV

#### 4. Spawn

```
spawn_agents_on_csv({
  csv_path: "{sessionDir}/wave-{N}.csv",
  id_column: "id",
  instruction: WAVE_INSTRUCTION,
  max_workers: <wave_size>,
  max_runtime_seconds: 3600,
  output_csv_path: "{sessionDir}/wave-{N}-results.csv",
  output_schema: RESULT_SCHEMA
})
```

**Sub-Agent Instruction:**
```
You are a CSV job sub-agent in a maestro-flow pipeline.

Execute the skill call: {skill_call}
Task: {topic}

Rules:
- Do NOT modify .workflow/.maestro/ status files
- The skill has its own session management
- Execute the command completely

Report result:
{"status":"completed|failed","skill_call":"{skill_call}","summary":"one-line result","artifacts":"artifact paths","error":"failure reason"}
```

**Result Schema:** `{ status, skill_call, summary, artifacts, error }` -- all string

#### 5. Read results & update

```
Read wave-{N}-results.csv
For each result row:
  Match to step by id
  If status == "completed":
    step.status = "completed"
    step.completed_at = now
  If status == "failed":
    step.status = "failed"
    step.error = result.error
```

#### 6. Barrier context update

After barrier wave completes, read outputs and update session context:

| Barrier | Read | Update |
|---------|------|--------|
| maestro-analyze | context.md, state.json | context.analysis_dir |
| maestro-plan | plan.json | context.plan_dir |
| maestro-execute | results | context.scratch_dir |
| maestro-brainstorm | .brainstorming/ | context.brainstorm_dir |
| maestro-roadmap | specs/ | context.spec_session_id |

#### 7. Persist & continue

```
Write status.json
Record wave in session.waves[]

Failure check:
  -y: retry once, then skip and continue
  non-y: mark remaining skipped, pause, STOP

Next step check:
  Decision node -> loop to 2.2
  More external steps -> loop to 2.3 step 1
  No pending -> Phase 3
```

---

## Phase 3: Completion

```
session.status = "completed"
Write status.json

Display:
============================================================
  FLOW COMPLETE
============================================================
  Session:  {session_id}
  Chain:    {chain_name}
  Phase:    {phase}
  Waves:    {wave_count} executed
  Steps:    {completed}/{total} ({skipped} skipped)

  [+] 0. maestro-plan 1            [W1]
  [+] 1. maestro-execute 1         [W2]
  [+] 2. maestro-verify 1          [W3]
  [+] 3. * post-verify -> proceed  [decision]
  [~] 4. quality-auto-test 1       [skipped]
  [+] 5. quality-review 1          [W4]
  ...
============================================================
```

</execution>

<csv_schema>
### wave-{N}.csv

```csv
id,skill_call,topic
"0","$maestro-flow --cmd maestro-verify 1","Flow step 2/8: verify phase 1"
"1","$maestro-flow --cmd quality-review 1","Flow step 3/8: review phase 1"
```

### Result Schema

`{ status, skill_call, summary, artifacts, error }` -- all string
</csv_schema>

<error_codes>
| Code | Severity | Description | Recovery |
|------|----------|-------------|----------|
| E001 | error | No intent and no running session | Prompt for intent |
| E002 | error | Command not found for --cmd | maestro-flow list |
| E003 | error | No matching chain template | maestro-flow chains |
| E004 | error | Delegate verdict parse failed | Fallback: treat as "fix" |
| E005 | error | Wave timeout | Mark step failed, pause |
| W001 | warning | Multiple chains match equally | Show top 3 |
</error_codes>

<success_criteria>
- [ ] --cmd resolves via maestro-flow CLI, executes command inline
- [ ] list/status/chains/suggest route to maestro-flow CLI
- [ ] Intent analysis -> chain matching -> session creation
- [ ] Wave execution via spawn_agents_on_csv with CSV skill_call format
- [ ] Barrier steps solo wave, non-barriers parallel
- [ ] Decision nodes evaluated between waves (never in CSV)
- [ ] Quality-gate decisions delegate-evaluated, structural evaluated directly
- [ ] Fix-loop insertion + reindex on "fix" verdict
- [ ] passed_gates tracking, retry_count enforcement
- [ ] Context propagation after barrier waves
- [ ] Auto mode: skip confirmation, auto-follow verdicts, retry+skip on failure
</success_criteria>
