"use client";

import { useState } from "react";

export default function EditableText({
  value,
  onChange,
  className,
  inputClassName,
  placeholder,
  readOnly,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  // true = read-only mode. Used for locked bags/packs.
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => {
          setEditing(false);
          if (draft.trim()) onChange(draft.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={inputClassName ?? className}
        style={{
          borderBottom: "1px dashed var(--border-strong)",
          background: "transparent",
          outline: "none",
        }}
      />
    );
  }

  return (
    <button
      onClick={
        readOnly
          ? undefined
          : () => {
              setDraft(value);
              setEditing(true);
            }
      }
      className={className}
      style={readOnly ? { cursor: "default" } : undefined}
    >
      {value || placeholder}
    </button>
  );
}
