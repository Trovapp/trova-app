// 웹(PWA) 빌드에서만 웹을 지원하지 않는 네이티브 라이브러리를 웹용 파일로 바꿔 끼운다(ADR 0013).
// 앱(iOS·안드로이드) 빌드는 그대로다.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const WEB_REPLACEMENTS = {
  "@react-native-community/datetimepicker": path.resolve(__dirname, "src/lib/web/DateTimePicker.tsx"),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && WEB_REPLACEMENTS[moduleName]) {
    return { type: "sourceFile", filePath: WEB_REPLACEMENTS[moduleName] };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
