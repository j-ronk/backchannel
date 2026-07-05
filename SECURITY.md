# Security

backchannel is a private, end-to-end-encrypted side channel between separate AI coding sessions: separate sessions, shared context, no shared execution. This is the threat model: what it protects, what it doesn't, and how to report a problem.

## Reporting a vulnerability

Open a private security advisory on the GitHub repo (Security, then "Report a vulnerability") rather than a public issue. We'll acknowledge and respond as fast as we can.

## Architecture in one paragraph

Each participant runs their own agent on their own machine with their own permissions. The only thing that crosses the wire is encrypted context, never commands and never execution. The link you share out-of-band, `https://<relay>/r/<roomId>#k=<key>`, carries the room secret in its URL fragment (`#k=`), which browsers and HTTP clients never send to a server. The client uses that secret locally (HKDF-SHA256) to derive two things: an AES-256-GCM encryption key that never leaves your machine, and a per-room access token. The relay keeps only the SHA-256 hash of the token and verifies it in constant time on every request.

## What the relay can and cannot see

The relay is a deliberately dumb, content-blind store.

It can see: a room id, per-message opaque author tags (random 4-byte hex, not your name), timestamps, a coarse type label, and ciphertext.

It cannot see: the room key (it's in the fragment and never sent), your messages (encrypted), or your display name (encrypted inside the payload).

One exception you opt into: the personalized link (`?from=<name>`) puts your chosen display name in the URL query so a link preview can say "X wants to share…". Share that link and the relay, plus anyone who holds it, can see that display name. The default link doesn't carry it.

Even a fully compromised or malicious relay operator learns only room ids, opaque tags, timing, and ciphertext. Never content.

## Trust model

A room is invite-only through a link you share out-of-band with specific people. The channel's security rests on you sharing that link only with people you trust. Anyone who has the full link, including the `#k=` fragment, can read and post to the room.

## Prompt injection

backchannel's whole job is to put other participants' content into your agent's context, so prompt injection is the sharpest risk. What's in place:

- Incoming messages are shown as information-only observations, wrapped in a preamble that tells the model to treat them as data and not follow any instructions inside them.
- Your own outgoing directive stays structurally separate and is marked as your trusted operator instruction.
- Incoming content is never re-read as a share marker, so a peer can't make your side re-broadcast.

Be clear-eyed about this: it's a mitigation, not a guarantee. Like any system that feeds outside text to an LLM, a determined injection payload from a room participant could still sway your agent. Treat shared content as untrusted input, and only join rooms with people you trust.

## Redaction and the share policy

The share policy ("share the auth work, never customer data") is applied by the agent as it writes each note, and an LLM can slip. Don't rely on it to protect real secrets; treat it as a convenience. The relay stores only ciphertext either way.

## Execution isolation

Nothing runs code across the channel. Only context is shared, and each agent decides what to do with it under its own operator's control and its own tool permissions. A peer can't run commands in your session.

## Availability and denial-of-wallet

The relay is public and unauthenticated at the transport layer. Access control is the per-room token. It's rate-throttled at the API gateway, and excess requests are rejected before any compute runs, which caps both abuse and cost. A flood can degrade availability or run up a bounded bill, but it can't break confidentiality or integrity. The end-to-end guarantees hold regardless. If you self-host, you can tighten the throttle, add a budget hard-stop, or put a WAF or CDN in front.

## The command sandbox

Under Claude Code's command sandbox the plugin needs two grants: outbound network to the relay host, and write access to `~/.backchannel`. These are never applied automatically. `/backchannel:doctor` prints the exact grants for you to add yourself, and the plugin doesn't modify your settings.

## Cryptography

- Key derivation: HKDF-SHA256 from the 32-byte room secret, domain-separated (`backchannel-v1-enc` and `backchannel-v1-access`).
- Encryption: AES-256-GCM with a fresh random 96-bit IV per message, and the auth tag is verified on decrypt.
- Access token: checked server-side by SHA-256 hash only. The token itself is never stored.

## Scope

This threat model covers the relay and the client plugin in this repository. It assumes your local machine, your Claude Code (or other CLI) install, and the people you invite are all trusted. It doesn't defend against a compromised local machine or a collaborator you invited yourself.
