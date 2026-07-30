---
name: grok-search
description: Use when a task needs live web or X (Twitter) information — breaking news, X posts or community sentiment ("what is X saying about..."), deep multi-source research on a topic, obscure errors that documentation lookups can't resolve, or anything after the model's knowledge cutoff. Also when the user says "search the web", "look this up online", or "research this". Not for library/API syntax (use a docs tool), pages whose URL you already know (use web_fetch), or local file/git/code tasks.
allowed-tools:
  - mcp__grok-search__web_search
  - mcp__grok-search__get_sources
  - mcp__grok-search__web_fetch
  - mcp__grok-search__web_map
  - mcp__grok-search__doctor
---

# Grok Search

Live agentic web + X search. The server runs Grok in a multi-turn search loop, so
one `web_search` call takes **~40–90 seconds** but returns a synthesized answer with
a real source list — including X posts, which most other search tools cannot reach.
Treat it as the deep/realtime path, not the quick-lookup path.

## Tool routing

| Situation | Tool |
|---|---|
| No URL yet — research a topic, debug an error, track news or X sentiment | `web_search` |
| Re-examine sources from a previous search (no new search) | `get_sources(session_id)` |
| Have the exact URL, want one page in depth | `web_fetch(url)` — GitHub issues/PRs, StackOverflow, arXiv, Wikipedia get structured Markdown |
| Discover URLs across a site | `web_map` |
| Searches keep failing / verifying setup | `doctor` |

If a faster generic search tool (e.g. firecrawl, exa, built-in web search) is also
available, prefer it for quick shallow lookups; use `web_search` here when you need
depth, synthesis, recency, or X coverage. For library/framework API documentation,
prefer a dedicated docs tool (e.g. context7) over any web search.

## Usage discipline

- **Batch related sub-questions into one query** — each call costs ~a minute. One
  rich query beats three narrow ones.
- The response carries a `session_id`; page through more sources with
  `get_sources` instead of re-searching.
- `truncated: true` on a source means its inline text was trimmed — recover the
  full page with `web_fetch(url)`.
- Only need the answer and links? Pass `response_format: "concise"`.
- `recency_days` restricts supplemental sources to recent publications;
  `platform: "x"` biases the search toward X.

## When results look wrong

`fallback_used: true` with `sources_count: 0` means the Grok backend did not
return a verified search — the text is a fallback notice, not an answer. Run
`doctor`: if `grok.reachable` is false or the detail shows 401/402, the gateway
account is out of credits or needs re-auth — report that to the user instead of
retrying the same query.
