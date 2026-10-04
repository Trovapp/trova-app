#!/bin/zsh
# Xcode StoreKit 테스트(실제 결제 없이 시뮬레이터에서 여행 패스 구매를 시험) 설정을 생성된 ios/ 프로젝트에 붙인다.
# ios/는 expo prebuild로 만드는 생성물이라(git 제외) prebuild 뒤마다 다시 실행한다.
# 주의: StoreKit 설정은 Xcode에서 실행(Run)할 때만 적용된다 — expo run:ios로 설치만 하면 상품이 안 보인다.
set -e
cd "$(dirname "$0")/.."
cp storekit/TrovaStoreKit.storekit ios/TrovaStoreKit.storekit
scheme=$(ls ios/*.xcodeproj/xcshareddata/xcschemes/*.xcscheme | grep -v ShareExtension | head -1)
if grep -q StoreKitConfigurationFileReference "$scheme"; then
  echo "이미 연결됨: $scheme"; exit 0
fi
python3 - "$scheme" <<'PY'
import sys,re
p=sys.argv[1]; s=open(p).read()
m=re.search(r'(<LaunchAction[^>]*>)',s,re.S)
s=s[:m.end()]+'\n      <StoreKitConfigurationFileReference\n         identifier = "../TrovaStoreKit.storekit">\n      </StoreKitConfigurationFileReference>'+s[m.end():]
open(p,'w').write(s)
PY
echo "연결함: $scheme"
