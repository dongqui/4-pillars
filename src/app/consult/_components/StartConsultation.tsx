"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_UTTERANCE_CHARS } from "@/lib/consultations/input";

interface Props {
  /** 홈에서 따라온 프로필. 없으면 계정의 첫 프로필로 연다 */
  profileId?: string;
}

export function StartConsultation({ profileId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    const trimmed = text.trim();
    if (trimmed.length === 0 || pending) return;
    setPending(true);
    setError(null);

    try {
      const query = profileId ? `?profile=${encodeURIComponent(profileId)}` : "";
      const res = await fetch(`/api/consultations${query}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "상담을 시작하지 못했어요");
        return;
      }
      router.push(`/consult/${json.consultation.id}`);
    } catch {
      setError("연결이 끊겼어요. 다시 시도해 주세요");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-[18px] border border-dashed border-slate-300 py-4 text-[14.5px] font-bold text-slate-500"
      >
        + 새 상담 시작하기
      </button>
    );
  }

  return (
    <div className="rounded-[18px] border border-slate-200 p-4">
      <p className="mb-3 text-[15px] font-bold tracking-[-0.02em]">무슨 고민이 있으세요?</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_UTTERANCE_CHARS}
        rows={4}
        autoFocus
        aria-label="고민 입력"
        placeholder="편하게 적어 주세요"
        className="w-full resize-none rounded-xl bg-slate-100 px-3.5 py-3 text-[14.5px] leading-[1.55] outline-none placeholder:text-slate-400"
      />
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-amber-700">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={start}
        disabled={pending || text.trim().length === 0}
        className="mt-3 w-full rounded-full bg-accent py-3 text-sm font-bold text-white disabled:opacity-40"
      >
        {pending ? "상담사를 부르고 있어요…" : "이용권 1장으로 시작하기"}
      </button>
    </div>
  );
}
