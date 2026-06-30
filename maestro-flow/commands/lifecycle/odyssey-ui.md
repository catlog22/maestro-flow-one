---
name: odyssey-ui
description: Long-running UI optimization cycle — visual survey, multi-dimensional audit, divergent exploration, fix, verify, generalize, and design knowledge persistence
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
survey → 6-dimension audit → divergent exploration → fix → verify → generalize → discover → persist.
Exhaustive iteration until all findings addressed or deferred.
</purpose>

<boundary>
**In scope:** Target component/page visual experience optimization — audit 6 dimensions, divergent exploration, fix, generalize to sibling components.
**Out of scope:** Backend/data/API → `/odyssey-planex` | Deep bug investigation → `/odyssey-debug` | Code quality review → `/odyssey-review-test-fix`

**Decision gate** — ONLY these qualify as decisions:
  - Brand/style direction requiring human creative judgment
  - Layout restructuring that changes user flow significantly
  - Requires new design tokens or breaking component API
</boundary>

<context>
$ARGUMENTS

**Target resolution:** Component path → audit component | Page/route → audit page | `staged`/`HEAD` → diff UI changes | Feature area → resolve to components/pages

**Flags:** `--dimensions <list>` dimension subset | `--fix-threshold <severity>` | `--skip-fix` audit+diverge only | `--skip-generalize` skip generalize+discover | `--auto` no delegate confirmation | `-y` auto-confirm | `-c` resume | `--heartbeat` /loop heartbeat

**Session**: `.workflow/scratch/{YYYYMMDD}-ui-odyssey-{slug}/`
**Output**: `session.json` | `evidence.ndjson` | `understanding.md`

**session.json — ui-specific fields:**
```json
{ "target": "", "dimensions": [],
  "audit_result": { "dimensions_audited": 0, "finding_count": 0, "severity_distribution": {} },
  "diverge_result": { "improvements_proposed": 0, "creative_ideas": 0 },
  "patterns": [], "confirmation": null, "generalization_stats": null }
```

**evidence.ndjson phases:** `survey|audit|diverge|fix|discovery|decision|self-iteration`

**phase_goals[]:**

| ID | Goal | Phase | skip_when |
|----|------|-------|-----------|
| G1 | Survey completed | S_SURVEY | — |
| G2 | Audit completed | S_AUDIT | — |
| G3 | Divergent exploration done | S_DIVERGE | — |
| G4 | Zero remaining: all findings/ideas fixed and verified | S_VERIFY | skip_fix |
| G5 | Pattern generalized | S_GENERALIZE | skip_generalize |
| G6 | Discoveries triaged | S_DISCOVER | skip_generalize |
| G7 | Learnings persisted | S_RECORD | — |

**understanding.md — 8 sections:**
1. Target & Design Context ← S_INTAKE | 2. Survey ← S_SURVEY | 3. Audit ← S_AUDIT
4. Diverge ← S_DIVERGE | 5. Verify ← S_VERIFY | 6. Generalize ← S_GENERALIZE
7. Discover ← S_DISCOVER | 8. Learnings ← S_RECORD

**Knowledge Persistence categories (section 8):**

| Category | Content | Follow-up |
|----------|---------|-----------|
| Design pattern | Component pattern + applicable scenarios + token references | `/spec-add ui` |
| Interaction spec | State definitions + transition rules + feedback patterns | `/spec-add ui` |
| Accessibility rule | WCAG requirement + implementation approach | `/spec-add ui` |
| Reusable generalization pattern | Pattern signature + application scope | `/spec-add coding` |
</context>

<invariants>
1-5 in base. UI-specific:
6. **Browser is truth** — verify in real rendering, not just code review
7. **Diverge before converge** — explore creatively first, then implement methodically
</invariants>

<self_iteration>
Applies to: **S_SURVEY, S_AUDIT, S_DIVERGE, S_GENERALIZE**. Logic in base.
</self_iteration>

<state_machine>

<states>
S_INTAKE → S_SURVEY → S_AUDIT → S_DIVERGE → S_FIX → S_VERIFY → S_GENERALIZE → S_DISCOVER → S_RECORD → END
</states>

<transitions>
S_INTAKE → S_INTAKE       : -c + session found → A_RESUME
S_INTAKE → S_SURVEY       : target resolved → A_INTAKE
S_INTAKE → S_INTAKE       : no target → AskUserQuestion

S_SURVEY  → S_AUDIT       : complete
S_AUDIT   → S_DIVERGE     : complete

S_DIVERGE → S_FIX         : !skip_fix AND actionable findings/ideas
S_DIVERGE → S_GENERALIZE  : (skip_fix OR no actionable) AND !skip_generalize
S_DIVERGE → S_RECORD      : (skip_fix OR no actionable) AND skip_generalize

S_FIX     → S_VERIFY      : fix implemented
S_VERIFY  → S_GENERALIZE  : verified, !skip_generalize
S_VERIFY  → S_RECORD      : verified, skip_generalize
S_VERIFY  → S_FIX         : needs_rework

S_GENERALIZE → S_DISCOVER : similar code found
S_GENERALIZE → S_RECORD   : no similar code

S_DISCOVER → S_AUDIT      : new component to audit → cross_phase_loops++
S_DISCOVER → S_FIX        : fixable sibling, !skip_fix → cross_phase_loops++
S_DISCOVER → S_RECORD     : remaining_actionable == 0 OR loops >= max_loops → log per-item reasons

S_RECORD   → END          : complete
</transitions>

<actions>

### A_INTAKE
1. Parse arguments: target, flags, `--dimensions` subset
2. Generate slug, create SESSION_DIR
3. `maestro search` + Glob prior sessions + ARCHITECTURE.md + spec load ui/coding
4. Derive `phase_goals[]` from flags
5. Write `session.json` + `understanding.md` section 1, emit Goal Prompt

Commit: `"odyssey-ui({slug}): INTAKE — parse target and load context"`

### A_RESUME
Glob latest session → read `session.json` → jump to `current_state`.

### A_SURVEY
1. **Design system inventory**: Scan for design tokens, CSS variables, theme imports
2. **Current state analysis**: Styling patterns, layout strategy, component hierarchy
3. **CLI-assisted**: `maestro delegate --role analyze --mode analysis` — survey tokens, spacing, typography, hierarchy, consistency
4. Append evidence phase=survey. Update section 2. Mark G1.

Commit: `"odyssey-ui({slug}): SURVEY — design token inventory"`

### A_AUDIT
Spawn 6 parallel Agents (one per dimension, or `--dimensions` subset):

| Dimension | Focus |
|-----------|-------|
| visual_hierarchy | Spacing, typography scale, color contrast, alignment, whitespace, visual weight |
| interaction_states | Hover, focus, active, disabled, loading, error, empty, selected states |
| accessibility | WCAG AA contrast, focus management, aria labels, keyboard nav, screen reader |
| responsiveness | Breakpoints, overflow, touch targets, fluid typography, container queries |
| micro_interactions | Transitions, animations, feedback indicators, loading states, progress |
| edge_cases | Long text truncation, empty data, error states, extreme values, i18n, RTL |

Each returns `[{title, severity, file, line, description, suggestion, dimension}]`.
Merge → evidence phase=audit. Write `audit_result`. Update section 3 with severity matrix. Mark G2.

Commit: `"odyssey-ui({slug}): AUDIT — 6-dimension review"`

### A_DIVERGE
Goes beyond defect fixing — "what would make this delightful?"

**Step 1 — 2 parallel Agents:**
- **Polish Agent**: Shadows, borders, transitions, hover states, feedback, empty states, skeleton loading, scroll behavior
- **Delight Agent**: Motion design, progressive disclosure, smart defaults, contextual hints, celebratory feedback, personality in copy

Each returns `[{idea, category (polish|delight), impact, effort, description, inspiration}]`

**Step 2 — CLI-assisted**: `maestro delegate --role analyze --mode analysis` — polish opportunities, micro-interactions, visual rhythm, delight moments

**Step 3 — Consolidate**: Merge audit findings + divergent ideas → prioritized list (severity x impact x effort).
Append evidence phase=diverge. Update section 4. Mark G3.

Commit: `"odyssey-ui({slug}): DIVERGE — creative exploration"`

### A_FIX
Skip if `--skip-fix`.
1. **Exhaustive fix**: ALL findings/ideas by priority tier (critical → high → medium → low + high-impact ideas). After each tier, re-review — new findings append.
2. Each fix → evidence phase=fix
3. Normal: AskUserQuestion per-fix | `-y`: auto-proceed, record `deferred`

Commit: `"odyssey-ui({slug}): FIX — implement improvements"`

### A_VERIFY
1. Run tests (lint, unit, visual regression)
2. `maestro delegate --role review --mode analysis` — visual correctness, interaction states, accessibility, responsive
3. `needs_rework` → S_FIX. `verified` → mark G4. Update section 5, write `confirmation`.

Commit: `"odyssey-ui({slug}): VERIFY — visual verification"`

### A_GENERALIZE, A_DISCOVER, A_RECORD
Base shared_actions. UI overrides:
- **A_GENERALIZE** pattern source: audit findings + diverge ideas (severity >= medium OR impact = high)
- **A_RECORD** learnings per Knowledge Persistence table

**Completion summary:**
```
--- UI ODYSSEY COMPLETE ---
Target:     {target} | Dimensions: {dimensions_audited}
Findings:   {C}C {H}H {M}M {L}L | Diverge: {improvements} polish + {creative} delight
Fix:        {fixed_count} applied, verified={yes|skipped}
Patterns:   {extracted} ({by_layer})
Scan hits:  {total} ({cross_layer} cross-layer)
Issues:     {N} created
Decisions:  {N} resolved, {M} pending, {K} deferred
Learnings:  {N} persisted
Self-iter:  {N} rounds
Goals:      {done}/{total} ({skipped} skipped)
---
```

</actions>

<appendix>

### `-y` ui-specific points

| Decision Point | Normal | `-y` |
|---------------|--------|------|
| A_FIX improvement confirmation | AskUserQuestion | auto-proceed, deferred |

### Goal Prompt convergence rules

```
Stop when audit + diverge findings all addressed (fix/issue/decision),
phase_goals_all_done=true. Fix by impact x severity per tier.
Re-review after each tier — new findings append and continue.
Pending decisions must AskUserQuestion — no self-resolve.
```

</appendix>

</state_machine>

<error_codes>
| Code | Severity | Condition | Recovery |
|------|----------|-----------|----------|
| E001 | error | No target specified | Provide target |
| E002 | error | Target path not found | Check path |
| W001 | warning | No design system detected | Proceed with defaults |
| W002 | warning | Some dimension agents failed | Partial coverage |
</error_codes>

<success_criteria>
- [ ] 6-dimension audit with severity matrix + divergent exploration (polish + delight)
- [ ] Improvements implemented and verified (unless --skip-fix)
- [ ] Multi-layer generalization + discoveries classified (unless --skip-generalize)
- [ ] Every unfixed finding has individual classification and reason
- [ ] understanding.md section 8 finalized; phase_goals G1-G7 tracked; `-y` no blocking prompts
</success_criteria>

<next_step_routing>
| Condition | Next |
|-----------|------|
| Finding needs deeper debug | `/odyssey-debug "<finding>"` |
| Issues from discoveries | `/manage-issue list --source ui-odyssey` |
| Design pattern to document | `/spec-add ui "..."` |
| Full review of changes | `/odyssey-review-test-fix <changed-files>` |
| Sibling components to polish | `/odyssey-ui "<sibling>"` |
</next_step_routing>
