---
name: odyssey-planex
description: Requirement-driven iterative cycle — plan, execute, strict verify, fix loop until acceptance criteria met
argument-hint: "<requirement> [--template <name>] [--max-iterations N] [--skip-generalize] [--auto] [--method agent|cli|auto] [--executor <tool>] [--skip-verify] [--heartbeat] [-y] [-c]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
---
<base>@~/.maestro/workflows/odyssey-base.md</base>

<purpose>
Requirement-to-delivery closed loop: parse requirement → define acceptance criteria →
plan → execute → verify → fix gaps → iterate until ALL criteria pass.
</purpose>

<boundary>
**In scope:** Single requirement delivery loop — from requirement parsing to all acceptance criteria passing + generalization.
**Out of scope:** Multi-requirement orchestration → `/maestro-roadmap` | Deep debugging → `/odyssey-debug` | Code review → `/odyssey-review-test-fix` | UI optimization → `/odyssey-ui`

**`--template <name>`:**

| Template | Criteria pattern | Use case |
|----------|-----------------|----------|
| `feature` | User story acceptance + boundary tests + UI verification | New feature |
| `bugfix` | Regression tests + root cause confirmation + boundary coverage | Bug fix |
| `refactor` | Behavior preservation + performance baseline + API compatibility | Refactoring |
| `migration` | Data consistency + rollback verification + performance comparison | Data/API migration |
| `api-endpoint` | Request/response contract + error handling + permission checks | API development |
</boundary>

<context>
$ARGUMENTS

**Flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `--template <name>` | Predefined requirement template | — |
| `--max-iterations N` | Max verify-fix cycles before escalation | 3 |
| `--skip-generalize` | Skip S_GENERALIZE + S_DISCOVER | false |
| `--auto` | CLI delegate calls without confirmation | false |
| `--method agent\|cli\|auto` | Execution method | `auto` |
| `--executor <tool>` | Explicit executor tool for CLI delegate | First enabled |
| `--skip-verify` | Skip post-execution validation gate | false |
| `--heartbeat` | Enable periodic progress heartbeat | false |
| `-y` | Auto-confirm — decisions recorded as `deferred` | false |
| `-c` | Resume most recent session | — |

**Session**: `.workflow/scratch/{YYYYMMDD}-planex-odyssey-{slug}/`
**Output**: `session.json` | `evidence.ndjson` | `understanding.md`

**session.json — planex-specific fields:**
```json
{ "requirement": "",
  "acceptance_criteria": [{"id":"AC1","criterion":"","verify_method":"test|grep|cli-review|manual","status":"pending","evidence":"","passed_at":null}],
  "plan": {"tasks":[{"id":"T1","title":"","description":"","criteria_refs":["AC1"],"status":"pending","files_modified":[],"domain":"general","executor":"agent"}],"created_at":""},
  "execution_config": {"method":"auto","default_executor":"","domain_routing":{"frontend":"","backend":"","default":"agent"},"code_review_tool":"Skip","verification_tool":"Auto","confirmed":false},
  "iterations": [{"iteration":1,"started_at":"","completed_at":"","criteria_before":{"passed":0,"total":0},"criteria_after":{"passed":0,"total":0},"gaps_fixed":[],"files_modified":[]}],
  "current_iteration": 0,
  "patterns": [{"id":"P1","source":"AC1 fix","layer":"syntax|semantic|structural","signature":"","description":"","risk":"","fix_template":""}],
  "generalization_stats": "-> base shared_schemas" }
```

**evidence.ndjson phases:** `planning|execution|verification|fix|decision|generalization|discovery|self-iteration`

**understanding.md — 8 sections:**
1. Requirement & Criteria <- S_INTAKE | 2. Plan <- S_PLAN | 3. Execution <- S_EXECUTE
4. Verification <- S_VERIFY | 5. Fix Log <- S_FIX | 6. Generalization <- S_GENERALIZE
7. Discoveries <- S_DISCOVER | 8. Learnings <- S_RECORD

**phase_goals[]:**

| ID | Goal | done_when | phase | skip_when |
|----|------|-----------|-------|-----------|
| G1 | Acceptance criteria defined | >=1 criterion in acceptance_criteria[] | S_INTAKE | — |
| G2 | Plan created | session.json.plan populated | S_PLAN | — |
| G3 | Implementation complete | all plan tasks executed | S_EXECUTE | — |
| G4 | All criteria pass | all acceptance_criteria[].status == passed | S_VERIFY | — |
| G5 | Pattern generalized | patterns[] >=1 entry | S_GENERALIZE | skip_generalize |
| G6 | Discoveries triaged | all scan hits classified | S_DISCOVER | skip_generalize |
| G7 | Learnings persisted | spec entries created OR no actionable | S_RECORD | — |

**Knowledge Persistence (written to understanding.md section 8):**

| Category | Content | Follow-up |
|----------|---------|-----------|
| Multi-round fix cycle pattern | Problem scenario + fix iteration + final approach | `/spec-add debug` |
| Reusable implementation pattern | Pattern + applicable scope + code template | `/spec-add coding` |
| Acceptance criteria template | Standard template + verify_method suggestion | `/spec-add review` |
| Generalization pattern | Signature + risk + fix template | `/spec-add coding` |
</context>

<invariants>
Base execution_discipline #1-5.
6. **Acceptance criteria are sacred** — no "close enough", no manual override without explicit escalation
</invariants>

<self_iteration>
Applies to: **S_PLAN, S_VERIFY, S_GENERALIZE**. Logic in base.
</self_iteration>

<state_machine>

<states>
S_INTAKE → S_PLAN → S_EXECUTE → S_VERIFY → S_FIX → S_GENERALIZE → S_DISCOVER → S_RECORD → END
</states>

<transitions>
S_INTAKE → S_INTAKE       : -c + session found (resume)
S_INTAKE → S_PLAN         : requirement + criteria defined
S_INTAKE → S_INTAKE       : no requirement → AskUserQuestion

S_PLAN    → S_EXECUTE
S_EXECUTE → S_VERIFY

S_VERIFY → S_GENERALIZE   : all passed AND NOT skip_generalize
S_VERIFY → S_RECORD       : all passed AND skip_generalize
S_VERIFY → S_FIX          : some failed AND iteration < max
S_VERIFY → S_PLAN         : fundamental plan flaw → cross_phase_loops++ (replan). **Criteria preservation:** acceptance_criteria[] statuses are preserved; only plan.tasks[] are regenerated. Previously passed criteria retain `passed` status; failed criteria reset to `pending` for re-verification after new plan execution.
S_VERIFY → S_RECORD       : some failed AND iteration >= max (escalate)

S_FIX → S_VERIFY (loop)

S_GENERALIZE → S_DISCOVER : hits found
S_GENERALIZE → S_RECORD   : no hits

S_DISCOVER → S_EXECUTE    : discovery finds area needing same implementation → cross_phase_loops++
S_DISCOVER → S_RECORD     : triage complete AND remaining_actionable == 0
S_DISCOVER → S_RECORD     : loops >= max_loops → log per-item reasons

S_RECORD → END
</transitions>

<actions>

### A_INTAKE

1. Parse requirement and flags, generate slug, create SESSION_DIR
2. **Define acceptance criteria** — analyze requirement → derive testable criteria. Each gets `verify_method`: test | grep | cli-review | manual
   - Normal: AskUserQuestion to confirm/edit
   - `-y`: auto-derive, record `{"phase":"decision","type":"criteria-confirmation","status":"deferred"}`
3. Search prior knowledge: `maestro search`, related sessions
4. Write session.json + understanding.md section 1. Mark G1 done. Emit Goal Prompt.

Commit: `"odyssey-planex({slug}): INTAKE — parse requirement and define criteria"`

### A_PLAN

1. Decompose requirement into ordered tasks mapped to acceptance criteria
2. CLI-assisted planning (optional):
   ```bash
   maestro delegate "PURPOSE: Create implementation plan for: {requirement}
   TASK: Decompose into subtasks | Map to acceptance criteria | Identify dependencies
   MODE: analysis
   CONTEXT: @**/* | Criteria: {criteria_summary}
   EXPECTED: JSON [{task_id, title, description, criteria_refs, deps}]
   " --role analyze --mode analysis
   ```
   Run with `run_in_background: true`, wait for callback.
3. Write session.json.plan, append evidence (planning), update understanding.md section 2. Mark G2 done.

Commit: `"odyssey-planex({slug}): PLAN — create execution plan"`

### A_EXECUTE

#### Step 1: Execution Options Confirmation

**Skip if** `-y` flag OR `--method` explicitly set OR `execution_config.confirmed == true` (resume).

Load available tools: `maestro delegate-config show --json`.

Present AskUserQuestion with 3 questions:
1. **Executor** — Auto (domain routing) | Agent (all tasks) | specific CLI tool | Other (custom domain routing)
2. **Review** — Skip | {tool} review (git diff quality check)
3. **Verify** — Auto (delegate convergence + structure + anti-pattern check) | specific tool | Skip

Parse response → write `execution_config` to session.json, set `confirmed: true`. `--skip-verify` overrides verification to `"Skip"`.

#### Step 2: Executor Resolution

Per-task domain routing (when method == "auto"):

| Domain | Keywords / Patterns | Extensions |
|--------|-------------------|------------|
| frontend | UI, component, page, style, layout, CSS, view | .tsx/.jsx/.vue/.css/.html/.svelte |
| backend | API, server, database, service, algorithm, worker | .go/.rs/.java/.py/.sql/.proto |
| general | mixed, config, tests, unclear | .ts/.js/other |

Resolution: `execution_config.domain_routing[domain]` → fallback `domain_routing.default` ("agent").

#### Step 3: Task Execution

Execute tasks per plan order. Independent tasks may run in parallel.

**Agent path:**
```
Spawn Agent with: task definition, acceptance criteria refs, prior task summaries, specs_content
Agent implements → verifies convergence → auto-fix (max 3) → returns result
```

**CLI path:**
```bash
maestro delegate "PURPOSE: Implement task ${task_id}: ${title}; success = criteria ${criteria_refs} satisfied
TASK: ${description} | Read existing code first | Verify convergence criteria after changes
MODE: write
CONTEXT: @${scope}/**/* | Criteria: ${criteria_summary}
EXPECTED: Working code changes, convergence evidence, summary of what was done
CONSTRAINTS: Scope limited to task files | Follow project specs

## Acceptance Criteria (must satisfy)
${criteria_refs.map(ref => criteria[ref].criterion).join('\n')}

## Implementation Steps
${task.description}

## Project Specs
${specs_content}

## Prior Task Summaries
${prior_summaries}
" --to ${resolved_executor} --mode write --id planex-${slug}-${task_id}
```

Run with `run_in_background: true`, wait for callback.

**Deviation Rule** — max 3 auto-fix attempts per task:
1. First attempt: normal dispatch
2. Retry: `--resume planex-${slug}-${task_id}` with simplified prompt
3. Final: fallback to Agent path
4. All 3 fail → mark task `blocked`, record checkpoint, continue remaining tasks

#### Step 4: Per-Task Evidence

Per completed task:
- Record evidence: `{"phase":"execution","type":"task-completed","task_id":"T1","executor":"agent|agy|...","files_modified":[],"summary":"","attempt":1}`
- Update task status in session.json plan

#### Step 5: Post-Execution Validation

**Skip if** `execution_config.verification_tool == "Skip"` OR `--skip-verify` OR no completed tasks.

**Check 1: Summary Consistency** — cross-check task status vs actual file changes (git diff).

**Check 2: CLI Verification Gate** — delegate to external model:
```bash
maestro delegate "PURPOSE: Verify execution output meets acceptance criteria; success = all criteria verified with file:line evidence
TASK:
1. CONVERGENCE: For each criterion, read actual code, verify behavior exists, report status with evidence
2. EXISTENCE: Verify all expected files exist on disk
3. SUBSTANCE: Verify real implementation — flag stubs, placeholders, TODO-only
4. ANTI-PATTERNS: Scan for TODO/FIXME/HACK, console.log debug, disabled tests
MODE: analysis
CONTEXT: @${modified_files}
EXPECTED: JSON { convergence: [{criterion, status, evidence}], issues: [{type, file, line, severity}], overall: passed|gaps_found }
CONSTRAINTS: Read-only | Check ALL criteria exhaustively | Evidence must be file:line

## Acceptance Criteria (verify each)
${acceptance_criteria.map(c => c.criterion).join('\n')}

## Modified Files
${modified_files.join('\n')}
" --to ${execution_config.verification_tool} --mode analysis
```

Run with `run_in_background: true`, wait for callback.

On result:
- `overall == "passed"` → proceed to S_VERIFY with boosted confidence
- `overall == "gaps_found"` → log findings, proceed to S_VERIFY

**Check 3: Code Review** (if `execution_config.code_review_tool != "Skip"`):
```bash
maestro delegate "Review git diff for correctness, style, bugs" --to ${code_review_tool} --mode analysis --rule analysis-review-code-quality
```

#### Step 6: Completion

Update understanding.md section 3. Mark G3 done.

Commit: `"odyssey-planex({slug}): EXECUTE — implementation complete"`

### A_VERIFY

Iron gate — every acceptance criterion checked objectively.

**Verify each criterion by method:**

| Method | Action |
|--------|--------|
| `test` | Run relevant tests, check pass/fail |
| `grep` | Grep for expected pattern |
| `cli-review` | `maestro delegate "PURPOSE: Verify criterion {criterion_id}: {criterion}\nTASK: Read implementation code \| Check behavior matches criterion \| Report pass/fail with file:line evidence\nMODE: analysis\nCONTEXT: @{relevant_files}\nEXPECTED: JSON {criterion_id, status: passed\|failed, evidence: [{file, line, detail}]}" --role review --mode analysis` |
| `manual` | Normal: AskUserQuestion / `-y`: record `deferred` |

Record per criterion: `{"phase":"verification","type":"criterion-check","criterion_id":"AC1","method":"","result":"passed|failed","evidence":"","iteration":N}`. Update acceptance_criteria[].status. Append to iterations[].

Update understanding.md section 4 with pass/fail table.

**Route:** all passed → mark G4 done → next state. Some failed + iteration < max → S_FIX. Some failed + iteration >= max → Normal: AskUserQuestion (continue/lower bar/accept) / `-y`: `deferred`, proceed S_RECORD.

Commit: `"odyssey-planex({slug}): VERIFY — acceptance check"`

### A_FIX

1. Increment current_iteration
2. For each failed criterion: diagnose gap → targeted code fix
3. CLI fix review (optional):
   ```bash
   maestro delegate "PURPOSE: Review fixes for failing criteria; success = no regressions and fixes correct
   TASK: Check fix correctness | Verify no regressions on passing criteria | Report verdict with file:line evidence
   MODE: analysis
   CONTEXT: @{modified_files} | Passing: {passing} | Fixed: {fixed}
   EXPECTED: JSON {verdict: passed|concerns_found, regression_risk: low|medium|high, concerns: [{criterion_id, file, line, description}]}
   CONSTRAINTS: Read-only | Check ALL passing criteria for regressions
   " --role review --mode analysis
   ```
4. Append evidence (fix), update understanding.md section 5 → S_VERIFY

Commit: `"odyssey-planex({slug}): FIX — targeted fix for failing criteria"`

### A_GENERALIZE

Base shared_actions. Pattern source: implementation patterns.

Commit: `"odyssey-planex({slug}): GENERALIZE — pattern scan complete"`

### A_DISCOVER

Base shared_actions. Planex override: discovery finding needing same implementation → route back to S_EXECUTE (not S_FIX).

Commit: `"odyssey-planex({slug}): DISCOVER — findings classified"`

### A_RECORD

Base shared_actions. Planex additions:
1. Iteration summary: what worked, what needed rework, fix cycle patterns
2. Learnings structured per Knowledge Persistence table: problem scenario + fix iteration process + final approach + applicable scope

**Completion summary:**
```
--- PLANEX ODYSSEY COMPLETE ---
Requirement: {requirement}
Criteria:    {passed}/{total} passed
Iterations:  {N} cycles
Patterns:    {patterns_extracted} ({by_layer} distribution)
Scan hits:   {total_hits} ({cross_layer_confirmed} cross-layer confirmed)
Issues:      {N} created | Decisions: {N} resolved, {M} pending, {K} deferred
Learnings:   {N} spec entries
Self-iter:   {N} rounds across {M} stages
Goals:       {done}/{total} confirmed ({skipped} skipped)
Status:      {ALL_PASSED|PARTIAL|ESCALATED}
---
```

Commit: `"odyssey-planex({slug}): RECORD — session summary"`

</actions>

<appendix>

### `-y` planex-specific points

| Decision Point | Normal | `-y` |
|---------------|--------|------|
| S_INTAKE criteria confirmation | AskUserQuestion | auto-derive, `deferred` |
| S_EXECUTE execution options | AskUserQuestion | use defaults (auto/Skip/Auto), `confirmed: true` |
| S_EXECUTE task blocked (3 retries) | AskUserQuestion: continue or stop | auto continue, log blocked |
| S_VERIFY manual criterion | AskUserQuestion | `deferred` |
| S_VERIFY max iteration reached | AskUserQuestion | auto accept, `deferred` |

### Goal Prompt convergence rules

```
Exhaustive iteration: until all acceptance_criteria[*].status==passed
AND phase_goals_all_done=true. Verify failure auto-triggers fix->re-verify loop.
Each fix round re-verifies; new criterion violations continue fixing within max_iterations.
No "close enough" — all criteria must ALL pass.
```

### Iteration Model

```
S_EXECUTE → S_VERIFY ──all pass──→ S_GENERALIZE → S_DISCOVER → S_RECORD
                │                       │
           some fail + iter < max       no hits ─→ S_RECORD
                ▼
             S_FIX ──→ S_VERIFY (loop)
```

Max iterations (default 3) prevents infinite loops. Each iteration records criteria_before, gaps_fixed, criteria_after.

</appendix>

</state_machine>

<error_codes>
| Code | Severity | Condition | Recovery |
|------|----------|-----------|----------|
| E001 | error | No requirement provided | Provide requirement |
| W001 | warning | No acceptance criteria derived | Manual definition needed |
| W002 | warning | Max iterations reached, criteria still failing | Escalate to user |
| W003 | warning | CLI review regression concern | Review before next iteration |
</error_codes>

<success_criteria>
- [ ] Requirement parsed with >=1 acceptance criterion (verify_method assigned)
- [ ] Plan tasks mapped to criteria; execution options confirmed
- [ ] Tasks dispatched via resolved executor with deviation rule (max 3 retries)
- [ ] Post-execution validation gate run (unless --skip-verify)
- [ ] Every criterion verified per method; failing → targeted fix (not re-implementation)
- [ ] Iteration count tracked and max respected; unfixed criteria individually classified
- [ ] understanding.md sections 1-8 updated per phase; phase_goals G1-G7 audited
- [ ] Generalization + discovery completed (unless --skip-generalize)
- [ ] Quality Gate self-iteration triggered when insufficient
- [ ] Goal Prompt displayed once after intake; `-y` mode: no blocking prompts
- [ ] Session resumable via -c; completion summary output
</success_criteria>

<next_step_routing>
| Condition | Next |
|-----------|------|
| All criteria passed | `/odyssey-review-test-fix <changed-files>` |
| Max iterations, still failing | `/odyssey-debug "<failing criterion>"` |
| Formal review | `/quality-review <phase>` |
| Issues from discoveries | `/manage-issue list --source planex-odyssey` |
| Pattern worth documenting | `/learn-decompose <module>` |
</next_step_routing>
</output>
