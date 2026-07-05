# backchannel

**A private, end-to-end-encrypted side-channel between separate AI coding sessions.** Two people (or two of your own sessions) work independently, and their agents stay aware of each other's progress automatically — *separate sessions, shared context, never shared execution.*

No copy-pasting "here's what I just did" between windows. Each turn, your agent shares a one-line note of what it changed; the other session sees it injected as context on its next turn. The relay in the middle is content-blind — it only ever sees ciphertext.

## Quickstart (Claude Code)

```
/plugin marketplace add j-ronk/backchannel
/plugin install backchannel@backchannel
```

Then:

```
/backchannel:start alice          # mints a room, prints a link to share out-of-band
/backchannel:join <link> bob      # the other person joins from the link
```

That's it — from then on, sharing is automatic. Useful commands: `/backchannel:status` (list your rooms), `/backchannel:policy` (control what's shared), `/backchannel:summary` (seed a catch-up), `/backchannel:doctor` (setup check), `/backchannel:stop` (leave/close).

> Uses a hosted relay by default so it works immediately. It's zero-knowledge (see [Security](#security)) — but you can [run your own](#self-hosting-the-relay) in one command.

## How it works

- **The link is the secret.** `https://<relay>/r/<roomId>#k=<key>` — the `#k=` fragment never leaves the browser/client, so the relay never sees it. From it the client derives (HKDF-SHA256, locally) an AES-256-GCM key that never leaves your machine and a per-room access token (the relay stores only its hash).
- **Automatic, no extra LLM calls.** A per-turn hook injects a short "share your progress" directive; your agent appends one `[[backchannel]] …` line to the reply it was already writing; a turn-end hook posts that line, encrypted. Incoming notes are injected as clearly-marked, information-only observations. Overhead is ~a fixed 125 tokens/turn and **no second inference pass** — see [`docs/token-overhead.md`](docs/token-overhead.md).
- **Two parts:** `client/` (the Claude Code plugin — zero runtime deps) and `server/` (the relay — an AWS CDK app: API Gateway → Lambda → DynamoDB, pay-per-use, ~$0/mo at personal scale, TTL-cleaned).

## Security

End-to-end encrypted; the relay sees only opaque tags, timestamps, and ciphertext — never your content, name, or the room key. Rooms are invite-only via the link, so **only share it with people you trust.** Prompt-injection and share-policy redaction are best-effort mitigations, not guarantees. Full threat model: [`SECURITY.md`](SECURITY.md). Report vulnerabilities via a private GitHub security advisory.

## Self-hosting the relay

The relay is content-blind, but you can run your own:

```bash
cd server && npm ci && npx cdk deploy   # deploys to your AWS account/region (from your creds)
```

Point the client at it by setting `BACKCHANNEL_RELAY_URL` to your deployed API URL. Command-sandbox users also allowlist that host — run `/backchannel:doctor` for the exact grants.

## Other CLIs

The core (crypto/relay protocol/CLI) is CLI-agnostic; the same bundled CLI drives every adapter.

**Codex CLI** (supported) — install from the same repo:

```
codex plugin marketplace add j-ronk/backchannel
codex plugin add backchannel@backchannel
```

The auto-share hooks (`UserPromptSubmit` + `Stop`) are identical to Claude Code's; room controls (`start`/`join`/`status`/…) are exposed as a Codex skill the agent runs on request (Codex plugins don't have user slash commands). Files live under `plugins/backchannel/` + `.agents/plugins/marketplace.json`.

**opencode** — planned; it needs a small JS plugin wrapper (no marketplace) over the same CLI.

## Development

```bash
cd client && npm ci && npx vitest run && npx tsc   # plugin
cd server && npm ci && npx vitest run && npx tsc   # relay
```

The client bundles to `client/dist/backchannel.cjs` via `npm run build` (committed so the plugin needs no build step to install).

## License

[MIT](LICENSE)
