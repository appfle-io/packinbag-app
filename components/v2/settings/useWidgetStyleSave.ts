"use client";

// 가방 바로가기 꾸미기 저장(2026-11-01, 1.12에 WidgetStylesScreen에서 뗌). 목록 화면과 투명 위젯 따라 하기가 같이 쓴다
import { useMemo, useState } from "react";
import type { WidgetStyle } from "@/lib/types";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/components/Toast";
import { isPremiumUser } from "@/lib/premiumLimits";
import {
  FREE_WIDGET_STYLES,
  MAX_WIDGET_STYLES,
  deleteWidgetPhoto,
  normalizeWidgetStyle,
  uploadWidgetPhoto,
} from "@/lib/v2/widgetStyles";

export function useWidgetStyleSave() {
  const { user, profile, updateWidgetStyles } = useAuth();
  const { show } = useToast();
  const premium = isPremiumUser(profile?.email, profile);
  const styles = useMemo(() => profile?.widgetStyles ?? [], [profile?.widgetStyles]);
  const [saving, setSaving] = useState(false);

  const canAdd = styles.length < (premium ? MAX_WIDGET_STYLES : FREE_WIDGET_STYLES);
  const limitMessage = premium ? `꾸미기는 ${MAX_WIDGET_STYLES}개까지 저장할 수 있어요` : "무료는 꾸미기 1개까지예요. 여러 개는 프리미엄이에요";

  // 저장했으면 true. 새 꾸미기 · 고친 꾸미기 둘 다(id로 구분)
  const save = async (draft: WidgetStyle, photo: Blob | null): Promise<boolean> => {
    if (!user || saving) return false;
    setSaving(true);
    const before = styles.find((s) => s.id === draft.id) ?? null;
    let uploaded: { url: string; path: string } | null = null;
    try {
      let next = draft;
      if (premium && draft.bg === "photo" && photo) {
        uploaded = await uploadWidgetPhoto(user.uid, draft.id, photo);
        next = { ...next, photoUrl: uploaded.url, photoPath: uploaded.path };
      }
      next = normalizeWidgetStyle(next, premium);
      // 사진 배경이 아니면 사진은 떼어 낸다(아래에서 Storage도 지움)
      if (next.bg !== "photo") next = { ...next, photoUrl: undefined, photoPath: undefined };
      const list = before ? styles.map((s) => (s.id === next.id ? next : s)) : [...styles, next];
      await updateWidgetStyles(list);
      if (before?.photoPath && before.photoPath !== next.photoPath) void deleteWidgetPhoto(before.photoPath);
      show(before ? "꾸미기를 저장했어요" : "꾸미기를 만들었어요. 홈 화면 위젯을 길게 눌러 골라 주세요");
      return true;
    } catch (err) {
      console.error("[팩인백] 위젯 꾸미기 저장 실패:", err);
      // 올린 사진은 쓰지 않게 됐으니 지운다
      if (uploaded) void deleteWidgetPhoto(uploaded.path);
      show("저장하지 못했어요. 인터넷 연결을 확인해 주세요");
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { premium, styles, saving, setSaving, canAdd, limitMessage, save };
}
