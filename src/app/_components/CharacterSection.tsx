import Link from "next/link";
import { characterOf } from "@/lib/saju-core/character";
import { CharacterCardStack } from "./CharacterCardStack";

/**
 * 시안이 세워 둔 세 장. 오행이 겹치지 않아 서피스 색이 서로 다르게 보인다
 * (화 · 목 · 금). 가운데 앞장은 시안과 같은 갑자다.
 */
const STACK = [characterOf("병", "인"), characterOf("갑", "자"), characterOf("신", "미")] as const;

export function CharacterSection() {
  return (
    <section
      id="character"
      className="overflow-x-clip border-y border-slate-100 bg-slate-50 py-[clamp(56px,8vw,88px)]"
    >
      <div className="mx-auto max-w-[1120px] px-5 md:px-8">
        <div className="flex flex-col items-center gap-[clamp(32px,4vw,56px)] md:grid md:grid-cols-2">
          <div className="min-w-0">
            <h2 className="mb-[18px] text-[clamp(28px,4vw,46px)] font-bold leading-[1.14] tracking-[-0.035em]">
              60가지 중,
              <br />
              나를 닮은 한 장
            </h2>
            <p className="mb-8 max-w-[450px] text-[17px] leading-[1.65] text-slate-500 [text-wrap:pretty]">
              태어난 날을 기준으로 만들어지는 60가지 기본 조합을 프로젝트 사주의 언어로 풀어냅니다.
              내가 가진 기질과 강점, 놓치기 쉬운 면까지 한 장에 담았어요.
            </p>
            <div className="flex flex-wrap items-center gap-3.5">
              <Link
                href="/funnel?step=name"
                className="rounded-[13px] bg-accent px-6 py-3.5 text-[15.5px] font-semibold text-white hover:bg-accent-700"
              >
                내 캐릭터 확인하기
              </Link>
              <span className="text-sm font-bold text-wood-ink">무료</span>
            </div>
          </div>

          <CharacterCardStack cards={[STACK[0], STACK[1], STACK[2]]} />
        </div>
      </div>
    </section>
  );
}
