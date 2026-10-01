"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import { IconEdit, IconExternalLink, IconLink, IconLinkOff, IconPencil } from "@tabler/icons-react";
import {
  createCustomShortLink,
  createShortLink,
  updateLinkMeta,
  validateCustomCode,
  validateLinkLabel,
  LINK_LABEL_MAX_LENGTH,
  type LinkMeta,
} from "@/lib/shortLinkService";
import { Button, ListRow, Sheet } from "@/components/v2/ui";

// 메모 편집기 링크 시트 하나. 구 LinkActionMenu + ShortenUrlModal + CustomUrlModal + EditLinkModal(+ window.prompt 링크 삽입)을
// 단계 전환으로 합쳤다. 서버 API(shorten-url / custom-shorten-url / update-short-link)는 그대로 쓴다.
export type LinkRequest =
  // 툴바 링크 버튼: 주소를 넣어 링크로 만들기(이미 링크면 주소 고치기·해제)
  | { kind: "insert"; initialUrl: string; canUnlink: boolean }
  // 축약 전 링크를 탭: 열기 · 해제 · 짧은 URL · 커스텀 URL
  | { kind: "tap"; url: string; canUnlink: boolean }
  // 내가 만든 짧은/커스텀 링크를 탭: 열기 · 해제 · 이름/주소 수정
  | { kind: "manage"; url: string; meta: LinkMeta; canUnlink: boolean };

type Step = "menu" | "insert" | "shorten" | "custom" | "edit";

const FIELD =
  "h-12 w-full rounded-field bg-fill px-4 text-body outline-none placeholder:text-faint";

function firstStep(req: LinkRequest): Step {
  return req.kind === "insert" ? "insert" : "menu";
}

export function LinkSheet({
  request,
  user,
  onClose,
  onOpen,
  onUnlink,
  onInsert,
  onShortened,
  onEdited,
}: {
  request: LinkRequest | null;
  user: User | null;
  onClose: () => void;
  onOpen: (url: string) => void;
  onUnlink: () => void;
  onInsert: (url: string) => void;
  // 새 짧은/커스텀 링크가 만들어졌을 때. 부모가 캐시 갱신 + 본문 링크 교체를 한다
  onShortened: (originalUrl: string, shortUrl: string, label: string | null) => void;
  // 내 링크의 이름/주소를 고쳤을 때
  onEdited: (meta: LinkMeta, result: { label: string | null; longUrl: string }) => void;
}) {
  // 닫히는 동안 내용이 사라지지 않게 마지막 요청을 기억하고, 새 요청이 오면 첫 단계부터
  const [kept, setKept] = useState<LinkRequest | null>(request);
  const [step, setStep] = useState<Step>(request ? firstStep(request) : "menu");
  const [url, setUrl] = useState("");
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [longUrl, setLongUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (request && request !== kept) {
    setKept(request);
    setStep(firstStep(request));
    setUrl(request.kind === "insert" ? request.initialUrl : "");
    setCode("");
    setLabel("");
    setLongUrl("");
    setError(null);
  }
  const req = request ?? kept;
  const targetUrl = req && req.kind !== "insert" ? req.url : "";

  const go = (next: Step) => {
    setError(null);
    if (next === "edit" && req?.kind === "manage") {
      setLabel(req.meta.label ?? "");
      setLongUrl(req.meta.longUrl);
    }
    setStep(next);
  };

  const run = async (task: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : "처리하지 못했어요");
    } finally {
      setSaving(false);
    }
  };

  const submit = () => {
    if (saving || !req) return;
    if (step === "insert") {
      const trimmed = url.trim();
      if (!trimmed) {
        setError("웹 주소를 입력해 주세요");
        return;
      }
      onInsert(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
      onClose();
      return;
    }
    if (!user) return;
    if (step === "shorten") {
      const labelError = validateLinkLabel(label);
      if (labelError) return setError(labelError);
      void run(async () => {
        const trimmed = label.trim();
        const shortUrl = await createShortLink(user, targetUrl, trimmed || undefined);
        onShortened(targetUrl, shortUrl, trimmed || null);
        onClose();
      });
      return;
    }
    if (step === "custom") {
      const codeError = validateCustomCode(code);
      if (codeError) return setError(codeError);
      const labelError = validateLinkLabel(label);
      if (labelError) return setError(labelError);
      void run(async () => {
        const trimmed = label.trim();
        const shortUrl = await createCustomShortLink(user, targetUrl, code.trim(), trimmed || undefined);
        onShortened(targetUrl, shortUrl, trimmed || null);
        onClose();
      });
      return;
    }
    if (step === "edit" && req.kind === "manage") {
      const labelError = validateLinkLabel(label);
      if (labelError) return setError(labelError);
      if (!longUrl.trim()) return setError("연결될 주소를 입력해 주세요");
      const meta = req.meta;
      void run(async () => {
        const result = await updateLinkMeta(user, { kind: meta.kind, code: meta.code, label: label.trim(), longUrl: longUrl.trim() });
        onEdited(meta, result);
        onClose();
      });
    }
  };

  const title =
    step === "insert"
      ? "링크"
      : step === "shorten"
        ? "짧은 URL 만들기"
        : step === "custom"
          ? "커스텀 URL 만들기"
          : step === "edit"
            ? "링크 수정"
            : "링크";

  const footer =
    step === "menu" ? undefined : (
      <div className="flex gap-2">
        {step !== "insert" && (
          <Button variant="secondary" className="flex-1" onClick={() => go("menu")}>
            뒤로
          </Button>
        )}
        <Button className="flex-1" disabled={saving || (step === "custom" && !code.trim())} onClick={submit}>
          {saving ? "저장 중" : step === "insert" ? "적용" : "저장"}
        </Button>
      </div>
    );

  const previewOrigin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <Sheet open={!!request} onClose={onClose} title={title} footer={footer}>
      {req && (
        <div className="flex flex-col gap-3">
          {targetUrl && <p className="m-0 truncate text-caption text-faint">{targetUrl}</p>}

          {step === "menu" && (
            <div className="flex flex-col">
              <ListRow
                title="링크 열기"
                leading={<IconExternalLink size={20} stroke={1.75} className="text-sub" aria-hidden="true" />}
                onClick={() => {
                  onClose();
                  onOpen(targetUrl);
                }}
              />
              {req.canUnlink && (
                <ListRow
                  title="링크 해제"
                  subtitle="일반 글자로 바꿔요"
                  leading={<IconLinkOff size={20} stroke={1.75} className="text-sub" aria-hidden="true" />}
                  onClick={() => {
                    onClose();
                    onUnlink();
                  }}
                />
              )}
              {req.kind === "tap" && user && (
                <>
                  <ListRow
                    title="짧은 URL로 바꾸기"
                    leading={<IconLink size={20} stroke={1.75} className="text-brand" aria-hidden="true" />}
                    onClick={() => go("shorten")}
                    chevron
                  />
                  <ListRow
                    divider={false}
                    title="커스텀 URL로 바꾸기"
                    leading={<IconEdit size={20} stroke={1.75} className="text-brand" aria-hidden="true" />}
                    onClick={() => go("custom")}
                    chevron
                  />
                </>
              )}
              {req.kind === "manage" && user && (
                <ListRow
                  divider={false}
                  title="이름 · 주소 수정"
                  leading={<IconPencil size={20} stroke={1.75} className="text-brand" aria-hidden="true" />}
                  onClick={() => go("edit")}
                  chevron
                />
              )}
            </div>
          )}

          {step === "insert" && (
            <>
              <input
                autoFocus
                value={url}
                inputMode="url"
                autoCapitalize="off"
                autoComplete="off"
                aria-label="웹 주소"
                placeholder="https://"
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className={FIELD}
              />
              <p className="m-0 text-caption text-faint">글자를 고른 뒤 누르면 그 글자에, 아니면 주소 그대로 넣어요.</p>
              {req.canUnlink && (
                <Button
                  variant="danger"
                  size="sm"
                  className="self-start px-0"
                  onClick={() => {
                    onClose();
                    onUnlink();
                  }}
                >
                  링크 해제
                </Button>
              )}
            </>
          )}

          {step === "custom" && (
            <label className="flex h-12 items-center rounded-field bg-fill px-4">
              <span className="max-w-40 shrink-0 truncate text-body text-faint">{previewOrigin}/c/</span>
              <input
                autoFocus
                value={code}
                maxLength={20}
                aria-label="원하는 주소"
                placeholder="원하는 주소"
                onChange={(e) => {
                  setCode(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-faint"
              />
            </label>
          )}

          {(step === "shorten" || step === "custom" || step === "edit") && (
            <label className="flex flex-col gap-2">
              <span className="text-caption font-semibold text-sub">표시 이름 (선택)</span>
              <input
                autoFocus={step !== "custom"}
                value={label}
                maxLength={LINK_LABEL_MAX_LENGTH}
                placeholder="비워 두면 링크 그대로 보여요"
                onChange={(e) => {
                  setLabel(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className={FIELD}
              />
            </label>
          )}

          {step === "edit" && (
            <label className="flex flex-col gap-2">
              <span className="text-caption font-semibold text-sub">연결되는 주소</span>
              <input
                value={longUrl}
                inputMode="url"
                autoCapitalize="off"
                placeholder="https://"
                onChange={(e) => {
                  setLongUrl(e.target.value);
                  if (error) setError(null);
                }}
                className={FIELD}
              />
            </label>
          )}

          {error ? (
            <p className="m-0 text-caption text-alert">{error}</p>
          ) : (
            step === "custom" && <p className="m-0 text-caption text-faint">한글 · 영문 · 숫자 · - · _ 만, 2~20자</p>
          )}
        </div>
      )}
    </Sheet>
  );
}
