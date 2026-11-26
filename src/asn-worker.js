import { readRelationships, readOrganizations, enquire, snapshotDate } from './asn-data.js';

function snapshotStream(file) {
  if (/\.bz2$/i.test(file.name)) throw new Error('Extract the .bz2 archive first (for example, with bunzip2) and choose the resulting .txt file.');
  if (!/\.gz$/i.test(file.name)) return file.stream();
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open gzip files. Extract the .gz archive and choose its .txt file.');
  return file.stream().pipeThrough(new DecompressionStream('gzip'));
}

let snapshot;
self.onmessage = async ({ data }) => {
  try {
    if (!snapshot) {
      const relationships = await readRelationships(snapshotStream(data.relationships));
      const organizations = await readOrganizations(snapshotStream(data.organizations));
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
