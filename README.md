# @pipeworx/companies-house

UK Companies House MCP — statutory company registry.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1854+ live data sources. This is an independent, unofficial integration — not affiliated with, endorsed by, or published by the upstream provider.

## Tools

- `search_companies(query, items_per_page?, start_index?)`
- `get_company(company_number)`
- `get_officers(company_number, items_per_page?, start_index?, register_type?)`
- `get_filings(company_number, category?, items_per_page?, start_index?)`
- `get_persons_with_significant_control(company_number, items_per_page?, start_index?)`
- `get_charges(company_number, items_per_page?, start_index?)` — the charges
  register: secured lending (mortgages, debentures, fixed/floating charges)
  registered against the company, the UK analogue of a US UCC lien filing.
  Returns each charge's status (outstanding/satisfied/part-satisfied),
  created/delivered/satisfied dates, particulars, and persons entitled (the
  lender(s)).

`company_number` on every per-company tool also accepts a company NAME,
resolved to a number automatically.

## Auth

Platform-keyed — the gateway supplies the key, same credential and publisher
as every other tool in this pack. A caller may still pass their own key with
`?_apiKey=<key>` (register a free one at
https://developer.company-information.service.gov.uk).

## Data source

Companies House (UK), the statutory company register — company profiles,
officers, filing history, persons with significant control, and the charges
(secured lending) register.

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "companies-house": {
      "url": "https://gateway.pipeworx.io/companies-house/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/companies-house/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1854+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/companies_house_search_companies \
  -H 'Content-Type: application/json' \
  -d '{"query":"Apple"}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/companies_house_search_companies`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Standalone (no gateway account)

This package also runs as a local stdio MCP server — no Pipeworx account, no
gateway round-trip:

```json
{
  "mcpServers": {
    "companies-house": {
      "command": "npx",
      "args": ["-y", "@pipeworx/mcp-companies-house"]
    }
  }
}
```

Or run it directly to confirm it starts:

```bash
npx -y @pipeworx/mcp-companies-house
```

It speaks MCP over stdin/stdout and answers `initialize`/`tools/list`/`tools/call`
for **only** this pack's tools — none of the shared meta-tools the gateway
connection above adds. Same source, same tools, no ask_pipeworx routing.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Companies House data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
