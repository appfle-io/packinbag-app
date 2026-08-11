"use client";

import { Fragment, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { openExternalLink } from "@/lib/openExternalLink";
import {
  isAlreadyShortLink,
  fetchLinkMeta,
  parseShortLinkUrl,
  type LinkMeta,
} from "@/lib/shortLinkService";
import { ensureLinkMetaLoaded, getCachedLinkMeta, setLinkMetaCache, subscribeLinkMeta } from "@/lib/linkLabelCache";
import LinkActionMenu from "@/components/LinkActionMenu";
import CustomUrlModal from "@/components/CustomUrlModal";
import ShortenUrlModal from "@/components/ShortenUrlModal";
import EditLinkModal from "@/components/EditLinkModal";
import { useToast } from "@/components/Toast";

// 짐/가방 메모 같은 일반 텍스트(TipTap이 아닌 plain <span>) 안에서 http(s):// URL을
// 찾아 클릭 가능한 링크로 바꿔준다. MentionText.tsx(@멘션 볼드 처리)와 동일한
// split(캡처그룹 정규식) 패턴을 재사용한다.
const URL_REGEX = /(https?:\/\/\S+)/g;

// url이 우리 서비스 짧은/커스텀 링크면 lib/linkLabelCache.ts에 캐시된 표시 이름(label)을
// 구독한다. 아직 조회 전이면(undefined) 백그라운드로 한 번 조회해두고, 응답이 오면(또는
// 다른 곳에서 이 링크를 수정해서 캐시가 갱신되면) 자동으로 리렌더된다. 우리 링크가 아니면
// 조회 없이 항상 null을 돌려준다.
function useLinkMeta(url: string, user: User | null): LinkMeta | null | undefined {
  const [, forceRerender] = useState(0);

  useEffect(() => {
    ensureLinkMetaLoaded(url, user);
    return subscribeLinkMeta(url, () => forceRerender((n) => n + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return getCachedLinkMeta(url);
}

// 링크 하나(<a>)를 렌더링한다. 우리 서비스 짧은/커스텀 링크면 표시 이름이 있을 때 원본 URL
// 텍스트 대신 그 이름을 보여준다(href는 항상 실제 url 그대로 - 리다이렉트 동작은 안 바뀐다).
function LinkifiedUrlPart({
  url,
  user,
  onClick,
}: {
  url: string;
  user: User | null;
  onClick: () => void;
}) {
  const meta = useLinkMeta(url, user);
  const displayText = meta?.label || url;
  return (
    <a
      href={url}
      onClick={(e) => {
        // 부모(짐 행 전체를 감싸는 div/button)의 탭 처리(수정 모드 진입, 다중선택
        // 등)로 이벤트가 번지지 않게 막는다.
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className="underline"
      style={{ color: "var(--accent)" }}
    >
      {displayText}
    </a>
  );
}

export default function LinkifiedText({
  text,
  user,
  shortenEnabled,
  onReplace,
}: {
  text: string;
  // 로그인 사용자 - "짧은/커스텀 URL로 변경"이나 이미 만든 링크 수정을 실제로 실행하려면 필요하다.
  user: User | null;
  // isShortUrlFeatureEnabled(email, profile)로 미리 계산해서 넘겨준다(프리미엄 + 설정
  // 토글이 둘 다 켜져 있어야 true) - false면 아직 축약 전인 링크를 눌러도 선택 메뉴 없이 바로 열린다.
  shortenEnabled: boolean;
  // 원본 URL을 짧은/커스텀 URL로 교체할 때 부모(짐 텍스트/가방 메모)의 실제 저장 로직을 호출한다.
  // 없으면(예: 읽기전용 맥락) "짧은/커스텀 URL로 변경" 자체가 제공되지 않는다.
  onReplace?: (originalUrl: string, shortUrl: string) => void;
}) {
  const [menuUrl, setMenuUrl] = useState<string | null>(null);
  const [customizeUrl, setCustomizeUrl] = useState<string | null>(null);
  // "짧은 URL로 변경"을 누르면 이 값이 채워져 표시 이름 입력 시트(ShortenUrlModal)가 열린다.
  const [shortenTargetUrl, setShortenTargetUrl] = useState<string | null>(null);
  // 이미 축약된 링크를 눌렀을 때, 본인이 만든 링크로 확인되면(fetchLinkMeta의 canEdit) 이
  // 값이 채워져 "열기/수정" 선택 시트가 뜬다. 확인 전(비동기 조회 중)이거나 본인 링크가
  // 아니면 메뉴 없이 바로 연다 - 다른 사람이 만든 링크까지 매번 확인창을 띄우면 오히려
  // 번거로워서, v78부터의 "바로 열림" 동작은 그대로 유지한다.
  const [manageTarget, setManageTarget] = useState<{ url: string; meta: LinkMeta } | null>(null);
  const [editTarget, setEditTarget] = useState<{ url: string; meta: LinkMeta } | null>(null);
  const { show } = useToast();

  const parts = text.split(URL_REGEX);

  const handleLinkClick = (url: string) => {
    if (isAlreadyShortLink(url)) {
      if (!user) {
        openExternalLink(url);
        return;
      }
      fetchLinkMeta(url, user).then((meta) => {
        if (meta?.canEdit) {
          setManageTarget({ url, meta });
        } else {
          openExternalLink(url);
        }
      });
      return;
    }
    const canShorten = shortenEnabled && !!user && !!onReplace;
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
          <LinkifiedUrlPart key={i} url={part} user={user} onClick={() => handleLinkClick(part)} />
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}

      {menuUrl && (
        <LinkActionMenu
          url={menuUrl}
          onOpen={() => openExternalLink(menuUrl)}
          onShorten={() => setShortenTargetUrl(menuUrl)}
          onCustomize={() => setCustomizeUrl(menuUrl)}
          onClose={() => setMenuUrl(null)}
        />
      )}

      {manageTarget && (
        <LinkActionMenu
          url={manageTarget.url}
          onOpen={() => {
            openExternalLink(manageTarget.url);
            setManageTarget(null);
          }}
          onManage={() => {
            setEditTarget(manageTarget);
            setManageTarget(null);
          }}
          onClose={() => setManageTarget(null)}
        />
      )}

      {shortenTargetUrl && user && (
        <ShortenUrlModal
          url={shortenTargetUrl}
          user={user}
          onSuccess={({ shortUrl, label }) => {
            const parsed = parseShortLinkUrl(shortUrl);
            if (parsed) {
              setLinkMetaCache(parsed.kind, parsed.code, {
                kind: parsed.kind,
                code: parsed.code,
                longUrl: shortenTargetUrl,
                label,
                canEdit: true,
              });
            }
            if (onReplace) onReplace(shortenTargetUrl, shortUrl);
            setShortenTargetUrl(null);
          }}
          onClose={() => setShortenTargetUrl(null)}
        />
      )}

      {customizeUrl && user && (
        <CustomUrlModal
          url={customizeUrl}
          user={user}
          onSuccess={({ shortUrl, label }) => {
            const parsed = parseShortLinkUrl(shortUrl);
            if (parsed) {
              setLinkMetaCache(parsed.kind, parsed.code, {
                kind: parsed.kind,
                code: parsed.code,
                longUrl: customizeUrl,
                label,
                canEdit: true,
              });
            }
            if (onReplace) onReplace(customizeUrl, shortUrl);
            setCustomizeUrl(null);
          }}
          onClose={() => setCustomizeUrl(null)}
        />
      )}

      {editTarget && user && (
        <EditLinkModal
          kind={editTarget.meta.kind}
          code={editTarget.meta.code}
          initialLabel={editTarget.meta.label}
          initialLongUrl={editTarget.meta.longUrl}
          user={user}
          onSuccess={(result) => {
            setLinkMetaCache(editTarget.meta.kind, editTarget.meta.code, {
              ...editTarget.meta,
              ...result,
            });
            show("링크를 수정했어요");
            setEditTarget(null);
          }}
          onClose={() => setEditTarget(null)}
        />
      )}
    </>
  );
}
