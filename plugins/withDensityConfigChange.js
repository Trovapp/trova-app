// 화면 밀도(density)가 바뀌어도 앱 화면(MainActivity)을 새로 만들지 않기(#39, 폴드 에뮬레이터 QA 2026-10-17).
// Expo 기본 configChanges에는 density가 없어, 밀도가 바뀌면 안드로이드가 화면을 새로 만들고 앱이 홈부터 다시 뜬다
// (보던 여행·일정 화면이 사라짐). 폴드폰은 접고 펼 때 바깥·안쪽 화면 밀도가 다를 수 있고, 일반 폰도 설정의
// '화면 크기'를 바꾸면 같다. density를 더하면 React Native가 화면 크기 바뀔 때처럼 그 자리에서 다시 그린다.
const { withAndroidManifest } = require("expo/config-plugins");

function addConfigChanges(value, extra) {
  const items = (value ?? "").split("|").filter(Boolean);
  for (const item of extra) {
    if (!items.includes(item)) items.push(item);
  }
  return items.join("|");
}

function applyDensityConfigChange(manifest) {
  const activities = manifest.manifest.application?.[0]?.activity ?? [];
  const main = activities.find((a) => a.$["android:name"] === ".MainActivity");
  if (!main) throw new Error("withDensityConfigChange: MainActivity를 찾지 못했습니다");
  main.$["android:configChanges"] = addConfigChanges(main.$["android:configChanges"], ["density"]);
  return manifest;
}

module.exports = function withDensityConfigChange(config) {
  return withAndroidManifest(config, (cfg) => {
    applyDensityConfigChange(cfg.modResults);
    return cfg;
  });
};
module.exports.addConfigChanges = addConfigChanges;
module.exports.applyDensityConfigChange = applyDensityConfigChange;
