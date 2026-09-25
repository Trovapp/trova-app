import { Component, type ErrorInfo, type ReactNode } from "react";
import { View } from "react-native";
import { QueryErrorView } from "@/components/QueryErrorView";
import { colors } from "@/lib/theme";

// 화면을 그리다 예상 못 한 오류(서버가 예상과 다른 모양의 데이터를 보낸 경우 등)가 나면
// 배포 앱은 흰 화면/강제 종료가 된다 — 앱 최상단에서 잡아 "다시 시도" 화면으로 바꾼다.
// 다시 시도는 아래 트리(내비게이션 포함)를 처음부터 다시 그린다.
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 아직 원격 오류 수집 도구가 없어서 개발 중 확인용으로만 남긴다.
    if (__DEV__) console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <QueryErrorView
            fullScreen
            message={"문제가 생겨서 화면을 보여드리지 못했어요.\n다시 시도해주세요."}
            onRetry={() => this.setState({ error: null })}
          />
        </View>
      );
    }
    return this.props.children;
  }
}
