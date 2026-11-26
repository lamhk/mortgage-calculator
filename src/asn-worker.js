import { parseRelationships, parseOrganizations, enquire, snapshotDate } from './asn-data.js';

async function readSnapshot(file) {
  if (/\.bz2$/i.test(file.name)) throw new Error('Extract the .bz2 archive first (for example, with bunzip2) and choose the resulting .txt file.');
  if (/\.gz$/i.test(file.name)) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open gzip files. Extract the .gz archive and choose its .txt file.');
    try {
      return await new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).text();
    } catch {
      throw new Error('Could not decompress the gzip snapshot. Check the file or try extracting it first.');
    }
  }
  return file.text();
}

let snapshot;
self.onmessage = async ({ data }) => {
  try {
    if (!snapshot) {
      const relationships = parseRelationships(await readSnapshot(data.relationships));
      const organizations = parseOrganizations(await readSnapshot(data.organizations));
      snapshot = { relationships, organizations };
    }
    const { relationships, organizations } = snapshot;
    self.postMessage({ ...enquire(relationships, organizations, data.asn, data.filters),
      relationshipDate: snapshotDate(data.relationships.name),
      organizationDate: snapshotDate(data.organizations.name) ?? organizations.period,
    });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
