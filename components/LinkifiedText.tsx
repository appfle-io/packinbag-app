"use client";

import { Fragment, useState } from "react";
import type { User } from "firebase/auth";
import { openExternalLink } from "@/lib/openExternalLink";
import { createShortLink, isAlreadyShortLink } from "@/lib/shortLinkService";
import LinkActionMenu from "@/components/LinkActionMenu";
import CustomUrlModal from "@/components/CustomUrlModal";

// 짐/가방 메모 같은 일반 텍스트(TipTap이 아닌 plain <span>) 안에서 http(s):// URL을
// 찾아 클릭 가능한 링크로 바꿔준다. MentionText.tsx(@멘션 볼드 처리)와 동일한
// split(캡처그룹 정규식) 패턴을 재사용한다.
const URL_REGEX = /(https?:\/\/\S+)/g;

export default function LinkifiedText({
  text,
  user,
  shortenEnabled,
  onReplace,
}: {
  text: string;
  // 로그인 사용자 - "짧은/커스텀 URL로 변경"을 실제로 실행하려면 필요하다.
  user: User | null;
  // isShortUrlFeatureEnabled(email, profile)로 미리 계산해서 넘겨준다(프리미엄 + 설정
  // 토글이 둘 다 켜져 있어야 true) - false면 링크를 눌러도 선택 메뉴 없이 바로 열린다.
  shortenEnabled: boolean;
  // 원본 URL을 짧은/커스텀 URL로 교체할 때 부모(짐 텍스트/가방 메모)의 실제 저장 로직을 호출한다.
  // 없으면(예: 읽기전용 맥락) "짧은/커스텀 URL로 변경" 자체가 제공되지 않는다.
  onReplace?: (originalUrl: string, shortUrl: string) => void;
}) {
  const [menuUrl, setMenuUrl] = useState<string | null>(null);
  const [customizeUrl, setCustomizeUrl] = useState<string | null>(null);

  const parts = text.split(URL_REGEX);

  const handleLinkClick = (url: string) => {
    const canShorten = shortenEnabled && !!user && !!onReplace && !isAlreadyShortLink(url);
    if (canShorten) {
      setMenuUrl(url);
    } else {
      openExternalLink(url);
    }
  };

  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            onClick={(e) => {
              // 부모(짐 행 전체를 감싸는 div/button)의 탭 처리(수정 모드 진입, 다중선택
              // 등)로 이벤트가 번지지 않게 막는다.
              e.preventDefault();
              e.stopPropagation();
              handleLinkClick(part);
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

      {menuUrl && (
        <LinkActionMenu
          url={menuUrl}
          onOpen={() => openExternalLink(menuUrl)}
          onShorten={() => {
            if (!user || !onReplace) return;
            const original = menuUrl;
            createShortLink(user, original)
              .then((shortUrl) => onReplace(original, shortUrl))
              .catch((err) => {
                console.error("[팩인백] 링크 축약 실패:", err);
              });
          }}
          onCustomize={() => {
            setCustomizeUrl(menuUrl);
          }}
          onClose={() => setMenuUrl(null)}
        />
      )}

      {customizeUrl && user && (
        <CustomUrlModal
          url={customizeUrl}
          user={user}
          onSuccess={(shortUrl) => {
            if (onReplace) onReplace(customizeUrl, shortUrl);
            setCustomizeUrl(null);
          }}
          onClose={() => setCustomizeUrl(null)}
        />
      )}
    </>
  );
}
