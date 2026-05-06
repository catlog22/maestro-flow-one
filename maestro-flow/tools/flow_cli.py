#!/usr/bin/env python3
"""
Maestro Flow CLI — command discovery, chain management, and session tracking.

Usage:
    python flow_cli.py <command> [options]

Commands:
    list [--category <cat>]           List available commands
    show <command-name>               Display command details
    chains [--category <cat>]         List chain templates
    chain <template-name>             Show chain details
    status [session-id]               Show session status
    sessions [--all]                  List sessions
    suggest <intent-text>             Suggest chain for intent
    resolve <command-name>            Resolve command name to file path
    step <session-id> <idx> <status>  Update step status
    reset <session-id>                Reset failed session
"""

import argparse
import json
import re
import sys
import textwrap
from datetime import datetime
from pathlib import Path

# Resolve skill root (this script lives in tools/)
SKILL_ROOT = Path(__file__).resolve().parent.parent
COMMANDS_DIR = SKILL_ROOT / "commands"
CHAINS_FILE = SKILL_ROOT / "chains" / "templates.json"

# Category → prefix mapping (for resolve)
CATEGORY_PREFIX = {
    "lifecycle": "maestro-",
    "milestone": "maestro-milestone-",
    "quality": "quality-",
    "manage": "manage-",
    "learn": "learn-",
    "spec": "spec-",
    "wiki": "wiki-",
}

# Reverse: prefix → category (ordered longest first)
PREFIX_CATEGORY = [
    ("maestro-milestone-", "milestone"),
    ("maestro-ralph-", "lifecycle"),
    ("maestro-", "lifecycle"),
    ("quality-", "quality"),
    ("manage-", "manage"),
    ("learn-", "learn"),
    ("spec-", "spec"),
    ("wiki-", "wiki"),
]


def parse_frontmatter(filepath: Path) -> dict:
    """Parse YAML-like frontmatter from .md file."""
    text = filepath.read_text(encoding="utf-8")
    match = re.match(r"^---\s*\n(.*?)\n---", text, re.DOTALL)
    if not match:
        return {}
    fm = {}
    for line in match.group(1).splitlines():
        line = line.strip()
        if ":" in line and not line.startswith("-") and not line.startswith("#"):
            key, _, val = line.partition(":")
            fm[key.strip()] = val.strip().strip('"').strip("'")
    return fm


def extract_purpose(filepath: Path) -> str:
    """Extract <purpose> section from .md file."""
    text = filepath.read_text(encoding="utf-8")
    match = re.search(r"<purpose>\s*\n(.*?)</purpose>", text, re.DOTALL)
    if match:
        return match.group(1).strip()[:200]
    return ""


def resolve_command(name: str) -> Path | None:
    """Resolve command name to file path within commands/."""
    # Try each prefix
    for prefix, category in PREFIX_CATEGORY:
        if name.startswith(prefix):
            filename = name[len(prefix):] + ".md"
            if filename == ".md":
                filename = name + ".md"
            p = COMMANDS_DIR / category / filename
            if p.exists():
                return p

    # Fallback: scan all categories
    for cat_dir in COMMANDS_DIR.iterdir():
        if cat_dir.is_dir():
            for f in cat_dir.glob("*.md"):
                fm = parse_frontmatter(f)
                if fm.get("name") == name:
                    return f

    return None


def load_chains() -> dict:
    """Load chain templates."""
    if not CHAINS_FILE.exists():
        return {}
    return json.loads(CHAINS_FILE.read_text(encoding="utf-8"))


def find_sessions(workflow_dir: Path, all_sessions: bool = False) -> list[dict]:
    """Find flow sessions from .workflow/.maestro/."""
    maestro_dir = workflow_dir / ".workflow" / ".maestro"
    if not maestro_dir.exists():
        return []
    sessions = []
    for session_dir in sorted(maestro_dir.iterdir(), reverse=True):
        status_file = session_dir / "status.json"
        if not status_file.exists():
            continue
        data = json.loads(status_file.read_text(encoding="utf-8"))
        if data.get("source") == "flow" or all_sessions:
            data["_path"] = str(status_file)
            sessions.append(data)
    return sessions


# ─── Commands ───────────────────────────────────────────────────────

def cmd_list(args):
    """List available commands."""
    categories = sorted(d.name for d in COMMANDS_DIR.iterdir() if d.is_dir())
    if args.category:
        categories = [c for c in categories if c == args.category]

    total = 0
    print(f"{'Category':<14} {'Command':<30} Description")
    print(f"{'─'*13}  {'─'*29} {'─'*40}")
    for cat in categories:
        cat_dir = COMMANDS_DIR / cat
        for f in sorted(cat_dir.glob("*.md")):
            fm = parse_frontmatter(f)
            name = fm.get("name", f.stem)
            desc = fm.get("description", "")[:50]
            print(f"{cat:<14} {name:<30} {desc}")
            total += 1
    print(f"\nTotal: {total} commands")


def cmd_show(args):
    """Show command details."""
    path = resolve_command(args.name)
    if not path:
        print(f"Command not found: {args.name}")
        sys.exit(1)

    fm = parse_frontmatter(path)
    purpose = extract_purpose(path)

    print(f"┌{'─'*50}┐")
    print(f"│ {fm.get('name', args.name):<48} │")
    print(f"│ {fm.get('description', '')[:48]:<48} │")
    print(f"├{'─'*50}┤")
    if fm.get("argument-hint"):
        print(f"│ Args: {fm['argument-hint'][:42]:<42}   │")
    print(f"│ File: {str(path.relative_to(SKILL_ROOT))[:42]:<42}   │")
    if purpose:
        print(f"├{'─'*50}┤")
        for line in textwrap.wrap(purpose, width=48):
            print(f"│ {line:<48} │")
    print(f"└{'─'*50}┘")


def cmd_chains(args):
    """List chain templates."""
    data = load_chains()
    templates = data.get("templates", {})

    if args.category:
        templates = {k: v for k, v in templates.items() if v.get("category") == args.category}

    print(f"{'Template':<25} {'Category':<16} {'Steps':>5}  Description")
    print(f"{'─'*24}  {'─'*15} {'─'*5}  {'─'*35}")
    for name, tmpl in templates.items():
        steps = len(tmpl.get("steps", []))
        desc = tmpl.get("description", "")[:35]
        cat = tmpl.get("category", "")
        print(f"{name:<25} {cat:<16} {steps:>5}  {desc}")
    print(f"\nTotal: {len(templates)} templates")


def cmd_chain(args):
    """Show chain details."""
    data = load_chains()
    tmpl = data.get("templates", {}).get(args.name)
    if not tmpl:
        print(f"Chain template not found: {args.name}")
        sys.exit(1)

    print(f"\n  Chain: {args.name}")
    print(f"  Category: {tmpl.get('category', '')}")
    print(f"  Description: {tmpl.get('description', '')}")
    print(f"  Triggers: {', '.join(tmpl.get('triggers', []))}")
    print(f"\n  Steps:")
    for i, step in enumerate(tmpl.get("steps", [])):
        type_badge = "⚡" if step["type"] == "external" else " "
        print(f"    {i}. {type_badge} {step['cmd']} {step.get('args', '')}  [{step['type']}]")
    print()


def cmd_suggest(args):
    """Suggest chain templates for intent."""
    intent = args.intent.lower()
    data = load_chains()
    matches = []

    for name, tmpl in data.get("templates", {}).items():
        score = 0
        matched_triggers = []
        for trigger in tmpl.get("triggers", []):
            if trigger.lower() in intent:
                score += len(trigger)
                matched_triggers.append(trigger)
        if score > 0:
            matches.append((score, name, tmpl, matched_triggers))

    matches.sort(key=lambda x: -x[0])

    if not matches:
        # Check single_commands
        singles = data.get("single_commands", {})
        for key, cmd in singles.items():
            if key in intent:
                print(f"\nSuggested single command:")
                print(f"  {cmd}  (match: {key})")
                return
        print("No matching chain found. Try: python flow_cli.py chains")
        return

    print(f"\nSuggested chains for: \"{args.intent}\"")
    for i, (score, name, tmpl, triggers) in enumerate(matches[:3]):
        steps = len(tmpl.get("steps", []))
        print(f"  {i+1}. {name:<25} {tmpl['description']:<35} ({steps} steps, match: {', '.join(triggers)})")


def cmd_resolve(args):
    """Resolve command name to file path."""
    path = resolve_command(args.name)
    if path:
        print(str(path))
    else:
        print(f"NOT_FOUND: {args.name}", file=sys.stderr)
        sys.exit(1)


def cmd_status(args):
    """Show session status."""
    sessions = find_sessions(Path.cwd(), all_sessions=True)
    if args.session_id:
        sessions = [s for s in sessions if s.get("session_id") == args.session_id]

    if not sessions:
        # Try running sessions only
        sessions = find_sessions(Path.cwd())

    if not sessions:
        print("No flow sessions found.")
        return

    session = sessions[0]
    steps = session.get("steps", [])
    total = len(steps)
    completed = sum(1 for s in steps if s.get("status") == "completed")

    print(f"\n  Session:  {session.get('session_id', '?')}")
    print(f"  Status:   {session.get('status', '?')}")
    print(f"  Source:   {session.get('source', '?')}")
    print(f"  Chain:    {session.get('chain_name', '?')} ({total} steps)")
    print(f"  Intent:   {session.get('intent', '')[:60]}")
    if session.get("phase"):
        print(f"  Phase:    {session['phase']}")
    print(f"  Progress: {completed}/{total} ({int(completed/total*100) if total else 0}%)")
    print(f"\n  Steps:")

    for step in steps:
        idx = step.get("index", "?")
        status = step.get("status", "pending")
        skill = step.get("skill", "?")
        step_args = step.get("args", "")
        stype = step.get("type", "internal")

        icon = {
            "completed": "done",
            "running": " >> ",
            "failed": "FAIL",
            "skipped": "skip",
            "pending": "    ",
        }.get(status, "    ")

        type_badge = "⚡" if stype == "external" else "◆" if stype == "decision" else " "
        print(f"    [{icon}] {idx}. {type_badge} {skill} {step_args}  [{stype}]")
    print()


def cmd_sessions(args):
    """List sessions."""
    sessions = find_sessions(Path.cwd(), all_sessions=args.all)
    if not sessions:
        print("No sessions found.")
        return

    print(f"{'Session ID':<30} {'Status':<12} {'Source':<8} {'Chain':<20} Intent")
    print(f"{'─'*29}  {'─'*11} {'─'*7} {'─'*19} {'─'*30}")
    for s in sessions[:20]:
        sid = s.get("session_id", "?")
        status = s.get("status", "?")
        source = s.get("source", "?")
        chain = s.get("chain_name", "?")[:19]
        intent = s.get("intent", "")[:30]
        print(f"{sid:<30} {status:<12} {source:<8} {chain:<20} {intent}")


def cmd_step(args):
    """Update a step's status."""
    sessions = find_sessions(Path.cwd(), all_sessions=True)
    session = next((s for s in sessions if s.get("session_id") == args.session_id), None)
    if not session:
        print(f"Session not found: {args.session_id}")
        sys.exit(1)

    status_path = Path(session["_path"])
    idx = int(args.index)
    steps = session.get("steps", [])
    if idx < 0 or idx >= len(steps):
        print(f"Invalid step index: {idx} (0-{len(steps)-1})")
        sys.exit(1)

    valid_statuses = ("pending", "running", "completed", "failed", "skipped")
    if args.status not in valid_statuses:
        print(f"Invalid status: {args.status}. Use: {', '.join(valid_statuses)}")
        sys.exit(1)

    steps[idx]["status"] = args.status
    now = datetime.now().isoformat()
    if args.status == "running":
        steps[idx]["started_at"] = now
    elif args.status in ("completed", "failed", "skipped"):
        steps[idx]["completed_at"] = now

    session["updated_at"] = now
    del session["_path"]
    status_path.write_text(json.dumps(session, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Step {idx} → {args.status}")


def cmd_reset(args):
    """Reset a failed session."""
    sessions = find_sessions(Path.cwd(), all_sessions=True)
    session = next((s for s in sessions if s.get("session_id") == args.session_id), None)
    if not session:
        print(f"Session not found: {args.session_id}")
        sys.exit(1)

    status_path = Path(session["_path"])
    reset_count = 0
    for step in session.get("steps", []):
        if step.get("status") in ("failed", "running"):
            step["status"] = "pending"
            step.pop("error", None)
            step.pop("started_at", None)
            step.pop("completed_at", None)
            reset_count += 1

    session["status"] = "running"
    session["updated_at"] = datetime.now().isoformat()
    del session["_path"]
    status_path.write_text(json.dumps(session, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Reset {reset_count} steps to pending. Session status → running.")


# ─── Main ───────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Maestro Flow CLI")
    sub = parser.add_subparsers(dest="command")

    p_list = sub.add_parser("list", help="List commands")
    p_list.add_argument("--category", "-c", help="Filter by category")

    p_show = sub.add_parser("show", help="Show command details")
    p_show.add_argument("name", help="Command name")

    p_chains = sub.add_parser("chains", help="List chain templates")
    p_chains.add_argument("--category", "-c", help="Filter by category")

    p_chain = sub.add_parser("chain", help="Show chain details")
    p_chain.add_argument("name", help="Template name")

    p_suggest = sub.add_parser("suggest", help="Suggest chain for intent")
    p_suggest.add_argument("intent", help="Intent text")

    p_resolve = sub.add_parser("resolve", help="Resolve command to file path")
    p_resolve.add_argument("name", help="Command name")

    p_status = sub.add_parser("status", help="Show session status")
    p_status.add_argument("session_id", nargs="?", help="Session ID")

    p_sessions = sub.add_parser("sessions", help="List sessions")
    p_sessions.add_argument("--all", "-a", action="store_true", help="Include all sources")

    p_step = sub.add_parser("step", help="Update step status")
    p_step.add_argument("session_id", help="Session ID")
    p_step.add_argument("index", help="Step index")
    p_step.add_argument("status", help="New status")

    p_reset = sub.add_parser("reset", help="Reset failed session")
    p_reset.add_argument("session_id", help="Session ID")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    cmd_map = {
        "list": cmd_list, "show": cmd_show, "chains": cmd_chains,
        "chain": cmd_chain, "suggest": cmd_suggest, "resolve": cmd_resolve,
        "status": cmd_status, "sessions": cmd_sessions,
        "step": cmd_step, "reset": cmd_reset,
    }
    cmd_map[args.command](args)


if __name__ == "__main__":
    main()
