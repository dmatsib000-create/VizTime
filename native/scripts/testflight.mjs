// Hands a freshly uploaded iPhone build to TestFlight's "Friends" group, so
// a friend's phone gets every build without anyone opening App Store
// Connect. Runs as the second job of .github/workflows/ios.yml, after
// xcodebuild has uploaded the archive, using the same App Store Connect API
// key. Needs nothing beyond Node 22.
//
// In order:
//   1. waits for App Store Connect to finish processing the build;
//   2. answers the export-compliance question if the upload left it open
//      (TimeFall has no encryption of its own);
//   3. writes "What to Test" for the build;
//   4. makes sure the app's test information has a description, and says
//      plainly what the account holder still has to type (the feedback
//      email and the review contact are theirs, never written here);
//   5. finds or creates the external group "Friends" with a public link;
//   6. submits the build for Beta App Review and adds it to the group;
//   7. prints the public link in the job summary.
// It exits with an error when the build can't reach testers yet, so the
// Actions page shows the reason in red. "Re-run failed jobs" then picks up
// the same build.

import { createPrivateKey, sign } from 'node:crypto';
import { appendFileSync } from 'node:fs';

const env = name => {
  const v = process.env[name];
  if (!v) { console.error(`::error::Missing ${name}`); process.exit(2); }
  return v;
};
const PRIVATE_KEY = env('APPSTORE_PRIVATE_KEY');
const KEY_ID = env('APPSTORE_KEY_ID');
const ISSUER_ID = env('APPSTORE_ISSUER_ID');
const BUILD_NUMBER = env('BUILD_NUMBER');
const MARKETING_VERSION = env('MARKETING_VERSION');
const SHA = (process.env.GITHUB_SHA || '').slice(0, 7);

const BUNDLE_ID = 'io.github.dmatsib000create.timefall';
const GROUP_NAME = 'Friends';
// The install page is public, so the link is capped; the account holder can
// raise it in App Store Connect → TestFlight → Friends.
const TESTER_LIMIT = 25;
const DESCRIPTION = 'A calm visual timer for time blindness and transitions. Try a session in each mode.';
const WHATS_NEW = `Build ${BUILD_NUMBER}${SHA ? `, from ${SHA}` : ''}. Try a session in each mode, and lock the phone during one.`;
const WAIT_MINUTES = 50;

/* ---------- The App Store Connect API ---------- */

const API = 'https://api.appstoreconnect.apple.com';

// A signed token lasts at most 20 minutes; this one is remade after 10.
let jwt = { value: '', made: 0 };
function token() {
  if (Date.now() - jwt.made < 10 * 60_000) return jwt.value;
  const now = Math.floor(Date.now() / 1000);
  const part = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = `${part({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })}.${part({ iss: ISSUER_ID, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' })}`;
  const sig = sign('sha256', Buffer.from(head), { key: createPrivateKey(PRIVATE_KEY), dsaEncoding: 'ieee-p1363' });
  jwt = { value: `${head}.${sig.toString('base64url')}`, made: Date.now() };
  return jwt.value;
}

class ApiError extends Error {
  constructor(status, errors, path) {
    const detail = (errors || []).map(e => `${e.code || e.title || ''} ${e.detail || ''}`.trim()).join('; ');
    super(`${status} from ${path.split('?')[0]}: ${detail || 'no detail'}`);
    this.status = status;
  }
}

async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data?.errors, path);
  return data;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const blank = s => !s || !String(s).trim();
const english = list => list.find(l => /^en/i.test(l.attributes.locale)) || list[0];

/* ---------- Steps ---------- */

async function findApp() {
  const r = await api('GET', `/v1/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}&fields[apps]=name,bundleId`);
  const app = r.data[0];
  if (!app) throw new Error(`No app in App Store Connect has the bundle id ${BUNDLE_ID}. Create it there first (docs/timefall-progress.md, step 3).`);
  return app;
}

async function waitForBuild(appId) {
  const q = `/v1/builds?filter[app]=${appId}&filter[version]=${encodeURIComponent(BUILD_NUMBER)}`
    + `&filter[preReleaseVersion.version]=${encodeURIComponent(MARKETING_VERSION)}&sort=-uploadedDate&limit=1`
    + '&fields[builds]=version,processingState,usesNonExemptEncryption,expired';
  const until = Date.now() + WAIT_MINUTES * 60_000;
  for (;;) {
    const build = (await api('GET', q)).data[0];
    const state = build?.attributes.processingState;
    if (state === 'VALID') return build;
    if (state === 'FAILED' || state === 'INVALID') {
      throw new Error(`App Store Connect marked build ${BUILD_NUMBER} as ${state}; its email to the account holder says why.`);
    }
    if (Date.now() > until) {
      throw new Error(`Build ${BUILD_NUMBER} was still ${state ? state.toLowerCase() : 'not listed'} after ${WAIT_MINUTES} minutes. Re-run this job later; it picks up the same build.`);
    }
    console.log(`Build ${BUILD_NUMBER}: ${state ? state.toLowerCase() : 'not listed yet'}; checking again in a minute.`);
    await sleep(60_000);
  }
}

async function exportCompliance(build) {
  if (build.attributes.usesNonExemptEncryption != null) return;
  await api('PATCH', `/v1/builds/${build.id}`, { data: { type: 'builds', id: build.id, attributes: { usesNonExemptEncryption: false } } });
  console.log('Answered the export-compliance question: no encryption of its own.');
}

async function whatToTest(build) {
  const have = (await api('GET', `/v1/builds/${build.id}/betaBuildLocalizations?fields[betaBuildLocalizations]=locale,whatsNew`)).data;
  const en = english(have);
  if (en) {
    await api('PATCH', `/v1/betaBuildLocalizations/${en.id}`, { data: { type: 'betaBuildLocalizations', id: en.id, attributes: { whatsNew: WHATS_NEW } } });
  } else {
    await api('POST', '/v1/betaBuildLocalizations', {
      data: { type: 'betaBuildLocalizations', attributes: { locale: 'en-US', whatsNew: WHATS_NEW }, relationships: { build: { data: { type: 'builds', id: build.id } } } },
    });
  }
}

// Fills the description where it is blank (Apple wants one in every
// language before a review) and returns what only the account holder can type.
async function testInformation(appId) {
  const missing = [];
  const locs = (await api('GET', `/v1/apps/${appId}/betaAppLocalizations?fields[betaAppLocalizations]=locale,description,feedbackEmail`)).data;
  let en = english(locs);
  if (!en) {
    en = (await api('POST', '/v1/betaAppLocalizations', {
      data: { type: 'betaAppLocalizations', attributes: { locale: 'en-US', description: DESCRIPTION }, relationships: { app: { data: { type: 'apps', id: appId } } } },
    })).data;
  }
  for (const l of [en, ...locs.filter(x => x !== en)]) {
    if (!blank(l.attributes.description)) continue;
    await api('PATCH', `/v1/betaAppLocalizations/${l.id}`, { data: { type: 'betaAppLocalizations', id: l.id, attributes: { description: DESCRIPTION } } });
  }
  if (blank(en.attributes.feedbackEmail)) missing.push('the Feedback Email');
  const detail = (await api('GET', `/v1/apps/${appId}/betaAppReviewDetail`)).data;
  const a = detail?.attributes || {};
  if (blank(a.contactFirstName) || blank(a.contactLastName)) missing.push('the Beta App Review contact name');
  if (blank(a.contactEmail)) missing.push('the Beta App Review contact email');
  if (blank(a.contactPhone)) missing.push('the Beta App Review contact phone');
  return missing;
}

async function friendsGroup(appId) {
  const groups = (await api('GET', `/v1/betaGroups?filter[app]=${appId}&filter[name]=${encodeURIComponent(GROUP_NAME)}`
    + '&fields[betaGroups]=name,isInternalGroup,publicLinkEnabled,publicLink')).data;
  let g = groups.find(x => x.attributes.name === GROUP_NAME && !x.attributes.isInternalGroup);
  if (!g) {
    g = (await api('POST', '/v1/betaGroups', {
      data: {
        type: 'betaGroups',
        attributes: { name: GROUP_NAME, isInternalGroup: false, publicLinkEnabled: true, publicLinkLimitEnabled: true, publicLinkLimit: TESTER_LIMIT, feedbackEnabled: true },
        relationships: { app: { data: { type: 'apps', id: appId } } },
      },
    })).data;
    console.log(`Made the external group "${GROUP_NAME}" with a public link for up to ${TESTER_LIMIT} testers.`);
  } else if (!g.attributes.publicLinkEnabled) {
    g = (await api('PATCH', `/v1/betaGroups/${g.id}`, {
      data: { type: 'betaGroups', id: g.id, attributes: { publicLinkEnabled: true, publicLinkLimitEnabled: true, publicLinkLimit: TESTER_LIMIT } },
    })).data;
  }
  return g;
}

async function submitForReview(build) {
  let sub = null;
  try {
    sub = (await api('GET', `/v1/builds/${build.id}/betaAppReviewSubmission?fields[betaAppReviewSubmissions]=betaReviewState`)).data;
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  const state = sub?.attributes?.betaReviewState;
  if (state && state !== 'REJECTED') return state;
  sub = (await api('POST', '/v1/betaAppReviewSubmissions', {
    data: { type: 'betaAppReviewSubmissions', relationships: { build: { data: { type: 'builds', id: build.id } } } },
  })).data;
  return sub.attributes?.betaReviewState || 'WAITING_FOR_REVIEW';
}

async function addToGroup(group, build) {
  try {
    await api('POST', `/v1/betaGroups/${group.id}/relationships/builds`, { data: [{ type: 'builds', id: build.id }] });
  } catch (e) {
    if (e.status !== 409) throw e; // already in the group
  }
}

/* ---------- Run ---------- */

const lines = [];
let failed = false;
const note = line => { console.log(line); lines.push(line); };
const fail = line => { console.log(`::error::${line}`); lines.push(line); failed = true; };
const plain = state => state.toLowerCase().replace(/_/g, ' ');

try {
  const app = await findApp();
  note(`App: ${app.attributes.name} (${BUNDLE_ID}).`);
  const build = await waitForBuild(app.id);
  note(`Build ${BUILD_NUMBER} of ${MARKETING_VERSION} is processed.`);
  await exportCompliance(build);
  await whatToTest(build);
  const missing = await testInformation(app.id);
  const group = await friendsGroup(app.id);
  if (missing.length) {
    fail(`Not sent to Beta App Review: App Store Connect still needs ${missing.join(', ')}. Only the account holder can type those (TestFlight tab → Test Information). Then re-run this job.`);
  } else {
    note(`Beta App Review: ${plain(await submitForReview(build))}.`);
  }
  try {
    await addToGroup(group, build);
    note(`Added to the "${GROUP_NAME}" group.`);
  } catch (e) {
    fail(`Could not add the build to the "${GROUP_NAME}" group: ${e.message}`);
  }
  const link = group.attributes.publicLink;
  note(link ? `Public link: ${link}` : `The "${GROUP_NAME}" group has no public link yet.`);
} catch (e) {
  fail(`Stopped: ${e.message}`);
}

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## TestFlight\n\n${lines.map(l => `- ${l}`).join('\n')}\n`);
}
process.exit(failed ? 1 : 0);
