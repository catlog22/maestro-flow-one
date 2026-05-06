# Maestro Flow One

All 49 Maestro workflow commands as a single skill with dual-variant support (Codex + Claude Code).

## Prerequisites

Install [Maestro Flow](https://github.com/catlog22/maestro-flow) CLI first:

```bash
npm install -g maestro-flow
```

## Install

```bash
npm install -g maestro-flow-one
```

> **Important:** Both `maestro-flow` and `maestro-flow-one` must be globally installed to ensure delegate sessions can correctly invoke `/maestro-flow --cmd ...` during wave/step execution. Without global install, external steps and cross-command calls will fail.

### Install skill

```bash
# Default: install both variants
maestro-flow install
#   .codex/skills/maestro-flow/  -> codex (spawn_agents_on_csv)
#   .claude/skills/maestro-flow/ -> claude (Skill + delegate)

# Single variant
maestro-flow install --variant codex
maestro-flow install --variant claude

# Project-level (instead of global ~/.)
maestro-flow install --project ./my-project
maestro-flow install --variant codex --project .
```

### Uninstall

```bash
maestro-flow uninstall                        # Remove both from global
maestro-flow uninstall --variant codex        # Remove codex only
maestro-flow uninstall --project .            # Remove from current project
npm uninstall -g maestro-flow-one             # Remove global CLI
```

## Variants

| Variant | Install Path | Execution Model |
|---------|-------------|-----------------|
| **codex** | `.codex/skills/maestro-flow/` | `spawn_agents_on_csv` wave-based parallel execution |
| **claude** | `.claude/skills/maestro-flow/` | `Skill()` + `maestro delegate` step-by-step execution |

Both variants share the same 49 commands and 14 chain templates. The difference is the SKILL.md execution engine:

- **Codex**: Builds CSV waves, dispatches via `spawn_agents_on_csv`. Barrier steps solo, non-barriers parallel. Decision nodes evaluated by coordinator between waves.
- **Claude**: Uses `maestro-flow next/done` CLI loop. Internal steps loaded inline via `Read()`, external steps delegated via `maestro delegate --to claude`.

## Usage

### In Codex / Claude Code

```bash
/maestro-flow "fix the login crash"        # Intent -> chain -> execute
/maestro-flow --chain quick-fix "login"     # Direct chain
/maestro-flow --cmd maestro-plan 1          # Single command
/maestro-flow list                          # List all 49 commands
/maestro-flow status                        # Session progress
/maestro-flow execute                       # Resume session
```

### CLI

```bash
maestro-flow list                           # All commands by category
maestro-flow list --variant claude          # Use claude variant data
maestro-flow show maestro-plan              # Command details
maestro-flow chains                         # All 14 chain templates
maestro-flow chain full-lifecycle           # Chain step details
maestro-flow suggest "fix a bug"            # Suggest chain for intent
maestro-flow resolve maestro-plan           # Command name -> file path

maestro-flow next                           # Load next pending step
maestro-flow done                           # Complete current step
maestro-flow status                         # Session status
maestro-flow sessions --all                 # List sessions
maestro-flow reset <session-id>             # Reset failed session
```

## Architecture

```
/maestro-flow "intent"
      |
      +-- "intent text"  --> chain match --> session create
      |     |
      |     +-- [codex]  Wave Execution Loop
      |     |   +-- buildNextWave (barrier=solo, non-barrier=parallel)
      |     |   +-- write wave-{N}.csv
      |     |   +-- spawn_agents_on_csv
      |     |   +-- read results, update status
      |     |
      |     +-- [claude] Step Execution Loop
      |         +-- maestro-flow next  (load command)
      |         +-- execute inline or delegate
      |         +-- maestro-flow done  (advance)
      |
      +-- Decision nodes (between steps/waves)
      |     +-- delegate evaluate -> proceed / fix-loop / escalate
      |
      +-- --cmd <name> <args>  --> resolve + Read() + inline execute
      +-- list / status / chains  --> maestro-flow CLI
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

### Without Decision Gates

| Chain | Steps | Flow |
|-------|-------|------|
| `analyze-plan-execute` | 3 | analyze -> plan -> execute |
| `execute-verify` | 2 | execute -> verify |
| `milestone-release` | 2 | audit -> release |
| `learn-deep` | 3 | follow -> decompose -> second-opinion |

### With Decision Gates

| Chain | Steps | Gates |
|-------|-------|-------|
| `quick-fix` | 5 | post-verify |
| `issue-fix` | 8 | post-verify, post-review |
| `plan-execute-verify` | 4 | post-verify |
| `quality-loop` | 7 | post-verify, post-review, post-test |
| `standard-lifecycle` | 9 | post-verify, post-review, post-test |
| `roadmap-driven` | 9 | post-verify, post-review |

### Full Lifecycle (15 steps, ralph-equivalent)

```
analyze -> plan -> execute -> verify -> [post-verify]
  -> auto-test -> [post-business-test]
  -> review -> [post-review]
  -> auto-test -> test -> [post-test]
  -> milestone-audit -> milestone-complete -> [post-milestone]
```

## Directory Structure

```
maestro-flow-one/
+-- bin/maestro-flow.js            # Global CLI (Node.js)
+-- package.json                   # npm package
+-- codex/maestro-flow/            # Codex variant -> .codex/skills/
|   +-- SKILL.md                   # spawn_agents_on_csv executor
|   +-- commands/ (49)
|   +-- chains/templates.json
+-- claude/maestro-flow/           # Claude variant -> .claude/skills/
|   +-- SKILL.md                   # Skill() + delegate executor
|   +-- commands/ (49)
|   +-- chains/templates.json
+-- README.md
+-- LICENSE
```

## Related

- [Maestro CLI](https://github.com/catlog22/maestro2)

## Links

- [Linux DO：学AI，上L站！](https://linux.do/)

## License

MIT
