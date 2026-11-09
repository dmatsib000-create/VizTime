// Names the page and the phone shells must agree on, though they live in
// different files and languages: run with `node --test`. Nothing else checks
// them, and a mismatch fails silently on a phone (a plugin that answers
// nothing, a link that opens nothing, a reminder without its tone).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const nativeJs = read('js/native.js');

test('the floating plugin has one name in Java and in the page', () => {
  const name = /@CapacitorPlugin\(name = "(\w+)"\)/.exec(read('native/android/app/src/main/java/io/github/dmatsib000create/timefall/FloatingPlugin.java'))[1];
  assert.match(read('native/android/app/src/main/java/io/github/dmatsib000create/timefall/MainActivity.java'), /registerPlugin\(FloatingPlugin\.class\)/);
  const used = new Set([...nativeJs.matchAll(/(?:call|listen|has)\('(\w+)'/g)].map(m => m[1]).filter(n => /^Float/.test(n)));
  assert.deepEqual([...used], [name]);
});

test('the link scheme is the same in both shells and the page', () => {
  const android = /<string name="custom_url_scheme">(\w+)<\/string>/.exec(read('native/android/app/src/main/res/values/strings.xml'))[1];
  const ios = /<key>CFBundleURLSchemes<\/key>\s*<array>\s*<string>(\w+)<\/string>/.exec(read('native/ios/App/App/Info.plist'))[1];
  assert.equal(ios, android);
  assert.match(read('js/menu.js'), new RegExp(`\`${android}://import\\?code=`));
  assert.match(nativeJs, new RegExp(`\\^${android}:\\\\/\\\\/import`));
});

test('every tone a reminder names is shipped on each phone', () => {
  const sounds = JSON.parse(/const SOUND = (\{[^}]+\})/.exec(nativeJs)[1].replace(/(\w+):/g, '"$1":').replace(/'/g, '"'));
  for (const [kind, name] of Object.entries(sounds)) {
    assert.ok(existsSync(new URL(`native/android/app/src/main/res/raw/${name}.wav`, root)), `Android lacks ${name}.wav`);
    // iPhone plays only the three tones; a quiet reminder there has no sound at all.
    if (kind !== 'silent') assert.ok(existsSync(new URL(`native/assets/sounds/${name}.wav`, root)), `iPhone lacks ${name}.wav`);
  }
});

test('the app id is the same everywhere it is written', () => {
  const id = JSON.parse(read('native/capacitor.config.json')).appId;
  assert.match(read('native/android/app/build.gradle'), new RegExp(`applicationId "${id.replace(/\./g, '\\.')}"`));
  assert.match(read('native/android/app/src/main/res/values/strings.xml'), new RegExp(`<string name="package_name">${id.replace(/\./g, '\\.')}</string>`));
  for (const line of read('native/ios/App/App.xcodeproj/project.pbxproj').match(/PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g)) assert.equal(line, `PRODUCT_BUNDLE_IDENTIFIER = ${id};`);
  assert.match(read('native/scripts/testflight.mjs'), new RegExp(`const BUNDLE_ID = '${id.replace(/\./g, '\\.')}';`));
});

test('the Android release tag the workflow makes is the one the app looks for', () => {
  const made = /TAG="([\w-]+)\$TIMEFALL_VERSION"/.exec(read('.github/workflows/android.yml'))[1];
  assert.match(nativeJs, new RegExp(`\\^${made}\\(`));
});
