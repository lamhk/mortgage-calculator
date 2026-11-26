// UN M49 Europe, translated to ISO alpha-2. GB is the ISO code; XK is commonly used for Kosovo.
const europe = new Set('AX AL AD AT BY BE BA BG HR CZ DK EE FO FI FR DE GI GR GG HU IS IE IM IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SJ SE CH UA GB VA'.split(' '));
const countryNames = new Intl.DisplayNames(['en-GB'], { type: 'region', fallback: 'none' });

export function parseAsn(value) {
  const match = /^(?:AS)?([0-9]{1,10})$/i.exec(value.trim());
  const asn = match ? Number(match[1]) : 0;
  return asn > 0 && asn < 4294967295 ? asn : null;
}

function relationshipParser() {
  const customers = new Map();
  const providers = new Map();
  let edges = 0;
  const add = (index, from, to) => {
    if (!index.has(from)) index.set(from, new Set());
    index.get(from).add(to);
  };
function addLine(raw) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const [left, right, kind] = line.split('|');
    const first = parseAsn(left);
    const second = parseAsn(right ?? '');
    if (first === null || second === null || !['0', '-1'].includes(kind)) {
      throw new Error('Use the complete CAIDA serial-1 .as-rel.txt snapshot (not prefix-to-AS or customer cones).');
    }
    if (kind === '0' || first === second) return;
    add(customers, first, second);
    add(providers, second, first);
    edges++;
  }
  return { addLine, finish() {
    if (!edges) throw new Error('The relationships file contains no provider-to-customer records.');
    return { customers, providers };
  } };
}

function organizationParser() {
  const organizations = new Map();
  const auts = new Map();
  let section;
  let period;
function addLine(raw) {
    const line = raw.trim();
    if (line.startsWith('#')) {
      const format = /^#\s*format:\s*(org_id|aut)\|/i.exec(line);
      if (format) section = format[1].toLowerCase();
      const date = /^#\s*date:\s*(\d{6})$/.exec(line);
      if (date) period = date[1].replace(/^(\d{4})(\d{2})$/, '$1-$2');
      return;
    }
    if (!section || !line) return;
    const fields = line.split('|');
    if (section === 'org_id' && fields.length === 5) {
      const [id, , name, country] = fields;
      const code = country.trim().toUpperCase();
      const normalized = code === 'UK' ? 'GB' : code;
      const valid = /^[A-Z]{2}$/.test(normalized) && !['XX', 'ZZ', 'EU', 'UN', 'AP', 'EZ', 'QO'].includes(normalized);
      const countryName = valid ? countryNames.of(normalized) : undefined;
      organizations.set(id, { name: name.trim(), code: countryName ? normalized : null, countryName });
    } else if (section === 'aut' && (fields.length === 5 || fields.length === 6)) {
      const [number, , name, orgId] = fields;
      const asn = parseAsn(number);
      if (asn !== null) auts.set(asn, { name: name.trim(), orgId });
    } else {
      throw new Error('An AS Organizations row does not match the CAIDA text format.');
    }
  }
  return { addLine, finish() {
    if (!organizations.size || !auts.size) throw new Error('Use the CAIDA .as-org2info.txt or .txt.gz snapshot, with both organization and ASN sections.');
    return { organizations, auts, period };
  } };
}

function parseText(parser, text) {
  for (const line of text.split('\n')) parser.addLine(line);
  return parser.finish();
}

async function parseStream(parser, bytes) {
  const reader = bytes.pipeThrough(new TextDecoderStream()).getReader();
  let pending = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = (pending + value).split('\n');
      pending = lines.pop();
      for (const line of lines) parser.addLine(line);
      if (pending.length > 65536) throw new Error('A snapshot line is too long. Choose a CAIDA text snapshot.');
    }
    if (pending) parser.addLine(pending);
    return parser.finish();
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export const parseRelationships = text => parseText(relationshipParser(), text);
export const parseOrganizations = text => parseText(organizationParser(), text);
export const readRelationships = bytes => parseStream(relationshipParser(), bytes);
export const readOrganizations = bytes => parseStream(organizationParser(), bytes);

export function enquire(graph, registry, upstream, { region = 'all', homing = 'all' } = {}) {
  const rows = [];
  let unknown = 0;
  for (const customer of graph.customers.get(upstream) ?? []) {
    const providers = [...graph.providers.get(customer)].sort((a, b) => a - b);
    const classification = providers.length === 1 ? 'single' : 'multi';
    if (homing !== 'all' && classification !== homing) continue;
    const aut = registry.auts.get(customer);
    const org = registry.organizations.get(aut?.orgId);
    if (!org?.code) unknown++;
    if (region === 'europe' && !europe.has(org?.code)) continue;
    rows.push({ customer, asName: aut?.name, orgName: org?.name, country: org?.countryName, code: org?.code, providers, classification });
  }
  rows.sort((a, b) => a.customer - b.customer);
  return { rows, unknown, total: graph.customers.get(upstream)?.size ?? 0 };
}

export function snapshotDate(filename) {
  const match = /^(\d{4})(\d{2})(\d{2})[.]/.exec(filename);
  return match ? match.slice(1).join('-') : null;
}
