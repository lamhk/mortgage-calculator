import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAsn, parseRelationships, parseOrganizations, enquire, snapshotDate, readRelationships, readOrganizations } from '../src/asn-data.js';

// Synthetic fixtures; no CAIDA data is distributed with the application.
const graph = parseRelationships('# comment\n10|20|-1\n10|20|-1\n99|20|-1\n10|21|-1\n10|22|-1\n10|23|-1\n10|24|0\n25|10|-1\n20|26|-1\n10|10|-1');
const registry = parseOrganizations([
  '# date: 202601', '# format: org_id|changed|org_name|country|source',
  'A||European Org|DE|TEST', 'B||Unlocated Org||TEST', 'C||Other Org|US|TEST',
  '# format: aut|changed|aut_name|org_id|opaque_id|source',
  '20||European Network|A||TEST', '21||Unlocated Network|B||TEST', '23||Other Network|C||TEST',
].join('\n'));

test('ASN validation accepts asplain with optional AS and rejects out-of-range or malformed values', () => {
  for (const value of ['AS174', '174', ' as174 ']) assert.equal(parseAsn(value), 174);
  for (const value of ['', 'AS 174', '174.1', '-1', '1e4', '0', '4294967295', '4294967296']) assert.equal(parseAsn(value), null);
  assert.equal(parseAsn('4294967294'), 4294967294);
});

test('direct relationships are directional, deduplicated and exclude peers and indirect customers', () => {
  const response = enquire(graph, registry, 10);
  assert.equal(response.total, 4);
  assert.deepEqual(response.rows.map(row => row.customer), [20, 21, 22, 23]);
  assert.deepEqual(enquire(graph, registry, 25).rows.map(row => row.customer), [10]);
  assert.deepEqual(response.rows[0].providers, [10, 99]);
  assert.deepEqual(response.rows[1].providers, [10]);
});

test('classifies using all providers before filtering geography, including providers without registry data', () => {
  const [row] = enquire(graph, registry, 10, { region: 'europe', homing: 'multi' }).rows;
  assert.equal(row.orgName, 'European Org');
  assert.equal(row.asName, 'European Network');
  assert.equal(row.code, 'DE');
  assert.deepEqual(row.providers, [10, 99]);
  assert.equal(row.classification, 'multi');
  assert.deepEqual(enquire(graph, registry, 10, { region: 'europe', homing: 'single' }).rows, []);
});

test('missing registration geography and missing ASN records are counted and excluded only in Europe', () => {
  const all = enquire(graph, registry, 10, { homing: 'single' });
  assert.equal(all.unknown, 2);
  assert.deepEqual(all.rows.map(row => row.country), [undefined, undefined, 'United States']);
  const europe = enquire(graph, registry, 10, { region: 'europe' });
  assert.equal(europe.unknown, 2);
  assert.equal(europe.rows.length, 1);
});

test('snapshot labels and wrong-file diagnostics', () => {
  assert.equal(registry.period, '2026-01');
  assert.equal(snapshotDate('20261101.as-rel.txt'), '2026-11-01');
  assert.equal(snapshotDate('renamed.txt'), null);
  assert.throws(() => parseRelationships('192.0.2.0\t24\t10'), /serial-1/);
  assert.throws(() => parseOrganizations('not an organization snapshot'), /AS Organizations|as-org2info/);
});

test('streams decode split UTF-8 characters, split records and final lines without newline', async () => {
  function chunks(lines) {
    const bytes = new TextEncoder().encode(lines.join(String.fromCharCode(10)));
    return new ReadableStream({ start(controller) {
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    } });
  }
  const streamedGraph = await readRelationships(chunks(['174|200|-1', '500|200|-1', '174|201|0']));
  const streamedRegistry = await readOrganizations(chunks([
    '# format: org_id|changed|org_name|country|source', 'D||Réseau|FR|TEST',
    '# format: aut|changed|aut_name|org_id|opaque_id|source', '200||Réseau AS|D||TEST',
  ]));
  const { rows } = enquire(streamedGraph, streamedRegistry, 174, { region: 'europe' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].orgName, 'Réseau');
  assert.deepEqual(rows[0].providers, [174, 500]);
});
