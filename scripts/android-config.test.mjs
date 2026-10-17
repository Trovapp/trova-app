import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { addConfigChanges, applyDensityConfigChange } = require("../plugins/withDensityConfigChange.js");

const expoDefault = "keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode";

test("화면 밀도가 바뀌어도 앱을 다시 만들지 않게 density를 더한다", () => {
  assert.equal(addConfigChanges(expoDefault, ["density"]), `${expoDefault}|density`);
});

test("이미 있는 값은 두 번 넣지 않는다(빌드를 여러 번 해도 같다)", () => {
  const once = addConfigChanges(expoDefault, ["density"]);
  assert.equal(addConfigChanges(once, ["density"]), once);
});

test("값이 비어 있으면 더할 것만 남긴다", () => {
  assert.equal(addConfigChanges(undefined, ["density"]), "density");
});

function manifestWith(activities) {
  return { manifest: { application: [{ activity: activities }] } };
}

test("MainActivity에만 더하고 다른 화면(액티비티)은 건드리지 않는다", () => {
  const manifest = manifestWith([
    { $: { "android:name": ".MainActivity", "android:configChanges": expoDefault } },
    { $: { "android:name": "com.other.Activity", "android:configChanges": "orientation" } },
  ]);
  applyDensityConfigChange(manifest);
  const [main, other] = manifest.manifest.application[0].activity;
  assert.equal(main.$["android:configChanges"], `${expoDefault}|density`);
  assert.equal(other.$["android:configChanges"], "orientation");
});

test("MainActivity가 없으면 빌드를 멈춰 모르고 지나가지 않게 한다", () => {
  assert.throws(() => applyDensityConfigChange(manifestWith([])), /MainActivity/);
});
