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

  function send() {
    if (disabled || trimmed.length === 0) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="flex items-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
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
        placeholder="질문을 입력하세요"
        aria-label="질문 입력"
        className="max-h-32 flex-1 resize-none rounded-[20px] bg-slate-100 px-4 py-2.5 text-[14.5px] outline-none placeholder:text-slate-400 disabled:opacity-50"
      />
      <button
        type="button"
        onClick={send}
        disabled={disabled || trimmed.length === 0}
        aria-label="보내기"
        className="h-10 w-10 flex-none rounded-full bg-accent text-white transition-opacity disabled:opacity-30"
      >
        ↑
      </button>
    </div>
  );
}
