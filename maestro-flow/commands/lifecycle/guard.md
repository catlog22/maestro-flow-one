---
name: maestro-guard
description: Manage editing boundary restrictions
argument-hint: "<on|off|status|allow <path>|deny <path>>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---
<purpose>
Configure directory-level write boundaries enforced by the workflow-guard PreToolUse hook.
Subcommands: on, off, status, allow `<path>`, deny `<path>`.
</purpose>

<context>
$ARGUMENTS — Parse subcommand and optional path argument.

**Config location:** `.workflow/config.json` → `guard` section

```json
{
  "guard": {
    "enabled": false,
    "mode": "allow",
    "paths": []
  }
}
```

**Enforcement:** The `workflow-guard` hook (PreToolUse on Write/Edit) reads this config
and blocks operations targeting files outside boundaries. Requires hooks level >= `full`.
</context>

<execution>

**Step 1: Parse subcommand**

Extract from $ARGUMENTS:
- `on` / `off` / `status` / `allow <path>` / `deny <path>`
- If no subcommand, default to `status`

**Step 2: Read config**

Read `.workflow/config.json`. If file missing, initialize with empty guard section.

**Step 3: Execute subcommand**

**`status`:**
- Display: enabled/disabled, mode (allow/deny), paths list
- Check if workflow-guard hook is active (read `.claude/settings.json` for hook presence)
- If guard enabled but hook not active, warn: "⚠ PathGuard enabled but workflow-guard hook not installed. Run `maestro hooks level full` to activate."

**`on`:**
- Set `guard.enabled = true`
- If `guard.paths` is empty, set default: `["src/", "tests/", ".workflow/"]`
- Check hook level, warn if < full
- Write config

**`off`:**
- Set `guard.enabled = false`
- Preserve existing paths and mode
- Write config

**`allow <path>`:**
- Normalize path to forward slashes, ensure trailing slash for directories
- If `guard.mode` is `deny`, AskUserQuestion: "Switching from deny to allow mode will clear existing paths ({N} paths). Continue?" — abort if user declines.
- Add path to `guard.paths` (deduplicate)
- Set `guard.enabled = true` if not already
- Write config

**`deny <path>`:**
- Normalize path to forward slashes, ensure trailing slash for directories
- If `guard.mode` is `allow`, AskUserQuestion: "Switching from allow to deny mode will clear existing paths ({N} paths). Continue?" — abort if user declines.
- Set `guard.mode = "deny"`
- Add path to `guard.paths` (deduplicate)
- Set `guard.enabled = true` if not already (symmetric with `allow`: adding a deny path auto-enables the guard)
- Write config

**Step 4: Confirm**

Display updated guard configuration.

</execution>

<error_codes>
- E001: `.workflow/config.json` not found and cannot be created (not a maestro project)
- W001: PathGuard enabled but workflow-guard hook not installed
</error_codes>

<success_criteria>
- [ ] Config read/written correctly
- [ ] Hook level warning displayed when applicable
- [ ] Updated configuration shown after changes
</success_criteria>

<completion>
### Next-step routing
| Condition | Suggestion |
|-----------|-----------|
| Guard enabled, hook not installed | `maestro hooks level full` |
| Want to verify guard works | Edit a file outside allowed paths |
</completion>
