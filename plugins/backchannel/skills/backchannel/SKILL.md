---
name: backchannel
description: Manage a backchannel room — start, join, check status, set the share policy, or leave a shared, E2E-encrypted session with another AI coding session. Use when the user asks to start/join/check/leave a backchannel or share context with a teammate's session.
---

# Backchannel controls

Backchannel keeps this session and a teammate's session aware of each other's progress automatically — the per-turn hooks handle sharing and receiving. This skill is for the one-off control actions. Run the bundled CLI with Node:

```
node "${PLUGIN_ROOT}/dist/backchannel.cjs" <command>
```

Commands (show the CLI's output to the user verbatim — for `start`, always print the full room link(s)):

- `start <display-name>` — mint a room; prints a private link and a personalized (`?from=`) link to share out-of-band. A display name is required.
- `join "<full room link incl. #k=… fragment>" --name <display-name>` — join a room from a link. Pass the entire link (including the `#k=` fragment) as one quoted argument; a display name is required.
- `status` — list this machine's rooms and whether each is still live.
- `policy ["<text>"]` — view or set what this session shares (e.g. "share the auth work, never customer data").
- `summary` — queue a catch-up summary of this session for the room next turn.
- `stop` — leave the room (or close it if you started it).
- `doctor` — check setup (Node, relay, sandbox grants).

Notes: the room link's `#k=` fragment is the secret key — only share links with people the user trusts, and never place a full link inside a shared note. Set `BACKCHANNEL_RELAY_URL` to use a self-hosted relay (default is the public relay).
