# Web Retrieval: Fetch MCP, Firecrawl, And Jina

Reviewed: 2026-10-08.

Use **Firecrawl for general external pages, keep fetch MCP for simple direct
reads, and use Jina Reader as an on-demand fallback**. This keeps the existing
cheap local path while adding remote retrieval for sites it cannot read.

## Choose A Path

| Situation | First choice | If it fails |
| --- | --- | --- |
| Known accessible raw files, JSON, or static HTML | Existing `fetch` MCP | Firecrawl, then Jina Reader |
| General external docs, rendered pages, or a host already blocked locally | Firecrawl `firecrawl_scrape` | Jina Reader |
| Find a page from a query | Firecrawl `firecrawl_search` | Use an available search tool, then retrieve the source page |

Use structured APIs such as `gh api` for structured metadata. Read each page
through one working path; fetching it through every provider adds cost without
necessarily adding independent evidence. Skip paths already known to fail for
that host in the current session. If Firecrawl is not configured, use the
available paths and record the limitation.

These are complementary capabilities, not a proxy chain. The existing
[`mcp-fetch-server`](https://github.com/zcaceres/fetch-mcp) makes HTTP requests
from this machine and extracts their content; it is not a browser. Firecrawl
and Jina Reader retrieve the target from their services. The machine still
needs working DNS and HTTPS access to those services. Registering multiple MCP
servers does not implement automatic failover: the agent chooses the path using
the [shared retrieval reference](../../skills/_shared/references/web-retrieval.md).

## Setup

The updater already registers `fetch` for Claude Code and Codex using
`npx -y mcp-fetch-server@latest`. Firecrawl registration is a separate setup step.
For a bounded trial, the [hosted Firecrawl MCP](https://github.com/firecrawl/firecrawl-mcp-server#installation)
supports scrape, search, and parse without a key, subject to rate limits:

```bash
codex mcp add firecrawl --url https://mcp.firecrawl.dev/v2/mcp
claude mcp add --transport http --scope user firecrawl https://mcp.firecrawl.dev/v2/mcp
```

Run the command for the client you use, then reconnect or restart the client.
For regular use, connect an account with known quota. Firecrawl documents
`https://mcp.firecrawl.dev/v2/mcp-oauth` for OAuth, or a bearer API key on
`/v2/mcp`. Update the same entry when changing authentication. In Codex, the
key can come from the process environment rather than being written into TOML:

```toml
[mcp_servers.firecrawl]
url = "https://mcp.firecrawl.dev/v2/mcp"
bearer_token_env_var = "FIRECRAWL_API_KEY"
```

Configure the secret in the launching environment or client secret store.
Connection and tool discovery are only setup checks; verify a real scrape
returns the requested document body before relying on it.

## Jina Fallback And DNS

[`r.jina.ai`](https://github.com/jina-ai/reader) is the Reader HTTP API. Its URL
format is `https://r.jina.ai/https://example.com/page`; it is not an MCP endpoint.
Use the bundled helper from the repository root:

```bash
bash skills/_shared/scripts/jina-reader.sh 'https://example.com/'
bash skills/_shared/scripts/jina-reader.sh --fresh 'https://developers.openai.com/learn/docs-mcp'
```

The helper uses curl with Google DoH first and Cloudflare DoH after a transport
failure, with TLS verification and bounded timeouts. It writes only a completed
response to stdout. DNS choices are in the script, so the agent need not remember
special curl flags. It changes no system DNS or hosts file and pins no Jina IP.
Each invocation resolves again; long-running clients should honor DNS TTLs.
DNS caching and Jina's page cache are separate: `--fresh` requests a page-cache
bypass, not a DNS refresh. Reuse fetched content while it meets the task's
freshness needs; there is no universal page refresh interval.

This is an anonymous fallback. A 401/403/429 is a service, authorization, or
quota response to investigate, not a reason to keep switching DNS. DoH also
requires reachable resolver endpoints; proxy settings can move DNS resolution
to the proxy. Report an unresolved transport failure instead of claiming this
configuration guarantees access on every network.

## Evidence And Limits

Bounded observations on 2026-10-08:

- Local direct retrieval of OpenAI docs failed. Firecrawl returned actual Docs
  MCP and Codex config-reference content with `maxAge: 0` (fresh requests).
- Jina Reader returned the OpenAI Docs MCP body with corrected per-request DNS
  and `X-No-Cache: true`; normal local Jina DNS failed in this environment.
- The [official Jina MCP](https://github.com/jina-ai/MCP) at
  `https://mcp.jina.ai/v1` initialized and listed tools, but anonymous `read_url`
  returned a tool-level 401 for two public URLs. Authenticated reads were not
  tested. Prefer the proven Reader path until an authenticated MCP read passes.

These establish working paths for the tested pages, not long-term availability
or unlimited quotas. Check the useful body, tool errors, cache metadata, and
truncation; a successful HTTP response alone is insufficient. Cite the original
source URL and record retrieval limitations. Use remote services for public
material within the task's authorized scope.
