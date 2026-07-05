---
description: View or set what this session shares with the backchannel room
argument-hint: [new policy text]
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/backchannel:*)
---
Show or update the share policy and relay the result. The policy guides what the agent shares each turn — but redaction is best-effort (the agent can slip), so never rely on it for hard secrets. The relay itself only ever stores ciphertext plus an opaque tag.

!`"${CLAUDE_PLUGIN_ROOT}/bin/backchannel" policy "$ARGUMENTS"`
