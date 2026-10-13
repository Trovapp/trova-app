// 바텀시트 안의 입력창. 앱은 키보드가 뜰 때 시트를 올려 주는 BottomSheetTextInput을 쓰고,
// 웹은 SheetTextInput.web.tsx(일반 TextInput)를 쓴다 — 웹에서 BottomSheetTextInput은 blur 때 오류가 나 저장이 멈췄다(2026-10-13 PWA QA).
export { BottomSheetTextInput as SheetTextInput } from "@gorhom/bottom-sheet";
