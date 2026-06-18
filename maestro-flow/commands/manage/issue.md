---
name: manage-issue
description: Create, query, update, close, and link issues
argument-hint: "<subcommand: create|list|status|update|close|link> [--title text] [--severity S] [--status S] [--resolution text]"
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
Issue lifecycle management: create, list, status, update, close, link. Stored in `.workflow/issues/issues.jsonl`. For automated discovery, use `/manage-issue-discover`.
</purpose>

<required_reading>
@~/.maestro/workflows/issue.md
</required_reading>

<deferred_reading>
- [issue.json template](~/.maestro/templates/issue.json) — read when creating or updating issue records (create, update, close)
</deferred_reading>

<context>
$ARGUMENTS -- subcommand + options. Parse first token as subcommand.

**Valid subcommands:**
- `create` -- create a new issue (--title, --severity, --source, --phase, --description)
- `list` -- list issues with optional filters (--status, --phase, --severity, --source)
- `status` -- show full detail for a specific issue (ISS-XXXXXXXX-NNN)
- `update` -- update issue fields (ISS-XXXXXXXX-NNN --status, --priority, --severity, --tags, ...)
- `close` -- close an issue with resolution (ISS-XXXXXXXX-NNN --resolution)
- `link` -- link issue to a task (ISS-XXXXXXXX-NNN --task TASK-NNN)

**State files:**
- `.workflow/issues/issues.jsonl` -- active issues (one JSON per line)
- `.workflow/issues/issue-history.jsonl` -- archived/closed issues
</context>

<execution>
Parse subcommand from first token of $ARGUMENTS.
Follow '~/.maestro/workflows/issue.md' completely.

</execution>

<completion>
### Next-step routing

| Subcommand | Suggestion |
|-----------|-----------|
| create | `/maestro-analyze --gaps <ISS-ID>` or `/maestro-plan --gaps` |
| list | `/maestro-analyze --gaps <ISS-ID>` for open issues |
| close | `/manage-status` |
</completion>

<error_codes>
| Code | Severity | Condition | Recovery |
|------|----------|-----------|----------|
| E_NO_SUBCOMMAND | error | No subcommand provided in $ARGUMENTS | Display valid subcommands, prompt user to select |
| E_INVALID_SUBCOMMAND | error | Unrecognized subcommand | Display valid subcommands with usage hints |
| E_ISSUES_DIR_MISSING | warning | `.workflow/issues/` directory does not exist | Auto-create directory and empty issues.jsonl |
</error_codes>

<success_criteria>
- [ ] Subcommand parsed and routed to correct handler
- [ ] Issue data read/written to correct JSONL file
- [ ] Output displayed in appropriate format (table for list, detail for status)
- [ ] Cross-references maintained (link creates bidirectional references)
- [ ] Next step routed by subcommand
</success_criteria>
