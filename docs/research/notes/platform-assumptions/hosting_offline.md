# Hosting an installable offline PWA on GitHub Pages at a project subpath (VizTime, as of November 2026)

Grounding from the repo (read-only, 2026-11-01):
- `manifest.webmanifest`: `"start_url": "./"`, `"scope": "./"`, `"display": "standalone"`, **no `id`**. Icons: 192, 512, maskable-512.
- `js/app.js:28`: `navigator.serviceWorker.register('sw.js')` on `load`. No `scope`, no `updateViaCache`, no update or `controllerchange` handling, and nothing calls `navigator.storage.persist()` or `estimate()`.
- `sw.js`: `CACHE = 'viztime-paper-7'`. Install precaches `SHELL` with `cache: 'reload'`, then `skipWaiting()`. Activate deletes only caches starting with `viztime` other than the current one, then `clients.claim()`. Fetch handles same-origin GETs: it sends `fetch(new Request(url, {cache:'no-cache'}))`, caches only `res.ok` responses, and on a **thrown** network error falls back to `caches.match(req, {ignoreSearch:true})`, then to `./index.html` for navigations. There is no timeout and no navigation preload. A non-ok response (404/429/5xx) is passed straight to the page and never falls back to the cache.
- `SHELL` does not include `icons/icon-maskable-512.png`, which the manifest references. That is minor, since it is only needed at install time.
- `js/store.js`: everything is in `localStorage` under the `viztime2:` prefix. There is no export or backup feature (a grep of `js/` found none).
- Live headers measured with `curl -I` on 2026-11-01 against `https://dmatsib000-create.github.io/VizTime/`, `sw.js` and `manifest.webmanifest`:
  - Headers returned: `Cache-Control: max-age=600`, `Expires` (= now + 10 min), `ETag`, `Last-Modified`, `Strict-Transport-Security: max-age=31556952`, `Via: 1.1 varnish`, `X-Served-By: cache-…` (Fastly).
  - The manifest is served as `application/manifest+json`.
  - Conditional requests (`If-None-Match` and `If-Modified-Since`) return `304`.
  - `http://…/VizTime/` and `https://…/VizTime` (no trailing slash) both `301` to `https://…/VizTime/`.
  - `?x=1` is served 200 with the same caching.
  - The account root `https://dmatsib000-create.github.io/` currently returns **404**: there is no user site, so there is currently no root-scoped service worker on this origin.

## 1. Shared origin: what all project sites on username.github.io share, and the cross-project risks

### Takeaway
Every project site under `username.github.io` is one origin, so they share localStorage, IndexedDB, Cache Storage, quota and eviction (all-or-nothing per origin). VizTime's prefixing protects only against accidental key or cache-name collisions, not against another project calling `localStorage.clear()` or deleting all caches. Service-worker scoping is the one area where the platform protects VizTime: the most specific scope wins, so a root-scope worker from a future user site would not control VizTime pages once VizTime's own worker is registered. Separately, `github.io` is on the Public Suffix List, so other *accounts'* sites are separate sites.

### Cited Findings
- Storage is managed per origin (scheme + host + port), and quotas apply to the whole origin "even if it hosts several sites" (MDN's example is `https://example.com/site1/` and `/site2/`) — [MDN: Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- When an origin is evicted, **all** of its data is deleted together, because partial deletion "could cause inconsistency problems" — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- Technologies counted per origin: Web Storage (localStorage and sessionStorage), IndexedDB, Cache API, OPFS and others — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- WebKit's quota policy covers localStorage, Cache API, IndexedDB, Service Worker and File System storage per origin. Cookies and the HTTP cache are outside it — [WebKit: Updates to Storage Policy (2023)](https://webkit.org/blog/14403/updates-to-storage-policy/)
- Persistent-storage status covers the whole site's storage: Cache API, cookies, Local Storage, IndexedDB, File System and service workers — [web.dev: Persistent storage](https://web.dev/articles/persistent-storage)
- When a document falls within the scope of several registrations, "The browser will associate the document with the matching registration that has the most specific scope… only one service worker runs for each document." MDN advises that "It is generally safer not to define registrations that have overlapping scopes." — [MDN: ServiceWorkerContainer.register()](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)
- A worker's default scope is the directory of the script, and it "can't have a scope broader than its own location" unless the script is served with a `Service-Worker-Allowed` header — [MDN register()](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)
- A user site (`username.github.io` repo) serving `/sw.js` can register scope `/` with no special header, because `/` is that script's own directory — [MDN register()](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)
- `github.io` is on the Public Suffix List, which "tell[s] us that example.com and example.github.io are independent sites". It sits in the PSL's private-domains section — [jefftk: History of the Public Suffix List](https://jefftk.com/p/history-of-the-public-suffix-list) (a secondary source; publicsuffix.org itself was not fetched). One open PSL issue reports browsers letting a public suffix set cookies on itself — [publicsuffix/list#461](https://github.com/publicsuffix/list/issues/461)
- On the live site today, the account root returns 404, so no user site and no root service worker exist yet (measured with curl, 2026-11-01; see header notes above).

### Inferences
- **Collisions vs. hostile or careless code.** The `viztime2:` prefix and the `startsWith('viztime')` cache filter in `activate` prevent VizTime from harming siblings, and siblings that follow the same convention from harming VizTime. Nothing in the platform stops another project on the same account from running `localStorage.clear()`, `caches.keys().then(ks => ks.forEach(k => caches.delete(k)))`, `indexedDB.deleteDatabase`, or unregistering *all* registrations via `navigator.serviceWorker.getRegistrations()`. All of these are same-origin APIs, and per MDN storage is per origin. This is a real but self-inflicted risk, because only the account owner's own repos can run on this origin.
- **Generic templates are the main hazard.** Many PWA starters' activate handlers delete *every* cache not in their whitelist. If the owner ever publishes a second PWA project (or a user site) on this account from such a template, it would wipe `viztime-paper-7`. VizTime's network-first design would then re-cache on the next online load, but offline launches would fail until that happened. Inference based on common template patterns; not sourced.
- **Root-scope worker.** If a user site is ever created with a `/`-scoped worker, the most-specific-scope rule keeps VizTime's `/VizTime/` registration in control of VizTime pages. Two exposures remain:
  - (a) Before VizTime's worker is registered (first visit on a new device), the root worker would intercept the VizTime navigation and its fetch handler would decide what VizTime gets.
  - (b) If VizTime's registration is ever unregistered, for example by the sibling code above, the root worker takes over.
  - Avoid a root-scoped worker on the account, or make any such worker ignore requests under `/VizTime/`.
- **Permissions and cookies.** Permissions such as notifications are granted per origin by Chromium and WebKit, so a notification grant to VizTime is a grant to every project on `username.github.io`, and a revoke by the user hits them all. I did not fetch a primary source on per-origin permission keying, so treat this as **uncertain but very likely**. Cookies set by any project are visible to all projects on the host (VizTime uses none).
- **"Clear site data".** Chrome's site settings, DevTools "Clear site data" and the `Clear-Site-Data` header operate at origin or site level. Because `username.github.io` is its own registrable site under the PSL, clearing it removes data for *all* of the account's projects at once, but not other accounts' sites. Mechanism inferred from MDN's per-origin model; Chrome's UI behaviour was not verified.
- **Quota and eviction are one unit.** A sibling project that stores large caches pushes the shared origin toward quota. Under LRU eviction, the whole origin, VizTime included, goes at once.

### Gaps
- No primary source found that documents Chromium or WebKit keying for notification, wake lock or Picture-in-Picture permissions on github.io specifically. Per-origin keying is general platform knowledge, not verified here.
- **iOS per-app separation.** WebKit says home-screen web apps "are not part of Safari and thus have their own counter of days of use" ([WebKit blog 10218](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)). A WebKit bug documents that home-screen apps don't share storage with Safari ([WebKit bug 181849](https://bugs.webkit.org/show_bug.cgi?id=181849)). I found **no authoritative source** on whether two different home-screen web apps from the *same origin*, for example two GitHub Pages projects both added to the home screen, get separate storage containers. Do not assume isolation between them. Test on a device if it matters.
- Did not verify what Chrome's PWA uninstall dialog offers ("also clear data") or whether it clears the entire github.io origin.

## 2. Service-worker scope, manifest `scope`/`start_url`/`id`, and app identity per platform

### Takeaway
VizTime's relative values resolve correctly on the subpath: the worker scope is `/VizTime/`, and `start_url`, `scope` and the computed `id` are all `https://username.github.io/VizTime/`. The missing `id` is harmless today but freezes the app's identity to the current `start_url`. Add `"id": "/VizTime/"` explicitly now. It equals the current computed id, so installed apps keep their identity. Note that `"./"` would resolve to the origin root, because `id` resolves against the start URL's origin., so that `start_url` or the manifest path can change later without orphaning installs. Changing the origin always creates a new app.

### Cited Findings
- `start_url` defaults to the document URL. A relative value is parsed against the **manifest URL** and must be same-origin with the document — [W3C Web Application Manifest](https://www.w3.org/TR/appmanifest/)
- `scope` is parsed against the manifest URL and applied only if `start_url` is within it. Otherwise it defaults to `start_url` with the filename, query and fragment stripped — [W3C Manifest](https://www.w3.org/TR/appmanifest/)
- `id` defaults to the processed `start_url`. A given `id` is parsed against the **start URL's origin**, so `"/"` or a bare path resolves from the origin root, not the subpath. It must be same-origin, its fragment is removed, and it need not be within scope — [W3C Manifest](https://www.w3.org/TR/appmanifest/)
- Chrome: "The `id` property represents the identity of the PWA to the browser." A manifest whose identity doesn't match is treated "as a new PWA, even if it is served from the same URL as another PWA." Since Chrome 96, the browser generates an `id` from `start_url` when the manifest has none, and DevTools shows the "Computed App Id". Setting an `id` "makes it possible to change the `start_url` and the manifest path", but only "if and only if their particular origin stays the same" — [Chrome: Uniquely identifying PWAs with the manifest id](https://developer.chrome.com/docs/capabilities/pwa-manifest-id)
- Chrome desktop and Android check the manifest for updates at launch, at most once per 24 hours.
  - Desktop applies the update after all windows close and updates every field except icons.
  - Android requests an updated WebAPK only when the device is charging and on Wi-Fi, can back off to 30 days, and updates icons too.
  - "Changes to the `start_url` require the manifest `id` to be set," and "Don't change the name or location of your web app manifest file."
  — [web.dev: How Chrome handles updates to the web app manifest](https://web.dev/articles/manifest-updates)
- Default SW scope = the script's directory, and relative script URLs resolve against the calling page's base URL. So `register('sw.js')` from `/VizTime/` or `/VizTime/index.html` registers `/VizTime/sw.js` with scope `/VizTime/`. MDN warns that page-relative URLs make it "easy to accidentally create unwanted registrations" if called from deeper pages — [MDN register()](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)
- GitHub Pages 301-redirects `/VizTime` (no slash) to `/VizTime/`, so the scope boundary is not missed when someone types the URL without the slash (measured with curl, 2026-11-01).

### Inferences
- **Resolved values today.** The manifest lives at `/VizTime/manifest.webmanifest`, so `start_url "./"` resolves to `https://<user>.github.io/VizTime/` and `scope "./"` resolves to the same. With no `id`, the computed id is `https://<user>.github.io/VizTime/`.
- **Pitfall when adding `id`.** The W3C rule parses `id` against the start URL's *origin*, not against the manifest URL. So both `"id": "/"` and `"id": "./"` resolve to the origin root `https://<user>.github.io/`, not to `/VizTime/`. That would change the identity: Chrome and Edge would treat the app as different from the one installed, and the id would collide conceptually with any other project on the account doing the same. Use **`"id": "/VizTime/"`** to reproduce the current computed id exactly, then confirm "Computed App Id" in DevTools before shipping. My reading of the spec's resolution rule needs that DevTools check, because the Chrome article does not state the rule.
- **Repo rename.** Renaming the repo changes the path and therefore the start_url, scope, worker scope and computed id. Every installed copy becomes an orphan: it points to a 404 or a new path and has no worker coverage. Saved data stays on the same origin, though, and is still readable under the new path, because storage is per origin, not per path.
- **iOS.** Home-screen apps are created from the page's state at "Add to Home Screen". Changing the manifest later does not update an existing iOS icon or name; the user must remove and re-add it. This is general knowledge and was not sourced in this session, so treat it as **uncertain**.
- **Android WebAPK.** The slow update channel (24 h, charging + Wi-Fi, back-off to 30 days) means manifest edits can take days or weeks to reach Android installs. Get name, icons and `id` right before Android rollout.

### Gaps
- No primary source fetched on how iOS Safari keys an installed home-screen web app (by start URL or by manifest `id`), or on whether iOS honours manifest `id` at all.
- Android WebAPK identity rules (manifest URL, `start_url` or `id`) are not documented on the fetched pages beyond the generic Chrome `id` article.

## 3. GitHub Pages HTTP caching, Fastly CDN, SW update checks, and flaky clinic Wi-Fi

### Takeaway
GitHub Pages serves every file with `Cache-Control: max-age=600` plus ETag and Last-Modified through Fastly. VizTime's `cache: 'no-cache'` correctly forces revalidation, which returns cheap 304s. Service-worker script updates bypass the HTTP cache by default. A deploy therefore reaches an online installed app on its next launch or navigation, possibly after a short CDN propagation delay. The real weakness is the opposite case: network-first with no timeout can hang on captive or flaky Wi-Fi, and non-ok responses never fall back to the cache.

### Cited Findings
- Live headers on the VizTime site: `Cache-Control: max-age=600`, `Expires` +10 min, `ETag`, `Last-Modified`, `Strict-Transport-Security: max-age=31556952`, served via Fastly (`Via: 1.1 varnish`, `X-Served-By: cache-…`, `X-Fastly-Request-ID`). `If-None-Match` and `If-Modified-Since` return 304 (curl, 2026-11-01). The GitHub Pages limits page does not document caching behaviour or any SLA — [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- Since Chrome 68 the top-level SW script is fetched bypassing the HTTP cache by default (`updateViaCache: 'imports'`). Before Chrome 68, any `max-age` over 86400 was capped at 24 h. Since Chrome 78, imported scripts are byte-compared on each check, and Firefox and Safari "already implement" this. Update checks run on navigation within scope, on `registration.update()`, and on push or sync events — [Chrome: Fresher service workers, by default](https://developer.chrome.com/blog/fresher-sw)
- `updateViaCache` values: `'all'` (HTTP cache for the main and imported scripts), `'imports'` (the main script always from the network), `'none'` (no HTTP cache) — [MDN register()](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)
- Service-worker boot-up typically adds about 50 ms, about 250 ms on mobile and sometimes over 500 ms before a network-based response can start. Navigation preload starts the request in parallel. Enable it in `activate` with `registration.navigationPreload.enable()` and consume `event.preloadResponse`; enabling it without consuming the response causes duplicate requests. Support: Chrome 59, Edge 18, Firefox 99, Safari 15.4 — [web.dev: Speed up service worker with navigation preloads](https://web.dev/blog/navigation-preload)
- Workbox's `NetworkFirst` exposes a `networkTimeoutSeconds` option, an industry-standard pattern for falling back to the cache when the network is slow. The docs page lists the option without describing its semantics — [Workbox strategies](https://developer.chrome.com/docs/workbox/modules/workbox-strategies)
- GitHub may rate-limit requests with HTTP `429` and an HTML body — [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

### Inferences
- **Update latency.**
  - After a deploy, `sw.js` is re-fetched from the network on the next navigation, because the default `updateViaCache` is `'imports'`. The byte change from the `CACHE` bump triggers install, `skipWaiting()` and `clients.claim()`.
  - Because VizTime is network-first with `no-cache` revalidation, even without a worker update, the next online load gets the new files once Fastly's edge has them.
  - Edge staleness of up to about 10 minutes after a deploy is plausible given `max-age=600`, but the purge behaviour of GitHub's Fastly setup is undocumented. Observed `Age: 540` with `X-Cache: HIT` on pages.github.com shows edges do hold copies for the max-age window.
  - So "fixed within ~10 minutes of a deploy, on next launch while online" is a reasonable expectation. **Uncertain**: GitHub may purge on deploy.
- **Floating window kept open for hours.** Update checks happen only on navigation, push/sync or an explicit `update()`. A Windows floating window that stays open all day never navigates, so it runs the old JS until relaunch. `skipWaiting()` + `clients.claim()` means the new worker takes over the *fetches* of the already-open old page mid-session. That is mostly harmless with network-first, but a lazily imported module could be the new version paired with old already-loaded modules. Consider calling `registration.update()` on `visibilitychange`, and reloading only at a safe moment (no running session), or not at all.
- **Flaky clinic Wi-Fi.** `fetch()` has no built-in timeout. On a captive portal or a stalled connection, the request may hang for tens of seconds or longer before it throws, and only a *thrown* error triggers the cache fallback. A captive portal may also return a 200 HTML login page, or a 30x, for every URL. VizTime would then cache that page under `index.html` or `app.js` keys, because `res.ok` is true for a portal's 200, which breaks the offline copy.
  - **Recommendations:**
    - (a) Race the network against a timeout of about 3–4 s for navigations and shell files, serve the cache on timeout, and let the network response still update the cache in the background.
    - (b) Fall back to the cache on `!res.ok` too, at least for navigations and SHELL files, so a 404, 429 or 5xx from GitHub or Fastly shows the working cached app instead of an error page.
    - (c) Only `put` into the cache when `res.type === 'basic'`, the response URL matches the request (`!res.redirected`), and the content-type is the expected one, to avoid caching captive-portal pages.
    - Alternatively use stale-while-revalidate for the shell, with an explicit version check.
- **Fastly 304s are cheap,** so `no-cache` revalidation costs little bandwidth. The cost is latency (a round trip per file per load), not bytes.
- **Navigation preload** would shave the SW boot-up delay from network-first navigations. It is optional, and the code must consume `preloadResponse` correctly.

### Gaps
- No official GitHub documentation of the `max-age=600` policy, of CDN purge-on-deploy behaviour, or of any uptime SLA. The headers above are measured, not documented.
- No authoritative figure for how long a stalled `fetch()` takes to fail in Chrome or Safari; it depends on OS-level TCP timeouts.

## 4. Offline correctness: navigation preload, `ignoreSearch`, start_url with query strings

### Takeaway
VizTime's offline fallbacks are mostly right. `ignoreSearch: true` covers query-string launches, and navigations fall back to `./index.html`. The gaps are the error-response case (only thrown errors fall back) and a theoretical cache-key bloat from query-string URLs being stored as separate entries.

### Cited Findings
- `start_url` may carry a query (Chrome's own example uses `"/?homescreen=1"`), and the default `id` derives from `start_url`, so adding a query to `start_url` later changes the computed id unless `id` is set explicitly — [Chrome manifest id](https://developer.chrome.com/docs/capabilities/pwa-manifest-id); [W3C Manifest](https://www.w3.org/TR/appmanifest/)
- `scope` processing strips the query and fragment — [W3C Manifest](https://www.w3.org/TR/appmanifest/)
- GitHub Pages ignores query strings: `/VizTime/?x=1` returns 200 with the same content and headers (curl, 2026-11-01).
- Navigation preload requests carry `Service-Worker-Navigation-Preload: true`, and the guidance is to add `Vary: Service-Worker-Navigation-Preload`. GitHub Pages cannot set custom headers, but static responses are identical either way, so this does not matter for VizTime — [web.dev navigation preload](https://web.dev/blog/navigation-preload)

### Inferences
- **Query strings in the cache.** `caches.match(req, {ignoreSearch:true})` correctly finds `./` for `./?anything`. On the write path, however, `c.put(req, copy)` stores each distinct query URL as its own entry. That is harmless at VizTime's scale, but each unique query string adds an entry. Normalise the key by stripping `search` for navigations before `put`.
- **Out-of-scope requests.** The fetch handler only checks the origin, not the path. A VizTime page requesting a same-origin URL outside `/VizTime/` (unlikely) would be cached in `viztime-…`. That is harmless, but scope-checking (`url.pathname.startsWith(registration.scope path)`) is tidier.
- **First-run offline gap.** `addAll` with `cache: 'reload'` is atomic: if any SHELL file 404s, the install fails and there is no offline copy. That is good for consistency, but a typo in SHELL breaks offline silently. The tests already guard scripts and fonts; `icons/icon-maskable-512.png` is not in SHELL, which is harmless.
- **iOS cold launch.** iOS home-screen apps are suspended or terminated in the background. A cold launch offline relies entirely on the SW plus the cache, which VizTime provides.

### Gaps
- Did not verify Safari's handling of `ignoreSearch` or `preloadResponse` edge cases on the current iOS version.

## 5. Storage durability: localStorage vs IndexedDB, eviction, `persist()`, quotas, backup

### Takeaway
On every engine, localStorage and IndexedDB live in the same per-origin bucket and are evicted together, so switching to IndexedDB does not improve durability, although it does raise the size limit. The real protections are:
- being an installed, frequently used app, which exempts it from Safari's 7-day ITP wipe and helps Chromium's `persist()` heuristics;
- calling `navigator.storage.persist()`;
- an export/import backup, since user "clear data" and sibling projects can still wipe everything.

### Cited Findings
- **Eviction triggers.**
  - (1) Storage pressure: LRU by origin, skipping persistent origins.
  - (2) The browser's total cap is exceeded (for example Chrome at 80% of disk).
  - (3) Safari only: with tracking prevention on, an origin with no user interaction in the last **seven days of browser use** has its script-created data deleted.
  — [MDN quotas & eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- **Safari's 7-day rule** covers IndexedDB, LocalStorage, media keys, SessionStorage, and Service Worker registrations and cache. Home-screen web apps "are not part of Safari and thus have their own counter of days of use," and deletion of first-party data in such an app would be considered a serious bug — [WebKit: Full Third-Party Cookie Blocking and More (2020)](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)
- **Safari 17+ quotas** (iOS 17, macOS Sonoma):
  - Browser apps: up to 60% of disk per origin and 80% overall.
  - Other (embedded) apps: 15% per origin and 20% overall.
  - Home-screen and Dock web apps get the browser-app quota.
  - Eviction is per origin, LRU, and skips origins with an active page or persistent mode. All origins default to best-effort.
  - `persist()` is granted by heuristics "such as whether the site is opened as a Home Screen Web App".
  - `estimate()` quota is an upper bound, not a guarantee; handle `QuotaExceededError`.
  — [WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/)
- **Chrome/Edge:** about 60% of total disk per origin. Firefox best-effort is min(10% of disk, 10 GiB group). Quotas are computed from total disk size to resist fingerprinting. Before iOS 17, Safari started at 1 GiB and prompted for more. Chrome reports data is very rarely deleted for regularly visited sites even in best-effort mode — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- **localStorage size:** MDN is internally inconsistent; it says "10 MiB … on all browsers" in one place and 5 MiB local + 5 MiB session per origin in another. Writes over the limit throw `QuotaExceededError` — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- **`persist()`:**
  - Firefox prompts the user.
  - Chrome and Edge decide silently by heuristics: site engagement, installed or bookmarked, notification permission. A denial can be retried.
  - Persistent data is "only deleted if the user chooses to remove it using their site settings."
  - There is no programmatic way to un-persist.
  — [web.dev: Persistent storage](https://web.dev/articles/persistent-storage); [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- **EU iOS (17.4+):** alternative browser engines may apply their own storage policies — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

### Inferences
- **iPhone (home-screen):** effectively safe from the 7-day rule because the app has its own use counter, and it gets the large quota. The remaining risks are system storage pressure (LRU; an app not opened for a long time is first in line), the user deleting the home-screen icon, and iOS bugs. The common belief that "removing the icon deletes its data" was not verified this session.
- **Opened in Safari as a tab** (not installed): subject to the 7-day wipe of localStorage, the SW and caches. Don't tell users the Safari tab is equivalent to the home-screen app.
- **Windows Chrome/Edge (installed):** installation helps the `persist()` heuristics. Eviction of a regularly used origin is rare. The main risks are the user clearing browsing data or site data (whole origin), a sibling project's code, or a profile reset.
- **Android:** same Chromium model as desktop. A WebAPK install counts as installed for the heuristics (inference).
- **Recommendation.** Call `navigator.storage.persist()` once, after install or launch in standalone mode, and record the result with `persisted()`. It is cheap, silent on Chromium and Safari, and protects the shared origin against pressure eviction. Note that on Firefox it shows a prompt; Firefox is not a target platform.
- **Recommendation.** Add plain-text export and import (a JSON file, or copying to the clipboard) of all `viztime2:` keys. This is the only mitigation that survives "clear site data", an origin migration, a device change and sibling-project accidents. It is also the migration path if the host changes (Q6).
- **IndexedDB vs localStorage.** There is no durability difference, since both are in the same origin bucket. Data size (presets, notes) is tiny, so localStorage's 5–10 MiB limit is not a concern. Do not migrate for durability reasons.

### Gaps
- No primary source fetched on iOS behaviour when a home-screen web app is deleted (does it delete its separate storage?), or on whether two same-origin home-screen apps share storage.
- No 2025–2026 changes to WebKit's storage policy were found beyond the 2023 post. Recent iOS 26-era changes were not checked.

## 6. Custom domain or alternative hosts (dedicated origin): benefits and migration cost

### Takeaway
A dedicated origin (a custom subdomain such as `viztime.example.com`, or `viztime.pages.dev` / a Workers static-assets site) removes every shared-origin risk in Q1 and lets `id`, `scope` and `start_url` be `/`. It is a **one-way door**, though: the new origin starts with empty storage, no service worker and a new app identity. Every device must re-install, and saved data must be moved by export/import. GitHub custom domains also have a trap: setting a custom domain on the *user* site silently moves every project site to that domain.

### Cited Findings
- A user or organization site's custom domain "will be used for all project sites owned by the same account". For example, a project would be available at `www.octocat.com/octo-project`. A project can override this with its own custom domain — [GitHub: About custom domains and GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)
- GitHub recommends verifying a custom domain to avoid takeover. A Pages site that is disabled while a custom domain still points at it "is at risk of a domain takeover". Using `www` is recommended — [GitHub custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)
- Custom domains get Let's Encrypt certificates after a DNS check. "Enforce HTTPS" is an admin setting. Extra DNS records can block certificate issuance. Domains must be under 64 characters — [GitHub: Securing your Pages site with HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- Identity changes are allowed only "if and only if their particular origin stays the same". A different origin means a new PWA — [Chrome manifest id](https://developer.chrome.com/docs/capabilities/pwa-manifest-id)
- Storage is per origin — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- Cloudflare Workers Static Assets: "Requests to static assets are free and unlimited". 429s on free-plan overage apply only to requests that invoke the Worker script (`run_worker_first`) — [Cloudflare: Static assets billing and limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations)
- Third-party write-ups say Cloudflare now steers new projects to Workers Static Assets over Pages. Pages free tier: 500 builds/month, 20,000 files, 25 MiB per asset — [morphllm comparison](https://www.morphllm.com/comparisons/cloudflare-pages-vs-workers); [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits) (the limits figures are from search snippets; the Pages limits page itself was not fetched).

### Inferences
- **Benefits of a dedicated origin:**
  - isolated storage, quota and eviction;
  - no sibling-SW or `clear()` risk;
  - its own notification permission;
  - root-scoped `id`, `scope` and `start_url`;
  - control over headers on Cloudflare or Netlify (for example `Cache-Control: no-cache` on `sw.js` and HTML, `Service-Worker-Allowed`, CSP);
  - `*.pages.dev` and `*.netlify.app` are also on the PSL, so each project subdomain is its own site (inference; PSL membership not verified this session).
- **Migration cost:**
  - (1) localStorage cannot be read cross-origin. Data must be exported from the old origin and imported on the new one. Build export/import *first*, ship it on the old origin, then migrate.
  - (2) Every installed app (iPhone home screen, Windows Chrome/Edge, any Android) must be removed and re-added from the new URL.
  - (3) The old site should remain up for a while, showing a "VizTime has moved" page with an export button. A server-side 301 is not possible on GitHub Pages; only a meta-refresh or JS redirect, and an installed old PWA running offline would never see it.
  - (4) The old service worker keeps serving the cached old app offline until the user removes the install.
- **Cheapest isolation that stays on GitHub:** give *this repo* its own custom subdomain (`viztime.example.com`). That needs a domain (paid) and DNS, and carries the same migration cost. Never set a custom domain on the user site without realising that it moves VizTime's URL, and therefore its origin, too.
- For a single-owner, low-traffic personal app, the shared-origin risks are all self-inflicted, since only this account's repos run there. Staying on github.io with strict conventions plus export/import is defensible. Migrating is mainly worth it before more devices or users depend on the current URL. Judgment call.

### Gaps
- Netlify's 2025 move to credit-based free plans and its current limits were not fetched.
- Did not confirm whether `pages.dev`, `workers.dev` and `netlify.app` are on the current PSL.

## 7. GitHub Pages terms and limits relevant to VizTime (2025–2026)

### Takeaway
VizTime is well inside every limit: a tiny static site, low traffic, non-commercial. HTTPS is automatic and HSTS is sent. GitHub publishes no uptime SLA for Pages, and the only documented failure modes are soft limits and 429 rate limiting, which VizTime's fetch handler currently passes through to the page instead of falling back to the cache.

### Cited Findings
- **Limits:**
  - Published site ≤ 1 GB; source repo recommended ≤ 1 GB.
  - Deploys time out after 10 minutes.
  - **Soft** bandwidth limit of 100 GB/month.
  - **Soft** limit of 10 builds/hour, which doesn't apply to custom Actions workflows.
  - Rate-limited requests get **HTTP 429**.
  - If over quota, GitHub may stop serving the site or email the owner.
  — [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- **Prohibited uses:** primarily commercial transaction sites or commercial SaaS, and sensitive transactions (passwords, credit cards). One user or organization site per account — [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- **HTTPS:** github.io sites created after June 15, 2016 are HTTPS by default — [GitHub HTTPS docs](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- **Live HSTS and redirects:** the live site sends `Strict-Transport-Security: max-age=31556952` and 301-redirects HTTP to HTTPS (curl, 2026-11-01).
- **No SLA:** the limits page does not cover uptime, SLA or caching — [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- **Auto-unpublishing:** Pages sites can be unpublished automatically when downgrading from Pro to Free (private-repo sites), or when a private repo is transferred to a Free account — [GitHub custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)

### Inferences
- **Keep the repo public** (or stay on a plan that publishes private-repo Pages). Making it private on a Free plan would unpublish the site. Installed apps would keep working offline from the cache, but never update, and the first online fetch returning 404 would get a 404 page (see the `!res.ok` issue in Q3).
- **Clinic use is not commercial use.** VizTime is a personal tool, not a commercial transaction site or SaaS, so it is within the terms as described. This is an interpretation, not legal advice.
- The account-wide "one user site" rule means that if the owner ever creates `username.github.io` as a user site, Q1's root-scope and Q6's custom-domain warnings apply.

### Gaps
- No 2025–2026 GitHub changelog entries about Pages limits, headers or CDN changes were found or fetched in this session. Searching github.blog/changelog for "Pages" would close this.
- No published GitHub Pages uptime history or SLA was found (githubstatus.com was not checked).

## Summary of concrete recommendations (from the inferences above)
1. **Add `"id": "/VizTime/"`** to the manifest. It matches today's computed id; verify "Computed App Id" in DevTools before and after. Don't rename the repo or move the manifest.
2. **Add a network timeout** (about 3–4 s) to navigations and shell fetches, falling back to the cache, with the late network response still updating the cache.
3. **Fall back to the cache on non-ok responses** (404, 429, 5xx) for navigations and SHELL files. Avoid caching redirected or captive-portal responses (check `res.redirected`, `res.type`, content-type).
4. **Call `navigator.storage.persist()`** when running standalone, and keep the existing `try/catch` around writes.
5. **Add export/import of `viztime2:` data.** It is the only defence against "clear site data", sibling-project mistakes and device changes, and the prerequisite for any future origin move.
6. **Keep the account free of a root-scope SW and of a user-site custom domain**, or make any such worker skip `/VizTime/`. Make any sibling PWA follow the same prefix rules for caches and storage.
7. **Optional:** add navigation preload; call `registration.update()` on `visibilitychange` for the long-running floating window; strip the query string from cache keys on `put`.
8. If isolation becomes important, migrate to a dedicated origin (its own custom subdomain, or Cloudflare Workers static assets) **only after** export/import ships, and plan for every device to re-install.
