// 응답 상태 코드를 들고 다니는 API 오류 — 재시도 여부(4xx는 다시 해도 같음)를 상태로 판단하려면
// 메시지 문자열이 아니라 값으로 있어야 한다. 메시지는 개발자용이라 화면엔 toUserMessage로 바꿔 보여준다.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// 화면에 띄울 오류 문구. API 오류("GET ... failed: 500")나 네트워크 오류("Network request failed")처럼
// 개발자용 메시지는 사용자 문구로 바꾸고, createShare처럼 처음부터 사용자용으로 던진 메시지만 그대로 쓴다.
export function toUserMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return fallback;
  if (err instanceof TypeError && /network request failed/i.test(err.message)) {
    return "인터넷 연결을 확인하고 다시 시도해주세요.";
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

// 조회 재시도 기준: 4xx(로그인 만료·없는 데이터 등)는 다시 해도 같으니 바로 실패, 네트워크/5xx만 1번 재시도.
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}
