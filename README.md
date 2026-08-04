# @pipeworx/companies-house

UK Companies House MCP — statutory company registry, BYO key.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

- `search_companies(query, items_per_page?, start_index?)`
- `get_company(company_number)`
- `get_officers(company_number, items_per_page?, start_index?, register_type?)`
- `get_filings(company_number, category?, items_per_page?, start_index?)`
- `get_persons_with_significant_control(company_number, items_per_page?, start_index?)`

## Auth

BYO key. Pass `?_apiKey=<key>` on the gateway URL. Register a free key at https://developer.company-information.service.gov.uk.

## Data source

`https://api.company-information.service.gov.uk` — HTTP Basic auth (key as username, empty password).

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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Companies House data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
