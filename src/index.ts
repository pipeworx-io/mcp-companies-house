interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Companies House MCP — UK statutory company registry (BYO key)
 *
 * UK equivalent of EDGAR for officer & filing data. Complements OpenCorporates
 * (broader but shallower) and GLEIF (cross-border identity).
 *
 * Auth: HTTP Basic — API key as username, empty password.
 *   Pass ?_apiKey=<your_key> on the gateway URL.
 *   Register a free key at https://developer.company-information.service.gov.uk
 *
 * Tools:
 * - search_companies: name-based search
 * - get_company:      registered office, status, type, SIC codes, accounts dates
 * - get_officers:     directors and secretaries, current and resigned
 * - get_filings:      filing history (annual returns, accounts, charges, etc.)
 * - get_persons_with_significant_control: PSC records (beneficial owners)
 */


const BASE_URL = 'https://api.company-information.service.gov.uk';

const tools: McpToolExport['tools'] = [
  {
    name: 'search_companies',
    description:
      'Search UK Companies House by company name. Returns matches with company number, name, status (active/dissolved), type, registered office address, and incorporation date. Use the company_number to look up officers, filings, and PSCs.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Company name (full or partial)' },
        items_per_page: { type: 'number', description: '1-100 (default 20)' },
        start_index: { type: 'number', description: 'Pagination offset (default 0)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_company',
    description:
      'Fetch a single UK company profile by company number. Returns registered name, status, type, SIC codes, registered office, accounts/confirmation-statement due dates, and links to officers/filings/charges/PSCs.',
    inputSchema: {
      type: 'object',
      properties: {
        company_number: { type: 'string', description: 'UK company number (e.g., "00006245")' },
      },
      required: ['company_number'],
    },
  },
  {
    name: 'get_officers',
    description:
      'List directors and secretaries for a UK company. Returns name, role, appointment/resignation dates, occupation, country of residence, nationality, and date of birth (month/year only).',
    inputSchema: {
      type: 'object',
      properties: {
        company_number: { type: 'string', description: 'UK company number' },
        items_per_page: { type: 'number', description: '1-100 (default 35)' },
        start_index: { type: 'number', description: 'Pagination offset (default 0)' },
        register_type: {
          type: 'string',
          description: 'directors | secretaries | llp-members (optional restriction)',
        },
      },
      required: ['company_number'],
    },
  },
  {
    name: 'get_filings',
    description:
      'Filing history for a UK company — annual returns, accounts, changes of address/directors, charges, mortgages. Returns category, description, filing date, transaction ID, and links to filed documents.',
    inputSchema: {
      type: 'object',
      properties: {
        company_number: { type: 'string', description: 'UK company number' },
        category: { type: 'string', description: 'Optional filter (accounts | confirmation-statement | officers | etc.)' },
        items_per_page: { type: 'number', description: '1-100 (default 25)' },
        start_index: { type: 'number', description: 'Pagination offset (default 0)' },
      },
      required: ['company_number'],
    },
  },
  {
    name: 'get_persons_with_significant_control',
    description:
      'Beneficial-ownership records (PSCs) for a UK company — individuals or entities with significant control. Returns name, kind, nature of control, ownership-of-shares brackets, and country of residence.',
    inputSchema: {
      type: 'object',
      properties: {
        company_number: { type: 'string', description: 'UK company number' },
        items_per_page: { type: 'number', description: '1-100 (default 25)' },
        start_index: { type: 'number', description: 'Pagination offset (default 0)' },
      },
      required: ['company_number'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = (args._apiKey as string | undefined)?.trim();
  if (!apiKey) {
    throw new Error(
      'Companies House requires a BYO API key. Pass ?_apiKey=<your_key> on the gateway URL. Register a free key at https://developer.company-information.service.gov.uk',
    );
  }
  switch (name) {
    case 'search_companies':
      return searchCompanies(apiKey, args);
    case 'get_company':
      return getCompany(apiKey, args.company_number as string);
    case 'get_officers':
      return getOfficers(apiKey, args);
    case 'get_filings':
      return getFilings(apiKey, args);
    case 'get_persons_with_significant_control':
      return getPSC(apiKey, args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function chFetch<T>(apiKey: string, path: string, query?: URLSearchParams): Promise<T> {
  const url = `${BASE_URL}${path}${query?.toString() ? `?${query}` : ''}`;
  const basic = btoa(`${apiKey}:`);
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${basic}`, Accept: 'application/json' },
  });
  if (res.status === 401) throw new Error('Companies House: invalid API key (HTTP 401)');
  if (res.status === 404) throw new Error('Companies House: not found (HTTP 404)');
  if (res.status === 429) throw new Error('Companies House: rate-limit hit (HTTP 429) — try again shortly');
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Companies House error: ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function searchCompanies(apiKey: string, args: Record<string, unknown>) {
  const params = new URLSearchParams({
    q: String(args.query),
    items_per_page: String(Math.min(100, Math.max(1, (args.items_per_page as number) ?? 20))),
    start_index: String((args.start_index as number) ?? 0),
  });
  const data = await chFetch<{
    total_results?: number;
    items?: {
      company_number?: string;
      title?: string;
      company_status?: string;
      company_type?: string;
      date_of_creation?: string;
      address_snippet?: string;
      links?: { self?: string };
    }[];
  }>(apiKey, '/search/companies', params);

  return {
    total: data.total_results ?? 0,
    returned: data.items?.length ?? 0,
    companies: (data.items ?? []).map((c) => ({
      company_number: c.company_number ?? null,
      name: c.title ?? null,
      status: c.company_status ?? null,
      type: c.company_type ?? null,
      incorporated_on: c.date_of_creation ?? null,
      address: c.address_snippet ?? null,
      ch_url: c.company_number ? `https://find-and-update.company-information.service.gov.uk/company/${c.company_number}` : null,
    })),
  };
}

async function getCompany(apiKey: string, companyNumber: string) {
  if (!companyNumber) throw new Error('company_number is required');
  const data = await chFetch<{
    company_number?: string;
    company_name?: string;
    company_status?: string;
    company_status_detail?: string;
    type?: string;
    jurisdiction?: string;
    sic_codes?: string[];
    date_of_creation?: string;
    date_of_cessation?: string;
    registered_office_address?: {
      address_line_1?: string;
      address_line_2?: string;
      locality?: string;
      region?: string;
      postal_code?: string;
      country?: string;
    };
    accounts?: { next_due?: string; next_made_up_to?: string; last_accounts?: { made_up_to?: string; type?: string } };
    confirmation_statement?: { next_due?: string; next_made_up_to?: string };
    links?: { officers?: string; filing_history?: string; charges?: string; persons_with_significant_control?: string };
  }>(apiKey, `/company/${encodeURIComponent(companyNumber)}`);

  return {
    company_number: data.company_number ?? null,
    name: data.company_name ?? null,
    status: data.company_status ?? null,
    status_detail: data.company_status_detail ?? null,
    type: data.type ?? null,
    jurisdiction: data.jurisdiction ?? null,
    sic_codes: data.sic_codes ?? [],
    incorporated_on: data.date_of_creation ?? null,
    dissolved_on: data.date_of_cessation ?? null,
    registered_office: data.registered_office_address ?? null,
    accounts_next_due: data.accounts?.next_due ?? null,
    accounts_next_made_up_to: data.accounts?.next_made_up_to ?? null,
    last_accounts_made_up_to: data.accounts?.last_accounts?.made_up_to ?? null,
    confirmation_statement_next_due: data.confirmation_statement?.next_due ?? null,
    ch_url: data.company_number ? `https://find-and-update.company-information.service.gov.uk/company/${data.company_number}` : null,
  };
}

async function getOfficers(apiKey: string, args: Record<string, unknown>) {
  const cn = args.company_number as string;
  if (!cn) throw new Error('company_number is required');
  const params = new URLSearchParams({
    items_per_page: String(Math.min(100, Math.max(1, (args.items_per_page as number) ?? 35))),
    start_index: String((args.start_index as number) ?? 0),
  });
  if (args.register_type) params.set('register_type', String(args.register_type));

  const data = await chFetch<{
    total_results?: number;
    active_count?: number;
    resigned_count?: number;
    items?: {
      name?: string;
      officer_role?: string;
      appointed_on?: string;
      resigned_on?: string;
      occupation?: string;
      country_of_residence?: string;
      nationality?: string;
      date_of_birth?: { month?: number; year?: number };
      address?: Record<string, string>;
    }[];
  }>(apiKey, `/company/${encodeURIComponent(cn)}/officers`, params);

  return {
    company_number: cn,
    total: data.total_results ?? 0,
    active: data.active_count ?? null,
    resigned: data.resigned_count ?? null,
    officers: (data.items ?? []).map((o) => ({
      name: o.name ?? null,
      role: o.officer_role ?? null,
      appointed_on: o.appointed_on ?? null,
      resigned_on: o.resigned_on ?? null,
      occupation: o.occupation ?? null,
      country_of_residence: o.country_of_residence ?? null,
      nationality: o.nationality ?? null,
      dob: o.date_of_birth ?? null,
      address: o.address ?? null,
    })),
  };
}

async function getFilings(apiKey: string, args: Record<string, unknown>) {
  const cn = args.company_number as string;
  if (!cn) throw new Error('company_number is required');
  const params = new URLSearchParams({
    items_per_page: String(Math.min(100, Math.max(1, (args.items_per_page as number) ?? 25))),
    start_index: String((args.start_index as number) ?? 0),
  });
  if (args.category) params.set('category', String(args.category));

  const data = await chFetch<{
    total_count?: number;
    items?: {
      category?: string;
      type?: string;
      description?: string;
      action_date?: string;
      date?: string;
      transaction_id?: string;
      pages?: number;
      links?: { self?: string; document_metadata?: string };
    }[];
  }>(apiKey, `/company/${encodeURIComponent(cn)}/filing-history`, params);

  return {
    company_number: cn,
    total: data.total_count ?? 0,
    filings: (data.items ?? []).map((f) => ({
      category: f.category ?? null,
      type: f.type ?? null,
      description: f.description ?? null,
      filed_on: f.date ?? null,
      action_date: f.action_date ?? null,
      transaction_id: f.transaction_id ?? null,
      pages: f.pages ?? null,
      document_metadata: f.links?.document_metadata ?? null,
    })),
  };
}

async function getPSC(apiKey: string, args: Record<string, unknown>) {
  const cn = args.company_number as string;
  if (!cn) throw new Error('company_number is required');
  const params = new URLSearchParams({
    items_per_page: String(Math.min(100, Math.max(1, (args.items_per_page as number) ?? 25))),
    start_index: String((args.start_index as number) ?? 0),
  });

  const data = await chFetch<{
    total_results?: number;
    items?: {
      name?: string;
      kind?: string;
      natures_of_control?: string[];
      country_of_residence?: string;
      nationality?: string;
      notified_on?: string;
      ceased_on?: string;
      address?: Record<string, string>;
      identification?: Record<string, string>;
    }[];
  }>(apiKey, `/company/${encodeURIComponent(cn)}/persons-with-significant-control`, params);

  return {
    company_number: cn,
    total: data.total_results ?? 0,
    persons: (data.items ?? []).map((p) => ({
      name: p.name ?? null,
      kind: p.kind ?? null,
      natures_of_control: p.natures_of_control ?? [],
      country_of_residence: p.country_of_residence ?? null,
      nationality: p.nationality ?? null,
      notified_on: p.notified_on ?? null,
      ceased_on: p.ceased_on ?? null,
      address: p.address ?? null,
      identification: p.identification ?? null,
    })),
  };
}

export default { tools, callTool, meter: { credits: 2 } } satisfies McpToolExport;
