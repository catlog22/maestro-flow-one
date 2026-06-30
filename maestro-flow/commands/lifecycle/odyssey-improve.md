---
name: odyssey-improve
description: Long-running codebase improvement cycle — multi-dimensional audit, deep diagnosis, targeted fix, verify, generalize, and engineering knowledge persistence
argument-hint: "<target> [--dimensions <list>] [--fix-threshold <severity>] [--skip-fix] [--skip-generalize] [--auto] [-y] [-c] [--heartbeat]"
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
survey → 6-dimension audit → diagnose → fix → verify → generalize → discover → persist.
Exhaustive iteration until zero remaining actionable findings.
</purpose>

<boundary>
**In scope:** Runtime quality improvement — performance/security/architecture/reliability/observability/maintainability audit → diagnose → fix → generalize.
**Out of scope:** UI visual → `/odyssey-ui` | New features → `/odyssey-planex` | Single bug → `/odyssey-debug` | Style review → `/odyssey-review-test-fix`
**Exploration freedom:** Free exploration within boundary — profiling, security scanning, architecture analysis, dependency audit.
**Zero-residual:** Every finding MUST have a concrete action (fix / issue / decision). "Report and shelve" is not allowed. "Pre-existing issue" is not a valid skip reason.
</boundary>

<context>
$ARGUMENTS

**Target resolution:**
| Input | Resolution |
|-------|-----------|
| Module/dir path | Audit that module |
| `HEAD` / `staged` | Review changes in diff |
| Feature area keyword | Resolve to related files |
| `--all` | Full project scan (use with caution) |

**Flags:** `--dimensions <list>` dimension subset | `--fix-threshold <severity>` fix cutoff (default: all) | `--skip-fix` audit+diagnose only | `--skip-generalize` skip S_GENERALIZE+S_DISCOVER | `--auto` no delegate confirmation | `-y` auto-confirm | `-c` resume | `--heartbeat` /loop heartbeat

**Dimensions (6):**
1. **performance** — hot paths, N+1 queries, memory allocation, cache efficiency, bundle size, lazy loading
2. **security** — OWASP Top 10, injection, auth bypass, data exposure, dependency vulnerabilities, secrets
3. **architecture** — layer violations, circular dependencies, coupling metrics, interface contracts, SRP violations
4. **reliability** — error handling gaps, retry logic, timeout handling, graceful degradation, resource cleanup
5. **observability** — logging coverage, metric gaps, trace propagation, error reporting, health checks
6. **maintainability** — code complexity (cyclomatic), dead code, test coverage gaps, documentation debt

**Session**: `.workflow/scratch/{YYYYMMDD}-improve-odyssey-{slug}/`
**Output**: `session.json` | `evidence.ndjson` | `understanding.md`

**session.json — improve-specific fields:**
```json
{ "target": "", "dimensions": [], "baseline_metrics": {},
  "audit_result": {}, "diagnoses": [], "confirmation": null,
  "generalization_stats": null }
```

**evidence.ndjson phases:** `survey|audit|diagnosis|fix|discovery|decision|self-iteration`
- `survey`: `category` (dependency|complexity|coverage|error_pattern), `detail`
- `audit`: `dimension`, `severity`, `measurement`
- `diagnosis`: `finding_ref`, `hypothesis`, `result` (confirmed|disproved|inconclusive), `root_cause`
- `fix`: `finding_ref`, `change_summary`, `risk`
- `discovery`: `file`, `line`, `classification` (safe|risk|issue), `action` (fix|issue|decision|skip)
- `decision`: `question`, `options`, `context`, `status` (pending|resolved|deferred), `resolution`
- `self-iteration`: `stage`, `round`, `assessment`, `expansion`

**phase_goals[]:**

| ID | Goal | Phase | skip_when |
|----|------|-------|-----------|
| G1 | Survey completed | S_SURVEY | — |
| G2 | Audit completed | S_AUDIT | — |
| G3 | Diagnosis completed | S_DIAGNOSE | — |
| G4 | Zero remaining: all findings fixed and verified | S_VERIFY | skip_fix |
| G5 | Pattern generalized | S_GENERALIZE | skip_generalize |
| G6 | Discoveries triaged | S_DISCOVER | skip_generalize |
| G7 | Learnings persisted | S_RECORD | — |

**understanding.md — 9 sections:**
1. Target & Baseline ← S_INTAKE | 2. Current State Survey ← S_SURVEY | 3. Audit Findings ← S_AUDIT
4. Root Cause Diagnosis ← S_DIAGNOSE | 5. Fix & Verification ← S_FIX+S_VERIFY
6. Generalization ← S_GENERALIZE | 7. Discoveries ← S_DISCOVER
8. Improvement Metrics ← S_RECORD (before/after) | 9. Engineering Learnings ← S_RECORD

**Knowledge Persistence categories (§9):**

| Category | Content | Follow-up |
|----------|---------|-----------|
| Performance pattern | Bottleneck type + fix approach + measurement method | `/spec-add coding` |
| Security rule | Vulnerability class + fix + prevention method | `/spec-add debug` |
| Architecture constraint | Violation description + correct boundary + check method | `/spec-add arch` |
| Reliability pattern | Failure mode + handling strategy + verification method | `/spec-add coding` |
</context>

<invariants>
All invariants (evidence append-only, session-as-state, phase goal tracking, auto-commit, zero-residual) defined in base.
</invariants>

<self_iteration>
Applies to: **S_SURVEY, S_AUDIT, S_DIAGNOSE, S_GENERALIZE**. Logic in base.
</self_iteration>

<state_machine>

<states>
S_INTAKE → S_SURVEY → S_AUDIT → S_DIAGNOSE → S_FIX → S_VERIFY → S_GENERALIZE → S_DISCOVER → S_RECORD → END
</states>

<transitions>
S_INTAKE → S_INTAKE      : -c + session found → A_RESUME
S_INTAKE → S_SURVEY      : target resolved → A_INTAKE
S_INTAKE → S_INTAKE      : no target → AskUserQuestion

S_SURVEY   → S_AUDIT       : complete

S_AUDIT → S_DIAGNOSE     : critical/high findings exist
S_AUDIT → S_GENERALIZE   : no critical/high, !skip_generalize
S_AUDIT → S_RECORD       : no findings OR skip_generalize

S_DIAGNOSE → S_FIX          : root causes identified, !skip_fix
S_DIAGNOSE → S_GENERALIZE   : root causes identified, skip_fix, !skip_generalize
S_DIAGNOSE → S_RECORD       : root causes identified, skip_fix, skip_generalize
S_DIAGNOSE → S_DIAGNOSE     : hypotheses failed, retries < 3 → A_ESCALATE_DIAGNOSIS
S_DIAGNOSE → S_RECORD       : retries >= 3 → INCONCLUSIVE

S_FIX      → S_VERIFY      : fix implemented

S_VERIFY → S_GENERALIZE   : verified, !skip_generalize
S_VERIFY → S_RECORD       : verified, skip_generalize
S_VERIFY → S_FIX          : needs_rework

S_GENERALIZE → S_DISCOVER   : hits found
S_GENERALIZE → S_RECORD     : no hits

S_DISCOVER → S_DIAGNOSE     : new critical issue → cross_phase_loops++
S_DISCOVER → S_FIX          : same-pattern fix, !skip_fix → cross_phase_loops++
S_DISCOVER → S_RECORD       : remaining_actionable == 0
S_DISCOVER → S_RECORD       : loops >= max_loops → MUST log per-item reasons

S_RECORD   → END            : complete
</transitions>

<actions>

### A_INTAKE
1. Parse arguments: target description, flags, `--dimensions` subset
2. Generate slug, create `SESSION_DIR`
3. Search: `maestro search "<keywords>"` + Glob prior sessions + ARCHITECTURE.md + spec load coding/debug
4. **Baseline capture**: Record current metrics (test pass rate, bundle size, dependency count, complexity hotspots) to `session.json.baseline_metrics`
5. Derive `phase_goals[]` from flags
6. Write `session.json` + `understanding.md` §1, emit Goal Prompt

Commit: `"odyssey-improve({slug}): INTAKE — parse target and capture baseline"`

### A_RESUME
Glob latest session → read `session.json` → display summary → jump to `current_state`.

### A_SURVEY
Current state survey — understand what exists before proposing changes.

1. Dependency audit (package.json/lock), complexity scan (size/nesting), test coverage map, error handling scan (empty catch, unhandled promise)
2. **CLI-assisted** (optional): `maestro delegate --role analyze --mode analysis` for dependency health, complexity hotspots, coverage gaps, error patterns. Execute `run_in_background: true`.
3. Evidence phase=survey. Update §2. Mark G1.

Commit: `"odyssey-improve({slug}): SURVEY — current state analysis"`

### A_AUDIT
Spawn 6 parallel Agents (one per dimension, or `--dimensions` subset).
Each returns: `[{title, severity, dimension, file, line, description, suggestion, measurement}]`

Merge → evidence phase=audit. Write `session.json.audit_result`.
Update §3 (findings by dimension + severity matrix). Mark G2.

Commit: `"odyssey-improve({slug}): AUDIT — multi-dimension review"`

### A_DIAGNOSE
Root cause analysis for critical/high findings — don't fix symptoms.

1. Group by dimension, prioritize by severity. For each: hypothesis → trace code path + git history → evidence phase=diagnosis
2. Ambiguity → evidence phase=decision; Normal: AskUserQuestion | `-y`: defer
3. CLI-assisted for complex findings: `maestro delegate --role analyze --mode analysis` (`run_in_background: true`)
4. Write `session.json.diagnoses[]`. Update §4. Mark G3.

Commit: `"odyssey-improve({slug}): DIAGNOSE — root cause analysis"`

### A_ESCALATE_DIAGNOSIS
`retries++`. < 3: `maestro delegate --role analyze`, new hypotheses, → S_DIAGNOSE. >= 3: Normal → AskUserQuestion | `-y` → INCONCLUSIVE → S_RECORD.

### A_FIX
1. Exhaustive fix: ALL diagnosed issues by severity tier (critical → high → medium → low within fix_threshold), one dimension at a time. After each tier, re-verify **current tier's dimension only** (not all dimensions) — new findings at same or higher severity append to current tier. Cross-dimension regression checks run once at S_VERIFY after all tiers complete.
2. For each fix: implement → evidence phase=fix
3. Normal: AskUserQuestion per-fix confirmation | `-y`: auto-proceed, record `deferred`

Commit: `"odyssey-improve({slug}): FIX — improvements applied"`

### A_VERIFY
1. Run tests covering modified areas
2. Re-capture metrics, compare with `session.json.baseline_metrics`
3. CLI-assisted: `maestro delegate --role review --mode analysis` (`run_in_background: true`)
4. `needs_rework` → S_FIX. `verified` → mark G4, advance.
5. Write `session.json.confirmation`. Update §5 (before/after metrics table).

Commit: `"odyssey-improve({slug}): VERIFY — improvements verified"`

### A_GENERALIZE, A_DISCOVER, A_RECORD
Base shared_actions. Improve overrides:
- **A_GENERALIZE** pattern source: diagnoses + fixes
- **A_RECORD** §8: improvement metrics (before/after comparison from baseline_metrics vs current). §9: learnings per Knowledge Persistence table. Completion summary lists suggested `/spec-add` commands.

**Completion summary:**
```
--- IMPROVE ODYSSEY COMPLETE ---
Target:      {target}
Dimensions:  {dimensions}
Findings:    {critical}C / {high}H / {medium}M / {low}L
Diagnosed:   {count}
Fixed:       {count} ({verified} verified)
Metrics:     {improved} improved / {regressed} regressed
Patterns:    {count} ({by_layer})
Scan hits:   {total} ({cross_layer_confirmed} confirmed)
Issues:      {N} created
Decisions:   {N} resolved, {M} pending, {K} deferred
Learnings:   {N} persisted
Self-iter:   {N} rounds across {M} stages
Cross-loops: {N}
Goals:       {done}/{total} ({skipped} skipped)
---
```

</actions>

<appendix>

### `-y` improve-specific points

| Decision Point | Normal | `-y` |
|---------------|--------|------|
| A_FIX improvement confirmation | AskUserQuestion | auto-proceed, `deferred` |
| A_DIAGNOSE ambiguity | AskUserQuestion | best-effort, `deferred` |
| A_ESCALATE 3-strike | AskUserQuestion 3-way | auto INCONCLUSIVE |
| A_DISCOVER hit routing | AskUserQuestion | auto create issue |
| A_DISCOVER ambiguous items | AskUserQuestion | all `deferred` |

`deferred` items shown in completion summary; recoverable via `-c`.

### Goal Prompt convergence rules

```
Exhaust iteration until all findings actioned (fix/issue/decision)
and phase_goals_all_done=true.
Fix by severity tiers, re-verify after each tier.
Baseline captured before fix, compared after to confirm improvement.
Pending decisions must AskUserQuestion — no silent resolve.
```

</appendix>

</state_machine>

<error_codes>
| Code | Severity | Condition | Recovery |
|------|----------|-----------|----------|
| E001 | error | No target specified | Provide target or use -c |
| E002 | error | Target path not found | Check path |
| W001 | warning | No dependency manifest found | Proceed without dep audit |
| W002 | warning | Some dimension agents failed | Partial audit coverage |
</error_codes>

<success_criteria>
- [ ] Target resolved, baseline metrics captured
- [ ] Survey + 6-dimension audit with structured findings and severity matrix
- [ ] Root causes diagnosed for critical/high findings
- [ ] Improvements implemented and verified with before/after metrics (unless --skip-fix)
- [ ] Multi-layer generalization + cross-phase loops (unless --skip-generalize)
- [ ] Every unfixed finding has individual classification and reason
- [ ] understanding.md §8 (metrics) and §9 (learnings) completed
- [ ] phase_goals G1-G7 tracked and audited
- [ ] Session resumable via -c
- [ ] Completion summary
</success_criteria>

<next_step_routing>
| Condition | Next |
|-----------|------|
| Security findings need deep investigation | `/odyssey-debug "<finding>"` |
| UI-related findings | `/odyssey-ui "<component>"` |
| Issues created from discoveries | `/manage-issue list --source improve-odyssey` |
| Architecture pattern to document | `/spec-add arch "..."` |
| Performance pattern to persist | `/spec-add coding "..."` |
| Formal review of changes | `/odyssey-review-test-fix <changed-files>` |
| Pending decisions | Filter evidence phase=decision status=pending |
</next_step_routing>
</output>
