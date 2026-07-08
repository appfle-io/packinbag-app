"use client";

import { FAQ_ITEMS } from "@/lib/faqs";
import AccordionModal from "@/components/AccordionModal";

export default function FaqModal({ onClose }: { onClose: () => void }) {
  return (
    <AccordionModal
      title="자주 묻는 질문"
      onClose={onClose}
      items={FAQ_ITEMS.map((f) => ({
        id: f.id,
        title: f.question,
        content: f.answer,
        groupLabel: f.category,
      }))}
    />
  );
}
