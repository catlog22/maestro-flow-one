---
name: odyssey-review-test-fix
description: Deep review + fix cycle — archaeology, exploration, multi-dimensional review, targeted fix, generalization, discovery, and knowledge persistence
argument-hint: "<target> [--dimensions <list>] [--fix-threshold critical|high|medium|low|all] [--skip-fix] [--skip-generalize] [--auto] [-y] [-c] [--heartbeat]"
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
archaeology → explore → multi-dimensional review → fix ALL findings → confirm → generalize → discover → persist. Zero-residual: every finding gets an action.
</purpose>

<boundary>
**In scope:** Multi-dimensional deep review of target code → exhaustive fix ALL findings by severity → generalize patterns project-wide.
**Out of scope:** Root cause debug → `/odyssey-debug` | Feature implementation → `/odyssey-planex` | UI visual optimization → `/odyssey-ui`

**Exploration freedom:** Free within boundary — cross-dimension correlation, git history tracing, project-wide generalization scan. Fix ALL findings within fix_threshold (default: all).
**Zero-residual:** Every finding MUST have a concrete action (fix / issue / decision). "Report and shelve" and "pre-existing skip" are forbidden.
</boundary>

<context>
$ARGUMENTS

**Target resolution:**

| Input | Resolution |
|-------|-----------|
| File/dir path | Review those files |
| `HEAD` / `staged` | `git diff HEAD` / `git diff --staged` |
| Phase number | state.json → changed files |
| PR number | `git diff main...HEAD` |

**Flags:** `--dimensions <list>` subset of review dimensions | `--fix-threshold <level>` severity cutoff (default: all) | `--skip-fix` skip S_FIX+S_CONFIRM | `--skip-generalize` skip S_GENERALIZE+S_DISCOVER | `--auto` no delegate confirmation | `-y` auto-confirm | `-c` resume | `--heartbeat` /loop heartbeat

**Session**: `.workflow/scratch/{YYYYMMDD}-review-odyssey-{slug}/`
**Output**: `session.json` | `evidence.ndjson` | `explore.json` | `understanding.md`

**session.json — review-specific fields:**
```json
{ "target": "", "dimensions": [], "review_result": {"remaining_actionable": 0},
  "patterns": [], "confirmation": null, "generalization_stats": null }
```

**evidence.ndjson phases:** `archaeology|explore|review|fix|discovery|decision|self-iteration`

**phase_goals[]:**

| ID | Goal | done_when | phase | skip_when |
|----|------|-----------|-------|-----------|
| G1 | Review completed | all dimensions reviewed | S_REVIEW | — |
| G2 | Explore context | explore.json populated | S_EXPLORE | — |
| G3 | Zero remaining | `remaining_actionable == 0` | S_CONFIRM | skip_fix |
| G4 | Pattern generalized | patterns[] >=1 | S_GENERALIZE | skip_generalize |
| G5 | Discoveries triaged | all hits classified | S_DISCOVER | skip_generalize |
| G6 | Learnings persisted | spec entries or no actionable | S_RECORD | — |

**understanding.md — 8 sections:**
1. Target & Scope ← S_INTAKE | 2. Archaeology ← S_ARCHAEOLOGY | 3. Exploration ← S_EXPLORE
4. Review Results ← S_REVIEW | 5. Fix & Confirmation ← S_FIX+S_CONFIRM
6. Generalization ← S_GENERALIZE | 7. Discoveries ← S_DISCOVER | 8. Learnings ← S_RECORD

Specs: `maestro load --type spec --category review`

**Knowledge Persistence categories (section 8):**

| Category | Content | Follow-up |
|----------|---------|-----------|
| Cross-dimension recurring pattern | Pattern + affected dimensions + coding standard | `/spec-add review` |
| Security finding | Vulnerability type + triggers + fix approach | `/spec-add debug` |
| Architecture violation pattern | Violation + correct boundary + verification | `/spec-add arch` |
| Reusable generalization pattern | Signature + risk + fix template + scope | `/spec-add coding` |
</context>

<invariants>
All invariants defined in base.
</invariants>

<self_iteration>
Applies to: **S_ARCHAEOLOGY, S_EXPLORE, S_REVIEW, S_FIX, S_GENERALIZE**. Logic in base.
</self_iteration>

<state_machine>

<states>
S_INTAKE → S_ARCHAEOLOGY → S_EXPLORE → S_REVIEW → S_FIX → S_CONFIRM → S_GENERALIZE → S_DISCOVER → S_RECORD → END
</states>

<transitions>
S_INTAKE → S_INTAKE       : -c + session found → A_RESUME_SESSION
S_INTAKE → S_ARCHAEOLOGY  : target resolved → A_INTAKE
S_INTAKE → S_INTAKE       : no target → AskUserQuestion

S_ARCHAEOLOGY → S_EXPLORE     : complete
S_EXPLORE     → S_REVIEW      : complete

S_REVIEW  → S_FIX          : !skip_fix AND findings
S_REVIEW  → S_GENERALIZE   : skip_fix OR no findings, !skip_generalize
S_REVIEW  → S_RECORD       : both skip

S_FIX     → S_CONFIRM      : tier complete
S_CONFIRM → S_GENERALIZE   : confirmed, !skip_generalize
S_CONFIRM → S_RECORD       : confirmed, skip_generalize
S_CONFIRM → S_FIX          : needs_rework

S_GENERALIZE → S_DISCOVER  : similar code found
S_GENERALIZE → S_RECORD    : no similar code

S_DISCOVER → S_FIX         : fixable sibling → cross_phase_loops++
S_DISCOVER → S_REVIEW      : new target, loops < max_loops → cross_phase_loops++
S_DISCOVER → S_RECORD      : remaining_actionable == 0 OR loops >= max_loops
</transitions>

<actions>

### A_INTAKE
1. Parse target + flags → file list. Create SESSION_DIR, derive phase_goals[]
2. `maestro search "<keywords>"` + Glob prior sessions + ARCHITECTURE.md + Grep keywords
3. Write `session.json` + `understanding.md` section 1, emit Goal Prompt

Commit: `"odyssey-review({slug}): INTAKE — parse target and load context"`

### A_RESUME_SESSION
Glob latest session → read `session.json` → jump to `current_state`.

### A_ARCHAEOLOGY
2 parallel Agents: Timeline (`git log --oneline -20 -- {files}`) + Blame (top 3 files `git blame -L {region}`). Evidence phase=archaeology.

**Error handling:** If any archaeology agent fails (Timeline or Blame), log W003 and proceed with available results. If delegate fails, log W003 and proceed with local agent results only.

`maestro delegate --role analyze --mode analysis` (`run_in_background: true`):
- PURPOSE: Review recent modifications related to {target}
- EXPECTED: JSON [{commit_sha, risk_level, analysis, could_cause_issue, explanation}]

Update section 2. Commit: `"odyssey-review({slug}): ARCHAEOLOGY — git history analysis"`

### A_EXPLORE
Skip if no CLI tools (W006).

`maestro delegate --role explore --mode analysis` (`run_in_background: true`):
- PURPOSE: Call chains, recent changes, error gaps, similar patterns
- EXPECTED: JSON {call_chains, recent_changes, error_gaps, similar_patterns}

Write `explore.json` + evidence phase=explore. Update section 3. Mark G2. Commit: `"odyssey-review({slug}): EXPLORE — codebase exploration"`

### A_REVIEW
Spawn N parallel Agents, one per dimension:
- **Correctness**: logic errors, boundary conditions, null/undefined, race conditions
- **Security**: injection, XSS, CSRF, data exposure, auth bypass
- **Performance**: hot paths, N+1, memory leaks, unnecessary recomputation
- **Architecture**: layer violations, circular deps, interface contracts, SoC

Each returns `[{title, severity, file, line, description, suggestion, cwe}]`. Merge → evidence phase=review. Write `review_result` + section 4 severity matrix. Mark G1.

Commit: `"odyssey-review({slug}): REVIEW — multi-dimension review complete"`

### A_FIX
Exhaustive iterative fix — descend by severity until `remaining_actionable == 0`.

```
for tier in [critical, high, medium, low].filter(>= threshold):
  for each unfixed candidate: read +/-20 lines → fix → evidence phase=fix
  re-review modified area (new findings → append, continue; max 2 per tier)
  tier done → auto-commit
```

Normal: AskUserQuestion per tier. `-y`: auto-fix all.
Remaining > 0 → retry (max_fix_rounds = 5). Unchanged 2 rounds → classify each individually. After 5 rounds with remaining > 0 → escalate: Normal: AskUserQuestion (continue/accept/reclassify) | `-y`: classify remaining as `deferred`, proceed.
Blanket "pre-existing" forbidden.

Commit per tier: `"odyssey-review({slug}): FIX-{tier} — {N} items fixed"`

### A_CONFIRM
Run tests + `maestro delegate --role review --mode analysis` (`run_in_background: true`) for zero-residual review.
- `remaining == 0 AND new == 0` → confirmed, mark G3
- Otherwise → needs_rework → S_FIX

Update `confirmation` + `remaining_actionable` + section 5.

Commit: `"odyssey-review({slug}): CONFIRM — zero-residual verified"`

### A_GENERALIZE, A_DISCOVER, A_RECORD
Base shared_actions. Review overrides:
- **A_GENERALIZE** pattern source: findings with severity >= medium
- **A_RECORD** learnings per Knowledge Persistence table

**Completion summary:**
```
--- REVIEW-TEST-FIX ODYSSEY COMPLETE ---
Target:     {target}          Dimensions: {dims}
Findings:   {C}C {H}H {M}M {L}L    Fix: {fixed}, confirmed={yes|skip}
Patterns:   {N} ({by_layer})        Scan hits: {total} ({cross} cross-layer)
Issues:     {N} created
Decisions:  {N} resolved, {M} pending, {K} deferred
Learnings:  {N} persisted
Self-iter:  {N} rounds across {M} stages
Goals:      {done}/{total} ({skipped} skipped)
---
```

</actions>

<appendix>

### `-y` review-specific points

| Decision Point | Normal | `-y` |
|---------------|--------|------|
| S_FIX tier candidates | AskUserQuestion | auto-fix, deferred |
| S_FIX re-review new findings | AskUserQuestion | auto-append |
| S_CONFIRM needs_rework | Display → S_FIX | auto proceed |

### Goal Prompt convergence rules

```
Stop when remaining_actionable == 0, confirmation == confirmed,
generalization exhausted, phase_goals_all_done=true.
Fix iterates by severity tier; each tier re-reviews modified area, new findings appended.
Every finding must have action (fix/issue/decision). Decision pending must AskUserQuestion.
```

</appendix>

</state_machine>

<error_codes>
| Code | Severity | Condition | Recovery |
|------|----------|-----------|----------|
| E001 | error | No target specified | Provide target |
| E002 | error | Target path not found | Check path |
| W001 | warning | No git history | Proceed |
| W002 | warning | Some dimension agents failed | Partial coverage |
| W003 | warning | Archaeology agent or delegate failure | Proceed with available results |
</error_codes>

<success_criteria>
- [ ] Session + 4 output files + prior knowledge searched
- [ ] Archaeology + CLI review → evidence phase=archaeology
- [ ] CLI exploration → explore.json + evidence phase=explore
- [ ] All dimensions reviewed, ALL findings fixed (remaining_actionable == 0)
- [ ] Per-tier re-review gate; every unfixed finding individually classified
- [ ] understanding.md sections 1-8 progressive
- [ ] Fix + confirmed (unless --skip-fix)
- [ ] Generalization + scan (unless --skip-generalize)
- [ ] Discoveries classified; unfixed findings individually justified
- [ ] phase_goals G1-G6 audited, Goal Prompt once, `-y` no blocking, -c resumable
- [ ] Completion summary
</success_criteria>

<next_step_routing>
| Condition | Next |
|-----------|------|
| Deeper debug needed | `/odyssey-debug "<finding>"` |
| Issues created | `/manage-issue list --source review-odyssey` |
| Document pattern | `/learn-decompose <module>` |
| Plan fixes | `/maestro-plan --gaps` |
</next_step_routing>
</output>
