"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** 숫자가 올라가는 시점. 체크가 다 그려진 뒤라야 "그래서 몇 장"이 순서대로 읽힌다. */
const BUMP_MS = 620;
/** 이 화면이 머무는 시간. 시안의 holdMs 기본값을 그대로 쓴다. */
const HOLD_MS = 2600;

interface Props {
  /** 이번 결제로 적립된 장수. */
  added: number;
  /** 적립이 끝난 지금의 잔액. 서버가 지갑에서 직접 읽은 값이다. */
  after: number;
  /** 연출이 끝나면 옮겨 갈 자리. safeNextPath 를 이미 통과한 값이어야 한다. */
  next: string;
}

/**
 * 결제 완료 연출(시안 Saju Payment Complete).
 *
 * 머물다 떠나는 화면이라 push 가 아니라 replace 로 옮긴다 — 도착지에서 뒤로
 * 가기를 누른 사용자를 이 화면에 다시 떨어뜨리지 않는다.
 *
 * 숫자를 before → after 로 올리는 이유: 결과만 찍으면 "원래 그만큼이었나"와
 * 구분되지 않는다. 무엇이 늘었는지가 이 화면이 하는 유일한 말이다.
 */
export function PaymentComplete({ added, after, next }: Props) {
  const router = useRouter();
  const [bumped, setBumped] = useState(false);

  // 정상 흐름에서는 적립 직후라 after - added 가 결제 전 잔액이다. 그 사이에 이용권을
  // 쓰고 이 주소로 다시 들어오면 음수가 나올 수 있어 0 에서 끊는다 — 마지막에 찍히는
  // 숫자는 어느 쪽이든 지갑에서 읽은 실제 잔액이라 틀리지 않는다.
  const before = Math.max(0, after - added);

  useEffect(() => {
    // 연출이 도는 2.6초 동안 도착지를 미리 받아 둔다 — 옮겨 갈 때 흰 화면이 없다.
    router.prefetch(next);
    const bump = setTimeout(() => setBumped(true), BUMP_MS);
    const leave = setTimeout(() => router.replace(next), HOLD_MS);
    return () => {
      clearTimeout(bump);
      clearTimeout(leave);
    };
  }, [next, router]);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-white px-6 py-8 text-slate-900">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(37,99,235,.09)_0%,rgba(37,99,235,0)_68%)]"
      />

      <div className="relative w-full max-w-[340px] text-center">
        <div className="relative mx-auto mb-[26px] h-[76px] w-[76px]">
          <span aria-hidden className="pc-pulse absolute inset-0 rounded-full bg-accent/[.16]" />
          <div className="pc-ring absolute inset-0 flex items-center justify-center rounded-full bg-accent-soft text-accent">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 12.5l4.4 4.5L19 7.5"
                className="pc-check"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="34"
              />
            </svg>
          </div>
        </div>

        <h1
          className="pc-rise m-0 text-[26px] font-bold tracking-[-0.03em]"
          style={{ animationDelay: "120ms" }}
        >
          결제 완료
        </h1>
        <p
          className="pc-rise mb-[30px] mt-[9px] text-[14.5px] leading-[1.6] text-slate-500 [text-wrap:pretty] [word-break:keep-all]"
          style={{ animationDelay: "180ms" }}
        >
          이용권이 충전되었어요.
        </p>

        <div
          className="pc-rise flex items-baseline justify-center gap-2.5"
          style={{ animationDelay: "240ms" }}
        >
          <span className="text-[13.5px] font-semibold tracking-[-0.01em] text-slate-400">
            이용권
          </span>
          <span className="relative inline-flex items-baseline gap-1">
            <span
              // key 로 다시 그리게 해서 숫자가 바뀔 때 애니메이션이 처음부터 돈다.
              key={bumped ? "after" : "before"}
              className={`font-mono text-[34px] font-bold tracking-[-0.03em] ${bumped ? "pc-num" : ""}`}
            >
              {bumped ? after : before}
            </span>
            <span className="text-[15px] font-semibold text-slate-400">장</span>
            {bumped && (
              <span className="pc-plus absolute -top-0.5 left-full ml-2 whitespace-nowrap text-[13.5px] font-bold text-accent">
                +{added}
              </span>
            )}
          </span>
        </div>

        {/* 타이머가 옮겨 주지만, 스크립트가 죽어도 갇히지 않게 손으로 갈 길을 남긴다. */}
        <Link
          href={next}
          replace
          className="mt-7 inline-block px-2.5 py-1.5 text-[12.5px] font-semibold text-slate-400 hover:text-slate-600"
        >
          바로 이동
        </Link>
      </div>
    </div>
  );
}
