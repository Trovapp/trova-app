# trova-app

인스타/유튜브 여행 영상 링크를 공유하면 AI가 장소 정보를 추출해 지도에
정리해주는 Trova 서비스의 모바일 앱(Expo/React Native, phase 1)입니다.
백엔드([trova-backend](https://github.com/taehyeooo/trova-backend))와 통신합니다.

## 시작하기

```bash
npm install
cp .env.example .env
```

`.env`에 아래 값을 채워주세요.

- `EXPO_PUBLIC_API_BASE_URL` — 백엔드 API 주소
- `EXPO_PUBLIC_KAKAO_MAP_JS_KEY` — 카카오맵 JS 키 (아래 참고)

### EXPO_PUBLIC_API_BASE_URL 값은 실행 대상에 따라 다릅니다

- iOS 시뮬레이터: `http://localhost:8080`
- Android 에뮬레이터: `http://10.0.2.2:8080` (에뮬레이터에서 `localhost`는 에뮬레이터 자신을 가리킴)
- 실제 기기: 개발 머신의 LAN IP (예: `http://192.168.0.10:8080`)

### 카카오맵 JS 키

같은 키를 [trova-frontend](https://github.com/taehyeooo/trova-frontend) 웹 레포에서도
`NEXT_PUBLIC_KAKAO_MAP_JS_KEY`로 사용하고 있습니다. 카카오 디벨로퍼스 콘솔에서 발급받은
JS 키를 그대로 재사용하면 됩니다.

## 중요: OAuth 로그인은 Expo Go에서 동작하지 않습니다

이 앱은 커스텀 URL 스킴(`trova://`)으로 OAuth 로그인 콜백을 받습니다. Expo Go는
커스텀 URL 스킴을 지원하지 않으므로 `npx expo start`로 Expo Go에서 실행하면
로그인이 동작하지 않습니다.

로그인을 테스트하려면 개발 빌드를 사용하세요.

```bash
npx expo run:ios
# 또는
npx expo run:android
# 또는 EAS 개발 빌드
eas build --profile development
```

## 실행

```bash
npx expo start
```
