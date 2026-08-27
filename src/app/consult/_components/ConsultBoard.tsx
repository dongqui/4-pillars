"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PersonOption } from "@/lib/profiles/option";
import { MAX_UTTERANCE_CHARS } from "@/lib/consultations/input";
import { TicketModal } from "./TicketModal";
import { SubjectSelect } from "./SubjectSelect";

interface Props {
  /** 상담이 근거로 삼는 사람. 서버가 ?profile 또는 계정의 "나" 로 확정해서 넘긴다 */
  profileId: string;
  /** 셀렉터에 서는 저장된 사람 전부. 로그인 필수 페이지라 최소 한 줄은 있다 */
  people: PersonOption[];
  balance: number;
  isEmpty: boolean;
  /** 서버에서 그린 상담 목록. 비어 있으면 대신 빈 상태를 그린다 */
  children: ReactNode;
}

/**
 * 목록 화면에서 손이 닿는 부분 전부 — 머리글 · 사주 셀렉터 · 새 상담 · 빈 상태 ·
 * 이용권 모달.
 *
 * 한 컴포넌트인 이유는 이들이 상태 하나(패널이 열렸는지)를 같이 보기 때문이다.
 * 머리글의 "+ 새 상담" 과 빈 상태의 "상담 시작하기" 는 같은 버튼이고, 둘 다
 * 이용권이 없으면 패널 대신 모달을 연다.
 *
 * 목록 자체는 서버에서 그려 children 으로 받는다 — 여기서 다시 그리면 상담 목록
 * 조회가 통째로 클라이언트로 넘어온다.
 */
export function ConsultBoard({ profileId, people, balance, isEmpty, children }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startNew() {
    // 서버가 그려 준 잔액으로 먼저 막는다. 이 값이 낡았어도 아래 402 갈래가 받는다.
    if (balance < 1) {
      setModal(true);
      return;
    }
    setOpen(true);
  }

  async function submit() {
    const trimmed = text.trim();
    if (trimmed.length === 0 || pending) return;
    setPending(true);
    setError(null);

    try {
      const res = await fetch(`/api/consultations?profile=${encodeURIComponent(profileId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const json = await res.json();

      if (!res.ok) {
        // 402 는 이용권이 없다는 뜻이라 문구가 아니라 살 곳을 줘야 한다.
        if (res.status === 402) {
          setModal(true);
          return;
        }
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none border-b border-slate-100 px-[clamp(16px,4vw,22px)] pb-3.5 pt-[22px] min-[900px]:px-[26px] min-[900px]:pb-[18px] min-[900px]:pt-[26px]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1.5 text-[11.5px] font-bold tracking-[0.08em] text-slate-400">
              CONSULT
            </div>
            <h1 className="text-[20px] font-bold tracking-[-0.03em]">고민상담</h1>
          </div>
          <button
            type="button"
            onClick={startNew}
            className="flex h-[38px] flex-none items-center gap-1.5 whitespace-nowrap rounded-[11px] bg-accent px-[15px] text-[14px] font-semibold text-white hover:bg-accent-700"
          >
            <span aria-hidden className="text-[16px] font-normal leading-none">
              +
            </span>
            새 상담
          </button>
        </div>
        {/* 로그인을 요구하는 페이지라 null 갈래가 없다 — 0장일 때도 보여준다,
            없다는 사실이 곧 충전 유인이다. 시안은 문장이지만 링크로 둔다:
            모달은 새 상담을 눌러야 뜨므로 여기까지 죽어 있으면 충전할 길이 멀어진다. */}
        <Link
          href="/checkout?next=/consult"
          className="mt-3.5 flex w-fit items-center gap-[7px] text-[13px] font-medium"
        >
          <span className="text-slate-500">이용권</span>
          <span className="font-bold tabular-nums text-slate-900">{balance}장</span>
          <span aria-hidden className="text-slate-300">
            ·
          </span>
          <span className="text-slate-400">상담 1건에 1장</span>
        </Link>

        {/* 상담사가 누구의 원국을 근거로 말하는지 — 시안이 머리글에 세워 둔 자리다 */}
        <SubjectSelect people={people} selectedId={profileId} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {open ? (
          <div className="flex-none border-b border-slate-100 px-[clamp(16px,4vw,22px)] py-4 min-[900px]:px-[26px]">
            <p className="mb-3 text-[15px] font-bold tracking-[-0.025em]">무슨 고민이 있으세요?</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              // 서버의 zod 검증이 실제 방어선이다. 이건 편의일 뿐이다.
              maxLength={MAX_UTTERANCE_CHARS}
              rows={4}
              autoFocus
              aria-label="고민 입력"
              placeholder="고민을 자유롭게 적어보세요"
              className="w-full resize-none rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] leading-[1.5] text-slate-900 outline-none placeholder:text-slate-400 focus:border-accent focus:bg-white"
            />
            {error && (
              <p role="alert" className="mt-2 text-[13px] text-amber-700">
                {error}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="h-12 flex-none rounded-[14px] px-4 text-[14.5px] font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending || text.trim().length === 0}
                className="h-12 flex-1 rounded-[14px] bg-accent text-[15.5px] font-bold tracking-[-0.02em] text-white hover:bg-accent-700 disabled:opacity-40"
              >
                {pending ? "상담사를 부르고 있어요…" : "이용권 1장으로 시작하기"}
              </button>
            </div>
          </div>
        ) : (
          isEmpty && <EmptyState onStart={startNew} />
        )}
        {!isEmpty && children}
      </div>

      {modal && <TicketModal balance={balance} onClose={() => setModal(false)} />}
    </div>
  );
}

/** 시안의 빈 상태. 아이콘은 "정리된 몇 줄"을 뜻한다 — 마지막 줄만 강조색이다 */
function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-7 pb-[72px] pt-14 text-center">
      <div className="mb-5 flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <span aria-hidden className="flex flex-col items-start gap-[3.5px]">
          <span className="h-[2.5px] w-[18px] rounded-sm bg-slate-300" />
          <span className="h-[2.5px] w-[12px] rounded-sm bg-slate-300" />
          <span className="h-[2.5px] w-[15px] rounded-sm bg-accent" />
        </span>
      </div>
      <p className="mb-2 text-[18px] font-bold tracking-[-0.03em]">아직 받은 상담이 없어요</p>
      <p className="mb-6 max-w-[300px] text-[14.5px] leading-[1.6] text-slate-500 [text-wrap:pretty]">
        지금 고민하는 걸 그대로 적어보세요. 사주를 근거로 답을 정리해 드립니다.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="h-12 rounded-[14px] bg-accent px-6 text-[15.5px] font-bold tracking-[-0.02em] text-white hover:bg-accent-700"
      >
        상담 시작하기
      </button>
    </div>
  );
}
