import { BrandLogo } from "@/components/BrandLogo";

const CHIPS = ["신중한 관찰자", "독립적인 판단", "강한 책임감"];

/**
 * 히어로의 시각물 — 리포트 첫 화면을 그대로 흉내 낸 카드다. 아래쪽은 흰색
 * 그라디언트로 잘려 "이어지는 내용이 더 있다"를 보여준다(시안의 -108px 겹침).
 *
 * 가상의 인물("지우")의 리포트라 스크린리더에서는 통째로 숨긴다 — 히어로 문구보다
 * 먼저 읽히면 첫 문장이 묻히고, 실제 사용자 데이터로 오해될 수도 있다.
 */
export function ReportPreview() {
  return (
    <div aria-hidden className="mx-auto mt-[52px] flex max-w-[520px] justify-center">
      <div className="min-w-0 flex-1 overflow-hidden rounded-[20px] border border-slate-200 bg-white text-left shadow-[0_36px_80px_-32px_rgba(15,23,42,.22),0_2px_8px_rgba(15,23,42,.04)] md:max-w-[460px]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-[18px] py-[13px]">
          <BrandLogo size="xs" />
          <span className="font-mono text-[11px] font-semibold tracking-[0.05em] text-slate-400">
            REPORT
          </span>
        </div>

        <div className="px-6 pt-6 text-center">
          <div className="font-mono text-xs text-slate-400">
            지우 · 양력 1993.06.14 04:30 · 갑자일주
          </div>
          <div className="mx-auto mt-[13px] max-w-[390px] text-[22px] font-bold leading-[1.36] tracking-[-0.03em] [text-wrap:balance] [word-break:keep-all]">
            겉으로는 조용하지만, 자신만의 기준과 승부욕이 강한 사람
          </div>
          <p className="mx-auto mt-[11px] max-w-[330px] text-[13.5px] leading-[1.6] text-slate-500 [text-wrap:pretty]">
            사람들과 잘 어울리지만, 혼자 생각을 정리하는 시간이 꼭 필요한 타입.
          </p>
          <div className="mt-[18px] flex flex-wrap justify-center gap-[7px]">
            {CHIPS.map((chip) => (
              <span
                key={chip}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-[12.5px] font-semibold text-slate-700"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>

        <div className="px-6 pt-[22px]">
          <div className="mb-1.5 text-[11px] font-bold tracking-[0.08em] text-slate-400">
            01 · 핵심 성향
          </div>
          <div className="mb-[13px] text-[17px] font-bold tracking-[-0.02em]">
            이렇게 보이는 데는 이유가 있어요
          </div>
          <div className="rounded-[13px] border border-slate-200 px-4 py-[15px]">
            <div className="mb-1 text-[13.5px] font-bold">신중한 관찰자</div>
            <p className="m-0 text-[13px] leading-[1.65] text-slate-600 [text-wrap:pretty]">
              갑목 일간이 자수(子) 위에 앉은 구조라, 움직이기 전에 상황을 오래 들여다봅니다. 말보다
              판단이 앞서는 이유예요.
            </p>
          </div>
        </div>

        {/* 카드 아래를 덮어 문장이 자연스럽게 사라지게 하는 페이드 */}
        <div className="-mt-[108px] h-[104px] bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,#fff_52%)]" />
      </div>
    </div>
  );
}
