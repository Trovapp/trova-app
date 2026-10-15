// 앱 호환 값(fingerprint, ADR 0018)에서 package.json scripts를 뺀다. 기본값은 scripts를 넣어서, 테스트 하나를
// 추가해도 값이 바뀌어 설치된 앱이 무선 업데이트를 못 받았다(#35, 2026-10-15 확인). scripts는 앱 안 코드가 아니다.
/** @type {import('expo/fingerprint').Config} */
const { SourceSkips } = require("expo/fingerprint");

module.exports = {
  sourceSkips: SourceSkips.PackageJsonAndroidAndIosScriptsIfNotContainRun | SourceSkips.PackageJsonScriptsAll,
};
