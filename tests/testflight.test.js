// The iPhone hand-off script (native/scripts/testflight.mjs), run against a
// stand-in App Store Connect (tests/helpers/fake-app-store.mjs): run with
// `node --test`. It decides whether friends get a build, so the cases that
// already happened (another build in review, an outage) are held here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../native/scripts/testflight.mjs', import.meta.url));
const fake = new URL('./helpers/fake-app-store.mjs', import.meta.url).href;
const key = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' });
const DAY = 24 * 60 * 60_000;
const ago = days => new Date(Date.now() - days * DAY).toISOString();

// Runs the script once against `scene`; returns its exit code, what it
// printed, the summary, its step outputs and the calls it made.
function run(scene, args = []) {
  const dir = mkdtempSync(join(tmpdir(), 'testflight-'));
  const files = { calls: join(dir, 'calls'), summary: join(dir, 'summary'), output: join(dir, 'output') };
  const r = spawnSync(process.execPath, ['--import', fake, script, ...args], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH, FAKE_STORE: JSON.stringify(scene), FAKE_CALLS: files.calls,
      APPSTORE_PRIVATE_KEY: key, APPSTORE_KEY_ID: 'KEY123', APPSTORE_ISSUER_ID: 'issuer',
      BUILD_NUMBER: '21', MARKETING_VERSION: '1.0.0',
      GITHUB_STEP_SUMMARY: files.summary, GITHUB_OUTPUT: files.output,
    },
  });
  const read = f => (existsSync(f) ? readFileSync(f, 'utf8') : '');
  return {
    code: r.status, out: r.stdout + r.stderr, summary: read(files.summary), output: read(files.output),
    calls: read(files.calls).split('\n').filter(Boolean).map(l => JSON.parse(l)),
  };
}
const posted = (r, path) => r.calls.filter(c => c.method === 'POST' && c.path === path);

test('a new build is submitted for review and added to Friends', () => {
  const r = run({ builds: [{ id: 'b21', version: '21', uploadedDate: ago(0) }] });
  assert.equal(r.code, 0, r.out);
  assert.equal(posted(r, '/v1/betaAppReviewSubmissions').length, 1);
  assert.equal(posted(r, '/v1/betaGroups/g1/relationships/builds').length, 1);
  assert.match(r.summary, /Beta App Review: waiting for review/);
});

test('another build in review: the new one waits, and the job is not a failure', () => {
  // What happened to build 16 on 9 November 2026.
  const r = run({ anotherInReview: true, builds: [{ id: 'b21', version: '21', uploadedDate: ago(0) }] });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /::warning::Build 21 waits: another build of this version is in Beta App Review/);
  assert.match(r.summary, /daily TestFlight upkeep/);
  assert.equal(posted(r, '/v1/betaGroups/g1/relationships/builds').length, 1);
});

test('waiting, and Apple will not take it into the group yet: still a warning, not a failure', () => {
  const r = run({ anotherInReview: true, groupRefuses: true, builds: [{ id: 'b21', version: '21', uploadedDate: ago(0) }] });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /::warning::Not in the "Friends" group yet/);
});

test('an outage answering 503 with an HTML page is asked again, and a POST never repeated', () => {
  const r = run({ flaky: 2, builds: [{ id: 'b21', version: '21', uploadedDate: ago(0) }] });
  assert.equal(r.code, 0, r.out);
  assert.equal(r.calls.filter(c => c.path === '/v1/apps').length, 3);
  assert.equal(posted(r, '/v1/betaAppReviewSubmissions').length, 1);
});

test('an outage that lasts shows its status, not a JSON parse error', () => {
  const r = run({ flaky: 10, builds: [] });
  assert.equal(r.code, 1);
  assert.match(r.out, /::error::Stopped: 503 from \/v1\/apps: <html>Service Unavailable<\/html>/);
});

test('upkeep: the newest build, once the other review is done, is submitted and added', () => {
  const r = run({ builds: [{ id: 'b14', version: '14', uploadedDate: ago(2), review: 'APPROVED' }, { id: 'b21', version: '21', uploadedDate: ago(0) }] }, ['--newest']);
  assert.equal(r.code, 0, r.out);
  const sub = posted(r, '/v1/betaAppReviewSubmissions');
  assert.equal(sub.length, 1);
  assert.equal(sub[0].body.data.relationships.build.data.id, 'b21');
  assert.equal(r.output, '');
  // The build's own "What to Test" is left as its job wrote it.
  assert.equal(r.calls.some(c => c.path.endsWith('/betaBuildLocalizations')), false);
});

test('upkeep: a build already in review or approved is left alone', () => {
  const r = run({ builds: [{ id: 'b21', version: '21', uploadedDate: ago(1), review: 'WAITING_FOR_REVIEW' }] }, ['--newest']);
  assert.equal(r.code, 0, r.out);
  assert.equal(posted(r, '/v1/betaAppReviewSubmissions').length, 0);
});

test('upkeep: a rejected build is not sent back unchanged', () => {
  const r = run({ builds: [{ id: 'b21', version: '21', uploadedDate: ago(1), review: 'REJECTED' }] }, ['--newest']);
  assert.equal(r.code, 1);
  assert.equal(posted(r, '/v1/betaAppReviewSubmissions').length, 0);
  assert.match(r.out, /rejected in Beta App Review/);
});

test('upkeep: asks for a fresh build when the newest has under 30 days left', () => {
  const young = run({ builds: [{ id: 'b21', version: '21', uploadedDate: ago(59), review: 'APPROVED' }] }, ['--newest']);
  assert.equal(young.output, '');
  const old = run({ builds: [{ id: 'b21', version: '21', uploadedDate: ago(61), review: 'APPROVED' }] }, ['--newest']);
  assert.equal(old.code, 0, old.out);
  assert.equal(old.output.trim(), 'rebuild=true');
  // Apple's own expiry date wins when it gives one.
  const dated = run({ builds: [{ id: 'b21', version: '21', uploadedDate: ago(1), expirationDate: new Date(Date.now() + 10 * DAY).toISOString(), review: 'APPROVED' }] }, ['--newest']);
  assert.equal(dated.output.trim(), 'rebuild=true');
});

test('upkeep: a build still processing is left to its own job', () => {
  const r = run({ builds: [{ id: 'b21', version: '21', uploadedDate: ago(0), state: 'PROCESSING' }] }, ['--newest']);
  assert.equal(r.code, 0, r.out);
  assert.equal(posted(r, '/v1/betaAppReviewSubmissions').length, 0);
});
