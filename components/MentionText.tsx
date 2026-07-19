import { Fragment } from "react";

// 댓글 텍스트 안에서 "@아이디"(공백 전까지) 부분만 골라서 볼드로 렌더링한다.
// 실제로 그 닉네임이 가방 멤버인지는 검사하지 않고(=일반 정규식 매칭), "@"로
// 시작해서 공백 전까지를 통째로 멘션으로 본다 - BagChatPreview(가방 속 상단 미리보기)와
// ItemThreadSheet(댓글 클릭해서 연 스레드) 양쪽에서 공통으로 쓴다.
const MENTION_REGEX = /(@\S+)/g;

export default function MentionText({ text }: { text: string }) {
  const parts = text.split(MENTION_REGEX);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Fragment key={i}>
            <span className="font-semibold">{part}</span>
          </Fragment>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}
