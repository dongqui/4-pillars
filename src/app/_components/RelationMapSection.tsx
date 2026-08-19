/**
 * 관계 지도 섹션.
 *
 * 시안의 "+ 사람 추가 · 무료" 버튼을 링크로 만들지 않는다 — /map 화면이 아직 없다.
 * 랜딩에서 열리는 척하면 눌러 본 사람이 곧바로 없는 화면을 본다. 대신 "준비 중"을
 * 붙여 무엇이 오는지만 보여준다(홈의 이어서 살펴보기와 같은 정책).
 */
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

export function RelationMapSection() {
  return (
    <section id="relmap" className="mx-auto max-w-[1120px] px-5 py-[clamp(56px,8vw,96px)] md:px-8">
      <div className="mb-[52px] text-center">
        <div className="mb-4 flex items-center justify-center gap-2.5">
          <h2 className="text-[clamp(28px,4vw,46px)] font-bold leading-[1.14] tracking-[-0.035em]">
            사람 사이에 놓인 나
          </h2>
          <span className="mt-1 flex-none rounded-md border border-slate-200 px-[9px] py-1 text-[11px] font-bold tracking-[0.06em] text-slate-400">
            준비 중
          </span>
        </div>
        <p className="text-[clamp(16px,2vw,18px)] text-slate-400 [text-wrap:pretty]">
          한 사람씩 추가하면, 그 사람이 나에게 어떤 역할인지 보입니다. 몇 명이든 무료로 열 계획이에요.
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
          <span className="whitespace-nowrap rounded-full bg-slate-100 px-4 py-2.5 text-[13.5px] font-semibold text-slate-500">
            + 사람 추가 · 준비 중
          </span>
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
