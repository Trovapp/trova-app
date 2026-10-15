import { test } from "node:test";
import assert from "node:assert/strict";
import { bundleProblems } from "./update-bundle-check.mjs";

const PROD = 'fetch("https://193-123-161-217.sslip.io/api/places")';
const LOCAL = 'fetch("http://localhost:8080/api/places")';

test("운영 채널 번들에 운영 주소만 있으면 통과", () => {
  assert.deepEqual(bundleProblems(PROD, "production"), []);
});

test("운영 채널 번들에 localhost가 섞이면 막는다", () => {
  assert.equal(bundleProblems(PROD + LOCAL, "production").length, 1);
});

test("운영 채널 번들에 운영 주소가 없으면 막는다", () => {
  assert.equal(bundleProblems(LOCAL, "production").length, 2);
});

test("preview 채널은 로컬 주소가 있어야 한다", () => {
  assert.deepEqual(bundleProblems(LOCAL, "preview"), []);
  assert.equal(bundleProblems(PROD, "preview").length, 1);
});

test("모르는 채널은 막는다", () => {
  assert.equal(bundleProblems(PROD, "staging").length, 1);
});

test("카카오 지도 웹뷰 기준 주소(https://localhost)는 서버 주소가 아니라 통과", () => {
  assert.deepEqual(bundleProblems(PROD + 'baseUrl:"https://localhost"', "production"), []);
});
