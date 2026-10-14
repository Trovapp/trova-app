import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, isNotFound } from "../src/lib/api/errors.ts";

test("404만 '찾을 수 없음'으로 본다 — 네트워크·서버 오류와 구분", () => {
  assert.equal(isNotFound(new ApiError(404, "GET /api/trips/0 failed: 404")), true);
  assert.equal(isNotFound(new ApiError(500, "x")), false);
  assert.equal(isNotFound(new TypeError("Network request failed")), false);
  assert.equal(isNotFound(null), false);
});
