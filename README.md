# Maestro Flow One

All 49 Maestro workflow commands packaged as a single installable Claude Code skill — with adaptive decision gates, minimal closed-loop chains, and a Python CLI for command management.

## Overview

```
/maestro-flow "fix the login crash"
       │
       ├── Intent Analysis ──→ Chain Matching ──→ Session Creation
       │                                              │
       │   ┌──────────────────────────────────────────┘
       │   │
       │   ▼
       │   Executor (step-by-step)
       │   ├── internal  → Read() command .md → execute inline
       │   ├── external  → maestro delegate → /maestro-flow --cmd
       │   └── decision  → Agent evaluates quality gate → proceed / fix-loop / escalate
       │
       ├── --cmd <name>     → Direct command execution (delegate entry)
       ├── --role executor  → Resume session execution
       └── list / status    → Python CLI tool
```

### Core Concepts

- **One Skill, 49 Commands** — All commands live in `commands/` by category, loaded at runtime via `flow_cli.py resolve` + `Read()`
- **Minimal Closed-Loop Chains** — 14 pre-defined templates from 2-step quick tasks to 15-step full lifecycle with quality gates
- **Decision Nodes** — Quality gates (post-verify, post-review, post-test) evaluated via Agent; fix-loops dynamically inserted on failure
- **Script-Loaded Execution** — Commands are NOT registered as slash commands; they are loaded inline through `--cmd` routing
- **Session Tracking** — `status.json` tracks chain progress, step status, context propagation

## Install

```bash
git clone https://github.com/catlog22/maestro-flow-one.git

# Unix
cd your-project
bash /path/to/maestro-flow-one/install.sh

# Windows
cd your-project
powershell /path/to/maestro-flow-one/install.ps1
```

This copies `maestro-flow/` into `.claude/skills/maestro-flow/`. Claude Code auto-registers `/maestro-flow` from the `SKILL.md` name field.

## Usage

### In Claude Code

```bash
# Intent-based — describe goal, get a chain suggestion
/maestro-flow "implement user authentication"

# Direct chain — skip intent analysis
/maestro-flow --chain full-lifecycle

# Single command — execute one command directly
/maestro-flow --cmd maestro-plan 1
/maestro-flow --cmd quality-debug "login crash"

# Session management
/maestro-flow status                # Current session progress
/maestro-flow continue              # Resume running session
/maestro-flow list                  # List all 49 commands
```

### Python CLI

```bash
python tools/flow_cli.py list                         # All commands by category
python tools/flow_cli.py list --category quality       # Filter by category
python tools/flow_cli.py show maestro-plan             # Command details
python tools/flow_cli.py chains                        # All chain templates
python tools/flow_cli.py chain full-lifecycle           # Chain step details
python tools/flow_cli.py suggest "fix a bug"           # Suggest matching chain
python tools/flow_cli.py resolve maestro-plan          # Command name → file path
python tools/flow_cli.py status                        # Session status
python tools/flow_cli.py sessions --all                # List all sessions
python tools/flow_cli.py step <session-id> 3 completed # Manual step update
python tools/flow_cli.py reset <session-id>            # Reset failed session
```

## Commands (49)

| Category | Count | Commands |
|----------|-------|----------|
| **lifecycle** | 17 | init, analyze, plan, execute, verify, brainstorm, roadmap, quick, ui-design, fork, merge, amend, overlay, update, composer, player, link-coordinate |
| **quality** | 7 | debug, review, test, auto-test, refactor, sync, retrospective |
| **manage** | 10 | status, issue, issue-discover, harvest, knowhow, knowhow-capture, learn, wiki, codebase-rebuild, codebase-refresh |
| **learn** | 5 | decompose, follow, investigate, retro, second-opinion |
| **milestone** | 3 | audit, complete, release |
| **spec** | 4 | add, load, remove, setup |
| **wiki** | 2 | connect, digest |

## Chains (14)

### Quick Chains (no decision gates)

| Chain | Steps | Flow |
|-------|-------|------|
| `analyze-plan-execute` | 3 | analyze → plan → execute |
| `execute-verify` | 2 | execute → verify |
| `milestone-release` | 2 | audit → release |
| `learn-deep` | 3 | follow → decompose → second-opinion |

### Chains with Decision Gates

| Chain | Steps | Flow | Decision Gates |
|-------|-------|------|----------------|
| `quick-fix` | 5 | debug → plan → execute → verify → ◆ | post-verify |
| `issue-fix` | 8 | analyze → plan → execute → verify → ◆ → review → ◆ → close | post-verify, post-review |
| `plan-execute-verify` | 4 | plan → execute → verify → ◆ | post-verify |
| `review-fix` | 4 | plan → execute → review → ◆ | post-review |
| `brainstorm-driven` | 5 | brainstorm → plan → execute → verify → ◆ | post-verify |
| `quality-loop` | 7 | verify → ◆ → review → ◆ → auto-test → test → ◆ | post-verify, post-review, post-test |
| `roadmap-driven` | 9 | init → roadmap → analyze → plan → execute → verify → ◆ → review → ◆ | post-verify, post-review |
| `standard-lifecycle` | 9 | plan → execute → verify → ◆ → review → ◆ → test → ◆ → audit | post-verify, post-review, post-test |
| `milestone-close` | 3 | audit → complete → ◆ | post-milestone |

### Full Lifecycle (ralph-equivalent)

```
full-lifecycle (15 steps):

  analyze → plan → execute → verify
       → ◆ post-verify
  → auto-test
       → ◆ post-business-test
  → review
       → ◆ post-review
  → auto-test → test
       → ◆ post-test
  → milestone-audit → milestone-complete
       → ◆ post-milestone
```

Each `◆` is a decision gate evaluated by Agent. On failure, a fix-loop is dynamically inserted (debug → plan --gaps → execute → re-verify) with retry tracking (max 2 retries before escalation).

## Decision Gates

Decision nodes use `Agent()` to evaluate quality gate results:

| Gate | Evaluates | On Fix |
|------|-----------|--------|
| `post-verify` | `verification.json` | debug → plan --gaps → execute → verify → re-evaluate |
| `post-review` | `review.json` | debug → plan --gaps → execute → review → re-evaluate |
| `post-test` | `uat.md` + `test-results.json` | debug → plan --gaps → execute → verify → test → re-evaluate |
| `post-business-test` | `business-test-results.json` | debug → plan --gaps → execute → verify → auto-test → re-evaluate |
| `post-milestone` | `state.json` | Structural: advance to next milestone or complete |

**Verdict format:**
```
---VERDICT---
STATUS: proceed | fix | escalate
REASON: one-line explanation
GAP_SUMMARY: problem description (fix/escalate only)
CONFIDENCE: high | medium | low
---END---
```

## Execution Model

### Internal Steps

Commands loaded via script, executed inline:

```
1. flow_cli.py resolve "maestro-plan"  →  commands/lifecycle/plan.md
2. Read() the .md file
3. Follow <execution> section with $ARGUMENTS
```

### External Steps

Delegated to new Claude Code session through the skill's own routing:

```
maestro delegate --to claude \
  "Execute: /maestro-flow --cmd maestro-execute {phase}" \
  --mode write
```

### Cross-Command Calls

Commands that reference other commands use the `--cmd` router (not `Skill()` directly):

```
Skill({ skill: "maestro-flow", args: "--cmd spec-add pattern ..." })
```

## Session (status.json)

```json
{
  "session_id": "flow-20260506-143022",
  "source": "flow",
  "status": "running",
  "intent": "fix the login crash",
  "chain_name": "quick-fix",
  "task_type": "quick-fix",
  "phase": 2,
  "auto_mode": false,
  "passed_gates": ["post-verify"],
  "steps": [
    { "index": 0, "type": "internal", "skill": "quality-debug", "status": "completed" },
    { "index": 1, "type": "internal", "skill": "maestro-plan", "status": "completed" },
    { "index": 2, "type": "external", "skill": "maestro-execute", "status": "running" },
    { "index": 3, "type": "internal", "skill": "maestro-verify", "status": "pending" },
    { "index": 4, "type": "decision", "skill": "decision:post-verify", "status": "pending" }
  ],
  "current_step": 2
}
```

## Directory Structure

```
maestro-flow-one/
├── README.md
├── LICENSE
├── install.sh
├── install.ps1
└── maestro-flow/                    # → .claude/skills/maestro-flow/
    ├── SKILL.md                     # Entry point router
    ├── executor.md                  # Step executor with decision support
    ├── commands/
    │   ├── lifecycle/  (17 files)   # init, analyze, plan, execute, verify, ...
    │   ├── quality/    (7 files)    # debug, review, test, auto-test, ...
    │   ├── manage/     (10 files)   # status, issue, wiki, harvest, ...
    │   ├── learn/      (5 files)    # decompose, follow, investigate, ...
    │   ├── milestone/  (3 files)    # audit, complete, release
    │   ├── spec/       (4 files)    # add, load, remove, setup
    │   └── wiki/       (2 files)    # connect, digest
    ├── chains/
    │   └── templates.json           # 14 chain templates + decision types
    └── tools/
        └── flow_cli.py              # CLI: list, show, chains, suggest, status, resolve
```

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI or Desktop
- Python 3.8+
- [Maestro CLI](https://github.com/catlog22/maestro2) (for `maestro delegate` in external steps)

## License

MIT
