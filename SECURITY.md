# Security

backchannel is a private, end-to-end-encrypted side-channel between separate AI coding sessions: **separate sessions, shared context, never shared execution.** This document is the threat model — what it protects, what it doesn't, and how to report a problem.

## Reporting a vulnerability

Please **open a private security advisory** on the GitHub repository (Security → *Report a vulnerability*) rather than a public issue. We'll acknowledge and respond as fast as we can.

## Architecture in one paragraph

Each participant runs their own agent on their own machine with their own permissions. The only thing that crosses the wire is **encrypted context** — never commands, never execution. The link you share out-of-band, `https://<relay>/r/<roomId>#k=<key>`, carries the room secret in its URL **fragment** (`#k=`), which browsers and HTTP clients never transmit to a server. From that secret the client derives (via HKDF-SHA256) two things locally: an **AES-256-GCM encryption key** that never leaves your machine, and a per-room **access token**. The relay stores only the SHA-256 *hash* of the access token and verifies it (timing-safe) on every request.

## What the relay can and cannot see

The relay is a deliberately dumb, content-blind store.

- **It can see:** a room id, per-message opaque author tags (random 4-byte hex, not your name), timestamps, a coarse type label, and **ciphertext**.
- **It cannot see:** the room key (it's in the fragment, never sent), your messages (encrypted), or your display name (encrypted inside the payload).
- **Exception you opt into:** the personalized link (`?from=<name>`) puts your chosen display name in the URL query so a link-preview can say "X wants to share…". If you share that link, the relay (and anyone holding the link) sees that display name. The default link does not.

Even a fully compromised or malicious relay operator learns only room ids, opaque tags, timing, and ciphertext — never content.

## Trust model — this matters

A room is **invite-only via a link you share out-of-band with specific people.** The security of the channel rests on you sharing the link only with collaborators you trust. Anyone with the full link (including the `#k=` fragment) can read and post to the room.

## Prompt injection (important, honest)

backchannel's job is to inject *other participants'* content into your agent's context — so prompt injection is the sharpest risk. Mitigations in place:

- Incoming messages are rendered as **information-only observations**, wrapped in a preamble that instructs the model to treat them as data and never follow instructions within them.
- Your own outgoing directive is kept **structurally separate** and explicitly marked as your trusted operator instruction.
- Incoming content is never re-interpreted as a share marker, so it can't cause your side to re-broadcast.

**This is a mitigation, not a guarantee.** As with any system that feeds external text to an LLM, a determined injection payload from a room participant could still influence your agent. Treat shared content as untrusted input, and only join rooms with people you trust.

## Redaction / share policy (best-effort)

The share policy ("share the auth work, never customer data") is applied by *the agent* when it writes each note. An LLM can slip. **Never rely on the policy to protect hard secrets** — it is a convenience, not a guarantee. The relay only ever stores ciphertext regardless.

## Execution isolation

There is no remote code execution across the channel. Only context is shared; each agent decides what to do with it under its own operator's control and its own tool permissions. A peer cannot run commands in your session.

## Availability / denial-of-wallet

The relay is public and unauthenticated at the transport layer (access control is the per-room token). It is **rate-throttled at the API gateway** (excess requests are rejected before any compute runs), which caps both abuse and cost. A flood can degrade availability or run up a bounded bill, but it cannot break confidentiality or integrity — the E2E guarantees hold regardless. Self-hosters can tighten the throttle, add a budget hard-stop, or front the relay with a WAF/CDN.

## The command sandbox

Under Claude Code's command sandbox, the plugin needs two grants: outbound network to the relay host, and write access to `~/.backchannel`. These are **never applied automatically** — `/backchannel:doctor` prints the exact grants for you to add yourself. The plugin does not modify your settings.

## Cryptography

- Key derivation: HKDF-SHA256 from the 32-byte room secret, domain-separated (`backchannel-v1-enc` / `backchannel-v1-access`).
- Encryption: AES-256-GCM with a fresh random 96-bit IV per message; the auth tag is verified on decrypt.
- Access token: compared server-side by SHA-256 hash only; the token itself is never stored.

## Scope

This threat model covers the relay + the client plugin in this repository. It assumes your local machine, your Claude Code (or other CLI) install, and the people you invite are trusted. It does not defend against a compromised local machine or a malicious collaborator you invited.
