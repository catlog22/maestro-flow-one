#!/bin/bash
# Install maestro-flow skill into a Claude Code project
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_SOURCE="$SCRIPT_DIR/maestro-flow"
TARGET_DIR="${1:-.}"

# Resolve absolute path
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
SKILL_TARGET="$TARGET_DIR/.claude/skills/maestro-flow"

echo "Installing Maestro Flow..."
echo "  Source: $SKILL_SOURCE"
echo "  Target: $SKILL_TARGET"
echo ""

# Check source exists
if [ ! -f "$SKILL_SOURCE/SKILL.md" ]; then
    echo "Error: SKILL.md not found in $SKILL_SOURCE"
    exit 1
fi

# Check Python 3
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "Warning: Python 3 not found. flow_cli.py will not work."
fi

# Create target directory
mkdir -p "$SKILL_TARGET"

# Copy skill files
cp -r "$SKILL_SOURCE/"* "$SKILL_TARGET/"

# Verify
COMMAND_COUNT=$(find "$SKILL_TARGET/commands" -name "*.md" | wc -l)

echo "Installation complete!"
echo "  Commands: $COMMAND_COUNT"
echo "  Entry:    /maestro-flow"
echo ""
echo "Usage:"
echo "  /maestro-flow \"your intent\"     # Intent-based routing"
echo "  /maestro-flow list               # List commands"
echo "  /maestro-flow --chain quick-fix  # Direct chain"
