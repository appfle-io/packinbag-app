"use client";

// 관리자 > 이벤트(2026-10-19, admin.md ADM-EVT). 등록 · 고치기 · 숨기기 · 지우기 + 휴대폰 · PC 폭 미리 보기.
// 파일은 Claude가 이벤트 가이드(_secrets/claude/event-guide.md)대로 만든 cover · body를 그대로 올린다
import { useEffect, useMemo, useState } from "react";
import { IconPencil, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import {
  EVENT_BODY_MAX_BYTES,
  EVENT_BUTTON_MAX,
  EVENT_COVER_MAX_BYTES,
  EVENT_LINK_LABEL_MAX,
  EVENT_LINKS_MAX,
  EVENT_SLUG_RE,
  EVENT_SUMMARY_MAX,
  EVENT_TITLE_MAX,
  eventLinks,
  eventPeriodLabel,
  eventShortPath,
  eventStatus,
  isAppPath,
  isSafeEventLink,
  localDateKey,
  normalizeSlug,
  type AppEvent,
  type EventBodyType,
  type EventLink,
  type EventStatus,
} from "@/lib/events";
import { deleteEventFile, deleteEventRemote, newEventId, saveEventRemote, subscribeToAllEvents, uploadEventFile } from "@/lib/eventsService";
import { adminApiFetch } from "@/lib/adminApiClient";
import { Badge, Button, IconButton, SegmentedControl, Sheet, Toggle, cx } from "@/components/v2/ui";
import { ConfirmSheet } from "@/components/v2/bag/sheets/ConfirmSheet";
import { ADMIN_FIELD, AdminCard, AdminEmpty, AdminError, AdminPage } from "@/components/admin/AdminPage";

type Draft = {
  existing?: AppEvent;
  title: string;
  summary: string;
  startDate: string;
  endDate: string;
  bodyType: EventBodyType;
  buttonLabel: string;
  // 버튼을 눌렀을 때 고를 곳(ADM-EVT-10). 빈 줄은 저장할 때 뺀다
  links: EventLink[];
  // 공개 페이지 주소 끝(ADM-EVT-11). 비우면 문서 id
  slug: string;
  published: boolean;
  coverFile: File | null;
  bodyFile: File | null;
};

type PreviewWidth = "phone" | "pc";
type PreviewScheme = "light" | "dark";

const STATUS: Record<EventStatus, { label: string; tone: "brand" | "neutral" }> = {
  hidden: { label: "숨김", tone: "neutral" },
  upcoming: { label: "예정", tone: "neutral" },
  active: { label: "진행 중", tone: "brand" },
  ended: { label: "끝남", tone: "neutral" },
};

const BODY_OPTIONS: { value: EventBodyType; label: string }[] = [
  { value: "html", label: "HTML 파일" },
  { value: "image", label: "이미지" },
];
const WIDTH_OPTIONS: { value: PreviewWidth; label: string }[] = [
  { value: "phone", label: "휴대폰" },
  { value: "pc", label: "PC" },
];
const SCHEME_OPTIONS: { value: PreviewScheme; label: string }[] = [
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
];

const plusDays = (n: number) => localDateKey(new Date(Date.now() + n * 24 * 60 * 60 * 1000));
// 공개 주소에 보여 줄 도메인(ADM-EVT-11)
const SITE_HOST = "packinbag.seeuson.com";

// 공개 페이지 캐시 바로 비우기(EVT-WEB-07). 실패해도 1분(/about은 5분) 뒤에는 바뀐다
function refreshPublicPages(...events: (AppEvent | undefined)[]) {
  const keys = [...new Set(events.flatMap((e) => (e ? [e.id, ...(e.slug ? [e.slug] : [])] : [])))];
  void adminApiFetch("/api/admin/revalidate-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys }),
  }).catch((err) => console.error("[팩인백] 공개 페이지 새로 고침 실패:", err));
}

function blankDraft(): Draft {
  return {
    title: "",
    summary: "",
    startDate: localDateKey(),
    endDate: plusDays(14),
    bodyType: "html",
    buttonLabel: "",
    links: [],
    slug: "",
    published: false,
    coverFile: null,
    bodyFile: null,
  };
}

function draftOf(e: AppEvent): Draft {
  return {
    existing: e,
    title: e.title,
    summary: e.summary,
    startDate: e.startDate,
    endDate: e.endDate,
    bodyType: e.bodyType,
    buttonLabel: e.buttonLabel ?? "",
    links: eventLinks(e),
    slug: e.slug ?? "",
    published: e.published,
    coverFile: null,
    bodyFile: null,
  };
}

const isHtmlFile = (f: File) => f.type === "text/html" || /\.html?$/i.test(f.name);

// 빈 줄(이름 · 주소 둘 다 빈 것)을 뺀 링크
const filledLinks = (d: Draft) =>
  d.links.map((l) => ({ label: l.label.trim(), url: l.url.trim() })).filter((l) => l.label || l.url);

// 저장하기 전 검사(ADM-EVT-04). 문제가 있으면 그 문구, 없으면 null. taken = 다른 이벤트가 쓰는 주소(slug · id)
function problemOf(d: Draft, taken: string[]): string | null {
  if (!d.title.trim()) return "제목을 적어 주세요";
  const slug = normalizeSlug(d.slug);
  if (slug && !EVENT_SLUG_RE.test(slug)) return "공개 주소는 영문 소문자 · 숫자 · -(하이픈) 3~40자만 돼요";
  if (slug && taken.includes(slug)) return "다른 이벤트가 쓰는 공개 주소예요";
  if (!d.startDate) return "시작하는 날을 정해 주세요";
  // 끝나는 날 ""는 "끝나는 날 없음"(EVT-DATA-04)
  if (d.endDate && d.startDate > d.endDate) return "끝나는 날이 시작하는 날보다 빨라요";
  if (!d.coverFile && !d.existing?.coverUrl) return "커버 이미지를 골라 주세요";
  if (d.coverFile && !d.coverFile.type.startsWith("image/")) return "커버는 이미지 파일이어야 해요";
  if (d.coverFile && d.coverFile.size > EVENT_COVER_MAX_BYTES) return "커버 이미지는 2MB 이하로 올려 주세요";
  const keepsBody = !d.bodyFile && !!d.existing?.bodyUrl && d.existing.bodyType === d.bodyType;
  if (!d.bodyFile && !keepsBody) return d.bodyType === "html" ? "본문 HTML 파일을 골라 주세요" : "본문 이미지를 골라 주세요";
  if (d.bodyFile && d.bodyType === "html" && !isHtmlFile(d.bodyFile)) return "본문은 .html 파일이어야 해요";
  if (d.bodyFile && d.bodyType === "image" && !d.bodyFile.type.startsWith("image/")) return "본문은 이미지 파일이어야 해요";
  if (d.bodyFile && d.bodyFile.size > EVENT_BODY_MAX_BYTES) return "본문 파일은 8MB 이하로 올려 주세요";
  const label = d.buttonLabel.trim();
  const links = filledLinks(d);
  if (!!label !== links.length > 0) return "버튼은 문구와 링크를 둘 다 적거나 둘 다 비워 주세요";
  if (links.some((l) => !l.label || !l.url)) return "링크는 이름과 주소를 둘 다 적어 주세요";
  if (links.some((l) => !isSafeEventLink(l.url))) return "주소는 /로 시작하는 앱 경로나 https:// 주소만 돼요";
  if (links.length > 1 && links.some((l) => isAppPath(l.url))) return "앱 안 화면(/…)은 링크가 하나일 때만 돼요";
  return null;
}

function FilePick({
  label,
  accept,
  file,
  existingName,
  onPick,
}: {
  label: string;
  accept: string;
  file: File | null;
  existingName?: string;
  onPick: (f: File | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption text-sub">{label}</span>
      <div className="flex items-center gap-3">
        <label className="flex h-11 shrink-0 cursor-pointer items-center justify-center rounded-field border border-line bg-card px-4 text-caption font-semibold text-ink active:bg-fill">
          파일 고르기
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              onPick(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </label>
        <span className="min-w-0 truncate text-caption text-sub">
          {file ? `${file.name} · ${Math.round(file.size / 1024)}KB` : existingName ?? "고른 파일 없음"}
        </span>
      </div>
    </div>
  );
}

// 미리 보기(ADM-EVT-05): 고른 HTML은 글을 읽어 srcdoc로, 올려 둔 것은 주소로. 앱과 같은 sandbox=""
function Preview({ draft }: { draft: Draft }) {
  const [width, setWidth] = useState<PreviewWidth>("phone");
  const [scheme, setScheme] = useState<PreviewScheme>("light");
  const [html, setHtml] = useState<{ file: File; text: string } | null>(null);
  const file = draft.bodyFile;
  const isHtml = draft.bodyType === "html";

  useEffect(() => {
    if (!file || !isHtml) return;
    let alive = true;
    void file.text().then((text) => alive && setHtml({ file, text }));
    return () => {
      alive = false;
    };
  }, [file, isHtml]);

  // 고른 이미지의 임시 주소. 바뀌거나 닫으면 놓아 준다
  const blobUrl = useMemo(() => (file && !isHtml ? URL.createObjectURL(file) : null), [file, isHtml]);
  useEffect(
    () => () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    },
    [blobUrl],
  );

  const existing = draft.existing && draft.existing.bodyType === draft.bodyType ? draft.existing.bodyUrl : undefined;
  const htmlDoc = file && isHtml && html?.file === file ? html.text : null;
  const htmlUrl = !file && isHtml ? existing : undefined;
  const imgUrl = !isHtml ? (blobUrl ?? (file ? undefined : existing)) : undefined;
  if (!htmlDoc && !htmlUrl && !imgUrl) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-caption text-sub">미리 보기</span>
        <div className="flex flex-wrap gap-2">
          <SegmentedControl label="미리 보기 폭" options={WIDTH_OPTIONS} value={width} onChange={setWidth} />
          <SegmentedControl label="미리 보기 화면 모드" options={SCHEME_OPTIONS} value={scheme} onChange={setScheme} />
        </div>
      </div>
      <div className={cx("mx-auto h-96 w-full overflow-hidden rounded-card border border-line", width === "phone" && "max-w-sm")}>
        {imgUrl ? (
          <div className="size-full overflow-y-auto bg-canvas">
            {/* eslint-disable-next-line @next/next/no-img-element -- 미리 보기(임시 · Storage 주소) */}
            <img src={imgUrl} alt="" className="block h-auto w-full" />
          </div>
        ) : (
          <iframe
            title="이벤트 미리 보기"
            sandbox=""
            {...(htmlDoc ? { srcDoc: htmlDoc } : { src: htmlUrl })}
            className="size-full border-0"
            // 고른 미리 보기 화면 모드(런타임)
            style={{ colorScheme: scheme }}
          />
        )}
      </div>
    </div>
  );
}

export default function AdminEventsPage() {
  const { user } = useAuth();
  const { show } = useToast();
  const [items, setItems] = useState<AppEvent[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [cached, setCached] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppEvent | null>(null);

  useEffect(
    () =>
      subscribeToAllEvents(setItems, (err) => {
        console.error("[팩인백] 이벤트 목록 실패:", err);
        setLoadError(true);
      }),
    [],
  );

  if (draft && draft !== cached) setCached(draft);
  const d = draft ?? cached;
  // 다른 이벤트가 쓰는 공개 주소(slug와 문서 id 모두 주소로 쓰여서 둘 다)
  const taken = (items ?? []).filter((e) => e.id !== d?.existing?.id).flatMap((e) => (e.slug ? [e.slug, e.id] : [e.id]));
  const problem = d ? problemOf(d, taken) : null;
  const patch = (p: Partial<Draft>) => {
    if (d) setDraft({ ...d, ...p });
  };

  // 저장(ADM-EVT-06): 새 파일만 올림 → 문서 저장 → 바뀐 예전 파일 삭제. 문서 저장이 실패하면 방금 올린 파일을 지운다
  const save = async () => {
    if (!draft || saving || problemOf(draft, taken)) return;
    setSaving(true);
    const id = draft.existing?.id ?? newEventId();
    const uploaded: string[] = [];
    try {
      const cover = draft.coverFile ? await uploadEventFile(id, "cover", draft.coverFile) : null;
      if (cover) uploaded.push(cover.path);
      const body = draft.bodyFile ? await uploadEventFile(id, "body", draft.bodyFile) : null;
      if (body) uploaded.push(body.path);
      const now = new Date().toISOString();
      const prev = draft.existing;
      const label = draft.buttonLabel.trim();
      const links = label ? filledLinks(draft) : [];
      const event: AppEvent = {
        id,
        title: draft.title.trim(),
        summary: draft.summary.trim(),
        startDate: draft.startDate,
        endDate: draft.endDate,
        coverUrl: cover?.url ?? prev?.coverUrl,
        coverPath: cover?.path ?? prev?.coverPath,
        bodyType: draft.bodyType,
        bodyUrl: body?.url ?? prev?.bodyUrl,
        bodyPath: body?.path ?? prev?.bodyPath,
        buttonLabel: label || undefined,
        // 예전 화면이 읽던 값은 첫 링크와 같게
        buttonUrl: links[0]?.url,
        links: links.length > 0 ? links : undefined,
        slug: normalizeSlug(draft.slug) || undefined,
        published: draft.published,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
        createdBy: prev?.createdBy ?? user?.uid,
      };
      await saveEventRemote(event);
      refreshPublicPages(event, prev);
      if (cover && prev?.coverPath) void deleteEventFile(prev.coverPath);
      if (body && prev?.bodyPath) void deleteEventFile(prev.bodyPath);
      show(prev ? "이벤트를 고쳤어요" : event.published ? "이벤트를 올렸어요" : "이벤트를 숨김으로 저장했어요");
      setDraft(null);
    } catch (err) {
      console.error("[팩인백] 이벤트 저장 실패:", err);
      uploaded.forEach((p) => void deleteEventFile(p));
      show("이벤트를 저장하지 못했어요");
    } finally {
      setSaving(false);
    }
  };

  const sorted = [...(items ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate) || b.createdAt.localeCompare(a.createdAt));

  return (
    <AdminPage
      title="이벤트"
      description="설정 > 이벤트와 홈 위 카드(진행 중인 것, 최대 3개)에 보여요. 파일은 이벤트 가이드대로 만든 커버 · 본문을 올려요"
      actions={
        <Button size="sm" leading={<IconPlus size={18} stroke={2} />} onClick={() => setDraft(blankDraft())}>
          새 이벤트
        </Button>
      }
    >
      {loadError ? (
        <AdminError>이벤트를 불러오지 못했어요. 규칙을 배포했는지 확인해 주세요</AdminError>
      ) : items === null ? null : sorted.length === 0 ? (
        <AdminEmpty>이벤트가 없어요. 오른쪽 위 &lsquo;새 이벤트&rsquo;로 올려 보세요</AdminEmpty>
      ) : (
        <AdminCard>
          <ul className="m-0 flex list-none flex-col p-0">
            {sorted.map((e, i) => {
              const s = STATUS[eventStatus(e)];
              return (
                <li key={e.id} className={cx("flex items-center gap-3 py-3", i < sorted.length - 1 && "border-b border-line")}>
                  {e.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Storage 주소
                    <img src={e.coverUrl} alt="" className="size-12 shrink-0 rounded-field bg-fill object-cover" />
                  ) : (
                    <span className="size-12 shrink-0 rounded-field bg-fill" />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-body font-semibold text-ink">{e.title}</span>
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </span>
                    <span className="text-caption text-sub">
                      {eventPeriodLabel(e)} · {e.bodyType === "html" ? "HTML" : "이미지"}
                      {e.buttonLabel ? ` · 버튼 ‘${e.buttonLabel}’ · 링크 ${eventLinks(e).length}개` : ""}
                    </span>
                    {e.published && <span className="truncate text-caption text-sub">{`${SITE_HOST}${eventShortPath(e)}`}</span>}
                    {e.summary && <span className="truncate text-caption text-faint">{e.summary}</span>}
                  </div>
                  <IconButton label="고치기" onClick={() => setDraft(draftOf(e))}>
                    <IconPencil size={20} stroke={1.75} />
                  </IconButton>
                  <IconButton label="삭제" className="text-alert" onClick={() => setDeleteTarget(e)}>
                    <IconTrash size={20} stroke={1.75} />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        </AdminCard>
      )}

      <Sheet
        open={!!draft}
        onClose={saving ? () => {} : () => setDraft(null)}
        title={d?.existing ? "이벤트 고치기" : "새 이벤트"}
        size="tall"
        footer={
          <div className="flex flex-col gap-2">
            {problem && <p className="m-0 text-center text-caption text-sub">{problem}</p>}
            <Button block disabled={!!problem || saving} onClick={save}>
              {saving ? "올리는 중" : d?.existing ? "저장" : d?.published ? "올리기" : "숨김으로 저장"}
            </Button>
          </div>
        }
      >
        {d && (
          <div className="flex flex-col gap-5">
            <label className="flex flex-col gap-2">
              <span className="flex justify-between text-caption text-sub">
                <span>제목</span>
                <span>
                  {d.title.length}/{EVENT_TITLE_MAX}
                </span>
              </span>
              <input value={d.title} maxLength={EVENT_TITLE_MAX} onChange={(e) => patch({ title: e.target.value })} placeholder="홈 카드에 2줄까지" className={ADMIN_FIELD} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="flex justify-between text-caption text-sub">
                <span>한 줄 설명</span>
                <span>
                  {d.summary.length}/{EVENT_SUMMARY_MAX}
                </span>
              </span>
              <input value={d.summary} maxLength={EVENT_SUMMARY_MAX} onChange={(e) => patch({ summary: e.target.value })} placeholder="제목 아래 작은 글" className={ADMIN_FIELD} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-2">
                <span className="text-caption text-sub">시작하는 날</span>
                <input type="date" value={d.startDate} onChange={(e) => patch({ startDate: e.target.value })} className={ADMIN_FIELD} />
              </label>
              {d.endDate ? (
                <label className="flex flex-col gap-2">
                  <span className="text-caption text-sub">끝나는 날(포함)</span>
                  <input type="date" value={d.endDate} onChange={(e) => patch({ endDate: e.target.value })} className={ADMIN_FIELD} />
                </label>
              ) : (
                <div className="flex flex-col gap-2">
                  <span className="text-caption text-sub">끝나는 날</span>
                  <span className="flex h-11 items-center text-body text-sub">없음(직접 닫을 때까지)</span>
                </div>
              )}
            </div>
            <Toggle
              checked={!d.endDate}
              onChange={(open) => patch({ endDate: open ? "" : plusDays(14) })}
              label="끝나는 날 없음"
              description="닫을 때까지 진행 중. 닫으려면 이걸 끄고 끝나는 날을 어제로(지난 이벤트로) 또는 게시를 끄기(숨김)"
            />

            <FilePick
              label="커버 이미지(정사각, 글자 없이)"
              accept="image/*"
              file={d.coverFile}
              existingName={d.existing?.coverUrl ? "올려 둔 커버 그대로" : undefined}
              onPick={(f) => patch({ coverFile: f })}
            />

            <div className="flex flex-col gap-2">
              <span className="text-caption text-sub">본문</span>
              <SegmentedControl label="본문 종류" options={BODY_OPTIONS} value={d.bodyType} onChange={(bodyType) => patch({ bodyType, bodyFile: null })} />
            </div>
            <FilePick
              label={d.bodyType === "html" ? "본문 HTML 파일(.html)" : "본문 이미지(가로 1080px 긴 이미지)"}
              accept={d.bodyType === "html" ? ".html,text/html" : "image/*"}
              file={d.bodyFile}
              existingName={d.existing?.bodyUrl && d.existing.bodyType === d.bodyType ? "올려 둔 본문 그대로" : undefined}
              onPick={(f) => patch({ bodyFile: f })}
            />
            <Preview draft={d} />

            <label className="flex flex-col gap-2">
              <span className="text-caption text-sub">버튼 글자(선택) — 화면 맨 아래 검은 버튼에 보여요</span>
              <input value={d.buttonLabel} maxLength={EVENT_BUTTON_MAX} onChange={(e) => patch({ buttonLabel: e.target.value })} placeholder="예: 책 사러 가기" className={ADMIN_FIELD} />
            </label>
            <div className="flex flex-col gap-2">
              <span className="flex justify-between text-caption text-sub">
                <span>링크(버튼을 누르면 고를 곳)</span>
                <span>
                  {d.links.length}/{EVENT_LINKS_MAX}
                </span>
              </span>
              <p className="m-0 text-caption text-faint">1개면 &ldquo;외부로 이동합니다&rdquo; 확인 창, 2개 이상이면 고르는 창이 떠요. 앱 안 화면(/…)은 1개일 때만, 확인 없이 바로 이동</p>
              {d.links.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-32 shrink-0">
                    <input
                      value={l.label}
                      maxLength={EVENT_LINK_LABEL_MAX}
                      onChange={(e) => patch({ links: d.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                      placeholder="이름(예: 예스24)"
                      aria-label={`링크 ${i + 1} 이름`}
                      className={ADMIN_FIELD}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <input
                      value={l.url}
                      onChange={(e) => patch({ links: d.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })}
                      placeholder="https:// 또는 /경로"
                      aria-label={`링크 ${i + 1} 주소`}
                      className={ADMIN_FIELD}
                    />
                  </div>
                  <IconButton label="링크 빼기" onClick={() => patch({ links: d.links.filter((_, j) => j !== i) })}>
                    <IconX size={18} stroke={1.9} />
                  </IconButton>
                </div>
              ))}
              {d.links.length < EVENT_LINKS_MAX && (
                <Button size="sm" variant="secondary" className="self-start" leading={<IconPlus size={16} stroke={2} />} onClick={() => patch({ links: [...d.links, { label: "", url: "" }] })}>
                  링크 추가
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-caption text-sub">공개 주소(선택) — 앱 없이 링크로 보는 페이지</span>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-caption text-sub">{SITE_HOST}/e/</span>
                <div className="min-w-0 flex-1">
                  <input
                    value={d.slug}
                    maxLength={40}
                    onChange={(e) => patch({ slug: e.target.value })}
                    onBlur={() => patch({ slug: normalizeSlug(d.slug) })}
                    placeholder={d.existing ? d.existing.id : "예: kang-book"}
                    aria-label="공개 주소"
                    autoCapitalize="none"
                    className={ADMIN_FIELD}
                  />
                </div>
              </div>
              {d.existing && (
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-caption text-faint">
                    {`${SITE_HOST}/e/${normalizeSlug(d.slug) || d.existing.id}`}
                    {d.published ? "" : " · 게시해야 열려요"}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const url = `https://${SITE_HOST}/e/${normalizeSlug(d.slug) || d.existing?.id}`;
                      if (!navigator.clipboard) return show("복사하지 못했어요");
                      navigator.clipboard
                        .writeText(url)
                        .then(() => show("공개 주소를 복사했어요"))
                        .catch(() => show("복사하지 못했어요"));
                    }}
                  >
                    복사
                  </Button>
                </div>
              )}
            </div>

            <Toggle
              checked={d.published}
              onChange={(published) => patch({ published })}
              label="게시하기"
              description="끄면 숨김(사용자에게 안 보임). 켜도 기간 밖이면 안 보여요"
            />
          </div>
        )}
      </Sheet>

      <ConfirmSheet
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="이 이벤트를 지울까요?"
        message="커버 · 본문 파일도 함께 지워지고 되돌릴 수 없어요. 잠깐 내리려면 고치기에서 게시를 끄세요."
        confirmLabel="삭제"
        danger
        onConfirm={() => {
          const target = deleteTarget;
          if (!target) return;
          deleteEventRemote(target)
            .then(() => {
              refreshPublicPages(target);
              show("이벤트를 지웠어요");
            })
            .catch(() => show("이벤트를 지우지 못했어요"));
        }}
      />
    </AdminPage>
  );
}
