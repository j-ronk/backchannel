# backchannel — shared context across separate Claude Code sessions

A Claude Code plugin for **observation-only, end-to-end-encrypted collaboration** between two people's agent sessions. Separate sessions, shared context — never shared execution. Each person runs their own agent on their own machine with their own permissions; only encrypted *context* crosses the wire, never commands.

## Install

**Claude Code (recommended) — via the plugin marketplace. No curl, no scripts:**

```
/plugin marketplace add j-ronk/backchannel
/plugin install backchannel@backchannel
```

That's it — versioned, auto-updating, and uninstallable with `/plugin uninstall backchannel@backchannel`. The `/backchannel:*` commands and the per-turn hooks activate on install. **Most people need nothing else.**

If you use Claude Code's **command sandbox**, run `/backchannel:doctor` once after installing — it checks your setup and prints the exact two-line settings grant to paste (see [below](#command-sandbox-users)). Everyone else can skip it.

<details>
<summary>Manual install (no marketplace)</summary>

Clone the plugin into your skills directory — it auto-loads:

```bash
git clone https://github.com/j-ronk/backchannel ~/.claude/skills/backchannel.repo
ln -sfn ~/.claude/skills/backchannel.repo/client ~/.claude/skills/backchannel
```

Then `/reload-plugins` (or restart). `install.sh` does the same and can also join a room in one step; it does **not** touch your settings — run `/backchannel:doctor` for sandbox grants.
</details>

**Other CLIs:** Codex CLI can install the same way via its own plugin marketplace (`codex plugin marketplace add …`); opencode support ships as a small plugin you add to `opencode.json`. Both reuse the same core CLI. (Adapters land after the Claude Code release.)

## Usage

- `/backchannel:start [name]` — mint a room and print a link to share out-of-band
- `/backchannel:join <link> [name]` — join a room from a link
- `/backchannel:policy [text]` — view or set what this session shares (e.g. "share the auth work, never customer data")
- `/backchannel:summary` — queue a catch-up summary of this session for the room on your next turn
- `/backchannel:stop` — leave (or, if you started it, close the room)

**Sharing is automatic.** There is no manual share command. Each turn in which you do meaningful work, your agent appends one discreet `[[backchannel]] …` note (honoring the share policy) and the plugin posts it encrypted to the room; the other participant sees it injected on their next turn. New events from others arrive each turn as clearly-marked, information-only observations. Redaction is best-effort — the agent can slip — so never rely on the policy to protect hard secrets.

<h2 id="command-sandbox-users">Command sandbox users: two grants needed</h2>

**Only relevant if you run Claude Code's command sandbox.** If you don't, skip this — the plugin works out of the box.

Under the sandbox, the per-turn hook and commands need to **(a)** reach the relay over the network and **(b)** write room state to `~/.backchannel`. Both are blocked by default (symptoms: `fetch failed`, then `EPERM … ~/.backchannel`, and the hook silently injecting nothing). `bin/backchannel` already routes Node's `fetch` through the sandbox proxy (`NODE_USE_ENV_PROXY`, needs Node ≥ 24); you just add two allowlist grants.

Run **`/backchannel:doctor`** — it detects your sandbox config and prints the exact snippet for your relay. It's the same as:

```json
{
  "sandbox": {
    "network": { "allowedDomains": ["*.execute-api.ap-southeast-2.amazonaws.com"] },
    "filesystem": { "allowWrite": ["~/.backchannel"] }
  }
}
```

Add that to `~/.claude/settings.json` (or via `/sandbox`) and **restart Claude Code**. We deliberately do **not** auto-edit your settings — nothing mutates your config behind your back. (Use the exact host of whatever relay you point at — see self-hosting below.)

## Self-hosting / custom relay

The relay is a dumb, content-blind ciphertext store. Point the client at your own deployment by setting `BACKCHANNEL_RELAY_URL` (the installer will allowlist that host instead). The server (CDK app) lives in `../server`.

## Security model (summary)

The link's `#k=` fragment is the secret: it derives both the AES-256-GCM encryption key (which **never leaves your machine**) and a per-room access token (the relay stores only its hash and verifies it on every request). The relay only ever sees an opaque participant tag, timestamps, and ciphertext — never your identity or content. Incoming context is injected as untrusted, information-only observations, never as commands; your own outgoing share directive is kept separate and marked trusted. Outgoing notes are redaction-aware but best-effort — the agent applies the share policy, but an LLM can slip, so don't rely on it for hard secrets. A fuller threat model will ship in `SECURITY.md` before public release.
