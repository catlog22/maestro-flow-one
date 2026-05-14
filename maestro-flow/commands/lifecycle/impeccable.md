---
name: maestro-impeccable
description: Production-grade UI design — 24 commands + chain orchestration with quality gates + design search
argument-hint: "<command|chain|intent> [target] [flags]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
  - TodoWrite
---

<purpose>
UI design command. Parse input → prerequisites → read workflow file → execute → track.

- **Direct**: single command via workflow file
- **Chain**: orchestrate command sequence with quality gates
- **Search**: query design knowledge base via CLI
</purpose>

## Input

$ARGUMENTS first word determines mode:

| First Word | Mode |
|------------|------|
| Known command (see routing table) | Direct |
| Chain name: build, redesign, improve, enhance, launch, harden, foundation, live | Chain |
| continue / next / -c | Resume |
| search | Search: `maestro impeccable search "$REST"` |
| Free text (concrete task) | Direct craft — has specific target + specs/reference |
| Free text (project intent) | Intent → classify → chain |
| (empty) | Menu: show commands by category |

## Command Routing

All workflows at `~/.maestro/workflows/impeccable/{command}.md`:

| Command | Category | Description |
|---------|----------|-------------|
| craft | Build | Shape then build end-to-end — full page/component implementation |
| shape | Build | Plan UX/UI before code — information architecture, wireframe, visual direction |
| teach | Build | Set up PRODUCT.md — users, brand, tone, anti-references, principles |
| document | Build | Generate DESIGN.md from existing code — extract tokens, typography, colors |
| extract | Build | Pull tokens/components into reusable design system |
| explore | Build | Multi-style comparison — generate variants, render prototypes, visual compare, select/mix |
| critique | Evaluate | UX heuristic review with Nielsen scoring (/40) + P0/P1 findings |
| audit | Evaluate | Technical quality checks — a11y, performance, responsive, code quality (/20) |
| polish | Refine | Final quality pass — micro-adjustments, pixel perfection |
| bolder | Refine | Amplify bland/safe designs — stronger personality, more contrast |
| quieter | Refine | Tone down aggressive/overwhelming designs — reduce visual noise |
| distill | Refine | Strip to essence — remove clutter, reduce cognitive load |
| harden | Refine | Production-ready — error states, i18n, edge cases, overflow, empty states |
| onboard | Refine | First-run flows, empty states, activation paths, progressive disclosure |
| animate | Enhance | Add purposeful motion — transitions, micro-interactions, scroll effects |
| colorize | Enhance | Add strategic color — OKLCH palette, contrast, color strategy |
| typeset | Enhance | Improve typography — scale, hierarchy, font pairing, line length |
| layout | Enhance | Fix spacing, rhythm, visual hierarchy, alignment, grid |
| delight | Enhance | Add personality — memorable details, joy, surprise moments |
| overdrive | Enhance | Push past conventional limits — ambitious visual effects |
| clarify | Fix | Improve UX copy — labels, error messages, microcopy, CTAs |
| adapt | Fix | Adapt for devices/screens — responsive, touch targets, breakpoints |
| optimize | Fix | Fix UI performance — loading, rendering, bundle, paint/layout jank |
| live | Iterate | Browser-based variant iteration — real-time design in DevTools |

Reference files (loaded by workflow as needed, not standalone commands):
brand.md, product.md, design.md, codex.md, heuristics-scoring.md, cognitive-load.md,
color-and-contrast.md, interaction-design.md, motion-design.md, personas.md,
responsive-design.md, spatial-design.md, typography.md, ux-writing.md

## Chains

| Chain | Steps | Scenario |
|-------|-------|----------|
| build | teach? → explore? → shape → craft → critique → [refine] → audit → polish | 从零新建 |
| redesign | document → explore → shape → craft → critique → [refine] → audit → polish | 基于现有代码重设计 |
| improve | critique → [refine] → polish → audit | 迭代改进 |
| enhance | {cmd...} → critique → [refine] → polish | 定向增强（支持多命令） |
| launch | harden → adapt → optimize → audit → polish | 全方位上线准备 |
| harden | harden → audit → polish | 边界加固 |
| foundation | teach? → explore → document → extract | 纯设计系统建设 |
| live | live | 实时迭代 |

- `?` = conditional: teach if PRODUCT.md missing; explore if DESIGN.md missing and --skip-design not set
- `[refine]` = quality gate loop: gate fails → auto-select fix commands from findings → re-gate
- `{cmd...}` = enhance 支持多命令，逗号分隔：`enhance colorize,typeset landing-page`

Chain flags: --threshold <N> (default 26/40), --max-loops <N> (default 3), --skip-design, --styles <N>, -y

## Free Text Routing

Free text 按优先级三层匹配。命中即停，不继续向下。

### Layer 1: 意图匹配单个命令 → Direct

将用户描述与 Command Routing 表的 Description 列语义匹配。匹配最接近的**一个**命令。

| Intent signal | Command |
|---------------|---------|
| 评审, review, 检查UX, 评分, heuristic | critique |
| 审计, a11y, 可访问性, 技术检查, performance audit, 代码质量 | audit |
| 加动画, 动效, transitions, micro-interactions, 过渡 | animate |
| 配色, 颜色, palette, 色彩, OKLCH, contrast | colorize |
| 字体, 排版, typography, font, 字号, 行高 | typeset |
| 布局, 间距, spacing, grid, 对齐, alignment, 视觉层次 | layout |
| 太花, 太吵, tone down, 视觉噪音, 简洁点 | quieter |
| 太平淡, 加强, 更大胆, more personality, 更有个性 | bolder |
| 太复杂, 简化, strip, 去掉多余, cognitive load | distill |
| 打磨, 微调, pixel perfect, final pass, 最终润色 | polish |
| 文案, copy, 标签, 错误提示, UX writing, microcopy | clarify |
| 响应式, mobile, 适配, breakpoints, touch targets | adapt |
| 性能, loading, bundle, 卡顿, jank, 速度 | optimize |
| 边界, error states, i18n, 溢出, 空状态加固 | harden |
| 引导, 新手, 首次使用, onboarding, empty state, 激活 | onboard |
| 趣味, 惊喜, personality, memorable, joy | delight |
| 炫酷, 极限, extraordinary, 超常规, 技术极限 | overdrive |
| 规划, plan UX, wireframe, 信息架构, 视觉方向 | shape |
| 多风格, 变体, variants, compare styles, 风格对比 | explore |
| 品牌定义, PRODUCT.md, 产品上下文 | teach |
| 提取设计, DESIGN.md, 设计文档化 | document |
| 提取组件, pull tokens, 设计系统提取 | extract |
| 实时, browser iteration, 浏览器迭代 | live |

### Layer 2: 具体构建任务 → Direct craft

Layer 1 未命中，但意图是"构建/创建某个具体东西"：
- 包含具体文件路径或目标（`d:\path`, `src/pages/`, `index.html`）
- 包含详细视觉规格（布局、风格、配色方案）
- 包含参考素材（`参考...`, `based on...`, `like...`）

→ 路由到 **craft**（Direct）

### Layer 3: 项目意图 → Chain

Layer 1+2 未命中，意图是泛泛的项目方向：

| Pattern | Chain |
|---------|-------|
| 新建, create, build, new, 从零开始 | build |
| 重做, redesign, 重新设计, rethink, 换风格, 改版 | redesign |
| 改进, improve, iterate, better, 迭代 | improve |
| 增强, enhance, 视觉升级, visual upgrade | enhance |
| 上线, launch, deploy, ship, 发布准备, production-ready | launch |
| 加固, harden, 生产化, 边界情况 | harden |
| 设计系统, design system, tokens, 设计规范, 设计基建 | foundation |
| 实时, live, browser | live |

Ambiguous + no `-y` → AskUserQuestion.

## Prerequisites

Before reading any command workflow:

1. **Context**: `maestro spec load --category ui` → if empty → `maestro impeccable load-context`
2. **PRODUCT.md**: missing/placeholder (<200 chars / `[TODO]`) → execute teach first, then resume original task
3. **Register**: identify brand/product → Read `~/.maestro/workflows/impeccable/{brand|product}.md`

## Direct Execution

1. Prerequisites ✓
2. **显示执行信息**：
   ```
   ── Command: {command} ────────────────────
   Category: {category} | Target: {target}
   ─────────────────────────────────────────
   ```
3. Read `~/.maestro/workflows/impeccable/{command}.md`
4. **TodoWrite 跟踪**：按 workflow 文件中的主要阶段创建 todo 项
   - 格式：`[{command}] {phase description}`
   - 每个阶段完成后立即标记 completed
5. Follow workflow file instructions
6. Post: suggest logical next command (teach→shape, shape→craft, craft→critique, etc.)

## Chain Execution

1. Prerequisites ✓
2. **显示执行链**：解析 chain 定义，输出完整步骤预览：
   ```
   ── Chain: build ──────────────────────────
    1. teach        (conditional: PRODUCT.md missing)
    2. explore      (conditional: DESIGN.md missing)
    3. shape
    4. craft
    5. critique     ◆ quality gate (threshold: 26/40)
    6. [refine]     ↺ auto-fix loop (max: 3)
    7. audit        ◆ quality gate (threshold: 14/20)
    8. polish
   ─────────────────────────────────────────
   Target: {target}
   ```
   - `◆` 标记 quality gate 步骤，显示阈值
   - `↺` 标记 refine loop，显示最大循环次数
   - conditional 步骤注明触发条件
   - 跳过的 conditional 步骤标记 `(skipped)`
3. Create session: `.workflow/.maestro/ui-craft-{YYYYMMDD-HHmmss}/status.json`
   ```json
   { "chain_type": "...", "target": "...", "steps": [...], "current_step": 0,
     "gate_history": [], "loop_count": 0, "status": "running" }
   ```
4. **TodoWrite 初始化**：为 chain 所有步骤创建 todo 项
   - 每步一项，格式：`[chain] step N: {command} — {description}`
   - conditional 步骤若跳过，立即标记 completed
   - quality gate 步骤标注阈值：`[chain] step 5: critique ◆ gate ≥26/40`
5. For each step:
   - Read `~/.maestro/workflows/impeccable/{command}.md` → execute
   - **步骤开始**：TodoWrite 标记当前步骤 in_progress
   - **步骤完成**：TodoWrite 标记 completed + update status.json (`current_step`, step `status`)
   - **步骤失败**：TodoWrite 标记 completed(with note) + 记录原因
6. **Quality gate** (critique/audit steps):
   - Parse score: critique `**Total** | | **N/40**`, audit `**Total** | | **N/20**`
   - Count `[P0]` / `[P1]` tags
   - Pass: score ≥ threshold AND P0 == 0 → advance
   - Fail: collect suggested commands from findings → execute → re-gate
   - Max loops exceeded → force advance with warning
   - TodoWrite：gate 结果记入当前步骤备注（score, P0/P1 count, pass/fail）
7. Final report: scores + trend + commands executed

## Resume

Scan `.workflow/.maestro/ui-craft-*/status.json` for `status == "running"` → most recent → resume from `current_step`.

## Quality Gate — Finding → Command Fallback

When findings lack explicit suggested command:

| Finding Category | Command |
|-----------------|---------|
| Layout, spacing, hierarchy, alignment | layout |
| Color, contrast, palette | colorize |
| Typography, font, readability | typeset |
| Animation, motion, transitions | animate |
| Copy, labels, UX writing | clarify |
| Responsive, mobile, breakpoints | adapt |
| Performance, loading, speed | optimize |
| Complexity, overload, clutter | distill |
| Bland, safe, generic | bolder |
| Aggressive, overwhelming | quieter |
| Onboarding, empty state | onboard |
| Edge cases, i18n, error handling | harden |
| Personality, memorability | delight |

Never auto-select: teach, shape, craft, live, document, extract, overdrive, critique, audit.
