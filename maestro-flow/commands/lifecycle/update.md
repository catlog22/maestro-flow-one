---
name: maestro-update
description: Detect version, preview changes, apply workflow upgrades
argument-hint: "[--dry-run] [--force] [--setup-only]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---
<purpose>
Detect current version, run schema migration to latest, then follow the version-specific upgrade workflow.
Schema (`src/migrations/`) handles transforms; workflow docs (`~/.maestro/workflows/updates/`) handle setup.
</purpose>

<context>
$ARGUMENTS — optional flags.

**Flags:**
- `--dry-run` -- Preview migration plan without executing
- `--force` -- Skip confirmation prompts
- `--setup-only` -- Skip schema migration, run only the setup for current version

**Version source:** `.workflow/state.json` → `version` field

**Workflow docs:** `~/.maestro/workflows/updates/`
- `update-v{TO}-setup.md` — post-migration setup for version {TO}

**Schema registry:** `src/migrations/` — handles all intermediate version bumps automatically
</context>

<execution>

### Step 1: Detect Version

```
1. Read .workflow/state.json → extract version (default "1.0" if missing)
2. Display:
   === Maestro Update ===
   Current version: v{version}
```

IF `--setup-only`:
  → Glob: ~/.maestro/workflows/updates/update-v{version}-setup.md
  → IF exists: follow that document completely, then EXIT
  → IF not exists: display "No setup script for v{version}" → EXIT

### Step 2: Check for Updates

```
1. Run: npx tsx src/migrations/run.ts "$(pwd)" --dry-run --json
2. Parse JSON output
3. IF status = "up-to-date":
     Display "Already up to date (v{version})"
     → Glob: ~/.maestro/workflows/updates/update-v{version}-setup.md
     → IF exists: AskUserQuestion "Run setup for v{version}?" → load and follow
     → EXIT

4. Display target:
   Update available: v{current} → v{target}
   Schema migrations: {N} step(s) (handled automatically)
```

IF `--dry-run` → display info and EXIT.

### Step 3: Execute

```
1. Confirm (unless --force):
   AskUserQuestion: "Upgrade v{current} → v{target}?"
   Options: [执行 / 取消]

2. Create backup:
   Bash: cp .workflow/state.json .workflow/state.json.backup-v{current}-{timestamp}

3. Run schema migration (handles all intermediate steps automatically):
   Bash: npx tsx src/migrations/run.ts "$(pwd)" --json
   Parse result, display changes.

4. IF failed → display backup restore command → EXIT

5. Load version-specific setup:
   Read: ~/.maestro/workflows/updates/update-v{target}-setup.md
   IF exists → follow completely (hooks, deps, knowledge system config)

6. Display: "v{current} → v{target}: done"
```

### Step 4: Summary

```
=== Update Complete ===
Version: v{current} → v{target}
Backup:  .workflow/state.json.backup-v{current}-{timestamp}

Next steps:
  /manage-status  -- Verify project state
  /maestro        -- Continue workflow
```

</execution>

<success_criteria>
- [ ] Current version detected from state.json
- [ ] Schema migrations run automatically (no manual intermediate steps)
- [ ] Backup created before migration
- [ ] Version-specific setup doc loaded and followed (if exists)
- [ ] --setup-only runs only setup for current version
- [ ] --dry-run previews without executing
- [ ] Summary shows version change and backup path
</success_criteria>

<completion>
### Next-step routing
| Condition | Suggestion |
|-----------|-----------|
| Update complete | `/manage-status` to verify project state |
| Want to continue workflow | `/maestro` |
</completion>
