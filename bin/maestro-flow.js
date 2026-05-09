#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

// --- Path resolution ---
// Package root: ../ relative to this script
const PKG_ROOT = path.join(__dirname, "..");
const VARIANTS = {
  codex: path.join(PKG_ROOT, "codex", "maestro-flow"),
  claude: path.join(PKG_ROOT, "claude", "maestro-flow"),
};
const DEFAULT_VARIANT = "codex";

// Resolve active variant: check installed first (project -> global), then package
function getSkillRoot(variant) {
  if (variant && VARIANTS[variant]) return VARIANTS[variant];

  const home = process.env.HOME || process.env.USERPROFILE;
  // Check installed locations: project first, then global
  const candidates = [
    path.join(process.cwd(), ".codex", "skills", "maestro-flow"),
    path.join(process.cwd(), ".claude", "skills", "maestro-flow"),
    path.join(home, ".codex", "skills", "maestro-flow"),
    path.join(home, ".claude", "skills", "maestro-flow"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "SKILL.md"))) return c;
  }
  return VARIANTS[DEFAULT_VARIANT];
}

let SKILL_ROOT = getSkillRoot();
let COMMANDS_DIR = path.join(SKILL_ROOT, "commands");
let CHAINS_FILE = path.join(SKILL_ROOT, "chains", "templates.json");

function setVariant(variant) {
  SKILL_ROOT = getSkillRoot(variant);
  COMMANDS_DIR = path.join(SKILL_ROOT, "commands");
  CHAINS_FILE = path.join(SKILL_ROOT, "chains", "templates.json");
}

// --- Name mapping ---
const PREFIX_CATEGORY = [
  ["maestro-milestone-", "milestone"],
  ["maestro-ralph-", "lifecycle"],
  ["maestro-", "lifecycle"],
  ["quality-", "quality"],
  ["manage-", "manage"],
  ["learn-", "learn"],
  ["spec-", "spec"],
  ["wiki-", "wiki"],
];

// --- Helpers ---

function parseFrontmatter(filepath) {
  const text = fs.readFileSync(filepath, "utf-8");
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("-") || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf(":");
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      fm[key] = val;
    }
  }
  return fm;
}

function extractPurpose(filepath) {
  const text = fs.readFileSync(filepath, "utf-8");
  const match = text.match(/<purpose>\s*\n([\s\S]*?)<\/purpose>/);
  return match ? match[1].trim().slice(0, 200) : "";
}

function resolveCommand(name) {
  for (const [prefix, category] of PREFIX_CATEGORY) {
    if (name.startsWith(prefix)) {
      let filename = name.slice(prefix.length) + ".md";
      if (!filename || filename === ".md") filename = name + ".md";
      const p = path.join(COMMANDS_DIR, category, filename);
      if (fs.existsSync(p)) return p;
    }
  }
  // Fallback: scan all categories
  if (fs.existsSync(COMMANDS_DIR)) {
    for (const cat of fs.readdirSync(COMMANDS_DIR)) {
      const catDir = path.join(COMMANDS_DIR, cat);
      if (!fs.statSync(catDir).isDirectory()) continue;
      for (const f of fs.readdirSync(catDir).filter((x) => x.endsWith(".md"))) {
        const fm = parseFrontmatter(path.join(catDir, f));
        if (fm.name === name) return path.join(catDir, f);
      }
    }
  }
  return null;
}

function loadChains() {
  if (!fs.existsSync(CHAINS_FILE)) return {};
  return JSON.parse(fs.readFileSync(CHAINS_FILE, "utf-8"));
}

function findSessions(workDir, all) {
  const maestroDir = path.join(workDir, ".workflow", ".maestro");
  if (!fs.existsSync(maestroDir)) return [];
  const sessions = [];
  for (const d of fs.readdirSync(maestroDir).sort().reverse()) {
    const statusFile = path.join(maestroDir, d, "status.json");
    if (!fs.existsSync(statusFile)) continue;
    const data = JSON.parse(fs.readFileSync(statusFile, "utf-8"));
    data._path = statusFile;
    if (data.source === "flow" || all) sessions.push(data);
  }
  return sessions;
}

function writeSession(session) {
  const p = session._path;
  const data = { ...session };
  delete data._path;
  data.updated_at = new Date().toISOString();
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
}

// --- Commands ---

function cmdList(args) {
  const categoryFilter = args.category;
  if (!fs.existsSync(COMMANDS_DIR)) {
    console.log("Commands directory not found:", COMMANDS_DIR);
    return;
  }
  const categories = fs
    .readdirSync(COMMANDS_DIR)
    .filter((d) => fs.statSync(path.join(COMMANDS_DIR, d)).isDirectory())
    .sort()
    .filter((c) => !categoryFilter || c === categoryFilter);

  let total = 0;
  console.log(
    `${"Category".padEnd(14)} ${"Command".padEnd(30)} Description`
  );
  console.log(`${"-".repeat(13)}  ${"-".repeat(29)} ${"-".repeat(40)}`);

  for (const cat of categories) {
    const catDir = path.join(COMMANDS_DIR, cat);
    const files = fs.readdirSync(catDir).filter((f) => f.endsWith(".md")).sort();
    for (const f of files) {
      const fm = parseFrontmatter(path.join(catDir, f));
      const name = fm.name || f.replace(".md", "");
      const desc = (fm.description || "").slice(0, 50);
      console.log(`${cat.padEnd(14)} ${name.padEnd(30)} ${desc}`);
      total++;
    }
  }
  console.log(`\nTotal: ${total} commands`);
}

function cmdShow(args) {
  const cmdPath = resolveCommand(args.name);
  if (!cmdPath) {
    console.log(`Command not found: ${args.name}`);
    process.exit(1);
  }
  const fm = parseFrontmatter(cmdPath);
  const purpose = extractPurpose(cmdPath);
  const relPath = path.relative(SKILL_ROOT, cmdPath);

  console.log(`+${"-".repeat(50)}+`);
  console.log(`| ${(fm.name || args.name).padEnd(48)} |`);
  console.log(`| ${(fm.description || "").slice(0, 48).padEnd(48)} |`);
  console.log(`+${"-".repeat(50)}+`);
  if (fm["argument-hint"]) {
    console.log(`| Args: ${fm["argument-hint"].slice(0, 42).padEnd(42)}   |`);
  }
  console.log(`| File: ${relPath.slice(0, 42).padEnd(42)}   |`);
  if (purpose) {
    console.log(`+${"-".repeat(50)}+`);
    // Simple word wrap
    const words = purpose.split(/\s+/);
    let line = "";
    for (const w of words) {
      if (line.length + w.length + 1 > 48) {
        console.log(`| ${line.padEnd(48)} |`);
        line = w;
      } else {
        line = line ? line + " " + w : w;
      }
    }
    if (line) console.log(`| ${line.padEnd(48)} |`);
  }
  console.log(`+${"-".repeat(50)}+`);
}

function cmdChains(args) {
  const data = loadChains();
  let templates = data.templates || {};
  if (args.category) {
    templates = Object.fromEntries(
      Object.entries(templates).filter(([, v]) => v.category === args.category)
    );
  }
  console.log(
    `${"Template".padEnd(25)} ${"Category".padEnd(16)} ${"Steps".padStart(5)}  Description`
  );
  console.log(
    `${"-".repeat(24)}  ${"-".repeat(15)} ${"-".repeat(5)}  ${"-".repeat(35)}`
  );
  for (const [name, tmpl] of Object.entries(templates)) {
    const steps = (tmpl.steps || []).length;
    const desc = (tmpl.description || "").slice(0, 35);
    const cat = tmpl.category || "";
    console.log(
      `${name.padEnd(25)} ${cat.padEnd(16)} ${String(steps).padStart(5)}  ${desc}`
    );
  }
  console.log(`\nTotal: ${Object.keys(templates).length} templates`);
}

function cmdChain(args) {
  const data = loadChains();
  const tmpl = (data.templates || {})[args.name];
  if (!tmpl) {
    console.log(`Chain template not found: ${args.name}`);
    process.exit(1);
  }
  console.log(`\n  Chain: ${args.name}`);
  console.log(`  Category: ${tmpl.category || ""}`);
  console.log(`  Description: ${tmpl.description || ""}`);
  console.log(`  Triggers: ${(tmpl.triggers || []).join(", ")}`);
  console.log(`\n  Steps:`);
  for (let i = 0; i < (tmpl.steps || []).length; i++) {
    const s = tmpl.steps[i];
    const badge =
      s.type === "external" ? "*" : s.type === "decision" ? ">" : " ";
    console.log(
      `    ${i}. ${badge} ${s.cmd} ${s.args || ""}  [${s.type}]`
    );
  }
  console.log();
}

function cmdSuggest(args) {
  const intent = args.intent.toLowerCase();
  const data = loadChains();
  const matches = [];

  for (const [name, tmpl] of Object.entries(data.templates || {})) {
    let score = 0;
    const matched = [];
    for (const trigger of tmpl.triggers || []) {
      if (intent.includes(trigger.toLowerCase())) {
        score += trigger.length;
        matched.push(trigger);
      }
    }
    if (score > 0) matches.push({ score, name, tmpl, matched });
  }

  matches.sort((a, b) => b.score - a.score);

  if (!matches.length) {
    // Check single_commands
    for (const [key, cmd] of Object.entries(data.single_commands || {})) {
      if (intent.includes(key)) {
        console.log(`\nSuggested single command:`);
        console.log(`  ${cmd}  (match: ${key})`);
        return;
      }
    }
    console.log("No matching chain found. Try: maestro-flow chains");
    return;
  }

  console.log(`\nSuggested chains for: "${args.intent}"`);
  for (let i = 0; i < Math.min(3, matches.length); i++) {
    const m = matches[i];
    const steps = (m.tmpl.steps || []).length;
    console.log(
      `  ${i + 1}. ${m.name.padEnd(25)} ${(m.tmpl.description || "").padEnd(35)} (${steps} steps, match: ${m.matched.join(", ")})`
    );
  }
}

function cmdResolve(args) {
  const p = resolveCommand(args.name);
  if (p) {
    console.log(p);
  } else {
    console.error(`NOT_FOUND: ${args.name}`);
    process.exit(1);
  }
}

function cmdStatus(args) {
  const sessions = findSessions(process.cwd(), true);
  const filtered = args.sessionId
    ? sessions.filter((s) => s.session_id === args.sessionId)
    : sessions.filter((s) => s.status === "running");
  const list = filtered.length ? filtered : sessions;

  if (!list.length) {
    console.log("No flow sessions found.");
    return;
  }

  const session = list[0];
  const steps = session.steps || [];
  const total = steps.length;
  const completed = steps.filter((s) => s.status === "completed").length;

  console.log(`\n  Session:  ${session.session_id || "?"}`);
  console.log(`  Status:   ${session.status || "?"}`);
  console.log(`  Source:   ${session.source || "?"}`);
  console.log(`  Chain:    ${session.chain_name || "?"} (${total} steps)`);
  console.log(`  Intent:   ${(session.intent || "").slice(0, 60)}`);
  if (session.phase) console.log(`  Phase:    ${session.phase}`);
  console.log(
    `  Progress: ${completed}/${total} (${total ? Math.round((completed / total) * 100) : 0}%)`
  );
  console.log(`\n  Steps:`);

  for (const step of steps) {
    const icon = { completed: "done", running: " >> ", failed: "FAIL", skipped: "skip", pending: "    " }[step.status] || "    ";
    const badge = step.type === "external" ? "*" : step.type === "decision" ? ">" : " ";
    console.log(
      `    [${icon}] ${step.index}. ${badge} ${step.skill} ${step.args || ""}  [${step.type}]`
    );
  }
  console.log();
}

function cmdSessions(args) {
  const sessions = findSessions(process.cwd(), !!args.all);
  if (!sessions.length) {
    console.log("No sessions found.");
    return;
  }
  console.log(
    `${"Session ID".padEnd(30)} ${"Status".padEnd(12)} ${"Source".padEnd(8)} ${"Chain".padEnd(20)} Intent`
  );
  console.log(
    `${"-".repeat(29)}  ${"-".repeat(11)} ${"-".repeat(7)} ${"-".repeat(19)} ${"-".repeat(30)}`
  );
  for (const s of sessions.slice(0, 20)) {
    console.log(
      `${(s.session_id || "?").padEnd(30)} ${(s.status || "?").padEnd(12)} ${(s.source || "?").padEnd(8)} ${(s.chain_name || "?").slice(0, 19).padEnd(20)} ${(s.intent || "").slice(0, 30)}`
    );
  }
}

function cmdStep(args) {
  const sessions = findSessions(process.cwd(), true);
  const session = sessions.find((s) => s.session_id === args.sessionId);
  if (!session) {
    console.log(`Session not found: ${args.sessionId}`);
    process.exit(1);
  }
  const idx = parseInt(args.index);
  const steps = session.steps || [];
  if (idx < 0 || idx >= steps.length) {
    console.log(`Invalid step index: ${idx} (0-${steps.length - 1})`);
    process.exit(1);
  }
  const valid = ["pending", "running", "completed", "failed", "skipped"];
  if (!valid.includes(args.status)) {
    console.log(`Invalid status: ${args.status}. Use: ${valid.join(", ")}`);
    process.exit(1);
  }
  steps[idx].status = args.status;
  const now = new Date().toISOString();
  if (args.status === "running") steps[idx].started_at = now;
  else if (["completed", "failed", "skipped"].includes(args.status))
    steps[idx].completed_at = now;

  writeSession(session);
  console.log(`Step ${idx} -> ${args.status}`);
}

function cmdNext(args) {
  const sessions = findSessions(process.cwd(), true);
  const filtered = args.sessionId
    ? sessions.filter((s) => s.session_id === args.sessionId)
    : sessions.filter((s) => s.status === "running");

  if (!filtered.length) {
    console.log("NO_SESSION");
    return;
  }

  const session = filtered[0];
  const steps = session.steps || [];
  const total = steps.length;

  const pending = steps.find((s) => s.status === "pending");
  if (!pending) {
    session.status = "completed";
    writeSession(session);
    console.log("SESSION_COMPLETE");
    return;
  }

  const idx = pending.index;
  pending.status = "running";
  pending.started_at = new Date().toISOString();
  session.current_step = idx;
  writeSession(session);

  console.log(`STEP: ${idx}/${total - 1}`);
  console.log(`TYPE: ${pending.type}`);
  console.log(`SKILL: ${pending.skill}`);
  console.log(`ARGS: ${pending.args || ""}`);

  if (pending.type === "decision") {
    console.log(`DECISION: ${pending.decision || ""}`);
    console.log(`RETRY: ${pending.retry_count || 0}/${pending.max_retries || 2}`);
    console.log("---COMMAND---");
    console.log("(decision node - evaluate via Agent)");
    return;
  }

  const cmdPath = resolveCommand(pending.skill);
  if (!cmdPath) {
    console.log(`RESOLVE_FAILED: ${pending.skill}`);
    return;
  }

  console.log(`PATH: ${cmdPath}`);
  console.log("---COMMAND---");
  console.log(fs.readFileSync(cmdPath, "utf-8"));
}

function cmdDone(args) {
  const sessions = findSessions(process.cwd(), true);
  const filtered = args.sessionId
    ? sessions.filter((s) => s.session_id === args.sessionId)
    : sessions.filter((s) => s.status === "running");

  if (!filtered.length) {
    console.log("NO_SESSION");
    return;
  }

  const session = filtered[0];
  const steps = session.steps || [];

  const running = steps.find((s) => s.status === "running");
  if (!running) {
    console.log("NO_RUNNING_STEP");
    return;
  }

  running.status = "completed";
  running.completed_at = new Date().toISOString();
  writeSession(session);

  console.log(`COMPLETED: ${running.index} ${running.skill || "?"}`);

  const nextPending = steps.find((s) => s.status === "pending");
  if (!nextPending) {
    // Reload and mark session complete
    const data = JSON.parse(fs.readFileSync(session._path, "utf-8"));
    data.status = "completed";
    data.updated_at = new Date().toISOString();
    fs.writeFileSync(session._path, JSON.stringify(data, null, 2), "utf-8");
    console.log("SESSION_COMPLETE");
  } else {
    console.log(
      `NEXT: ${nextPending.index} ${nextPending.skill || "?"} [${nextPending.type || "internal"}]`
    );
  }
}

function cmdReset(args) {
  const sessions = findSessions(process.cwd(), true);
  const session = sessions.find((s) => s.session_id === args.sessionId);
  if (!session) {
    console.log(`Session not found: ${args.sessionId}`);
    process.exit(1);
  }
  let count = 0;
  for (const step of session.steps || []) {
    if (step.status === "failed" || step.status === "running") {
      step.status = "pending";
      delete step.error;
      delete step.started_at;
      delete step.completed_at;
      count++;
    }
  }
  session.status = "running";
  writeSession(session);
  console.log(`Reset ${count} steps to pending. Session status -> running.`);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

function countMd(dir) {
  let n = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) n += countMd(path.join(dir, entry.name));
    else if (entry.name.endsWith(".md")) n++;
  }
  return n;
}

function rmDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) rmDir(p);
    else fs.unlinkSync(p);
  }
  fs.rmdirSync(dir);
}

// Resolve target skills directory per variant and scope
// codex -> .codex/skills/   claude -> .claude/skills/
function resolveSkillsDir(variant, args) {
  const dotDir = variant === "codex" ? ".codex" : ".claude";
  if (args.project) {
    return path.join(path.resolve(args.project), dotDir, "skills");
  }
  const home = process.env.HOME || process.env.USERPROFILE;
  return path.join(home, dotDir, "skills");
}

// Resolve target agents directory per variant and scope
// codex -> .codex/agents/   claude -> .claude/agents/
function resolveAgentsDir(variant, args) {
  const dotDir = variant === "codex" ? ".codex" : ".claude";
  if (args.project) {
    return path.join(path.resolve(args.project), dotDir, "agents");
  }
  const home = process.env.HOME || process.env.USERPROFILE;
  return path.join(home, dotDir, "agents");
}

function cmdInstall(args) {
  const variant = args.variant || "all";
  const validVariants = ["codex", "claude", "all"];

  if (!validVariants.includes(variant)) {
    console.log(`Invalid variant: ${variant}. Use: ${validVariants.join(", ")}`);
    process.exit(1);
  }

  const scope = args.project ? "project" : "global";
  console.log(`Install scope: ${scope}`);
  console.log();

  const toInstall = variant === "all" ? ["codex", "claude"] : [variant];

  for (const v of toInstall) {
    const source = VARIANTS[v];
    const skillsDir = resolveSkillsDir(v, args);
    const skillName = "maestro-flow";
    const skillTarget = path.join(skillsDir, skillName);

    console.log(`Installing [${v}] -> ${skillName}`);
    console.log(`  Source: ${source}`);
    console.log(`  Target: ${skillTarget}`);

    if (!fs.existsSync(path.join(source, "SKILL.md"))) {
      console.error(`  Error: SKILL.md not found in ${source}`);
      continue;
    }

    copyDir(source, skillTarget);

    const cmdCount = countMd(path.join(skillTarget, "commands"));
    console.log(`  Commands: ${cmdCount}`);

    // Install agents to the proper location (outside skill dir)
    const agentsSource = path.join(source, "agents");
    if (fs.existsSync(agentsSource)) {
      const agentsTarget = resolveAgentsDir(v, args);
      fs.mkdirSync(agentsTarget, { recursive: true });
      let agentCount = 0;
      for (const entry of fs.readdirSync(agentsSource)) {
        const srcPath = path.join(agentsSource, entry);
        if (fs.statSync(srcPath).isFile()) {
          fs.copyFileSync(srcPath, path.join(agentsTarget, entry));
          agentCount++;
        }
      }
      console.log(`  Agents:   ${agentCount} -> ${agentsTarget}`);
    }
    console.log();
  }

  console.log("Installation complete!");
  if (variant === "all") {
    console.log("  .codex/skills/maestro-flow/  -> codex (spawn_agents_on_csv)");
    console.log("  .claude/skills/maestro-flow/ -> claude (Skill + delegate)");
    console.log("  .codex/agents/              -> codex agent definitions");
    console.log("  .claude/agents/             -> claude agent definitions");
  } else {
    const dotDir = variant === "codex" ? ".codex" : ".claude";
    console.log(`  ${dotDir}/skills/maestro-flow/ -> ${variant}`);
    console.log(`  ${dotDir}/agents/             -> ${variant} agent definitions`);
  }
  console.log();
  console.log("Usage:");
  console.log('  /maestro-flow "your intent"');
  console.log("  maestro-flow list");
}

function cmdUninstall(args) {
  const variant = args.variant || "all";
  const toUninstall = variant === "all" ? ["codex", "claude"] : [variant];
  const scope = args.project ? "project" : "global";

  let removed = 0;
  for (const v of toUninstall) {
    const skillsDir = resolveSkillsDir(v, args);
    const skillTarget = path.join(skillsDir, "maestro-flow");
    if (!fs.existsSync(skillTarget)) continue;
    const cmdCount = countMd(path.join(skillTarget, "commands"));
    const dotDir = v === "codex" ? ".codex" : ".claude";
    rmDir(skillTarget);
    console.log(`Uninstalled ${dotDir}/skills/maestro-flow (${cmdCount} commands) [${scope}]`);
    removed++;
  }

  if (!removed) {
    console.log(`Maestro Flow not found [${scope}]`);
  } else {
    console.log();
    console.log("Global CLI still available. Remove: npm uninstall -g maestro-flow-one");
  }
}

// --- CLI Parser ---

function parseArgs() {
  const args = process.argv.slice(2);
  if (!args.length) {
    printHelp();
    return;
  }

  const cmd = args[0];
  const rest = args.slice(1);

  // Parse flags
  const flags = {};
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--category" || rest[i] === "-c") {
      flags.category = rest[++i];
    } else if (rest[i] === "--all" || rest[i] === "-a") {
      flags.all = true;
    } else if (rest[i] === "--project" || rest[i] === "-p") {
      flags.project = rest[++i];
    } else if (rest[i] === "--variant" || rest[i] === "-v") {
      flags.variant = rest[++i];
    } else {
      positional.push(rest[i]);
    }
  }

  // Apply variant for query commands
  if (flags.variant) setVariant(flags.variant);

  switch (cmd) {
    case "list":
      return cmdList({ category: flags.category });
    case "show":
      if (!positional[0]) { console.log("Usage: maestro-flow show <command-name>"); return; }
      return cmdShow({ name: positional[0] });
    case "chains":
      return cmdChains({ category: flags.category });
    case "chain":
      if (!positional[0]) { console.log("Usage: maestro-flow chain <template-name>"); return; }
      return cmdChain({ name: positional[0] });
    case "suggest":
      if (!positional[0]) { console.log("Usage: maestro-flow suggest <intent-text>"); return; }
      return cmdSuggest({ intent: positional.join(" ") });
    case "resolve":
      if (!positional[0]) { console.log("Usage: maestro-flow resolve <command-name>"); return; }
      return cmdResolve({ name: positional[0] });
    case "status":
      return cmdStatus({ sessionId: positional[0] });
    case "sessions":
      return cmdSessions({ all: flags.all });
    case "step":
      if (positional.length < 3) { console.log("Usage: maestro-flow step <session-id> <index> <status>"); return; }
      return cmdStep({ sessionId: positional[0], index: positional[1], status: positional[2] });
    case "next":
      return cmdNext({ sessionId: positional[0] });
    case "done":
      return cmdDone({ sessionId: positional[0] });
    case "reset":
      if (!positional[0]) { console.log("Usage: maestro-flow reset <session-id>"); return; }
      return cmdReset({ sessionId: positional[0] });
    case "install":
      return cmdInstall({ project: flags.project || positional[0], variant: flags.variant });
    case "uninstall":
      return cmdUninstall({ project: flags.project || positional[0], variant: flags.variant });
    case "help":
    case "--help":
    case "-h":
      return printHelp();
    default:
      console.log(`Unknown command: ${cmd}`);
      printHelp();
  }
}

function printHelp() {
  console.log(`
Maestro Flow CLI - command discovery, chain management, session tracking

Usage: maestro-flow <command> [options]

Commands:
  list [--category <cat>]              List available commands
  show <command-name>                  Display command details
  chains [--category <cat>]            List chain templates
  chain <template-name>                Show chain details
  suggest <intent-text>                Suggest chain for intent
  resolve <command-name>               Resolve command name to file path
  status [session-id]                  Show session status
  sessions [--all]                     List sessions
  next [session-id]                    Load next pending step
  done [session-id]                    Complete current step
  step <session-id> <index> <status>   Update step status
  reset <session-id>                   Reset failed session
  install [--variant codex|claude|all]  Install skill (default: all)
  uninstall [--variant codex|claude|all] Remove skill

Options:
  --variant, -v <name>     Select variant: codex, claude, all (default: all)
                           codex  -> .codex/skills/maestro-flow/
                           claude -> .claude/skills/maestro-flow/
                           all    -> both
  --project, -p <dir>      Install to project dir (default: global ~/.claude|.codex)
  --category, -c <cat>     Filter by category (list, chains)
  --all, -a                Show all sessions (sessions)
`);
}

parseArgs();
