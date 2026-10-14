import { test } from "node:test";
import assert from "node:assert/strict";
import { SNOOZE_MS, base64UrlToBytes, parseOpenTarget, shouldShowPushPrompt } from "../src/lib/pushLogic.ts";

test("알림 이동 값을 화면 대상으로 바꾼다", () => {
  assert.deepEqual(parseOpenTarget("draft:12"), { kind: "draft", draftId: 12 });
  assert.deepEqual(parseOpenTarget("trip:45:place:678"), { kind: "trip", tripId: 45, tripPlaceId: 678 });
  assert.deepEqual(parseOpenTarget("trip:45"), { kind: "trip", tripId: 45 });
  assert.equal(parseOpenTarget("draft:abc"), null);
  assert.equal(parseOpenTarget("javascript:alert(1)"), null);
  assert.equal(parseOpenTarget(null), null);
});

const base = {
  standalone: true, supported: true, permission: "default", hasPublicKey: true,
  loggedIn: true, subscribed: false, optedOut: false, snoozedUntil: null, now: 1_000,
};

test("설치한 앱에서 아직 묻지 않았을 때만 카드를 보인다", () => {
  assert.equal(shouldShowPushPrompt(base), true);
  assert.equal(shouldShowPushPrompt({ ...base, standalone: false }), false);
  assert.equal(shouldShowPushPrompt({ ...base, supported: false }), false);
  assert.equal(shouldShowPushPrompt({ ...base, permission: "denied" }), false);
  assert.equal(shouldShowPushPrompt({ ...base, hasPublicKey: false }), false);
  assert.equal(shouldShowPushPrompt({ ...base, loggedIn: false }), false);
});

test("허용했지만 구독이 없으면(서버에 못 보냄) 다시 보인다, 구독돼 있으면 숨긴다", () => {
  assert.equal(shouldShowPushPrompt({ ...base, permission: "granted", subscribed: false }), true);
  assert.equal(shouldShowPushPrompt({ ...base, permission: "granted", subscribed: true }), false);
});

test("나중에를 누르면 7일 동안 숨긴다", () => {
  assert.equal(shouldShowPushPrompt({ ...base, snoozedUntil: base.now + SNOOZE_MS }), false);
  assert.equal(shouldShowPushPrompt({ ...base, snoozedUntil: base.now - 1 }), true);
});

test("서버 공개 키(base64url)를 바이트로 바꾼다", () => {
  assert.deepEqual([...base64UrlToBytes("AQID_-8")], [1, 2, 3, 255, 239]);
});

test("마이페이지에서 알림을 끈 사람에게는 카드를 다시 보이지 않는다", () => {
  assert.equal(shouldShowPushPrompt({ ...base, permission: "granted", subscribed: false, optedOut: true }), false);
  assert.equal(shouldShowPushPrompt({ ...base, optedOut: true }), false);
  assert.equal(shouldShowPushPrompt({ ...base, optedOut: false }), true);
});

test("서버 공개 키가 바뀌었는지 바이트로 비교한다", async () => {
  const { sameKey } = await import("../src/lib/pushLogic.ts");
  const a = new Uint8Array([4, 1, 2, 3]);
  assert.equal(sameKey(a.buffer, new Uint8Array([4, 1, 2, 3])), true);
  assert.equal(sameKey(a.buffer, new Uint8Array([4, 1, 2, 9])), false);
  assert.equal(sameKey(null, a), false);
});

test("주소에서 open만 지우고 다른 값은 남긴다", async () => {
  const { withoutOpenParam } = await import("../src/lib/pushLogic.ts");
  assert.equal(withoutOpenParam("?open=draft:1&utm=x"), "/?utm=x");
  assert.equal(withoutOpenParam("?open=draft:1"), "/");
});
