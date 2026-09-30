"use client";

import { useCallback, useState } from "react";
import { uploadBagImage, deleteBagImage } from "@/lib/storageService";
import { FREE_MAX_USER_BAG_IMAGES, MAX_BAG_IMAGES } from "@/lib/premiumLimits";
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

// 가방 사진·파일 첨부. 구 BagEditorScreen의 handleAddImages / removeImage와 같은 규칙:
// 무료는 1장, 프리미엄 5장, PDF 등 이미지가 아닌 파일은 프리미엄 전용 + 10MB 이하.
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

      if (!premium && bag.images.length >= FREE_MAX_USER_BAG_IMAGES) {
        onPremiumRequired(
          `무료 회원은 가방 사진을 최대 ${FREE_MAX_USER_BAG_IMAGES}장까지 첨부할 수 있어요. 사진을 더 추가하려면 이용권 코드를 등록해주세요.`,
        );
        return;
      }
      const maxAllowed = premium ? MAX_BAG_IMAGES : FREE_MAX_USER_BAG_IMAGES;
      const selected = list.slice(0, Math.max(0, maxAllowed - bag.images.length));
      const isNonImage = (f: File) => !f.type.startsWith("image/");
      const nonImages = selected.filter(isNonImage);
      const toUpload = premium ? selected : selected.filter((f) => !isNonImage(f));
      if (nonImages.length > 0 && !premium) {
        onPremiumRequired("이미지가 아닌 파일(PDF 포함) 첨부/열기는 프리미엄 전용 기능이에요. 이용권 코드를 등록하면 바로 쓸 수 있어요.");
      }
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

  const removeImage = useCallback(
    (index: number) => {
      if (guard()) return;
      const url = bag.images[index];
      update((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
      if (!offline && url) deleteBagImage(url);
    },
    [guard, bag.images, update, offline],
  );

  return { uploading, addFiles, removeImage };
}