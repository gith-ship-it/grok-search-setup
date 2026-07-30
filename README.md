# grok-search-setup

One-line installer that wires **Grok live web + X search** into your coding agents
(**opencode**, **Claude Code**, **Codex**) as an MCP server.

It installs [`grok-search-rs`](https://github.com/Episkey-G/GrokSearch-rs) and registers a
`grok-search` MCP server in every client it finds, with the one setting that matters when
you route through a proxy: **`GROK_SEARCH_TIMEOUT_SECONDS=150`** (a proxied multi-round
agentic Grok search can take ~50s; the default 60s times out right at the edge).

## Install

**Linux / macOS**
```bash
curl -fsSL https://raw.githubusercontent.com/gith-ship-it/grok-search-setup/main/install.sh | bash
```

**Windows (PowerShell)**
```powershell
irm https://raw.githubusercontent.com/gith-ship-it/grok-search-setup/main/install.ps1 | iex
```

You'll be prompted for two things — your **endpoint base URL** and your **API key**. Both
stay on the local machine only; **nothing endpoint-specific is baked into this repo**.

Prerequisite: **Node.js 18+** (grok-search-rs ships as a node-installed native binary).

## Endpoint / proxy

`grok-search-rs` talks to a Grok **Responses** (`/v1/responses`) endpoint. You point it at
whichever you use — this installer ships **no default host**, you supply it:

- **Your own proxy (e.g. [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI))** —
  set the URL to your gateway, e.g. `https://your-host/v1`, and use that gateway's API key.
  This lets grok-search reuse your existing Grok account pool instead of a separate xAI key.
  Confirm your proxy actually exposes `/v1/responses` with the server-side `web_search` /
  `x_search` tools (not every gateway does).
- **xAI directly** — set the URL to `https://api.x.ai/v1` (the built-in fallback if you just
  press Enter) and use an `xai-...` key from console.x.ai.

Set it non-interactively with `CPA_URL` (see below), or type it at the prompt. The API key
is written only to `~/.config/grok-search-rs/cpa.key` (mode 600); for opencode it is
referenced via `{file:...}` and never inlined into `opencode.json`.

## What it configures

For each detected client it registers a `grok-search` MCP server whose tools are
`web_search`, `get_sources`, `web_fetch`, `web_map`, `doctor`:

| Client | Written to | Key stored as |
|--------|-----------|---------------|
| Claude Code | `~/.claude.json` (user scope, via `claude mcp add`) | inline env |
| Codex | `~/.codex/config.toml` (via `codex mcp add`) | inline env |
| opencode | `~/.config/opencode/opencode.json` (`mcp.grok-search`) | `{file:...}` reference |

Existing MCP servers are left untouched (merge, not overwrite). Re-running updates the entry
in place (idempotent).

### Claude Code skill (auto-invocation)

On machines with Claude Code, the installer also drops a **skill** at
`~/.claude/skills/grok-search/SKILL.md` ([source](skills/grok-search/SKILL.md)). MCP tool
descriptions alone only get you tool-picking once the agent already decided to search; the
skill's trigger description stays in context and tells the agent *when* to reach for
grok-search (live info, X sentiment, deep research) and when to prefer a faster tool — the
same pattern Firecrawl uses for its official skill. Restart Claude Code to load it.
Uninstalling removes the skill too.

## Options (env vars)

| Var | Default | Meaning |
|-----|---------|---------|
| `CPA_KEY` | *(prompted)* | API key for your endpoint; set it to skip the prompt (CI) |
| `CPA_URL` | *(prompted, falls back to `https://api.x.ai/v1`)* | your Grok Responses endpoint base URL |
| `GROK_MODEL` | `grok-4.5` | Grok model |
| `GROK_TIMEOUT` | `150` | HTTP timeout (seconds) — keep ≥120 behind a proxy |
| `GROK_X_SEARCH` | `true` | offer X/Twitter as a search source |

Non-interactive example:
```bash
CPA_KEY=sk-xxx CPA_URL=https://your-host/v1 \
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/gith-ship-it/grok-search-setup/main/install.sh)"
```

## Usage

Ask your agent to search, e.g. *"search the web for the latest on <topic>"* or *"what is X
saying about <topic> today?"* — the `grok-search` tools handle it. First call takes ~40–60s
behind a proxy (agentic multi-round search); results carry cited sources.

## Uninstall

```bash
# Linux / macOS
curl -fsSL https://raw.githubusercontent.com/gith-ship-it/grok-search-setup/main/install.sh | bash -s -- --uninstall
```
```powershell
# Windows
$env:GROK_UNINSTALL='1'; irm https://raw.githubusercontent.com/gith-ship-it/grok-search-setup/main/install.ps1 | iex
```
Removes the MCP entries from all clients and deletes the key file. The `grok-search-rs`
binary is left installed (`npm uninstall -g grok-search-rs` to remove it).

## Notes

- **Bot-protection**: if the verify step reports your endpoint unreachable (HTTP 1010/403)
  from a non-browser client, relax bot-fight-mode for that host.
- **opencode `{file:}`**: the key is referenced, not inlined. If opencode reports auth
  errors, replace `{file:...}` with the literal key in `mcp.grok-search.environment`.
