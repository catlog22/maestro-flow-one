# Maestro Flow One

All 49 Maestro workflow commands as a single Claude Code skill with global CLI.

## Install

```bash
npm install -g maestro-flow-one
```

This registers the global `maestro-flow` CLI and makes the skill available for any project.

### Install skill to a project

```bash
cd your-project
maestro-flow install
```

This copies the skill to `.claude/skills/maestro-flow/`, registering `/maestro-flow` in Claude Code.

### Uninstall

```bash
maestro-flow uninstall              # Remove skill from current project
npm uninstall -g maestro-flow-one   # Remove global CLI
```

## Usage

### Claude Code

```bash
/maestro-flow "fix the login crash"        # Intent -> chain selection -> execute
/maestro-flow --chain quick-fix "login"     # Direct chain
/maestro-flow --cmd maestro-plan 1          # Single command
/maestro-flow list                          # List all 49 commands
/maestro-flow status                        # Session progress
/maestro-flow continue                      # Resume session
```

### CLI

```bash
maestro-flow list                           # All commands by category
maestro-flow list --category quality        # Filter
maestro-flow show maestro-plan              # Command details
maestro-flow chains                         # All 14 chain templates
maestro-flow chain full-lifecycle           # Chain step details
maestro-flow suggest "fix a bug"            # Suggest chain for intent
maestro-flow resolve maestro-plan           # Command name -> file path

maestro-flow next                           # Load next pending step
maestro-flow done                           # Complete current step
maestro-flow status                         # Session status
maestro-flow sessions --all                 # List sessions
maestro-flow step <id> 3 completed          # Manual step update
maestro-flow reset <id>                     # Reset failed session
```

## Architecture

```
/maestro-flow "intent"
      |
      +-- --role executor --> executor.md
      |     |
      |     +-- maestro-flow next   (load command, mark running)
      |     +-- execute by type     (internal/external/decision)
      |     +-- maestro-flow done   (mark complete, advance)
      |     +-- self-invoke loop
      |
      +-- --cmd <name> <args>  --> resolve + Read() + inline execute
      +-- list / status / chains  --> maestro-flow CLI
      +-- "intent text"  --> chain match --> session create --> executor
```

### Execution Model

| Type | How |
|------|-----|
| **internal** | `maestro-flow next` loads .md content -> follow `<execution>` inline |
| **external** | `maestro delegate --to claude "/maestro-flow --cmd {skill} {args}"` |
| **decision** | Agent evaluates quality gate -> proceed / fix-loop / escalate |

### Cross-Command Calls

Commands reference each other through the skill router:

```
Skill({ skill: "maestro-flow", args: "--cmd spec-add pattern ..." })
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
| `review-fix` | 4 | post-review |
| `brainstorm-driven` | 5 | post-verify |
| `quality-loop` | 7 | post-verify, post-review, post-test |
| `roadmap-driven` | 9 | post-verify, post-review |
| `standard-lifecycle` | 9 | post-verify, post-review, post-test |
| `milestone-close` | 3 | post-milestone |

### Full Lifecycle (15 steps, ralph-equivalent)

```
analyze -> plan -> execute -> verify -> [post-verify]
  -> auto-test -> [post-business-test]
  -> review -> [post-review]
  -> auto-test -> test -> [post-test]
  -> milestone-audit -> milestone-complete -> [post-milestone]
```

Each `[decision]` gate is evaluated by Agent. On failure, fix-loop inserted dynamically (max 2 retries).

## Decision Gates

| Gate | Evaluates | Fix Loop |
|------|-----------|----------|
| post-verify | verification.json | debug -> plan --gaps -> execute -> verify -> re-evaluate |
| post-review | review.json | debug -> plan --gaps -> execute -> review -> re-evaluate |
| post-test | uat.md + test-results.json | debug -> plan --gaps -> execute -> verify -> test -> re-evaluate |
| post-business-test | business-test-results.json | debug -> plan --gaps -> execute -> verify -> auto-test -> re-evaluate |
| post-milestone | state.json | Structural: advance to next milestone or complete |

## Directory Structure

```
maestro-flow-one/
+-- package.json              # npm package, bin: maestro-flow
+-- bin/maestro-flow.js        # Global CLI (Node.js)
+-- README.md
+-- LICENSE
+-- maestro-flow/              # Skill directory -> .claude/skills/maestro-flow/
    +-- SKILL.md               # Entry point router
    +-- executor.md            # Step executor
    +-- commands/              # 49 command files
    |   +-- lifecycle/ (17)
    |   +-- quality/ (7)
    |   +-- manage/ (10)
    |   +-- learn/ (5)
    |   +-- milestone/ (3)
    |   +-- spec/ (4)
    |   +-- wiki/ (2)
    +-- chains/templates.json  # 14 chains + decision types
```

## Related

- [Maestro CLI](https://github.com/catlog22/maestro2) - Workflow orchestration CLI (required for `maestro delegate` in external steps)

## License

MIT
