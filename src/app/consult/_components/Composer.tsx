"use client";

import { useState } from "react";
import { MAX_UTTERANCE_CHARS } from "@/lib/consultations/input";

interface Props {
  disabled: boolean;
  onSend: (text: string) => void;
}

export function Composer({ disabled, onSend }: Props) {
  const [text, setText] = useState("");
  const trimmed = text.trim();
  const canSend = !disabled && trimmed.length > 0;

  function send() {
    if (!canSend) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="flex-none border-t border-slate-100 bg-white px-[clamp(16px,4vw,28px)] pb-[max(16px,env(safe-area-inset-bottom))] pt-3 min-[900px]:pb-[18px]">
      <div className="mx-auto flex max-w-[640px] items-end gap-[9px]">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Shift+Enter 는 줄바꿈. 고민을 여러 줄로 쓰는 사람이 많다.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          // 서버의 zod 검증이 실제 방어선이다. 이건 편의일 뿐이다.
          maxLength={MAX_UTTERANCE_CHARS}
          rows={1}
          disabled={disabled}
          placeholder="고민을 자유롭게 적어보세요"
          aria-label="질문 입력"
          className="h-12 max-h-[120px] min-w-0 flex-1 resize-none rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-[13px] text-[15px] leading-[1.45] text-slate-900 outline-none placeholder:text-slate-400 focus:border-accent focus:bg-white disabled:opacity-50"
        />
        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          aria-label="보내기"
          className={`flex h-12 w-12 flex-none items-center justify-center rounded-[14px] transition-colors ${
            canSend ? "bg-accent text-white" : "bg-slate-100 text-slate-400"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 12h13M12.5 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
