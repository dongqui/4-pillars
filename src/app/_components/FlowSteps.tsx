const STEPS = [
  {
    no: "01",
    title: "생년월일 입력",
    desc: "태어난 날 하나면 충분해요. 로그인도 필요 없어요.",
  },
  {
    no: "02",
    title: "내 캐릭터 만나기",
    desc: "예순 개의 캐릭터 중 나에게 해당하는 한 장을 받아요.",
  },
  {
    no: "03",
    title: "이어서 탐색",
    desc: "리포트로 나를 읽고, 주변 사람들과의 관계까지 살펴봐요.",
  },
];

export function FlowSteps() {
  return (
    <section className="px-5 py-14 md:px-8 md:py-[clamp(72px,8vw,104px)]">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-[34px] text-xs font-bold tracking-[0.1em] text-slate-400">
          어떻게 진행되나요
        </div>
        <div className="flex flex-col gap-[34px] md:grid md:grid-cols-3 md:gap-9">
          {STEPS.map((step, i) => (
            <div
              key={step.no}
              // 첫 칸만 액센트 선 — 어디서 시작하는지 한 눈에 보이게 한다.
              // 모바일은 세로로 쌓이므로 선도 왼쪽으로 돌린다.
              className={`border-l-2 pl-[18px] md:border-l-0 md:border-t-2 md:pl-0 md:pt-[22px] ${
                i === 0 ? "border-accent" : "border-[#EEF1F5]"
              }`}
            >
              <div className="mb-[14px] text-[13px] font-bold tracking-[0.06em] text-accent">
                {step.no}
              </div>
              <div className="mb-[9px] text-[clamp(19px,2.2vw,22px)] font-bold tracking-[-0.025em]">
                {step.title}
              </div>
              <p className="text-[15px] leading-[1.65] text-gray-500 [text-wrap:pretty]">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
