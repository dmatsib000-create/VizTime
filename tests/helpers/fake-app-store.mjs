// A stand-in App Store Connect for tests/testflight.test.js, loaded with
// `node --import` before native/scripts/testflight.mjs so the real script
// runs unchanged. FAKE_STORE (JSON) sets the scene; every call is appended to
// the file FAKE_CALLS, one JSON line each, for the test to read back.
import { appendFileSync } from 'node:fs';

const scene = JSON.parse(process.env.FAKE_STORE || '{}');
const builds = scene.builds || [];
let flaky = scene.flaky || 0;
const json = (status, body) => new Response(body == null ? '' : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const record = call => appendFileSync(process.env.FAKE_CALLS, `${JSON.stringify(call)}\n`);

// Waits are made instant, so the script's retries and polling don't slow the tests.
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...args) => realTimeout(fn, 0, ...args);

globalThis.fetch = async (url, { method = 'GET', body } = {}) => {
  const u = new URL(url);
  const path = u.pathname;
  record({ method, path, query: u.search, body: body ? JSON.parse(body) : null });
  if (flaky > 0 && method === 'GET') { flaky--; return new Response('<html>Service Unavailable</html>', { status: 503 }); }

  if (path === '/v1/apps') return json(200, { data: [{ id: 'app1', attributes: { name: 'TimeFall Timer', bundleId: 'io.github.dmatsib000create.timefall' } }] });
  if (path === '/v1/builds') {
    const version = u.searchParams.get('filter[version]');
    const list = version ? builds.filter(b => b.version === version) : [...builds].sort((a, b) => Date.parse(b.uploadedDate) - Date.parse(a.uploadedDate));
    return json(200, { data: list.slice(0, 1).map(b => ({ id: b.id, attributes: { version: b.version, processingState: b.state || 'VALID', usesNonExemptEncryption: false, uploadedDate: b.uploadedDate, expirationDate: b.expirationDate } })) });
  }
  let m;
  if ((m = /^\/v1\/builds\/([^/]+)\/betaAppReviewSubmission$/.exec(path))) {
    const b = builds.find(x => x.id === m[1]);
    return b?.review ? json(200, { data: { id: `sub-${b.id}`, attributes: { betaReviewState: b.review } } }) : json(404, { errors: [{ code: 'NOT_FOUND' }] });
  }
  if (/^\/v1\/builds\/[^/]+\/betaBuildLocalizations$/.test(path)) return json(200, { data: [{ id: 'bl1', attributes: { locale: 'en-US', whatsNew: '' } }] });
  if (/^\/v1\/apps\/[^/]+\/betaAppLocalizations$/.test(path)) return json(200, { data: [{ id: 'al1', attributes: { locale: 'en-US', description: 'A calm timer', feedbackEmail: 'owner@example.com' } }] });
  if (/^\/v1\/apps\/[^/]+\/betaAppReviewDetail$/.test(path)) return json(200, { data: { id: 'rd1', attributes: { contactFirstName: 'A', contactLastName: 'B', contactEmail: 'a@example.com', contactPhone: '1' } } });
  if (path === '/v1/betaGroups') return json(200, { data: [{ id: 'g1', attributes: { name: 'Friends', isInternalGroup: false, publicLinkEnabled: true, publicLink: 'https://testflight.apple.com/join/example' } }] });
  if (path === '/v1/betaAppReviewSubmissions' && method === 'POST') {
    if (scene.anotherInReview) return json(422, { errors: [{ code: 'ENTITY_UNPROCESSABLE.ANOTHER_BUILD_IN_REVIEW', detail: 'Another build in the same train is already in beta review.' }] });
    return json(201, { data: { id: 'sub-new', attributes: { betaReviewState: 'WAITING_FOR_REVIEW' } } });
  }
  if (/^\/v1\/betaGroups\/[^/]+\/relationships\/builds$/.test(path)) return scene.groupRefuses ? json(422, { errors: [{ code: 'ENTITY_UNPROCESSABLE', detail: 'Not yet' }] }) : new Response(null, { status: 204 });
  if (method === 'PATCH') return json(200, { data: { id: 'x', attributes: {} } });
  return json(404, { errors: [{ code: 'NOT_FOUND', detail: `${method} ${path}` }] });
};
