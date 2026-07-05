# Token overhead

How much does backchannel add to your token usage? Roughly 125 fixed input tokens per turn (a standing instruction), about 22 tokens for each note you send or receive, and no extra model calls at all. On a normal coding turn that's around 1-2% overhead. On a large-context turn it's under 0.5%.

## Why it's cheap by design

backchannel never makes a second model call. There's no separate summariser pass and no per-turn `claude -p`. The agent writes its share note in-band, as one line of the reply it was already producing. So the overhead is a bounded amount of extra context, plus one short output line when you share. It doesn't double your inference, which is what keeps both the token cost and the dollar cost near zero.

There are three parts to the overhead, all deterministic:

1. The send directive, injected into context on every active turn (input). This is the only always-on cost.
2. Received messages: a short preamble plus one line per unread note (input), only on turns where something arrived.
3. Your `[[backchannel broadcast]]` line, appended to your reply (output), only on turns where you share.

## Measured component sizes

Measured with `tiktoken` (`o200k_base`) as a stand-in for Claude's tokenizer (see [caveats](#method-and-caveats)).

| Component | Tokens | When |
|---|---:|---|
| Send directive | 125 | input, every active turn |
| Send directive + catch-up variant | 162 | input, first turn or on-demand summary |
| Observation preamble | 31 | input, on turns where at least one message arrived |
| One received message line | 22 | input, per message received |
| Your marker note | 22 | output, per turn you share |

## Per-turn overhead

The directive is a fixed ~125 tokens, so its percentage cost shrinks as the turn's context grows. The baseline here is the tokens already in that turn (context replay, tool output, your prompt):

| Baseline input / turn | Directive only | Directive + 1 received msg |
|---:|---:|---:|
| 2,000 (tiny turn) | 6.25% | 8.90% |
| 10,000 (typical coding turn) | 1.25% | 1.78% |
| 50,000 (large context) | 0.25% | 0.36% |
| 150,000 (very large context) | 0.08% | 0.12% |

## Whole-session simulation

A 30-turn pair session where you share on half your turns and receive on half, against a conservative baseline of 12,000 input and 700 output tokens per turn:

- Added: 4,582 input + 330 output = 4,912 tokens
- Session baseline: 381,000 tokens
- Overhead is about 1.29% of the session, with no extra model calls.

Since the added input is fixed per turn, the percentage is smaller in the common case of larger real contexts, and only gets big on very short turns.

## Method and caveats

- The tokenizer is a proxy. Counts use OpenAI's `o200k_base` BPE rather than Claude's own tokenizer. Expect maybe 10-15% drift for English, which doesn't change any conclusion here. For exact Claude counts, point the script's `t()` at Anthropic's free [`/v1/messages/count_tokens`](https://docs.anthropic.com/en/api/messages-count-tokens) endpoint.
- The baselines are illustrative. Real Claude Code turns re-send the whole conversation as input each turn, so 10k-150k+ tokens per turn is typical, and the percentages above cover that range.
- A couple of things aren't counted: any small envelope Claude Code wraps hook output in, and the model's cost of acting on the directive. Both are negligible next to the numbers above.
- To reproduce: `pip install tiktoken && python docs/measure-token-overhead.py`.
