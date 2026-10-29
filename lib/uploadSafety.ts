// 첨부로 올리면 안 되는 파일(2026-10-22, _secrets/docs/packinbag_security_review.md SEC-WEB-05).
// HTML · SVG · XML은 내려받기 주소를 열면 브라우저가 웹 페이지로 그려 스크립트가 돈다 → 피싱 페이지를 올려 두는 데 쓰일 수 있다.
// storage.rules `isBlockedType`과 같은 기준. 형식(type)이 비어도 확장자로 거른다
const BLOCKED_TYPE = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/xml|application\/xml)\b/i;
const BLOCKED_EXT = /\.(html?|xhtml|xht|svgz?|xml|mht|mhtml)$/i;

export const BLOCKED_UPLOAD_MESSAGE = "HTML · SVG 같은 웹 페이지 파일은 첨부할 수 없어요";

export function isBlockedUploadFile(file: { name: string; type: string }): boolean {
  return BLOCKED_TYPE.test(file.type.trim()) || BLOCKED_EXT.test(file.name.trim());
}
