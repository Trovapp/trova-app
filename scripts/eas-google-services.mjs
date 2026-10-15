// EAS 빌드 서버에서 설치 전에 실행(package.json eas-build-pre-install). 파일 변수 GOOGLE_SERVICES_JSON(경로)을
// app.config.ts가 보는 ./google-services.json으로 복사한다 — 설정 경로를 고정해야 fingerprint가 로컬과 같다(#33).
import { copyFileSync, existsSync } from "node:fs";

const src = process.env.GOOGLE_SERVICES_JSON;
if (src && existsSync(src)) {
  copyFileSync(src, "google-services.json");
  console.log("google-services.json 복사함");
} else {
  console.log("GOOGLE_SERVICES_JSON 없음 — 복사 안 함");
}
