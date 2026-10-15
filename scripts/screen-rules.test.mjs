import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldOpenResult } from "../src/lib/processingRules.ts";
import { visibleDrafts } from "../src/lib/draftCards.ts";

const done = { isSuccess: true, isFetchedAfterMount: true, hasJob: false, retrying: false, focused: true };

test("분석이 끝나고 지금 보이는 화면이면 결과로 넘어간다", () => {
  assert.equal(shouldOpenResult(done), true);
});

test("알림·공유로 다른 화면이 위에 있으면 결과로 넘어가지 않는다", () => {
  assert.equal(shouldOpenResult({ ...done, focused: false }), false);
});

test("아직 작업이 남아 있거나 다시 시도 중이면 넘어가지 않는다", () => {
  assert.equal(shouldOpenResult({ ...done, hasJob: true }), false);
  assert.equal(shouldOpenResult({ ...done, retrying: true }), false);
  assert.equal(shouldOpenResult({ ...done, isFetchedAfterMount: false }), false);
});

const d = (draftId, status) => ({ draftId, status });

test("초안이 2개 이하면 모두 보여준다", () => {
  assert.deepEqual(visibleDrafts([d(1, "READY"), d(2, "PENDING")], false), { shown: [d(1, "READY"), d(2, "PENDING")], hiddenCount: 0 });
});

test("초안이 많으면 준비된 것부터 2개만 보이고 나머지 수를 알려 준다", () => {
  const drafts = [d(1, "PENDING"), d(2, "READY"), d(3, "PROCESSING"), d(4, "READY"), d(5, "READY")];
  assert.deepEqual(visibleDrafts(drafts, false), { shown: [d(2, "READY"), d(4, "READY")], hiddenCount: 3 });
});

test("펼치면 전부 보여준다(준비된 것 먼저)", () => {
  const drafts = [d(1, "PENDING"), d(2, "READY"), d(3, "READY")];
  assert.deepEqual(visibleDrafts(drafts, true), { shown: [d(2, "READY"), d(3, "READY"), d(1, "PENDING")], hiddenCount: 0 });
});
