# Token overhead

**How much does backchannel add to your token usage?** Short answer: a fixed **~125 input tokens per turn** (a standing instruction), a **~22-token line** for each note you send or receive, and — the important part — **zero extra LLM calls**. For a normal coding turn that's ~1–2% overhead; for a large-context turn it's well under 0.5%.

## Why it's cheap by design

backchannel never makes a second model call. There's no separate "summarizer" pass and no per-turn `claude -p`. The agent produces its share note *in-band*, as one line of the reply it was already generating. So the entire overhead is a bounded amount of added **context** (plus one short output line when you share) — not doubled inference. That's what keeps both the token cost and the dollar cost near zero.

The overhead has exactly three parts, all deterministic:

1. **The send directive** — injected into context every active turn (input). The one always-on cost.
2. **Received messages** — a short preamble plus one line per unread peer note (input), only on turns where something arrived.
3. **Your `[[backchannel]]` marker** — one line appended to your reply (output), only on turns where you share.

## Measured component sizes

Measured with `tiktoken` (`o200k_base`) as a proxy for Claude's tokenizer — see [caveats](#method--caveats).

| Component | Tokens | When |
|---|---:|---|
| Send directive | **125** | input, every active turn |
| Send directive + catch-up variant | 162 | input, first turn / on-demand summary |
| Observation preamble | 31 | input, on turns where ≥1 message arrived |
| One received message line | 22 | input, per message received |
| Your marker note | 22 | output, per turn you share |

## Per-turn overhead

The directive is a **fixed** ~125 tokens, so its *percentage* cost falls as your turn's context grows. Baseline = the tokens already in that turn (context replay + tool output + your prompt):

| Baseline input / turn | Directive only | Directive + 1 received msg |
|---:|---:|---:|
| 2,000 (tiny turn) | 6.25% | 8.90% |
| 10,000 (typical coding turn) | 1.25% | 1.78% |
| 50,000 (large context) | 0.25% | 0.36% |
| 150,000 (very large context) | 0.08% | 0.12% |

## Whole-session simulation

A 30-turn two-person pair session — you share on half your turns, receive on half — against a conservative 12,000 input + 700 output tokens/turn baseline:

- Added: **4,582 input + 330 output = 4,912 tokens**
- Session baseline: 381,000 tokens
- **Overhead ≈ 1.29% of the session — with zero extra LLM calls.**

Because the added input is fixed per turn, the percentage is smaller for the (common) case of larger real-world contexts, and larger only for very short turns.

## Method & caveats

- **Tokenizer is a proxy.** Counts use OpenAI's `o200k_base` BPE, not Claude's proprietary tokenizer. Expect ~10–15% drift for English — which does not change any conclusion here. For exact Claude counts, point the script's `t()` at Anthropic's free [`/v1/messages/count_tokens`](https://docs.anthropic.com/en/api/messages-count-tokens) endpoint.
- **Baselines are illustrative.** Real Claude Code turns re-send the whole conversation as input each turn, so 10k–150k+ tokens/turn is typical; the overhead percentages above bracket that range.
- **What's *not* counted:** any small envelope Claude Code wraps hook output in, and the model's cost of *acting* on the directive — both negligible versus the numbers above.
- **Reproduce:** `pip install tiktoken && python docs/measure-token-overhead.py`.
