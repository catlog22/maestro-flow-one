---
name: quality-test
description: Use when implementation needs user acceptance testing with interactive verification and gap closure
argument-hint: "[phase] [--smoke] [--auto-fix]"
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
<purpose>
UAT-style conversational testing for a completed phase. Interactive scenario walk-through with severity inference. Issues trigger parallel debug agents and optional gap-fix loop (--auto-fix).
</purpose>

<required_reading>
@~/.maestro/workflows/test.md
</required_reading>

<context>
Phase or task: $ARGUMENTS (optional)

Flags, artifact context resolution, and output directory format defined in workflow test.md.
</context>

<execution>
Follow '~/.maestro/workflows/test.md' completely.

### Phase Gates (MANDATORY, BLOCKING)

**GATE 1: Setup → Test Design**
- REQUIRED: Target resolved (phase or scratch task). E001 if missing.
- REQUIRED: Smoke tests pass (if --smoke). E003 if fail.
- BLOCKED if missing: cannot design tests without resolved target.

**GATE 2: Test Design → Execution**
- REQUIRED: test-plan.json generated with categorized tests mapped to requirements.
- REQUIRED: uat.md created or resumed.
- BLOCKED if plan missing: do not start interactive testing without plan.

**GATE 3: Execution → Completion**
- REQUIRED: All tests presented and responses processed.
- REQUIRED: UAT confidence scored with 4-dimension factor model.
- REQUIRED: Pressure pass completed if > 80% pass rate.
- BLOCKED if incomplete: finish all scenarios before reporting.

**Command-specific extensions (not in workflow):**

**Knowledge context loading** (before test design):
- Wiki search: `maestro search "<phase/feature keywords>" --json` → prior test strategies, recipes, decisions
- Role knowledge: `maestro search --category test` → select relevant → `maestro wiki load <id>`
- Specs + tools: `maestro spec load --category test` → test conventions + discoverable knowhow tools

**Test tool discovery** (knowhow tools as scenario source):
- Load registered test tools: `maestro spec load --category test --keyword <feature>`
- If tools found, extract their steps as additional test scenarios marked `source: "tool"`
- Each numbered step in a tool becomes a UAT test with its assertion as `expected` behavior

**Review findings integration** (from related review artifacts):
- Extract critical/high findings as additional test scenarios, marked `source: "review_finding"`
- When review verdict is "BLOCK" and review-finding tests fail, auto-enter gap-fix loop

**Debug root cause integration** (from related debug artifacts):
- Generate regression test scenarios from confirmed root causes, marked `source: "debug_root_cause"`

**Register artifact on completion:**
```
Append to state.json.artifacts[]:
{
  id: nextArtifactId(artifacts, "test"),  // TST-001
  type: "test",
  milestone: current_milestone,
  phase: target_phase,
  scope: "phase",
  path: "scratch/{YYYYMMDD}-test-P{N}-{slug}",
  status: issues == 0 ? "completed" : "failed",
  depends_on: exec_art.id,
  harvested: false,
  created_at: start_time,
  completed_at: now()
}
```

</execution>

<completion>
### Standalone report

```
--- COMPLETION STATUS ---
STATUS: DONE|DONE_WITH_CONCERNS|NEEDS_RETRY
CONCERNS: {description if applicable}
--- END STATUS ---
```

### Ralph-invoked completion

End the step by calling the CLI (no text block output):
```
maestro ralph complete <idx> --status {STATUS} [--evidence {path}]
```

### Next-step routing

| Condition | Suggestion |
|-----------|-----------|
| All tests pass | `/maestro-milestone-audit` |
| --auto-fix succeeded | `/maestro-execute {phase}` |
| --auto-fix gaps remain | `/quality-debug --from-uat {phase}` |
| Manual fix needed | `/quality-debug --from-uat {phase}` |
| Coverage below threshold | `/quality-auto-test {phase}` |
</completion>

<error_codes>
| Code | Severity | Condition | Recovery |
|------|----------|-----------|----------|
| E001 | error | Phase or task target required (no active sessions) | Prompt user for phase number |
| E002 | error | Phase not verified yet (no verification.json) | Suggest `/maestro-execute` first (verification is built-in) |
| E003 | error | Smoke test failed (app won't start) | Suggest `/quality-debug` |
| W001 | warning | One or more test scenarios failed | Auto-diagnose, suggest fix options |
| W002 | warning | Coverage below threshold | Suggest `/quality-auto-test` |
</error_codes>

<success_criteria>
- [ ] Target resolved (phase or scratch task)
- [ ] Active sessions checked, resume offered if applicable
- [ ] Smoke tests run if --smoke flag set
- [ ] test-plan.json generated with categorized tests mapped to requirements
- [ ] uat.md created/resumed with all tests
- [ ] Tests presented one at a time with expected behavior
- [ ] User responses processed as pass/issue/skip
- [ ] Severity inferred from natural language (never asked)
- [ ] Batched writes: on issue, every 5 passes, or completion
- [ ] test-results.json and coverage-report.json written
- [ ] UAT confidence scored with 4-dimension factor model
- [ ] Readiness gate checked before final report
- [ ] Pressure pass completed if > 80% pass rate
- [ ] Confidence summary appended to uat.md
- [ ] index.json uat fields updated
- [ ] If issues: parallel debug agents spawned per gap cluster
- [ ] Gaps updated with root_cause, fix_direction, affected_files
- [ ] Gap-fix loop triggered if --auto-fix (max 2 iterations)
- [ ] Next step routed (phase-transition if pass, verify if auto-fix success, debug --from-uat if issues, test-gen if low coverage)
</success_criteria>
