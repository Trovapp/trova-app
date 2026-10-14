// 안드로이드 입력칸 아래 검은 밑줄 없애기(ADR 0017 에뮬레이터 QA, 2026-10-14).
// Expo 기본 테마가 입력칸 배경으로 rn_edit_text_material(밑줄 그림)을 깔아, underlineColorAndroid를 줘도
// 둥근 테두리 안쪽에 줄이 남았다. 테마의 입력칸 배경을 투명으로 바꿔 모든 입력칸에서 한 번에 없앤다.
const { withAndroidStyles, AndroidConfig } = require("expo/config-plugins");

module.exports = function withNoEditTextUnderline(config) {
  return withAndroidStyles(config, (cfg) => {
    cfg.modResults = AndroidConfig.Styles.assignStylesValue(cfg.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: "android:editTextBackground",
      value: "@android:color/transparent",
    });
    return cfg;
  });
};
