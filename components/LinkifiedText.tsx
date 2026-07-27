import { Fragment } from "react";
import { openExternalLink } from "@/lib/openExternalLink";

// 짐/가방 메모 같은 일반 텍스트(TipTap이 아닌 plain <span>) 안에서 http(s):// URL을
// 찾아 클릭 가능한 링크로 바꿔준다. MentionText.tsx(@멘션 볼드 처리)와 동일한
// split(캡처그룹 정규식) 패턴을 재사용한다.
const URL_REGEX = /(https?:\/\/\S+)/g;

export default function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(URL_REGEX);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            onClick={(e) => {
              // 부모(짐 행 전체를 감싸는 div/button)의 탭 처리(수정 모드 진입, 다중선택
              // 등)로 이벤트가 번지지 않게 막고, 여기서 직접 링크를 연다.
              e.preventDefault();
              e.stopPropagation();
              openExternalLink(part);
            }}
            className="underline"
            style={{ color: "var(--accent)" }}
          >
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}
