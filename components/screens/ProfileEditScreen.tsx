"use client";

import { useState } from "react";
import { IconArrowLeft, IconRefresh } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthProvider";
import { useSwipeBack } from "@/lib/useSwipeBack";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import { randomNickname } from "@/lib/nickname";
import { friendlyAuthError } from "@/lib/authErrorMessage";
import Avatar from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import DeleteAccountDialog from "@/components/DeleteAccountDialog";

export default function ProfileEditScreen({ onBack }: { onBack: () => void }) {
  const { user, profile, updateNickname, updateAvatar, changePassword, logout, deleteAccount } =
    useAuth();
  const { show } = useToast();
  const swipeBackRef = useSwipeBack<HTMLDivElement>(onBack);
  const [nicknameDraft, setNicknameDraft] = useState(profile?.nickname ?? "");
  const [avatarDraft, setAvatarDraft] = useState(profile?.avatarId ?? AVATAR_OPTIONS[0].id);
  const [saving, setSaving] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

  const isPasswordAccount = !!user?.providerData.some((p) => p.providerId === "password");
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const dirty =
    nicknameDraft.trim() !== (profile?.nickname ?? "") ||
    avatarDraft !== (profile?.avatarId ?? "");

  const handleSave = async () => {
    const value = nicknameDraft.trim().slice(0, 12);
    if (!value) return;
    setSaving(true);
    try {
      if (value !== profile?.nickname) await updateNickname(value);
      if (avatarDraft !== profile?.avatarId) await updateAvatar(avatarDraft);
      show("프로필을 저장했어요");
      onBack();
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    if (newPassword.length < 6) {
      setPasswordError("새 비밀번호는 6자 이상이어야 해요.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordError("새 비밀번호가 서로 달라요.");
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      show("비밀번호를 변경했어요");
      setShowPasswordChange(false);
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (err) {
      setPasswordError(friendlyAuthError(err instanceof Error ? err.message : ""));
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div ref={swipeBackRef} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 pb-2 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1">
          <IconArrowLeft size={20} stroke={1.75} />
        </button>
        <p className="text-[15px] font-medium">프로필 수정</p>
        <button
          onClick={handleSave}
          disabled={!dirty || saving || !nicknameDraft.trim()}
          className="rounded-lg px-3 py-1.5 text-[13px] font-medium disabled:opacity-40"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          저장
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 pt-2">
          <Avatar avatarId={avatarDraft} size={72} />
          <p className="text-[12px] text-text-secondary">{profile?.email}</p>
        </div>

        <div>
          <p className="text-[12px] text-text-secondary mb-2">닉네임</p>
          <div className="flex items-center gap-1.5">
            <input
              value={nicknameDraft}
              onChange={(e) => setNicknameDraft(e.target.value.slice(0, 12))}
              placeholder="닉네임 (12자 이내)"
              maxLength={12}
              className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none"
            />
            <button
              onClick={() => setNicknameDraft(randomNickname())}
              aria-label="닉네임 새로 추천받기"
              className="rounded-lg border border-border p-2 shrink-0"
            >
              <IconRefresh size={15} stroke={1.75} />
            </button>
          </div>
        </div>

        <div>
          <p className="text-[12px] text-text-secondary mb-2">캐릭터</p>
          <div className="grid grid-cols-6 gap-2">
            {AVATAR_OPTIONS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAvatarDraft(a.id)}
                className="rounded-full p-0.5"
                style={{
                  boxShadow: avatarDraft === a.id ? "0 0 0 2px var(--accent)" : "none",
                }}
              >
                <Avatar avatarId={a.id} size={34} />
              </button>
            ))}
          </div>
        </div>

        {isPasswordAccount && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] text-text-secondary">비밀번호</p>
              {!showPasswordChange && (
                <button
                  onClick={() => setShowPasswordChange(true)}
                  className="rounded-lg border px-2.5 py-1 text-[11px] font-medium shrink-0"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--accent)",
                  }}
                >
                  변경하기
                </button>
              )}
            </div>

            {showPasswordChange && (
              <div className="flex flex-col gap-2">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="현재 비밀번호"
                  className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="새 비밀번호 (6자 이상)"
                  minLength={6}
                  className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none"
                />
                <input
                  type="password"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  placeholder="새 비밀번호 확인"
                  minLength={6}
                  className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none"
                />
                {passwordError && (
                  <p className="text-[11px]" style={{ color: "var(--danger)" }}>
                    {passwordError}
                  </p>
                )}
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => {
                      setShowPasswordChange(false);
                      setPasswordError("");
                      setCurrentPassword("");
                      setNewPassword("");
                      setNewPasswordConfirm("");
                    }}
                    className="flex-1 rounded-lg border border-border py-2 text-[13px]"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleChangePassword}
                    disabled={
                      changingPassword || !currentPassword || !newPassword || !newPasswordConfirm
                    }
                    className="flex-1 rounded-lg py-2 text-[13px] font-medium disabled:opacity-50"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    {changingPassword ? "변경 중..." : "변경하기"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 flex flex-col items-center gap-2 pt-4" style={{ paddingBottom: 56 }}>
        <button
          onClick={logout}
          className="rounded-lg border px-4 py-1.5 text-[12px]"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface-2)",
            color: "var(--text-secondary)",
          }}
        >
          로그아웃
        </button>
        <button
          onClick={() => setShowDeleteAccount(true)}
          className="rounded-lg border px-4 py-1.5 text-[11px]"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          회원 탈퇴
        </button>
      </div>

      {showDeleteAccount && (
        <DeleteAccountDialog
          nickname={profile?.nickname ?? ""}
          onCancel={() => setShowDeleteAccount(false)}
          onConfirm={async () => {
            await deleteAccount();
            setShowDeleteAccount(false);
          }}
        />
      )}
    </div>
  );
}
