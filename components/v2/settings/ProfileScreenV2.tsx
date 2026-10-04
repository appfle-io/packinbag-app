"use client";

import { useState } from "react";
import { IconRefresh } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import { randomNickname } from "@/lib/nickname";
import { friendlyAuthError } from "@/lib/authErrorMessage";
import LegacyAvatar from "@/components/Avatar";
import { Badge, Button, IconButton, SectionHeader, Sheet, cx } from "@/components/v2/ui";
import { ConfirmSheet } from "@/components/v2/bag/sheets/ConfirmSheet";
import { AccountLinkSheet } from "@/components/v2/sheets/AccountLinkSheet";
import { SubScreen } from "./SubScreen";

const NICK_MAX = 12;
const FIELD = "h-12 w-full rounded-field border border-line bg-card px-4 text-body outline-none placeholder:text-faint focus:border-ink";

// 비밀번호 바꾸기 시트(이메일 가입 계정만)
function PasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { changePassword } = useAuth();
  const { show } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setError("");
    }
  }

  const submit = async () => {
    setError("");
    if (next.length < 6) return setError("새 비밀번호는 6자 이상이어야 해요.");
    if (next !== confirm) return setError("새 비밀번호가 서로 달라요.");
    setBusy(true);
    try {
      await changePassword(current, next);
      show("비밀번호를 바꿨어요");
      onClose();
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={busy ? () => {} : onClose}
      title="비밀번호 바꾸기"
      footer={
        <Button block disabled={busy || !current || !next || !confirm} onClick={submit}>
          {busy ? "바꾸는 중" : "바꾸기"}
        </Button>
      }
    >
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} aria-label="지금 비밀번호" placeholder="지금 비밀번호" autoComplete="current-password" className={FIELD} />
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} aria-label="새 비밀번호" placeholder="새 비밀번호 (6자 이상)" autoComplete="new-password" className={FIELD} />
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="새 비밀번호 확인" placeholder="새 비밀번호 확인" autoComplete="new-password" enterKeyHint="done" className={FIELD} />
        {error && (
          <p role="alert" className="m-0 pt-1 text-caption text-alert">
            {error}
          </p>
        )}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
}

// 회원 탈퇴 시트: 닉네임을 그대로 입력해야 버튼이 켜진다
function DeleteAccountSheet({ open, nickname, needsPassword, onClose }: { open: boolean; nickname: string; needsPassword: boolean; onClose: () => void }) {
  const { deleteAccount } = useAuth();
  const [input, setInput] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setInput("");
      setPassword("");
      setError(null);
    }
  }

  const matches = !!input.trim() && input === nickname && (!needsPassword || password.length > 0);
  const submit = async () => {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(needsPassword ? password : undefined);
      onClose();
    } catch (err) {
      // 본인 확인(재인증) 단계에서 막히면 아무것도 지워지지 않은 상태다
      const message = friendlyAuthError(err instanceof Error ? err.message : "");
      if (message) setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={busy ? () => {} : onClose}
      title="회원 탈퇴"
      showClose={!busy}
      footer={
        <Button block disabled={!matches || busy} className={cx(matches && !busy && "bg-alert text-on-brand")} onClick={submit}>
          {busy ? "지우는 중" : "영구 삭제"}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="m-0 text-body text-sub">
          계정, 팩 보관함, 나만 쓰는 가방이 모두 영구히 지워지고 되돌릴 수 없어요. 함께 쓰던 가방에서는 나만 빠지고 다른 멤버는 계속 쓸 수 있어요.
        </p>
        <label className="flex flex-col gap-2">
          <span className="text-caption text-sub">
            계속하려면 닉네임 <strong className="font-semibold text-ink">{nickname}</strong>을(를) 그대로 입력해 주세요
          </span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
            placeholder={nickname}
            autoComplete="off"
            autoCapitalize="off"
            className={FIELD}
          />
        </label>
        {needsPassword ? (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            aria-label="지금 비밀번호"
            placeholder="본인 확인을 위해 지금 비밀번호"
            autoComplete="current-password"
            className={FIELD}
          />
        ) : (
          <p className="m-0 text-caption text-sub">본인 확인을 위해 로그인 창이 한 번 더 뜰 수 있어요.</p>
        )}
        {error && (
          <p role="alert" className="m-0 text-caption text-alert">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

// 설정 > 프로필. 구 ProfileEditScreen 대체(같은 AuthProvider 함수).
// 닉네임·캐릭터를 고치고 아래 "저장". 비밀번호 바꾸기(이메일 계정) · 로그아웃 · 회원 탈퇴. 게스트면 계정 전환 안내
export function ProfileScreenV2({ onBack }: { onBack: () => void }) {
  const { user, profile, updateNickname, updateAvatar, logout, isGuest, isOfflineMode, exitOfflineMode } = useAuth();
  // 오프라인 모드도 isGuest가 true지만 게스트(익명 계정)와 다르다: 계정 전환·"지워질 수 있어요" 경고가 맞지 않는다
  const onlineGuest = isGuest && !isOfflineMode;
  const { show } = useToast();
  const [nickname, setNickname] = useState(profile?.nickname ?? "");
  const [avatarId, setAvatarId] = useState(profile?.avatarId ?? AVATAR_OPTIONS[0].id);
  const [saving, setSaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const isPasswordAccount = !!user?.providerData?.some((p) => p.providerId === "password");
  const trimmed = nickname.trim();
  const dirty = trimmed !== (profile?.nickname ?? "") || avatarId !== (profile?.avatarId ?? "");

  const save = async () => {
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      if (trimmed !== profile?.nickname) await updateNickname(trimmed.slice(0, NICK_MAX));
      if (avatarId !== profile?.avatarId) await updateAvatar(avatarId);
      show("프로필을 저장했어요");
      onBack();
    } catch {
      show("프로필을 저장하지 못했어요. 잠시 뒤 다시 해 주세요");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SubScreen
      title="프로필"
      onBack={onBack}
      bodyClassName="gap-8"
      footer={
        <Button block disabled={!dirty || !trimmed || saving} onClick={save}>
          {saving ? "저장 중" : "저장"}
        </Button>
      }
    >
      <section className="flex flex-col items-center gap-2 pt-2">
        <LegacyAvatar avatarId={avatarId} size={72} />
        {isOfflineMode ? (
          <span className="flex items-center gap-2">
            <Badge>오프라인</Badge>
            <span className="text-caption text-sub">이 기기에만 저장돼요</span>
          </span>
        ) : isGuest ? (
          <span className="flex items-center gap-2">
            <Badge tone="brand">게스트</Badge>
            <span className="text-caption text-sub">이 기기에만 저장돼요</span>
          </span>
        ) : (
          <span className="text-caption text-sub">{profile?.email}</span>
        )}
        {onlineGuest && (
          <Button variant="text" size="sm" onClick={() => setLinkOpen(true)}>
            정식 계정으로 전환하기
          </Button>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeader>닉네임</SectionHeader>
        <div className="flex items-center gap-2">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, NICK_MAX))}
            maxLength={NICK_MAX}
            aria-label="닉네임"
            placeholder={`닉네임 (${NICK_MAX}자 이내)`}
            className={FIELD}
          />
          <IconButton label="닉네임 추천받기" variant="soft" onClick={() => setNickname(randomNickname())}>
            <IconRefresh size={20} stroke={1.75} />
          </IconButton>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeader>캐릭터</SectionHeader>
        <div role="radiogroup" aria-label="캐릭터" className="grid grid-cols-6 gap-2">
          {AVATAR_OPTIONS.map((a, i) => {
            const on = avatarId === a.id;
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`캐릭터 ${i + 1}`}
                onClick={() => setAvatarId(a.id)}
                className={cx(
                  "flex aspect-square items-center justify-center rounded-full bg-transparent transition-shadow duration-160 ease-snappy",
                  on ? "ring-2 ring-brand ring-offset-2 ring-offset-canvas" : "active:opacity-60",
                )}
              >
                <LegacyAvatar avatarId={a.id} size={40} />
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col">
        <SectionHeader>계정</SectionHeader>
        {isPasswordAccount && (
          <button type="button" onClick={() => setPasswordOpen(true)} className="flex min-h-13 w-full items-center border-b border-line bg-transparent text-left text-body text-ink active:bg-fill">
            비밀번호 바꾸기
          </button>
        )}
        {isOfflineMode ? (
          // 오프라인 데이터는 이 기기에 그대로 남는다(지우지 않음) → 확인 없이 바로 나간다
          <button type="button" onClick={exitOfflineMode} className="flex min-h-13 w-full items-center bg-transparent text-left text-body text-ink active:bg-fill">
            오프라인 모드 종료
          </button>
        ) : (
          <button type="button" onClick={() => setLogoutOpen(true)} className="flex min-h-13 w-full items-center border-b border-line bg-transparent text-left text-body text-ink active:bg-fill">
            {isGuest ? "게스트 모드 끝내기" : "로그아웃"}
          </button>
        )}
        {!isGuest && (
          <button type="button" onClick={() => setDeleteOpen(true)} className="flex min-h-13 w-full items-center bg-transparent text-left text-body text-alert active:bg-fill">
            회원 탈퇴
          </button>
        )}
      </section>

      <PasswordSheet open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      <DeleteAccountSheet open={deleteOpen} nickname={profile?.nickname ?? ""} needsPassword={isPasswordAccount} onClose={() => setDeleteOpen(false)} />
      <AccountLinkSheet open={linkOpen} onClose={() => setLinkOpen(false)} />
      <ConfirmSheet
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title={isGuest ? "게스트 모드를 끝낼까요?" : "로그아웃할까요?"}
        message={isGuest ? "회원가입 없이 나가면 지금까지 만든 가방과 팩이 모두 지워질 수 있어요." : undefined}
        confirmLabel={isGuest ? "지우고 나가기" : "로그아웃"}
        danger
        onConfirm={() => logout()}
      />
    </SubScreen>
  );
}
