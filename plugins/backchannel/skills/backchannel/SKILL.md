---
name: backchannel
description: Manage a backchannel room. Start, join, check status, set the share policy, or leave a shared, E2E-encrypted session with another AI coding session. Use when the user asks to start, join, check, or leave a backchannel, or to share context with a teammate's session.
---

# Backchannel controls

Backchannel keeps this session and a teammate's session aware of each other's progress automatically; the per-turn hooks do the sharing and receiving. This skill is for the one-off control actions. Run the bundled CLI with Node:

```
node ../../dist/backchannel.cjs <command>
```

That path is relative to this skill's own directory (the working directory when the skill runs). Show the CLI's output to the user verbatim. For `start`, always print the full room link(s). Commands:

- `start <display-name>` mints a room and prints a private link plus a personalized (`?from=`) link to share out-of-band. A display name is required.
- `join "<full room link incl. #k=… fragment>" --name <display-name>` joins a room from a link. Pass the whole link (including the `#k=` fragment) as one quoted argument. A display name is required.
- `status` lists this machine's rooms and whether each is still live.
- `policy ["<text>"]` views or sets what this session shares (say, "share the auth work, never customer data").
- `summary` queues a catch-up of this session for the room next turn.
- `stop` leaves the room, or closes it if you started it.
- `doctor` checks setup (Node, relay, sandbox grants).

The room link's `#k=` fragment is the secret key, so only share links with people the user trusts, and never put a full link inside a shared note. Set `BACKCHANNEL_RELAY_URL` to use a self-hosted relay; the default is the public relay.
