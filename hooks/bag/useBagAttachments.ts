"use client";

import { useCallback, useState } from "react";
import { uploadBagImage } from "@/lib/storageService";
import { deleteBagAttachmentIfUnused } from "@/lib/storageCleanup";
import { ATTACH_PREMIUM_MESSAGE, MAX_BAG_IMAGES } from "@/lib/premiumLimits";
import { useToast } from "@/components/Toast";
import type { BagDocument } from "./useBagDocument";

const MAX_NON_IMAGE_BYTES = 10 * 1024 * 1024;

export interface BagAttachmentsOptions {
  doc: BagDocument;
  premium: boolean;
  offline: boolean;
  // 프리미엄 안내가 필요할 때 화면이 PremiumLimitModal을 띄운다
  onPremiumRequired: (message: string) => void;
}

// 가방 사진·파일 첨부. 무료는 첨부 없음(2026-10-21), 프리미엄 5장, 이미지가 아닌 파일은 10MB 이하.
// 오프라인(포터블)에서는 data URL로 가방 문서에 바로 넣는다.
export function useBagAttachments({ doc, premium, offline, onPremiumRequired }: BagAttachmentsOptions) {
  const { bag, update, guard } = doc;
  const { show } = useToast();
  const [uploading, setUploading] = useState(false);

  const addFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (guard()) return;
      const list = files ? Array.from(files) : [];
      if (list.length === 0) return;

      // 무료는 첨부 없음(2026-10-21, 예전 1장). 오프라인 모드는 premium이 true
      if (!premium) {
        onPremiumRequired(ATTACH_PREMIUM_MESSAGE);
        return;
      }
      const selected = list.slice(0, Math.max(0, MAX_BAG_IMAGES - bag.images.length));
      const isNonImage = (f: File) => !f.type.startsWith("image/");
      const toUpload = selected;
      if (toUpload.length === 0) return;
      if (toUpload.some((f) => isNonImage(f) && f.size > MAX_NON_IMAGE_BYTES)) {
        show("이미지가 아닌 파일은 10MB 이하만 첨부할 수 있어요");
        return;
      }

      setUploading(true);
      try {
        let urls: string[];
        if (offline) {
          urls = await Promise.all(
            toUpload.map(
              (file) =>
                new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(file);
                }),
            ),
          );
        } else {
          urls = await Promise.all(toUpload.map((f) => uploadBagImage(bag.id, f)));
        }
        update((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
      } catch {
        show(offline ? "파일을 불러오지 못했어요" : "이미지 업로드에 실패했어요");
      } finally {
        setUploading(false);
      }
    },
    [guard, premium, offline, bag.images.length, bag.id, update, show, onPremiumRequired],
  );

  // 가방 화면 첨부 줄의 X(2026-10-14). 화면에서 바로 빼고, 다른 곳이 쓰지 않는 파일만 Storage에서 지운다.
  // 인덱스가 아니라 URL로 찾는다 - 확인 시트를 띄운 사이 다른 멤버가 사진을 넣거나 빼도 엉뚱한 걸 지우지 않게
  const removeImage = useCallback(
    (url: string) => {
      if (guard()) return;
      if (!bag.images.includes(url)) return;
      update((prev) => ({ ...prev, images: prev.images.filter((u) => u !== url) }));
      if (!offline) void deleteBagAttachmentIfUnused(bag.id, url);
      show("첨부를 삭제했어요");
    },
    [guard, bag.images, bag.id, update, offline, show],
  );

  return { uploading, addFiles, removeImage };
}