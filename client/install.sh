#!/usr/bin/env bash
# Optional manual installer for people who don't use the Claude Code plugin marketplace.
# Preferred install:
#   /plugin marketplace add j-ronk/backchannel  &&  /plugin install backchannel@backchannel
# This script only clones + symlinks the plugin (and can join a room). It does NOT edit your
# settings — if you use the command sandbox, run /backchannel:doctor afterward for the two grants.
set -euo pipefail
REPO="${BACKCHANNEL_REPO:-https://github.com/j-ronk/backchannel}"
DEST="$HOME/.claude/skills/backchannel"
LINK="${1:-}"

if [ -d "$DEST.repo/.git" ]; then
  git -C "$DEST.repo" pull --ff-only
else
  mkdir -p "$(dirname "$DEST")"
  git clone --depth 1 "$REPO" "$DEST.repo"
  ln -sfn "$DEST.repo/client" "$DEST"
fi

if [ -n "$LINK" ]; then
  "$DEST/bin/backchannel" join "$LINK" && echo "Installed and joined the room."
else
  echo "Installed."
fi
echo "Restart Claude Code (or /reload-plugins) to activate. Command-sandbox users: run /backchannel:doctor for the two grants."
