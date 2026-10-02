"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  BODY_MAX,
  REFUND_REASONS,
  canSubmit,
  formatOptionDate,
  serviceKey,
  type RefundReason,
  type ServiceTarget,
  type SupportKind,
  type SupportOptions,
} from "@/lib/support/types";
import { isOutsideRect } from "./backdrop";

interface Copy {
  title: string;
  desc: string;
  picker: string | null;
  textLabel: string;
  placeholder: string;
  submit: string;
  sentTitle: string;
  sentDesc: string;
}

/** 시안(Saju Home.dc.html) 문구 그대로. */
const COPY: Record<SupportKind, Copy> = {
  error: {
    title: "오류 문의",
    desc: "문제가 생긴 서비스를 고르고 상황을 알려주세요.",
    picker: "문제가 생긴 서비스",
    textLabel: "자세한 설명",
    placeholder: "어떤 화면에서 어떤 문제가 있었는지 적어주세요.",
    submit: "문의 보내기",
    sentTitle: "문의가 접수되었어요",
    sentDesc: "확인 후 가입하신 이메일로 답변드릴게요.",
  },
  feedback: {
    title: "피드백 보내기",
    desc: "좋았던 점, 아쉬운 점 무엇이든 들려주세요.",
    picker: null,
    textLabel: "내용",
    placeholder: "자유롭게 적어주세요.",
    submit: "피드백 보내기",
    sentTitle: "피드백 고마워요",
    sentDesc: "보내주신 의견은 서비스 개선에 참고할게요.",
  },
  refund: {
    title: "환불 요청",
    desc: "환불받을 결제 내역을 선택해 주세요.",
    picker: "결제 내역",
    textLabel: "추가 설명 (선택)",
    placeholder: "필요하면 상황을 덧붙여 주세요.",
    submit: "환불 요청하기",
    sentTitle: "환불 요청이 접수되었어요",
    sentDesc: "영업일 기준 3일 안에 처리 결과를 알려드릴게요.",
  },
};

interface Row {
  key: string;
  title: string;
  sub: string;
  meta: string;
  disabled: boolean;
  target?: ServiceTarget;
}

type Loaded =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; rows: Row[]; balance: number | null };

/** 응답 → 화면 줄. 날짜 메타를 여기서(받는 순간) 계산해 렌더를 순수하게 둔다. */
function toRows(o: SupportOptions, now: Date): { rows: Row[]; balance: number | null } {
  if (o.kind === "error") {
    return {
      rows: o.items.map((it) => ({
        key: serviceKey(it.target),
        title: it.title,
        sub: it.sub,
        meta: formatOptionDate(it.createdAt, now),
        disabled: false,
        target: it.target,
      })),
      balance: null,
    };
  }
  return {
    rows: o.items.map((it) => ({
      key: it.purchaseId,
      title: it.title,
      sub: it.sub,
      meta: it.requested ? "요청됨" : formatOptionDate(it.createdAt, now),
      disabled: it.requested,
    })),
    balance: o.balance,
  };
}

const FAIL = "보내지 못했어요. 잠시 후 다시 시도해 주세요.";

/**
 * 헤더 ⋯ 메뉴의 오류 문의 · 피드백 · 환불 요청 모달. 열려 있는 동안만 마운트한다.
 *
 * <dialog>.showModal() 을 쓰는 이유는 LeaveConfirmDialog 와 같다(top layer, 포커스 트랩, Esc).
 * 760px 미만은 아래에서 올라오는 시트, 이상은 가운데 카드 — 시안의 mobile 분기와 같은 경계다.
 */
export function SupportDialog({ kind, onClose }: { kind: SupportKind; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const copy = COPY[kind];

  const [loaded, setLoaded] = useState<Loaded>(
    kind === "feedback" ? { status: "ready", rows: [], balance: null } : { status: "loading" },
  );
  const [attempt, setAttempt] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [reason, setReason] = useState<RefundReason | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  useEffect(() => {
    if (kind === "feedback") return;
    let cancelled = false;
    fetch(`/api/support/options?kind=${kind}`)
      .then((r) => (r.ok ? (r.json() as Promise<SupportOptions>) : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (!cancelled) setLoaded({ status: "ready", ...toRows(data, new Date()) });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ status: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [kind, attempt]);

  function close() {
    if (!sending) onClose();
  }

  const rows = loaded.status === "ready" ? loaded.rows : [];
  const ready = canSubmit(kind, { pick, reason, text }) && !sending;

  async function submit() {
    if (!ready) return;
    const row = rows.find((r) => r.key === pick);
    const payload =
      kind === "error"
        ? { kind, target: row?.target, body: text }
        : kind === "refund"
          ? { kind, purchaseId: pick, reason, body: text }
          : { kind, body: text };

    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSent(true);
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? FAIL);
    } catch {
      setError(FAIL);
    } finally {
      setSending(false);
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={(e) => {
        // Esc. 기본 동작에 맡기면 DOM 만 닫히고 부모 상태는 열린 채로 남는다.
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        const el = ref.current;
        if (e.target === el && el && isOutsideRect(el.getBoundingClientRect(), e.clientX, e.clientY)) close();
      }}
      // 기본: 하단 시트. 760px 이상: 가운데 카드. preflight 가 지운 margin:auto 를 되돌린다.
      className="mx-0 mb-0 mt-auto max-h-[92vh] w-full max-w-none overflow-y-auto rounded-t-[22px] bg-white px-5 pb-6 pt-[22px] text-slate-900 shadow-[0_-20px_60px_-20px_rgba(15,23,42,.35)] backdrop:bg-slate-900/45 backdrop:backdrop-blur-[2px] min-[760px]:m-auto min-[760px]:max-h-[88vh] min-[760px]:max-w-[460px] min-[760px]:rounded-[22px] min-[760px]:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-[20px] font-bold leading-[1.3] tracking-[-0.04em]">
            {copy.title}
          </h2>
          <p id={descId} className="mt-[5px] text-[13.5px] text-slate-500 [text-wrap:pretty]">
            {copy.desc}
          </p>
        </div>
        <button
          type="button"
          aria-label="닫기"
          onClick={close}
          className="flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-full bg-slate-100 text-[15px] text-slate-500 hover:bg-slate-200"
        >
          ✕
        </button>
      </div>

      {sent ? (
        <div className="pb-2 pt-[34px] text-center" role="status">
          <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-full bg-accent-50 text-[20px] font-bold text-accent">
            ✓
          </div>
          <div className="text-[17px] font-bold tracking-[-0.03em]">{copy.sentTitle}</div>
          <div className="mt-1.5 text-[13.5px] text-slate-500">{copy.sentDesc}</div>
          <button
            type="button"
            onClick={onClose}
            className="mt-[26px] w-full cursor-pointer rounded-[14px] bg-slate-900 py-[15px] text-[15px] font-bold text-white"
          >
            확인
          </button>
        </div>
      ) : (
        <>
          {copy.picker && (
            <div className="mt-[22px]">
              <div className="mb-[9px] flex items-baseline justify-between gap-2">
                <span className="text-[12.5px] font-bold text-slate-700">{copy.picker}</span>
                {loaded.status === "ready" && loaded.balance !== null && (
                  <span className="text-[12.5px] text-slate-400">지금 남은 이용권 {loaded.balance}장</span>
                )}
              </div>

              {loaded.status === "loading" && (
                <div className="flex flex-col gap-[7px]" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-[62px] animate-pulse rounded-[14px] bg-slate-100" />
                  ))}
                </div>
              )}

              {loaded.status === "failed" && (
                <div className="rounded-[14px] border border-slate-200 px-4 py-5 text-center text-[13.5px] text-slate-500">
                  목록을 불러오지 못했어요.{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setLoaded({ status: "loading" });
                      setAttempt((n) => n + 1);
                    }}
                    className="cursor-pointer font-semibold text-accent"
                  >
                    다시 시도
                  </button>
                </div>
              )}

              {loaded.status === "ready" && rows.length === 0 && (
                <div className="rounded-[14px] border border-slate-200 px-4 py-5 text-center text-[13.5px] text-slate-500">
                  환불할 결제 내역이 없어요
                </div>
              )}

              {loaded.status === "ready" && rows.length > 0 && (
                <div role="radiogroup" aria-label={copy.picker} className="flex max-h-[252px] flex-col gap-[7px] overflow-y-auto">
                  {rows.map((r) => {
                    const on = pick === r.key;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={r.disabled}
                        onClick={() => setPick(r.key)}
                        className={`flex w-full cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] px-3.5 py-3 text-left transition-colors disabled:cursor-default disabled:opacity-50 ${
                          on ? "border-accent bg-[#F5F8FF]" : "border-slate-200 bg-white"
                        }`}
                      >
                        <span
                          className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-[1.5px] ${
                            on ? "border-accent" : "border-slate-300"
                          }`}
                        >
                          <span className={`h-2 w-2 rounded-full ${on ? "bg-accent" : "bg-transparent"}`} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14.5px] font-semibold tracking-[-0.02em] text-slate-900">{r.title}</span>
                          <span className="mt-0.5 block truncate text-[12.5px] text-slate-400">{r.sub}</span>
                        </span>
                        <span className="flex-none whitespace-nowrap text-[12.5px] text-slate-400">{r.meta}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {kind === "refund" && (
            <div className="mt-5">
              <div className="mb-[9px] text-[12.5px] font-bold text-slate-700">환불 사유</div>
              <div role="radiogroup" aria-label="환불 사유" className="flex flex-wrap gap-[7px]">
                {REFUND_REASONS.map((label) => {
                  const on = reason === label;
                  return (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setReason(label)}
                      className={`cursor-pointer rounded-full border-[1.5px] px-3.5 py-[9px] text-[13.5px] font-semibold tracking-[-0.01em] transition-colors ${
                        on ? "border-accent bg-[#F5F8FF] text-accent-700" : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <label className="mt-5 block">
            <span className="mb-[9px] block text-[12.5px] font-bold text-slate-700">{copy.textLabel}</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={copy.placeholder}
              rows={5}
              maxLength={BODY_MAX}
              className="block w-full resize-y rounded-[14px] border-[1.5px] border-slate-200 bg-slate-50 px-3.5 py-[13px] text-[14.5px] leading-[1.55] text-slate-900 outline-none focus:border-accent focus:bg-white"
            />
          </label>

          {error && (
            <p role="alert" className="mt-3 text-[13px] text-red-600">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={!ready}
            className="mt-[22px] w-full cursor-pointer rounded-[14px] bg-accent py-[15px] text-[15px] font-bold text-white transition-colors disabled:cursor-default disabled:bg-slate-300"
          >
            {sending ? "보내는 중…" : copy.submit}
          </button>
        </>
      )}
    </dialog>
  );
}
