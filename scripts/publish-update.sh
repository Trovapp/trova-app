#!/usr/bin/env bash
# 안드로이드 앱 무선 업데이트 올리기(#33). 사용: scripts/publish-update.sh <preview|production> "<메시지>"
# 1) 그 채널의 EAS 환경 변수로 번들을 만들고  2) 번들 안 서버 주소를 검사한 뒤  3) 검사한 그 번들을 그대로 올린다.
# EAS_BUILD_PROFILE을 채널과 같게 두어 app.config.ts 결과(=fingerprint)가 그 채널 빌드와 같아지게 한다.
set -euo pipefail
cd "$(dirname "$0")/.."

channel="${1:-}"
message="${2:-}"
if [[ "$channel" != "preview" && "$channel" != "production" ]] || [[ -z "$message" ]]; then
  echo "사용: scripts/publish-update.sh <preview|production> \"<메시지>\"" >&2
  exit 2
fi

out=dist-update
rm -rf "$out"
export EAS_BUILD_PROFILE="$channel"
npx -y eas-cli@latest env:exec "$channel" "npx expo export --platform android --output-dir $out --clear" --non-interactive
node scripts/update-bundle-check.mjs "$channel" "$out"
npx -y eas-cli@latest update --channel "$channel" --environment "$channel" --platform android \
  --message "$message" --skip-bundler --input-dir "$out" --non-interactive
