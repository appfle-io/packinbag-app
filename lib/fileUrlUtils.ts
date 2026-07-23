// Firebase Storage 다운로드 URL은 원본 파일명(+확장자)이 "?" 쿼리스트링 바로 앞에 그대로
// 남아있어서(lib/storageService.ts 참고), 그걸로 PDF와 이미지를 구분할 수 있다.
// 가방 이미지(BagEditorScreen)와 메모팩 첨부파일(PackNoteEditorScreen) 둘 다에서 재사용한다.
export function isPdfUrl(url: string): boolean {
  return url.split("?")[0].toLowerCase().endsWith(".pdf");
}
