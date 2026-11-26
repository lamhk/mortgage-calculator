import { parseAsn } from './asn-data.js';

const byId = (id) => document.getElementById(id);
const form = byId('enquiry-form');
const upstream = byId('upstream');
const button = byId('lookup-button');
const status = byId('enquiry-status');
const alert = byId('enquiry-error');
const dates = byId('snapshot-dates');
const table = byId('result-table');
const customers = byId('customers');
const relationships = byId('relationships');
const organizations = byId('organizations');
const pages = byId('result-pages');
const previous = byId('previous-page');
const next = byId('next-page');
const pageSize = 100;
let worker;
let result;
let page;

function resetResults() {
  alert.textContent = '';
  dates.hidden = table.hidden = pages.hidden = true;
  result = undefined;
  customers.replaceChildren();
}

function stopWorker() {
  worker?.terminate();
  worker = undefined;
  button.disabled = false;
}

function fail(message) {
  button.disabled = false;
  status.textContent = '';
  alert.textContent = message;
}

for (const input of [relationships, organizations]) {
  input.addEventListener('change', () => {
    stopWorker();
    resetResults();
    status.textContent = 'Run an enquiry with the selected snapshots.';
  });
}

function show({ rows, unknown, total, relationshipDate, organizationDate }, asn, region) {
  dates.textContent = 'Snapshot dates: CAIDA serial-1 relationships — ' + (relationshipDate ?? 'unknown') + '; CAIDA AS Organizations — ' + (organizationDate ?? 'unknown') + '.';
  dates.hidden = false;
  const unknownNote = unknown ? ' ' + unknown + ' customer(s) matching the homing filter have unknown country' + (region === 'europe' ? ' and were excluded.' : '.') : '';
  status.textContent = (rows.length
    ? rows.length + ' of ' + total + ' direct customers match for AS' + asn + '.'
    : total ? 'No direct customers of AS' + asn + ' match these filters.' : 'No direct customers of AS' + asn + ' were found in this snapshot.') + unknownNote;
  if (!rows.length) return;
  byId('customer-caption').textContent = 'Direct customers of AS' + asn;
  result = rows;
  page = 0;
  pages.hidden = rows.length <= pageSize;
  renderPage();
  table.hidden = false;
}

function renderPage() {
  const start = page * pageSize;
  const end = Math.min(start + pageSize, result.length);
  byId('page-status').textContent = 'Showing ' + (start + 1) + '–' + end + ' of ' + result.length;
  previous.disabled = start === 0;
  next.disabled = end === result.length;
  const fragment = document.createDocumentFragment();
  for (const row of result.slice(start, end)) {
    const tr = document.createElement('tr');
    const id = document.createElement('th');
    id.scope = 'row';
    id.textContent = 'AS' + row.customer;
    tr.append(id);
    for (const value of [row.asName || 'Unknown', row.orgName || 'Unknown', row.country ? row.country + ' (' + row.code + ')' : 'Unknown', row.classification === 'single' ? 'Single-homed' : 'Multi-homed', row.providers.length, row.providers.map(n => 'AS' + n).join(', ')]) {
      const td = document.createElement('td');
      td.textContent = value;
      tr.append(td);
    }
    fragment.append(tr);
  }
  customers.replaceChildren(fragment);
}

previous.addEventListener('click', () => { page--; renderPage(); if (previous.disabled) next.focus(); });
next.addEventListener('click', () => { page++; renderPage(); if (next.disabled) previous.focus(); });

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (button.disabled) return;
  resetResults();
  const asn = parseAsn(upstream.value);
  upstream.removeAttribute('aria-invalid');
  if (asn === null) {
    upstream.setAttribute('aria-invalid', 'true');
    fail('Enter an ASN from 1 to 4294967294, for example AS174 or 174.');
    upstream.focus();
    return;
  }
  for (const [input, name] of [[relationships, 'relationships'], [organizations, 'AS Organizations']]) {
    if (!input.files.length) {
      fail('Choose a ' + name + ' snapshot first.');
      input.focus();
      return;
    }
  }
  const filters = { region: byId('region').value, homing: byId('homing').value };
  status.textContent = 'Reading the snapshots and finding customers…';
  button.disabled = true;
  try {
    worker ??= new Worker(new URL('./asn-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      button.disabled = false;
      if (data.error) fail(data.error);
      else show(data, asn, filters.region);
    };
    worker.onerror = () => {
      stopWorker();
      fail('Could not start the enquiry. Serve this page over HTTP or HTTPS in a current browser.');
    };
    worker.postMessage({ relationships: relationships.files[0], organizations: organizations.files[0], asn, filters });
  } catch {
    stopWorker();
    fail('Could not read the snapshots in this browser.');
  }
});
