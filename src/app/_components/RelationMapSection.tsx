import Link from "next/link";

const LEFT = [
  { who: "어머니", role: "나를 자라게 한 뿌리", tag: "기운을 주는 사람", tone: "calm" },
  { who: "직장 상사", role: "자꾸 부딪히는 자리", tag: "나를 단련시키는 사람", tone: "warm" },
] as const;

const RIGHT = [
  { who: "오래된 친구", role: "말이 편한 사이", tag: "균형을 맞춰주는 사람", tone: "cool" },
  { who: "연인", role: "가장 가까운 관계", tag: "서로를 키우는 사람", tone: "calm" },
] as const;

type Tone = (typeof LEFT)[number]["tone"] | (typeof RIGHT)[number]["tone"];

// 시안의 세 톤은 오행 토큰과 같은 색이다 — 따로 적지 않고 그대로 쓴다.
const TONE: Record<Tone, string> = {
  calm: "text-wood-ink bg-wood-soft",
  warm: "text-fire-ink bg-fire-soft",
  cool: "text-water-ink bg-water-soft",
};

const CARD =
  "rounded-[18px] border border-slate-100 bg-white px-5 py-[18px] shadow-[0_1px_3px_rgba(15,23,42,.04)]";

function PersonCard({
  person,
  align,
}: {
  person: (typeof LEFT)[number] | (typeof RIGHT)[number];
  align: "left" | "right";
}) {
  return (
    <div className={`${CARD} ${align === "right" ? "md:text-right" : ""}`}>
      <div className="text-[15.5px] font-bold tracking-[-0.01em]">{person.who}</div>
      <div className="mt-1.5 text-[13.5px] text-slate-400 [text-wrap:pretty]">{person.role}</div>
      <span
        className={`mt-[11px] inline-block rounded-full px-[11px] py-[5px] text-xs font-semibold ${TONE[person.tone]}`}
      >
        {person.tag}
      </span>
    </div>
  );
}

/**
 * 관계 지도 섹션. /map 은 로그인만 하면 열리고 이용권을 쓰지 않아 무료로 적는다
 * (비로그인은 /map 이 알아서 로그인으로 넘긴다 — 여기서 흐름을 끊지 않는다).
 */
export function RelationMapSection() {
  return (
    <section id="relmap" className="mx-auto max-w-[1120px] px-5 py-[clamp(56px,8vw,96px)] md:px-8">
      <div className="mb-[52px] text-center">
        <h2 className="mb-4 text-[clamp(28px,4vw,46px)] font-bold leading-[1.14] tracking-[-0.035em]">
          사람 사이에 놓인 나
        </h2>
        <p className="text-[clamp(16px,2vw,18px)] text-slate-400 [text-wrap:pretty]">
          한 사람씩 추가하면, 그 사람이 나에게 어떤 역할인지 보입니다. 몇 명이든 무료입니다.
        </p>
      </div>

      <div className="mx-auto grid max-w-[900px] items-center gap-5 md:grid-cols-3 md:gap-[clamp(20px,4vw,40px)]">
        <div className="flex flex-col gap-4">
          {LEFT.map((p) => (
            <PersonCard key={p.who} person={p} align="right" />
          ))}
        </div>

        <div className="flex flex-col items-center gap-2.5">
          <div className="flex h-[104px] w-[104px] flex-col items-center justify-center gap-[3px] rounded-full bg-slate-900 text-white shadow-[0_20px_44px_-18px_rgba(15,23,42,.4)]">
            <span className="text-[22px] font-bold tracking-[-0.02em]">나</span>
            <span className="text-[11px] text-white/50">큰나무형</span>
          </div>
          <div className="text-[12.5px] font-semibold text-slate-400">4명 추가됨</div>
          <Link
            href="/map"
            className="whitespace-nowrap rounded-full bg-accent-50 px-4 py-2.5 text-[13.5px] font-semibold text-accent hover:bg-accent-100"
          >
            + 사람 추가 · 무료
          </Link>
        </div>

        <div className="flex flex-col gap-4">
          {RIGHT.map((p) => (
            <PersonCard key={p.who} person={p} align="left" />
          ))}
        </div>
      </div>
    </section>
  );
}
