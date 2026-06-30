---
name: odyssey-debug
description: Long-running debug cycle — archaeology, diagnosis, fix, confirmation, generalization, discovery, and knowledge persistence
argument-hint: "<issue> [--template <name>] [--skip-fix] [--skip-generalize] [--auto] [-y] [-c] [--heartbeat]"
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
archaeology → explore → diagnose → fix & confirm → generalize → discover siblings → persist.
Exhaustive iteration until root cause confirmed or INCONCLUSIVE.
</purpose>

<boundary>
**In scope:** Single bug/issue full loop.
**Out of scope:** Features → `/odyssey-planex` | Quality review → `/odyssey-review-test-fix` | UI → `/odyssey-ui` | Architecture → `/maestro-plan`

**`--template <name>`:**

| Template | Strategy | Use case |
|----------|----------|----------|
| `performance` | profiling → hot path → allocation → cache | Performance degradation |
| `memory-leak` | heap snapshot → retention chain → lifecycle | Memory leaks |
| `race-condition` | timeline → concurrent access → lock analysis | Race conditions |
| `regression` | git bisect → diff analysis → boundary check | Regressions |
| `crash` | stack trace → null chain → error propagation | Crashes / exceptions |
</boundary>

<context>
$ARGUMENTS

**Flags:** `--skip-fix` analysis-only | `--skip-generalize` quick fix | `--template <name>` | `--auto` no delegate confirmation | `-y` auto-confirm | `-c` resume | `--heartbeat` /loop heartbeat

**Session**: `.workflow/scratch/{YYYYMMDD}-debug-odyssey-{slug}/`
**Output**: `session.json` | `evidence.ndjson` | `explore.json` | `understanding.md`

**session.json — debug-specific fields:**
```json
{ "issue": "", "diagnosis_retries": 0, "root_cause": null, "confirmation": null,
  "patterns": [], "generalization_stats": null }
```

**evidence.ndjson phases:** `archaeology|explore|diagnosis|discovery|decision|self-iteration`
- `archaeology`: `sha`, `author`, `date`, `message`, `relevance`
- `explore`: `category` (call_chain|recent_change|error_gap|similar_pattern), `detail`
- `diagnosis`: `hypothesis`, `result` (confirmed|disproved|inconclusive)
- `discovery`: `file`, `line`, `classification` (safe|risk|bug), `action` (fix|issue|decision|skip)
- `decision`: `question`, `options`, `context`, `status`, `resolution`
- `self-iteration`: `stage`, `round`, `assessment`, `expansion`

**explore.json**: `{call_chains, recent_changes, error_gaps, similar_patterns, cli_tool, timestamp}`

**phase_goals[]:**

| ID | Goal | done_when | phase | skip_when |
|----|------|-----------|-------|-----------|
| G1 | Root cause identified | phase=diagnosis result=confirmed | S_DIAGNOSE | — |
| G2 | Explore context gathered | explore.json ≥1 category | S_EXPLORE | — |
| G3 | Fix applied and confirmed | confirmation.overall == confirmed | S_CONFIRM | skip_fix |
| G4 | Pattern generalized | patterns[] ≥1 entry | S_GENERALIZE | skip_generalize |
| G5 | Discoveries triaged | all scan hits classified | S_DISCOVER | skip_generalize |
| G6 | Learnings persisted | spec entries created OR none actionable | S_RECORD | — |

**understanding.md — 9 sections:**
1. Issue & Scope ← S_INTAKE | 2. Archaeology ← S_ARCHAEOLOGY | 3. Exploration ← S_EXPLORE
4. Hypotheses ← S_DIAGNOSE | 5. Root Cause ← S_DIAGNOSE | 6. Fix & Confirmation ← S_FIX+S_CONFIRM
7. Generalization ← S_GENERALIZE | 8. Discoveries ← S_DISCOVER | 9. Learnings ← S_RECORD

**Knowledge Persistence categories (§9):**

| Category | Content | Follow-up |
|----------|---------|-----------|
| Recurring root cause pattern | Type + triggers + fix + detection | `/spec-add debug` |
| Non-obvious workaround | Problem + steps + why obvious fix fails | `/spec-add learning` |
| Architecture boundary violation | Violation + correct boundary + verification | `/spec-add arch` |
| Reusable generalization pattern | Signature + risk + fix template + scope | `/spec-add coding` |
</context>

<invariants>
1. **Evidence append-only** — never delete or overwrite evidence.ndjson entries
2. **Phase goal tracking** — mark goal done/failed before transition; no silent skips
</invariants>

<self_iteration>
Applies to: **S_ARCHAEOLOGY, S_EXPLORE, S_DIAGNOSE, S_GENERALIZE**. Logic in base.
</self_iteration>

<state_machine>

<states>
S_INTAKE → S_ARCHAEOLOGY → S_EXPLORE → S_DIAGNOSE → S_FIX → S_CONFIRM → S_GENERALIZE → S_DISCOVER → S_RECORD → END
</states>

<transitions>
S_INTAKE → S_INTAKE       : -c + session found → A_RESUME_SESSION
S_INTAKE → S_ARCHAEOLOGY  : issue parsed → A_INTAKE
S_INTAKE → S_INTAKE       : no issue, no session → AskUserQuestion

S_ARCHAEOLOGY → S_EXPLORE     : complete
S_EXPLORE     → S_DIAGNOSE    : complete

S_DIAGNOSE → S_FIX          : confirmed, !skip_fix
S_DIAGNOSE → S_GENERALIZE   : confirmed, skip_fix, !skip_generalize
S_DIAGNOSE → S_RECORD       : confirmed, skip_fix, skip_generalize
S_DIAGNOSE → S_DIAGNOSE     : all hypotheses failed, retries < 3 → A_ESCALATE_DIAGNOSIS
S_DIAGNOSE → S_RECORD       : retries >= 3 → INCONCLUSIVE

S_FIX     → S_CONFIRM       : fix implemented
S_CONFIRM → S_GENERALIZE    : confirmed, !skip_generalize
S_CONFIRM → S_RECORD        : confirmed, skip_generalize
S_CONFIRM → S_FIX           : needs_rework

S_GENERALIZE → S_DISCOVER   : similar code found
S_GENERALIZE → S_RECORD     : no similar code

S_DISCOVER → S_DIAGNOSE     : new bug → cross_phase_loops++
S_DISCOVER → S_FIX          : same-pattern bug + fix_template, !skip_fix → cross_phase_loops++
S_DISCOVER → S_RECORD       : remaining_actionable == 0
S_DISCOVER → S_RECORD       : loops >= max_loops → log per-item reasons

S_RECORD   → END            : complete
</transitions>

<actions>

### A_INTAKE
1. Parse arguments, generate slug, create SESSION_DIR
2. `maestro search "<keywords>"` + Glob prior sessions + ARCHITECTURE.md + Grep keywords
3. Derive `phase_goals[]` from flags
4. Write `session.json` + `understanding.md` §1, emit Goal Prompt

Commit: `"odyssey-debug({slug}): INTAKE — parse target and load context"`

### A_RESUME_SESSION
Glob latest session → read `session.json` → jump to `current_state`.

### A_ARCHAEOLOGY
2 parallel Agents: Timeline (`git log --oneline -20 -- {files}`) + Blame (top 3 files `git blame -L {region}`). Evidence phase=archaeology.

`maestro delegate --role analyze --mode analysis` (`run_in_background: true`):
- PURPOSE: Review recent modifications related to {issue}
- EXPECTED: JSON [{commit_sha, risk_level, analysis, could_cause_issue, explanation}]

Update §2. Commit: `"odyssey-debug({slug}): ARCHAEOLOGY — git history analysis"`

### A_EXPLORE
Skip if no CLI tools (W006).

`maestro delegate --role explore --mode analysis` (`run_in_background: true`):
- PURPOSE: Call chains, recent changes, error gaps, similar patterns
- EXPECTED: JSON {call_chains, recent_changes, error_gaps, similar_patterns}

Write `explore.json` + evidence phase=explore. Update §3. Mark G2. Commit: `"odyssey-debug({slug}): EXPLORE — codebase exploration"`

### A_DIAGNOSE
1. Hypotheses from evidence, ranked [HIGH]/[MEDIUM]/[LOW] → §4
2. Test each → evidence phase=diagnosis
3. Ambiguity → evidence phase=decision; Normal: AskUserQuestion | `-y`: defer
4. Confirmed → `session.json.root_cause` + §5. Mark G1.

Commit: `"odyssey-debug({slug}): DIAGNOSE — root cause confirmed"`

### A_ESCALATE_DIAGNOSIS
`diagnosis_retries++`. < 3: `maestro delegate --role analyze`, new hypotheses, → S_DIAGNOSE. >= 3: Normal → AskUserQuestion | `-y` → INCONCLUSIVE → S_RECORD.

### A_FIX
1. Present root cause + proposed fix. Normal: AskUserQuestion | `-y`: auto proceed
2. Implement fix, evidence phase=decision

Commit: `"odyssey-debug({slug}): FIX — {summary}"`

### A_CONFIRM
1. Run covering tests
2. `maestro delegate --role review --mode analysis` (`run_in_background: true`):
   - EXPECTED: JSON {verdict, findings [{severity, description, suggestion}], regression_risk}
3. `session.json.confirmation`: `{test_result, cli_review, overall: "confirmed|needs_rework"}`
4. Update §6. `needs_rework` → S_FIX. `confirmed` → mark G3.

Commit: `"odyssey-debug({slug}): CONFIRM — fix verified"`

### A_GENERALIZE, A_DISCOVER, A_RECORD
Base shared_actions. Debug overrides:
- **A_GENERALIZE** pattern source: root cause + fix
- **A_RECORD** learnings per Knowledge Persistence table

**Completion summary:**
```
--- DEBUG ODYSSEY COMPLETE ---
Issue:      {issue}
Root cause: {root_cause.hypothesis}
Fix:        {applied|skipped|inconclusive}
Patterns:   {patterns_extracted} ({by_layer})
Scan hits:  {total_hits} ({cross_layer_confirmed} confirmed)
Issues:     {N} created
Decisions:  {N} resolved, {M} pending, {K} deferred
Learnings:  {N} persisted
Self-iter:  {N} rounds across {M} stages
Goals:      {done}/{total} ({skipped} skipped)
---
```

</actions>

<appendix>

### `-y` debug-specific points

| Decision Point | Normal | `-y` |
|---------------|--------|------|
| A_DIAGNOSE ambiguity | AskUserQuestion | deferred |
| A_ESCALATE 3-strike | AskUserQuestion | INCONCLUSIVE |
| A_FIX direction | AskUserQuestion | auto proceed |

### Goal Prompt convergence rules

```
Stop when root cause confirmed (or INCONCLUSIVE), fix verified,
generalization exhausted, phase_goals_all_done=true.
All sibling bugs fixed or issued — no leftovers.
```

</appendix>

</state_machine>

<error_codes>
| Code | Severity | Condition | Recovery |
|------|----------|-----------|----------|
| E001 | error | No issue, no session | Provide issue or -c |
| W001 | warning | No relevant git history | Proceed |
| W002 | warning | 3 retries exhausted | INCONCLUSIVE |
| W003 | warning | Partial archaeology agent failure (Timeline or Blame) | Proceed with available results, log failed agent |
| W005 | warning | Pending decisions | Filter evidence phase=decision |
| W006 | warning | No CLI tools | Skip explore |
</error_codes>

<success_criteria>
- [ ] Session + 4 output files + prior knowledge searched
- [ ] Archaeology + CLI review → evidence phase=archaeology
- [ ] CLI exploration → explore.json + evidence phase=explore
- [ ] Hypotheses tested, root cause with evidence refs
- [ ] understanding.md 9 sections progressive
- [ ] Fix + confirmed (unless --skip-fix)
- [ ] Generalization + scan (unless --skip-generalize)
- [ ] Discoveries classified; unfixed findings individually justified
- [ ] phase_goals + goal audit + resumable via -c
- [ ] Completion summary
</success_criteria>

<next_step_routing>
| Condition | Next |
|-----------|------|
| Discovery issues | `/manage-issue list --source debug-odyssey` |
| Document pattern | `/learn-decompose <module>` |
| Formal review | `/quality-review <phase>` |
| Second opinion | `/learn-second-opinion <understanding.md>` |
| Related question | `/learn-investigate "<question>"` |
| Pending decisions | Filter evidence phase=decision status=pending |
</next_step_routing>
