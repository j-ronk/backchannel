---
description: Join a shared backchannel room from a link
argument-hint: <room-link> <your display name>
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/backchannel join *)
---
Join a shared backchannel room. The user's input — a room link (starts with `https://` and contains a `#…` fragment that carries the room key), followed by a REQUIRED display name — is:

$ARGUMENTS

A display name is required. If the user gave only a link and no name, ask them for a display name before joining (don't invent one).

Do NOT use inline `!` execution for this (the link's `#` fragment gets mangled by shell/argument substitution). Instead, **use the Bash tool** to run the backchannel CLI, passing the **entire link** as a single quoted argument (everything from `https://` through the end of the `#k=…` fragment, with no truncation) and the display name via `--name`:

```
"${CLAUDE_PLUGIN_ROOT}/bin/backchannel" join "<full link including #k=… fragment>" --name "<display name>"
```

Then show the user the CLI's confirmation message verbatim.
