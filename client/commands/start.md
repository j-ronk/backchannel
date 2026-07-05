---
description: Start a new shared backchannel room and print a link to share
argument-hint: <your display name>
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/backchannel:*)
---
The backchannel CLI output below contains the room link(s). You MUST print that output to the user **verbatim and in full**, including **every complete link character-for-character (the whole `https://…/r/…#k=…` string, fragment included)**. The links are the entire purpose of this command — reproducing them is mandatory and non-negotiable.

- Do NOT summarize, paraphrase, shorten, describe, or omit the links.
- Do NOT replace a link with a sentence about it.
- It is fine to add a one-line note after, but the full links must appear first.
- A display name is REQUIRED. If it is missing, the CLI prints a usage error — relay that verbatim instead.

!`"${CLAUDE_PLUGIN_ROOT}/bin/backchannel" start --name "$ARGUMENTS"`
