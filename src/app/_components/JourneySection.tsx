/**
 * 캐릭터 이후에 무엇이 더 있는지 보여주는 다크 섹션.
 *
 * 시안은 세 줄 모두 "지금" 배지였지만 궁합은 아직 화면이 없다 — 랜딩에서
 * 있다고 말하면 홈에 들어온 사람이 곧바로 어긋난 것을 본다.
 */
const ROWS = [
  {
    title: "나를 더 깊게 읽기",
    desc: "기질과 사고방식, 감정의 결까지 여러 갈래로 나눠 정리해요.",
    tag: "지금",
  },
  {
    title: "주변 사람들과의 관계",
    desc: "가족, 친구, 동료가 나에게 어떤 역할을 하는지 한자리에서 살펴봐요.",
    tag: "지금",
  },
  {
    title: "두 사람의 궁합",
    desc: "특정한 한 사람과 나 사이에 어떤 흐름이 있는지 들여다봐요.",
    tag: "준비 중",
  },
];

export function JourneySection() {
  return (
    <section className="bg-slate-900 text-white">
      <div className="mx-auto max-w-[1120px] px-5 py-16 md:px-8 md:py-[clamp(84px,9vw,116px)]">
        <p className="m-0 max-w-[720px] text-[25px] font-bold leading-[1.35] tracking-[-0.035em] [text-wrap:pretty] md:text-[clamp(28px,3.6vw,42px)]">
          캐릭터는 첫 페이지예요.
          <br />
          나와 주변을 읽는 방법은 계속 더해집니다.
        </p>

        <div className="mt-[clamp(40px,5vw,58px)] flex flex-col">
          {ROWS.map((row, i) => (
            <div
              key={row.title}
              className={`flex items-start gap-3.5 py-[22px] md:gap-6 md:py-[26px] ${
                i === 0 ? "" : "border-t border-white/10"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="mb-2 text-[clamp(19px,2.3vw,24px)] font-bold tracking-[-0.03em]">
                  {row.title}
                </div>
                <p className="m-0 max-w-[520px] text-[15.5px] leading-[1.7] text-white/55 [text-wrap:pretty]">
                  {row.desc}
                </p>
              </div>
              <span className="mt-1 flex-none rounded-md border border-white/15 px-[9px] py-1 text-[11px] font-bold tracking-[0.06em] text-white/50">
                {row.tag}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-[clamp(30px,4vw,42px)] max-w-[520px] text-[15px] leading-[1.7] text-white/45 [text-wrap:pretty]">
          올해의 흐름, 시기별 리포트, 여러 사람이 모인 관계 세계까지 — 나를 읽는 관점은 앞으로도
          늘어납니다.
        </p>
      </div>
    </section>
  );
}
