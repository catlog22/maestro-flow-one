---
name: maestro-impeccable
description: Production-grade UI design with knowhow accumulation — 24 commands + chain orchestration with quality gates + integrated design search
argument-hint: "<command|intent> [target] [--chain build|improve|enhance|harden|live] [--enhance <cmd>] [--threshold <score>] [--max-loops <n>] [--skip-harvest] [--skip-design-explore] [--skip-design] [--styles <N>] [--stack <stack>] [-y] [-c]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - Skill
  - AskUserQuestion
  - TodoWrite
---
<purpose>
Production-grade UI design system with two execution modes:

**Direct Mode** — Execute any of 24 sub-commands for the full design lifecycle:
Build (craft, shape, teach, document, extract, explore), Evaluate (critique, audit), Refine (polish, bolder, quieter, distill, harden, onboard),
Enhance (animate, colorize, typeset, layout, delight, overdrive), Fix (clarify, adapt, optimize), Iterate (live).

**Chain Mode** — Orchestrate sub-commands via intelligent intent routing + quality gate auto-iteration.
5 chains: build, improve, enhance, harden, live. Critique/audit scores drive automatic command selection and iteration loops.

Includes integrated design-explore (multi-variant design system generation via BM25 engine, HTML prototype rendering, interactive user review)
and `search` CLI subcommand for querying UI/UX design knowledge base (BM25 + 30+ CSV data files).

After each command, automatically harvests design decisions into `.workflow/knowhow/` (DCS-, AST-, TIP-, REF-) for cross-session accumulation.

Session (chain mode): `.workflow/.maestro/ui-craft-{YYYYMMDD-HHmmss}/status.json`
</purpose>

<deferred_reading>
- [impeccable harvest workflow](~/.maestro/workflows/impeccable.md) — read after command execution for harvest logic
- [design stage workflow](~/.maestro/workflows/impeccable/design.md) — read when S_DESIGN_EXPLORE state entered
- [sub-command workflow](~/.maestro/workflows/impeccable/{command}.md) — read when dispatching a sub-command
</deferred_reading>

<sub_commands>
All sub-command workflows reside under `~/.maestro/workflows/impeccable/`:

| Category | Command | Workflow File |
|----------|---------|---------------|
| Build | craft | `workflows/impeccable/craft.md` |
| Build | shape | `workflows/impeccable/shape.md` |
| Build | teach | `workflows/impeccable/teach.md` |
| Build | document | `workflows/impeccable/document.md` |
| Build | extract | `workflows/impeccable/extract.md` |
| Build | explore | `workflows/impeccable/explore.md` |
| Evaluate | critique | `workflows/impeccable/critique.md` |
| Evaluate | audit | `workflows/impeccable/audit.md` |
| Refine | polish | `workflows/impeccable/polish.md` |
| Refine | bolder | `workflows/impeccable/bolder.md` |
| Refine | quieter | `workflows/impeccable/quieter.md` |
| Refine | distill | `workflows/impeccable/distill.md` |
| Refine | harden | `workflows/impeccable/harden.md` |
| Refine | onboard | `workflows/impeccable/onboard.md` |
| Enhance | animate | `workflows/impeccable/animate.md` |
| Enhance | colorize | `workflows/impeccable/colorize.md` |
| Enhance | typeset | `workflows/impeccable/typeset.md` |
| Enhance | layout | `workflows/impeccable/layout.md` |
| Enhance | delight | `workflows/impeccable/delight.md` |
| Enhance | overdrive | `workflows/impeccable/overdrive.md` |
| Fix | clarify | `workflows/impeccable/clarify.md` |
| Fix | adapt | `workflows/impeccable/adapt.md` |
| Fix | optimize | `workflows/impeccable/optimize.md` |
| Iterate | live | `workflows/impeccable/live.md` |

**Reference workflows** (loaded by context, not as sub-commands):
`brand.md`, `product.md`, `design.md`, `codex.md`, `heuristics-scoring.md`, `cognitive-load.md`,
`color-and-contrast.md`, `interaction-design.md`, `motion-design.md`, `personas.md`,
`responsive-design.md`, `spatial-design.md`, `typography.md`, `ux-writing.md`

**Search engine**: `workflows/impeccable/ui-search/` — BM25 search engine + CSV knowledge files
</sub_commands>

<context>
$ARGUMENTS — sub-command, intent text, or special keywords, with optional flags.

**Keywords:** `continue`/`next` → resume previous chain session

**Flags (direct mode):**
- `--skip-harvest` — Execute command without knowhow capture
- `-y` — Auto-confirm where the skill allows

**Flags (chain mode):**
- `--chain <type>` — Force chain type: build, improve, enhance, harden, live
- `--enhance <cmd>` — Specific enhance command (animate|colorize|typeset|layout|delight|overdrive|bolder)
- `--threshold <score>` — Critique pass threshold (default: 26/40). Audit threshold auto-computed as threshold×0.5
- `--max-loops <n>` — Maximum quality gate iterations (default: 3)
- `-c` / `--continue` — Resume previous chain session
- `--skip-design-explore` / `--skip-design` — Skip design-explore and bridge
- `--styles <N>` — Number of design system variants (2-5, default 3). Build chain only
- `--stack <stack>` — Tech stack for supplementary guidelines (default: html-tailwind)
</context>

<invariants>
1. **Session before chain execution** — status.json created before any chain step runs
2. **All chain steps via Skill** — every sub-command dispatched through `Skill({ skill: "maestro-impeccable" })`
3. **Gate scores drive loops** — refine loop auto-selects commands from P0/P1 findings, never from hardcoded lists
4. **Interactive gates respected** — teach, shape, craft retain their user gates; never suppress
5. **Harvest after direct mode** — knowhow capture runs after every direct-mode command (unless --skip-harvest or live)
</invariants>

<chains>

### Chain Definitions

| Chain | Sequence | Gate Condition |
|-------|----------|----------------|
| **build** | teach? → **design_explore?** → shape → craft → **critique** → [refine loop] → audit → polish | critique ≥ threshold AND P0 == 0 |
| **improve** | **critique** → [refine loop] → polish → audit | critique ≥ threshold AND P0 == 0 |
| **enhance** | {cmd} → **critique** → polish (if needed) | critique ≥ threshold |
| **harden** | harden → **audit** → polish | audit ≥ threshold×0.5 |
| **live** | live | — (interactive, no gate) |

- `teach?` — conditional: only if PRODUCT.md missing/placeholder
- `design_explore?` — conditional: only if DESIGN.md missing AND `--skip-design-explore` not set. Delegates to explore which handles variant generation, prototype rendering, visual comparison, user selection/mix, AND bridge to DESIGN.md internally
- `[refine loop]` — quality gate loop: extract suggested commands from critique → execute → re-critique

### Intent → Chain Routing

| Intent Pattern | Chain |
|---------------|-------|
| 新建, create, build, new, 从零, landing, feature, page | build |
| 设计, design, 风格, style, 设计系统, design system, 视觉, theme | build |
| 改进, improve, fix, 优化, iterate, better, 迭代 | improve |
| 动画, 颜色, 排版, animate, color, type, bold, delight, enhance | enhance |
| 生产, production, harden, 上线, ship, edge case, i18n | harden |
| 实时, live, browser, 浏览器, variant | live |

Explicit `--chain` overrides routing. Ambiguous + no `-y` → AskUserQuestion.

</chains>

<state_machine>

<states>
S_PARSE      — 解析参数、模式检测、意图分类                PERSIST: —
S_RESUME     — 扫描已有 chain session、恢复执行           PERSIST: —
S_SETUP      — 加载 context、检查 PRODUCT.md                PERSIST: —
S_CREATE     — 创建 session + status.json                    PERSIST: session (全量)
S_DESIGN_EXPLORE — 委托 explore：多变体生成、原型对比、选型/混搭、自动 bridge 到 DESIGN.md  PERSIST: explore_completed, design_md_path
S_CHAIN      — 按序执行 chain 步骤                           PERSIST: step progress, executed commands
S_GATE       — 质量门控：解析评分、决策                       PERSIST: scores, loop count
S_REFINE     — 执行自动选取的 refine 命令                    PERSIST: refine commands, loop state
S_REPORT     — 最终报告 + 趋势                               PERSIST: final scores, status
</states>

<transitions>

S_PARSE:
  → S_RESUME     WHEN: -c / --continue flag OR keyword "continue"/"next"
  → S_SETUP      WHEN: chain mode detected (--chain flag or intent classified)
  → S_PARSE      WHEN: chain mode, ambiguous AND not -y          DO: AskUserQuestion
  → END          WHEN: direct mode → execute sub-command directly (see Direct Mode execution)
  → END          WHEN: search mode → CLI dispatch
  → END          WHEN: direct mode, no arguments → show command menu with categories
  → END          WHEN: chain mode, no intent AND no target → E002

S_RESUME:
  → S_CHAIN      WHEN: session found                  DO: A_LOCATE_SESSION
  → END          WHEN: no session found → E005

S_SETUP:
  → S_CREATE     DO: A_LOAD_CONTEXT

S_CREATE:
  → S_CHAIN      DO: A_CREATE_SESSION

S_CHAIN:
  → S_DESIGN_EXPLORE  WHEN: current step is 'design_explore' AND DESIGN.md missing AND --skip-design-explore not set AND --skip-design not set
  → S_GATE       WHEN: current step is gate command (critique/audit)
  → S_CHAIN      WHEN: step is design_explore but skip conditions met → advance
  → S_CHAIN      WHEN: step is normal command → execute → advance
  → S_REPORT     WHEN: all steps complete

S_DESIGN_EXPLORE:
  → S_CHAIN      WHEN: explore completed (DESIGN.md produced) → advance to shape
  → S_CHAIN      WHEN: explore failed → W004 → advance to shape (full interview fallback)

S_GATE:
  → S_CHAIN      WHEN: PASS (score ≥ threshold AND P0 == 0) → advance to next step
  → S_REFINE     WHEN: FAIL (score < threshold OR P0 > 0)
  → S_CHAIN      WHEN: max loops exceeded → W002 → force advance

S_REFINE:
  → S_GATE       DO: execute auto-selected commands → re-run gate command
                  GUARD: loop_count < max_loops

S_REPORT:
  → END          DO: A_FINAL_REPORT

</transitions>

<actions>

### A_LOCATE_SESSION

1. Scan `.workflow/.maestro/ui-craft-*/status.json`, filter `status == "running"`, sort DESC
2. Take most recent; load into context as current session
3. Resume from `current_step` position

### A_LOAD_CONTEXT

1. If chain starts with `teach` → execute it first, impeccable handles context loading internally
2. Otherwise → trigger context loading (spec load --category ui, with load-context fallback)
3. If PRODUCT.md missing/placeholder → prepend teach, execute, then resume

### A_CREATE_SESSION

1. Read `.workflow/state.json` for project context (phase, milestone)
2. Create `.workflow/.maestro/ui-craft-{YYYYMMDD-HHmmss}/status.json`:
   ```json
   { "session_id": "ui-craft-{ts}", "source": "maestro-impeccable", "intent": "...",
     "chain_type": "build|improve|enhance|harden|live", "target": "...",
     "auto_mode": false, "threshold": 26, "max_loops": 3,
     "steps": [{ "index": 0, "command": "shape", "status": "pending" }],
     "gate_history": [], "loop_count": 0,
     "current_step": 0, "status": "running",
     "created_at": "ISO-8601", "updated_at": "ISO-8601" }
   ```
3. Write status.json before executing any step

### A_DESIGN_EXPLORE

1. Execute: `Skill({ skill: "maestro-impeccable", args: "explore --styles {styles_count}" })`
2. explore handles internally: variant generation, prototype rendering, visual comparison, user selection/mix, bridge to DESIGN.md, spec registration
3. On completion: verify `.workflow/impeccable/DESIGN.md` exists
4. Update status.json: `explore_completed: true`, `design_md_path`

### A_FINAL_REPORT

1. Read critique trend if available
2. Update status.json with `status: "completed"` and final scores
3. Present summary table with scores, iterations, commands executed

</actions>

</state_machine>

<execution>

## 1. Mode Detection

1. If first argument is `search` → **Search Mode** (Section 6)
2. If first argument matches one of the 24 sub-commands → **Direct Mode** (Section 2)
3. If `--chain` flag present → **Chain Mode** (Section 3)
4. If `-c` / `--continue` or keyword "continue"/"next" → **Resume** (S_RESUME)
5. If intent text (doesn't match a sub-command) → classify intent → **Chain Mode** (Section 3)
6. No arguments → show command menu with categories

## 2. Direct Mode

### 2a. Invoke Skill

```
Skill({ skill: "maestro-impeccable", args: "$ARGUMENTS" })
```

The skill handles: context loading (spec load --category ui, with load-context fallback), register detection (brand/product),
reference file loading, and command execution.

### 2b. Harvest

After the skill completes, read `~/.maestro/workflows/impeccable.md` and follow the harvest workflow.

Skip harvest if:
- `--skip-harvest` flag is set
- Sub-command is `live` (interactive, no harvestable output)
- Sub-command is unrecognized

### 2c. Post-Execution Routing

**Pipeline context detected** (called via Skill from brainstorm, maestro, etc.):
- Report command result and **stop** — the calling flow owns what happens next

**Standalone invocation** (user directly ran `/maestro-impeccable`):
- Show next-step suggestions based on what was executed:
  - `teach` → suggest `explore` or `shape`
  - `explore` → suggest `shape` → `craft`
  - `shape` → suggest `craft`
  - `craft` → suggest `critique`
  - `critique`/`audit` → suggest commands from findings
  - Enhancement/fix commands → suggest `critique` to re-evaluate

## 3. Chain Mode

Follow the state machine (S_PARSE → S_SETUP → S_CREATE → S_CHAIN → S_GATE → S_REFINE → S_REPORT).

### 3a. Parse & Route

1. If `--chain` present → use directly
2. Otherwise → match $ARGUMENTS against intent patterns
3. If `--enhance` present → chain = enhance, cmd = --enhance value
4. For enhance chain without `--enhance` → infer from intent ("动画" → animate, "颜色" → colorize, etc.)
5. Ambiguous + no `-y` → ask user to pick chain

Create TodoWrite with chain steps.

### 3b. Execute Chain

For each step in chain, sequentially:

```
▸ Step {n}/{total}: /maestro-impeccable {command} {target}
```

Execute via: `Skill({ skill: "maestro-impeccable", args: "{command} {target}" })`

After each step: update status.json `current_step` and step `status`.

**Step-specific logic:**

- **design_explore** (build chain only): check DESIGN.md exists → skip if yes; check --skip-design-explore → skip if set; otherwise execute `Skill({ skill: "maestro-impeccable", args: "explore --styles {styles_count}" })`; verify DESIGN.md on completion
- **teach, shape, craft** are interactive — do NOT suppress their user gates
- Gate steps (critique/audit) → transition to quality gate logic (Section 4)

## 4. Quality Gate

### 4a. Execute Gate Command

```
Skill({ skill: "maestro-impeccable", args: "critique {target}" })
```
or
```
Skill({ skill: "maestro-impeccable", args: "audit {target}" })
```

### 4b. Parse Score

From critique output, extract:
- **score**: Nielsen's total — from `"**Total** | | **N/40**"` row
- **P0_count**: count of `[P0]` tagged findings
- **P1_count**: count of `[P1]` tagged findings
- **suggested_commands**: list of `/maestro-impeccable <cmd>` from "Suggested command" fields

From audit output, extract:
- **score**: dimension total — from `"**Total** | | **N/20**"` row
- **P0_count**: count of `[P0]` findings

### 4c. Evaluate

```
critique_pass = (score >= threshold) AND (P0_count == 0)
audit_pass    = (score >= threshold * 0.5) AND (P0_count == 0)
```

### 4d. On PASS → advance to next chain step

### 4e. On FAIL

1. Collect suggested commands from P0/P1 findings
2. If no suggestions → use fallback mapping (see quality_gate_routing)
3. De-duplicate, cap at 3 commands per iteration
4. Sort: P0-suggested first
5. Execute each: `Skill({ skill: "maestro-impeccable", args: "{cmd} {target}" })`
6. Re-run gate command
7. Increment loop_count, append to status.json `gate_history`

### 4f. On Max Loops Exceeded → W002, force advance

## 5. Final Report (chain mode)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Chain complete: {chain_type}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Critique : {score}/40 (trend: {trend_line})
 Audit    : {score}/20
 Loops    : {total_iterations}
 Commands : {executed_command_list}

 Status   : {PASS | PARTIAL — N issues remain}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If issues remain → suggest: "Run `/maestro-impeccable --chain improve {target}` to continue iteration."

## 6. Search CLI

Direct CLI dispatch (no Skill, no harvest):

```bash
maestro impeccable search "<query>" [options]
```

Options: `-d <domain>`, `-s <stack>`, `-n <max>`, `--design-system`, `-p <name>`, `-f <fmt>`, `--persist`, `--page <page>`, `-o <dir>`

Domains: style, color, chart, landing, product, ux, typography, icons, react, web, google-fonts.
Stacks: react, nextjs, vue, svelte, astro, swiftui, react-native, flutter, html-tailwind, shadcn, + more.

Search uses `workflows/impeccable/ui-search/search.py` (BM25 engine + 30+ CSV knowledge files).

</execution>

<quality_gate_routing>

### Finding → Command Fallback Mapping

When critique/audit findings lack explicit "Suggested command", map by category:

| Finding Category | Command |
|-----------------|---------|
| Visual hierarchy, layout, spacing, alignment | layout |
| Color, contrast, palette, monochromatic | colorize |
| Typography, font, readability, hierarchy | typeset |
| Animation, motion, transitions, micro-interaction | animate |
| Copy, labels, error messages, UX writing | clarify |
| Responsive, mobile, breakpoints, touch targets | adapt |
| Performance, loading, speed, bundle, jank | optimize |
| Complexity, overload, clutter, cognitive load | distill |
| Bland, safe, generic, lacks personality | bolder |
| Aggressive, overwhelming, loud, overstimulating | quieter |
| Onboarding, empty state, first-run, activation | onboard |
| Edge cases, i18n, error handling, overflow | harden |
| Personality, memorability, joy, delight | delight |

### Commands Never Auto-Selected

| Command | Reason |
|---------|--------|
| teach | Project setup (run in S_SETUP only) |
| shape | Requires user interview |
| craft | Full build with multiple gates |
| live | Interactive browser mode |
| document | Generates DESIGN.md (setup) |
| extract | Design system extraction (setup) |
| overdrive | Requires explicit user vision |
| critique | Gate command, not a fix |
| audit | Gate command, not a fix |

</quality_gate_routing>

<error_codes>
| Code | Severity | Description |
|------|----------|-------------|
| E001 | error | Invalid sub-command (not in 24 valid commands) or impeccable skill not available |
| E002 | error | No intent or target specified |
| E003 | error | Invalid --chain type |
| E004 | error | Invalid --enhance command |
| E005 | error | Resume session not found |
| E006 | error | Python 3 not available for design system generation |
| E007 | error | ui-search scripts not found at expected path |
| W001 | warning | PRODUCT.md missing, prepending teach to chain |
| W002 | warning | Max quality gate loops exceeded, forcing continue |
| W003 | warning | Could not parse score from critique/audit output |
| W004 | warning | Design system generation failed, falling back to shape full interview |
| W005 | warning | Bridge transformation failed, continuing without DESIGN.md |
| W006 | warning | Harvest failed — design knowledge not captured (command still succeeded) |
| W007 | warning | PRODUCT.md missing — skill will auto-trigger teach |
| W008 | warning | Node.js not available for prototype rendering, falling back to text-only |
</error_codes>

<success_criteria>
- [ ] Mode detected correctly (direct / chain / search / resume)
- [ ] Sub-command recognized and routed (direct mode)
- [ ] Intent classified and chain type selected (chain mode)
- [ ] Context loaded (PRODUCT.md present or taught)
- [ ] Session dir created with status.json before chain execution
- [ ] All chain steps executed via Skill("maestro-impeccable", ...)
- [ ] Quality gate evaluated with parsed scores
- [ ] Refine loop executed when gate failed (if applicable)
- [ ] Gate history and scores persisted to status.json
- [ ] Knowhow entry created in .workflow/knowhow/ (unless --skip-harvest or live)
- [ ] Progress tracked via TodoWrite throughout (chain mode)
</success_criteria>
