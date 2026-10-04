// 응답 상태 코드를 들고 다니는 API 오류 — 재시도 여부(4xx는 다시 해도 같음)를 상태로 판단하려면
// 메시지 문자열이 아니라 값으로 있어야 한다. 메시지는 개발자용이라 화면엔 toUserMessage로 바꿔 보여준다.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    // 서버가 사용자에게 보여주라고 보낸 안내(하루 한도 초과 429, 처리 대기열 포화 503 등). 있으면 그대로 보여준다.
    readonly userMessage?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// 무료·여행 패스 한도를 다 썼을 때(서버 402, code PLAN_LIMIT, 백엔드 #130). onPass가 false면 무료 사용자라 구매 화면으로 안내한다.
export class PlanLimitError extends ApiError {
  constructor(
    message: string,
    userMessage: string | undefined,
    readonly feature: "ANALYSIS" | "DRAFT" | "ASSIST",
    readonly onPass: boolean,
  ) {
    super(402, message, userMessage);
    this.name = "PlanLimitError";
  }
}

// 요청이 시간 제한 안에 끝나지 않았을 때(서버 과부하·연결이 사라진 경우). 예전엔 시간 제한이 없어
// 서버가 응답을 안 주면 "불러오는 중..."에서 5분 넘게 멈춰 있었다(실측).
export class RequestTimeoutError extends Error {
  constructor(path: string, timeoutMs: number) {
    super(`${path} timed out after ${timeoutMs}ms`);
    this.name = "RequestTimeoutError";
  }
}

// 화면에 띄울 오류 문구. API 오류("GET ... failed: 500")나 네트워크 오류("Network request failed")처럼
// 개발자용 메시지는 사용자 문구로 바꾸고, createShare처럼 처음부터 사용자용으로 던진 메시지만 그대로 쓴다.
export function toUserMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.userMessage ?? fallback;
  if (err instanceof RequestTimeoutError) return "응답이 늦어지고 있어요. 잠시 후 다시 시도해주세요.";
  if (err instanceof TypeError && /network request failed/i.test(err.message)) {
    return "인터넷 연결을 확인하고 다시 시도해주세요.";
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

// 조회 재시도 기준: 4xx(로그인 만료·없는 데이터 등)는 다시 해도 같으니 바로 실패, 네트워크/5xx만 1번 재시도.
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  // 시간 초과를 다시 시도하면 같은 시간을 한 번 더 기다리게 된다 — 바로 오류 화면(다시 시도 버튼)을 보여준다.
  if (error instanceof RequestTimeoutError) return false;
  return failureCount < 1;
}
