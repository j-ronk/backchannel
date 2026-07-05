# backchannel (Claude Code plugin)

A Claude Code plugin for observation-only, end-to-end-encrypted collaboration between two people's agent sessions. Separate sessions, shared context, no shared execution. Each person runs their own agent on their own machine with their own permissions, and only encrypted context crosses the wire. Never commands.

## Install

Recommended: the plugin marketplace. No curl, no scripts.

```
/plugin marketplace add j-ronk/backchannel
/plugin install backchannel@backchannel
```

It's versioned, auto-updating, and removed with `/plugin uninstall backchannel@backchannel`. The `/backchannel:*` commands and the per-turn hooks turn on at install, and most people need nothing else.

If you use Claude Code's command sandbox, run `/backchannel:doctor` once after installing. It checks your setup and prints the two-line settings grant to paste (details [below](#command-sandbox-users)). Everyone else can skip it.

<details>
<summary>Manual install (no marketplace)</summary>

Clone the plugin into your skills directory and it auto-loads:

```bash
git clone https://github.com/j-ronk/backchannel ~/.claude/skills/backchannel.repo
ln -sfn ~/.claude/skills/backchannel.repo/client ~/.claude/skills/backchannel
```

Then `/reload-plugins` (or restart). `install.sh` does the same and can join a room in one step. It doesn't touch your settings. Run `/backchannel:doctor` for the sandbox grants.
</details>

Codex CLI works too, from the same repo: `codex plugin marketplace add j-ronk/backchannel` then `codex plugin add backchannel@backchannel`. opencode support is planned.

## Usage

- `/backchannel:start <name>` mints a room and prints a link to share out-of-band
- `/backchannel:join <link> <name>` joins a room from a link
- `/backchannel:status` lists your rooms and whether each is still live
- `/backchannel:policy [text]` shows or sets what this session shares (say, "share the auth work, never customer data")
- `/backchannel:summary` queues a catch-up of this session for the room next turn
- `/backchannel:stop` leaves the room, or closes it if you started it
- `/backchannel:doctor` checks your setup

Sharing is automatic, with no manual share command. On each turn where you do real work, your agent appends one short `[[backchannel]]` note that follows the share policy, and the plugin posts it to the room encrypted. The other person sees it on their next turn. Notes from others arrive as clearly-labelled, information-only observations. Redaction is best-effort (an LLM can slip), so don't rely on the policy to protect real secrets.

<h2 id="command-sandbox-users">Command sandbox users: two grants</h2>

Skip this unless you run Claude Code's command sandbox. Otherwise the plugin works out of the box.

Under the sandbox, the hook and commands need two things that are blocked by default: reaching the relay over the network, and writing room state to `~/.backchannel`. If they're missing you'll see `fetch failed`, then `EPERM … ~/.backchannel`, and the hook quietly injecting nothing. `bin/backchannel` already routes Node's `fetch` through the sandbox proxy (via `NODE_USE_ENV_PROXY`, which needs Node 24+), so all you add is the two allowlist grants.

Run `/backchannel:doctor` and it prints the exact snippet for your relay. It looks like this:

```json
{
  "sandbox": {
    "network": { "allowedDomains": ["*.execute-api.ap-southeast-2.amazonaws.com"] },
    "filesystem": { "allowWrite": ["~/.backchannel"] }
  }
}
```

Add that to `~/.claude/settings.json` (or via `/sandbox`) and restart Claude Code. The plugin never edits your settings for you. Use the host of whatever relay you point at (see self-hosting below).

## Self-hosting / custom relay

The relay is a dumb, content-blind ciphertext store. Run your own and point the client at it by setting `BACKCHANNEL_RELAY_URL`, and the installer allowlists that host instead. The server (a CDK app) lives in `../server`.

## Security (summary)

The link's `#k=` fragment is the secret. It derives the AES-256-GCM key, which never leaves your machine, and a per-room access token, of which the relay keeps only the hash and checks it on every request. So the relay only ever sees an opaque participant tag, timestamps, and ciphertext, never your identity or content. Incoming context arrives as untrusted, information-only observations, never as commands, and your own outgoing directive stays separate and marked trusted. Outgoing notes follow the share policy, but that's best-effort since an LLM can slip, so don't trust it with real secrets. Full threat model: [../SECURITY.md](../SECURITY.md).
