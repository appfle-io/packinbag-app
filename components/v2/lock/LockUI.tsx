"use client";

import { useEffect, useRef, useState } from "react";
import { IconBackspace, IconChevronLeft, IconFaceId, IconFingerprint, IconLock, IconX } from "@tabler/icons-react";
import Portal from "@/components/Portal";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { OverlayLayerProvider } from "@/lib/overlayLayer";
import { useEscapeToClose } from "@/lib/useEscapeToClose";
import type { PrivateLock } from "@/lib/types";
import { DEFAULT_PIN_LENGTH, setSessionUnlocked, type LockKind, type PinLength } from "@/lib/v2/privateLock";
import { authenticateBiometric, biometricLabel, getBiometricInfo, type BiometricType } from "@/lib/v2/biometric";
import { Button, IconButton, SegmentedControl, Sheet, cx } from "@/components/v2/ui";
import { usePrivateLock } from "./usePrivateLock";

// 개인 잠금 화면 조각(2026-10-12): 숫자 패드 · 잠금 화면(전체 화면) · PIN 만들기 시트 · PIN을 잊었을 때 · 잠금 문(감싸기) · 잠그기/풀기 도우미

// 잠금 화면은 시트 · 겹 화면보다 위, 처리 중 화면(210)보다 아래
const LOCK_Z = 200;

// ---- 숫자 패드 -------------------------------------------------------------------------

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

function PinPad({
  length,
  value,
  onChange,
  disabled,
  active = true,
}: {
  length: number;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  // 실제 키보드(PC) 입력을 받을지(맨 위 패드만)
  active?: boolean;
}) {
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const press = (key: string) => {
    if (disabled) return;
    const cur = valueRef.current;
    if (key === "del") onChange(cur.slice(0, -1));
    else if (cur.length < length) onChange(cur + key);
  };
  const pressRef = useRef(press);
  useEffect(() => {
    pressRef.current = press;
  });

  // PC: 숫자 키 · 백스페이스
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        pressRef.current(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        pressRef.current("del");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex items-center gap-4" aria-label={`${value.length}/${length}자리 입력`} role="status">
        {Array.from({ length }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cx(
              "size-3 rounded-full transition-colors duration-160 ease-snappy",
              i < value.length ? "bg-ink" : "border border-line-strong bg-transparent",
            )}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-x-6 gap-y-4">
        {KEYS.map((k, i) =>
          k === "" ? (
            <span key={i} aria-hidden="true" className="size-18" />
          ) : (
            <button
              key={i}
              type="button"
              disabled={disabled}
              aria-label={k === "del" ? "지우기" : k}
              onClick={() => press(k)}
              className={cx(
                "flex size-18 select-none items-center justify-center rounded-full text-heading font-semibold text-ink",
                "transition-colors duration-160 ease-snappy disabled:opacity-40",
                k === "del" ? "bg-transparent active:bg-fill" : "bg-fill active:bg-line",
              )}
            >
              {k === "del" ? <IconBackspace size={24} stroke={1.75} aria-hidden="true" /> : k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

function BiometricIcon({ type }: { type: BiometricType }) {
  return type === "touchId" ? (
    <IconFingerprint size={20} stroke={1.75} aria-hidden="true" />
  ) : (
    <IconFaceId size={20} stroke={1.75} aria-hidden="true" />
  );
}

const waitLabel = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return s >= 60 ? `${Math.ceil(s / 60)}분 뒤에 다시 입력할 수 있어요` : `${s}초 뒤에 다시 입력할 수 있어요`;
};

// ---- 잠금 화면(전체 화면) -------------------------------------------------------------------

export function LockScreen({
  open,
  title,
  name,
  onUnlocked,
  onCancel,
  cancelLabel = "닫기",
}: {
  open: boolean;
  title: string;
  // 무엇을 여는지(가방 · 팩 이름). 이름은 잠겨도 보인다
  name?: string;
  onUnlocked?: () => void;
  // 없으면 닫기 버튼 없음
  onCancel?: () => void;
  cancelLabel?: "닫기" | "뒤로";
}) {
  const lock = usePrivateLock();
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [checking, setChecking] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [bio, setBio] = useState<{ available: boolean; type: BiometricType }>({ available: false, type: "none" });
  const [openedAt, setOpenedAt] = useState<boolean>(false);

  // 열릴 때마다 처음 상태로
  if (open !== openedAt) {
    setOpenedAt(open);
    if (open) {
      setValue("");
      setMessage(null);
      setForgotOpen(false);
    }
  }

  useEscapeToClose(() => onCancel?.(), open && !!onCancel && !forgotOpen);

  const unlocked = () => {
    setSessionUnlocked(true);
    onUnlocked?.();
  };

  // Face ID: 켜 두었으면 열자마자 한 번
  const bioOn = lock.biometricOn;
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getBiometricInfo().then((info) => {
      if (cancelled) return;
      setBio(info);
      if (info.available && bioOn) {
        void authenticateBiometric("잠긴 내용을 열어요").then((ok) => !cancelled && ok && unlocked());
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 열릴 때 한 번
  }, [open]);

  // 기다리는 동안 남은 시간
  useEffect(() => {
    if (waitUntil <= Date.now()) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= waitUntil) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [waitUntil]);
  const waiting = waitUntil > now;

  const submit = async (pin: string) => {
    setChecking(true);
    const r = await lock.verify(pin);
    setChecking(false);
    setValue("");
    if (r.ok) {
      setMessage(null);
      onUnlocked?.();
      return;
    }
    if (r.waitMs > 0) {
      setWaitUntil(Date.now() + r.waitMs);
      setNow(Date.now());
      setMessage(null);
    } else {
      setMessage(r.fails >= 3 ? `PIN이 맞지 않아요 · ${r.fails}번 틀렸어요` : "PIN이 맞지 않아요");
    }
  };

  const change = (next: string) => {
    setValue(next);
    if (message) setMessage(null);
    if (next.length === lock.pinLength) void submit(next);
  };

  if (!open) return null;

  return (
    <Portal>
      <OverlayLayerProvider value={LOCK_Z + 20}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          // eslint-disable-next-line pib-v2/no-arbitrary-values -- 잠금 화면 층(200): 시트 · 겹 화면 위, 처리 중 화면(210) 아래
          className="pib-v2 pib-v2-overlay pib-safe-top fixed inset-0 z-[200] flex flex-col"
        >
          <div aria-hidden="true" className="absolute inset-0 bg-canvas" />
          <div className="relative flex h-11 shrink-0 items-center px-2">
            {onCancel && (
              <IconButton label={cancelLabel} onClick={onCancel}>
                {cancelLabel === "뒤로" ? <IconChevronLeft size={22} stroke={1.9} /> : <IconX size={22} stroke={1.9} />}
              </IconButton>
            )}
          </div>
          <div className="pb-safe-8 relative flex min-h-0 flex-1 flex-col items-center justify-center gap-8 overflow-y-auto px-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-fill text-ink">
                <IconLock size={22} stroke={1.9} aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="m-0 text-heading font-bold">{title}</h2>
                {name && <p className="m-0 max-w-72 truncate text-caption text-sub">{name}</p>}
              </div>
              <p className={cx("m-0 min-h-5 text-caption", message || waiting ? "text-alert" : "text-sub")} aria-live="polite">
                {waiting ? waitLabel(waitUntil - now) : message ?? `PIN ${lock.pinLength}자리를 입력해 주세요`}
              </p>
            </div>
            <PinPad length={lock.pinLength} value={value} onChange={change} disabled={checking || waiting} active={!forgotOpen} />
            <div className="flex flex-col items-center gap-1">
              {bio.available && bioOn && (
                <Button variant="text" size="sm" leading={<BiometricIcon type={bio.type} />} onClick={() => void authenticateBiometric("잠긴 내용을 열어요").then((ok) => ok && unlocked())}>
                  {biometricLabel(bio.type)}로 열기
                </Button>
              )}
              <button type="button" onClick={() => setForgotOpen(true)} className="h-11 bg-transparent px-3 text-caption font-semibold text-sub active:opacity-60">
                PIN을 잊었어요
              </button>
            </div>
          </div>
          <ForgotPinSheet
            open={forgotOpen}
            onClose={() => setForgotOpen(false)}
            onDone={() => {
              setForgotOpen(false);
              onUnlocked?.();
            }}
          />
        </div>
      </OverlayLayerProvider>
    </Portal>
  );
}

// ---- PIN 만들기 · 바꾸기 ---------------------------------------------------------------------

export function PinSetupSheet({
  open,
  mode,
  onClose,
  onDone,
}: {
  open: boolean;
  mode: "create" | "change" | "reset";
  onClose: () => void;
  onDone: (next: PrivateLock) => void;
}) {
  const lock = usePrivateLock();
  const [length, setLength] = useState<PinLength>(DEFAULT_PIN_LENGTH);
  const [first, setFirst] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openedAt, setOpenedAt] = useState(false);
  if (open !== openedAt) {
    setOpenedAt(open);
    if (open) {
      setLength(mode === "create" ? DEFAULT_PIN_LENGTH : lock.pinLength);
      setFirst(null);
      setValue("");
      setMessage(null);
    }
  }

  const change = async (next: string) => {
    setValue(next);
    if (message) setMessage(null);
    if (next.length < length) return;
    if (first === null) {
      setFirst(next);
      setValue("");
      return;
    }
    if (next !== first) {
      setFirst(null);
      setValue("");
      setMessage("PIN이 서로 달라요. 처음부터 다시 입력해 주세요");
      return;
    }
    setSaving(true);
    try {
      const saved = await lock.savePin(next, length);
      onDone(saved);
    } finally {
      setSaving(false);
    }
  };

  const title = mode === "create" ? "잠금 PIN 만들기" : mode === "change" ? "PIN 바꾸기" : "새 PIN 만들기";
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col items-center gap-6 pb-2">
        <div className="flex w-full flex-col gap-3">
          <p className={cx("m-0 text-center text-body", message ? "text-alert" : "text-ink")} aria-live="polite">
            {message ?? (first === null ? `숫자 ${length}자리를 정해 주세요` : "한 번 더 입력해 주세요")}
          </p>
          {first === null && (
            <SegmentedControl
              label="PIN 자리 수"
              options={[
                { value: "6", label: "6자리" },
                { value: "4", label: "4자리" },
              ]}
              value={String(length) as "4" | "6"}
              onChange={(v) => {
                setLength(Number(v) as PinLength);
                setValue("");
              }}
              className="mx-auto w-full max-w-60"
            />
          )}
        </div>
        <PinPad length={length} value={value} onChange={(v) => void change(v)} disabled={saving} active={open} />
        <p className="m-0 text-center text-micro text-faint">
          같은 계정이면 모든 기기에서 이 PIN으로 열어요. 함께 쓰는 사람에게는 잠금이 보이지 않아요.
        </p>
      </div>
    </Sheet>
  );
}

// ---- PIN을 잊었을 때: 본인 확인 → 새 PIN -------------------------------------------------------

function ForgotPinSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { user, reauthenticate } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const usesPassword = (user?.providerData ?? []).some((p) => p.providerId === "password");

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      await reauthenticate(usesPassword ? password : undefined);
      setPassword("");
      onClose();
      setSetupOpen(true);
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
      setError(
        code.includes("wrong-password") || code.includes("invalid-credential")
          ? "비밀번호가 맞지 않아요"
          : code.includes("popup-closed") || code.includes("cancel")
            ? "로그인을 마치지 않았어요"
            : "본인 확인을 하지 못했어요. 잠시 후 다시 해 주세요",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title="PIN 다시 만들기"
        footer={
          <Button block disabled={busy || (usesPassword && !password)} onClick={() => void verify()}>
            {busy ? "확인하는 중…" : usesPassword ? "확인" : "다시 로그인하고 계속"}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="m-0 text-body text-sub">
            {usesPassword ? "계정 비밀번호로 본인인지 확인한 뒤 새 PIN을 만들어요." : "계정에 다시 로그인해 본인인지 확인한 뒤 새 PIN을 만들어요."} 잠가 둔 가방 · 팩은 그대로 잠겨 있어요.
          </p>
          {usesPassword && (
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && password && void verify()}
              aria-label="계정 비밀번호"
              placeholder="계정 비밀번호"
              className="h-12 rounded-field border border-line bg-card px-4 text-body outline-none focus:border-ink"
            />
          )}
          {error && <p className="m-0 text-caption text-alert">{error}</p>}
        </div>
      </Sheet>
      <PinSetupSheet
        open={setupOpen}
        mode="reset"
        onClose={() => setSetupOpen(false)}
        onDone={() => {
          setSetupOpen(false);
          onDone();
        }}
      />
    </>
  );
}

// ---- 잠금 문: 감싼 화면이 잠겨 있으면 위를 덮는다(보관함 팩 · 메모 편집기) -----------------------------

export function PrivateLockGate({
  locked,
  title,
  name,
  onBack,
  children,
}: {
  locked: boolean;
  title: string;
  name?: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const lock = usePrivateLock();
  return (
    <>
      {children}
      <LockScreen open={locked && !lock.unlocked} title={title} name={name} onCancel={onBack} cancelLabel="뒤로" />
    </>
  );
}

// ---- 잠그기 · 풀기 도우미 ------------------------------------------------------------------------
// 잠그거나 풀 때는 PIN을 확인한다(지금 풀려 있으면 바로). PIN이 아직 없으면 먼저 만든다.
// element를 화면 어딘가에 그려 둬야 한다

const KIND_WORD: Record<LockKind, string> = { bag: "가방", pack: "팩", library: "팩" };

export function useLockGuard() {
  const lock = usePrivateLock();
  const { show } = useToast();
  const [unlockReq, setUnlockReq] = useState<{ title: string; name?: string; run: () => void } | null>(null);
  const [setupReq, setSetupReq] = useState<{ run: (next: PrivateLock) => void } | null>(null);

  const requireUnlock = (run: () => void, opts?: { title?: string; name?: string }) => {
    if (!lock.hasPin || lock.unlocked) {
      run();
      return;
    }
    setUnlockReq({ title: opts?.title ?? "PIN을 입력해 주세요", name: opts?.name, run });
  };

  const toggleLock = (kind: LockKind, id: string, on: boolean, opts?: { name?: string; memo?: boolean }) => {
    const word = opts?.memo ? "메모" : KIND_WORD[kind];
    if (on && !lock.hasPin) {
      setSetupReq({
        run: (next) => {
          void lock.setLocked(kind, id, true, next);
          show(`${word}을(를) 잠갔어요. 앱을 나갔다 오면 PIN으로 열어요`);
        },
      });
      return;
    }
    requireUnlock(
      () => {
        void lock.setLocked(kind, id, on);
        show(on ? `${word}을(를) 잠갔어요. 앱을 나갔다 오면 PIN으로 열어요` : `${word} 잠금을 풀었어요`);
      },
      { title: on ? `${word} 잠그기` : `${word} 잠금 풀기`, name: opts?.name },
    );
  };

  const element = (
    <>
      <LockScreen
        open={!!unlockReq}
        title={unlockReq?.title ?? ""}
        name={unlockReq?.name}
        onUnlocked={() => {
          const r = unlockReq;
          setUnlockReq(null);
          r?.run();
        }}
        onCancel={() => setUnlockReq(null)}
      />
      <PinSetupSheet
        open={!!setupReq}
        mode="create"
        onClose={() => setSetupReq(null)}
        onDone={(next) => {
          const r = setupReq;
          setSetupReq(null);
          r?.run(next);
        }}
      />
    </>
  );

  return { ...lock, requireUnlock, toggleLock, element };
}
