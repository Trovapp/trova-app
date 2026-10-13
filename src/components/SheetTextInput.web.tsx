// 웹(PWA)용 바텀시트 입력창. @gorhom/bottom-sheet의 BottomSheetTextInput은 blur 때 웹에 없는
// TextInput.State.currentlyFocusedInput()을 불러 오류가 나고, 그 뒤의 onBlur(메모 저장)가 실행되지 않았다(2026-10-13 PWA QA,
// 운영에서 메모 저장 요청 0건). 웹은 키보드에 맞춰 시트를 올릴 일이 없으므로 일반 TextInput을 쓴다.
export { TextInput as SheetTextInput } from "react-native";
