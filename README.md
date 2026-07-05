# backchannel

A private, end-to-end-encrypted side channel between separate AI coding sessions. Two people (or two of your own sessions) work independently while their agents stay aware of each other's progress. Separate sessions, shared context, no shared execution.

You stop copy-pasting "here's what I just did" between windows. Each turn, your agent shares a one-line note of what it changed, and the other session picks it up as context on its next turn. The relay in the middle is content-blind. It only ever sees ciphertext.

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

After that, sharing is automatic. The other commands are `/backchannel:status` (list your rooms), `/backchannel:policy` (control what's shared), `/backchannel:summary` (seed a catch-up), `/backchannel:doctor` (setup check), and `/backchannel:stop` (leave or close the room).

It uses a hosted relay by default so it works right away. That relay is zero-knowledge (see [Security](#security)), and you can [run your own](#self-hosting-the-relay) with one command.

## How it works

The link is the secret. In `https://<relay>/r/<roomId>#k=<key>`, the `#k=` fragment never leaves the client, because browsers and HTTP clients don't send URL fragments to the server. The client uses it locally (HKDF-SHA256) to derive an AES-256-GCM key that never leaves your machine, plus a per-room access token whose hash is all the relay ever stores.

There are no extra model calls. A per-turn hook adds a short "share your progress" instruction, your agent appends one `[[backchannel]]` line to the reply it was already writing, and a turn-end hook posts that line encrypted. Notes from other people arrive as clearly-labelled, information-only observations. The cost is about 125 fixed tokens per turn and no second inference pass. The [token-overhead notes](docs/token-overhead.md) work through the numbers.

There are two parts. `client/` is the Claude Code plugin, with zero runtime dependencies. `server/` is the relay: an AWS CDK app (API Gateway, Lambda, DynamoDB) that's pay-per-use, costs around $0/month at personal scale, and expires its own data via TTL.

## Security

Everything is end-to-end encrypted. The relay sees opaque per-message tags, timestamps, and ciphertext, and nothing else. Not your messages, not your name, not the room key. Rooms are invite-only through the link, so only share it with people you trust. Prompt-injection defences and share-policy redaction are best-effort and not guarantees. [SECURITY.md](SECURITY.md) has the full threat model. Report vulnerabilities through a private GitHub security advisory.

## Self-hosting the relay

The relay can't read your content, but you can still run your own:

```bash
cd server && npm ci && npx cdk deploy   # deploys to your AWS account/region, from your credentials
```

Set `BACKCHANNEL_RELAY_URL` to your deployed API URL to point the client at it. If you use the command sandbox, allowlist that host too; `/backchannel:doctor` prints the exact grants.

## Other CLIs

The core (crypto, relay protocol, CLI) doesn't depend on any one CLI, so the same bundled binary drives every adapter.

Codex CLI works today, from this same repo:

```
codex plugin marketplace add j-ronk/backchannel
codex plugin add backchannel@backchannel
```

Its auto-share hooks (`UserPromptSubmit` and `Stop`) are identical to Claude Code's. The room controls (`start`, `join`, `status`, and the rest) come as a Codex skill the agent runs when you ask, since Codex plugins don't expose user slash commands. Those files live under `plugins/backchannel/` and `.agents/plugins/marketplace.json`.

opencode is planned. It needs a small JS plugin wrapper over the same CLI, since opencode has no plugin marketplace.

## Development

```bash
cd client && npm ci && npx vitest run && npx tsc   # plugin
cd server && npm ci && npx vitest run && npx tsc   # relay
```

`npm run build` in `client/` bundles the CLI to `client/dist/backchannel.cjs`. That file is committed, so installing the plugin needs no build step.

## License

[MIT](LICENSE)
