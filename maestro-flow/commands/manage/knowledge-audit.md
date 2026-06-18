---
name: manage-knowledge-audit
description: Audit and prune knowledge across spec / knowhow / artifact stores
argument-hint: "--scope <spec|knowhow|artifact|all> [--level P0|P1|P2] [--timeline T1..T6] [--since YYYY-MM-DD] [--milestone <name>] [--include-archive] [--interactive] [--mark|--delete|--purge] [--dry-run] [--report]"
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
审查 spec/knowhow/artifact 存储，识别矛盾/失效/孤儿，通过 keep/deprecate/delete 三态清理。对称于 `manage-harvest`（写入入口）。
</purpose>

<required_reading>
@~/.maestro/workflows/knowledge-audit.md
</required_reading>

<deferred_reading>
- @~/.maestro/workflows/harvest.md (audit 检测的 artifact 是 harvest 的产物源)
- @~/.maestro/workflows/specs-add.md (deprecate 操作所需的 `<spec-entry>` 变形)
</deferred_reading>

<context>
Arguments: $ARGUMENTS

**Scope（必选）：** `spec` | `knowhow` | `artifact` | `all`

**删除策略**默认 `--interactive`（三态面板逐项决策）；非交互模式 `--mark`（仅打标）/ `--delete`（软删到 `.trash/`）/ `--purge`（物理擦除，仅 artifact 且需双重确认）。

Flag 全集、scope 对应的扫描路径、Stage 步骤、检测算法定义在 workflow knowledge-audit.md。
</context>

<execution>
Follow `~/.maestro/workflows/knowledge-audit.md` Stages 1-8 in order.

### Phase Gates (MANDATORY, BLOCKING)

**GATE 1: Load → Detect** (Stages 1-2 → Stage 4)
- REQUIRED: Scope 解析通过，互斥标志校验完成。
- REQUIRED: 三存储按 scope 加载完成。
- BLOCKED if scope 非法或存储不可读: E001/E002。

**GATE 2: Detect → Decision** (Stage 4 → Stage 5)
- REQUIRED: Finding 池按 P0/P1/P2 分级输出。
- REQUIRED: 未 harvest 的 artifact 删除前触发抢救确认（W002）。
- BLOCKED if finding 为空: 无需淘汰，直接输出报告。

**GATE 3: Decision → Mutate** (Stage 5 → Stage 6-7)
- REQUIRED: Backup tarball 生成于 `.workflow/.trash/knowledge-audit-{timestamp}/`。
- REQUIRED: 备份成功后方可执行变更。
- REQUIRED: `--purge` 需双重确认（仅 artifact scope）。
- BLOCKED if 备份失败: E005，禁止执行变更。

### Execution Constraints

- **Deprecate over delete**: 文本存储首选 `status="deprecated"`，保留历史。
- **Purge 仅 artifact**: `--purge` 不作用于 spec/knowhow。
- **Rescue before delete**: 未抽取 artifact 删除前强制提示先 `/manage-harvest`。
</execution>

<completion>
### Next-step routing

| Condition | Suggestion |
|-----------|-----------|
| 复审淘汰记录 | 查看 `audit-report-{date}.md` |
| 抢救未抽取 artifact | `/manage-harvest <artifact-id>` |
| 验证 spec 现状 | `/spec-load --role implement` |
| 周期巡检 | `--scope all --report` |
</completion>

<error_codes>
| Code | Severity | Condition | Recovery |
|------|----------|-----------|----------|
| E001 | error | `.workflow/` 未初始化 | 先跑 `/maestro-init` |
| E002 | error | `--scope` 缺失或非法 | 提供 spec/knowhow/artifact/all |
| E003 | error | `--purge` 与 `--dry-run` 同用 | 二选一 |
| E004 | error | `--purge` 作用于非 artifact 范围 | purge 仅支持 artifact scope |
| E005 | error | 备份失败（`.trash/` 写入异常） | 检查磁盘空间与权限，重试 |
| W001 | warning | 检出冲突但用户选择 keep | 记入 report，不阻断 |
| W002 | warning | 待删 artifact 无 harvest-log 记录 | 提示先跑 manage-harvest |
| W003 | warning | 循环 supersedes 链 | 自动断环或交互选保留节点 |
| W004 | warning | 检测耗时 >120s（大规模 spec 库） | 建议加 `--scope` 收敛或 `--since` 增量 |
| W005 | warning | LLM detector 不可用 | 降级到正则+图算法子集，跳过 B/G 类语义场景 |
</error_codes>

<success_criteria>
- [ ] Scope 正确解析，互斥标志校验通过
- [ ] 三存储按 scope 加载完成，构建出统一 finding 池
- [ ] Stage 3 时间线索引建立（mtime ↔ session/milestone 状态）
- [ ] Stage 4 按 P0/P1/P2 输出 finding 列表
- [ ] 如非 `--report`：用户对每项做出三态决策
- [ ] 未 harvest 的 artifact 删除前触发抢救确认
- [ ] Stage 6 backup tarball 生成于 `.workflow/.trash/`
- [ ] `deprecate` 通过元数据注入完成（spec/knowhow 文件未被物理删除）
- [ ] `delete` 移动至 `.trash/`，索引同步更新
- [ ] `purge` 仅在双重确认通过后执行
- [ ] `audit-report-{date}.md` + `audit-log.jsonl` 写入完成
- [ ] 摘要展示三存储变更计数与下一步路由
</success_criteria>
