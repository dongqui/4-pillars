import Link from "next/link";
import { characterOf } from "@/lib/saju-core/character";
import { HeroCardStack } from "./HeroCardStack";

/**
 * 스택에 세우는 세 장. 오행이 겹치지 않게 골라 서피스 색이 서로 다르게 보이도록 한다
 * (수 · 화 · 목). 앞장은 시안과 같은 갑자.
 */
const STACK = [characterOf("임", "신"), characterOf("병", "인"), characterOf("갑", "자")] as const;

export function Hero() {
  return (
    <section className="overflow-x-clip pt-10 pb-2 md:pt-[clamp(56px,7vw,88px)] md:pb-6">
      <div className="mx-auto max-w-[1120px]">
        <div className="flex flex-col gap-10 px-5 md:grid md:grid-cols-2 md:items-center md:gap-12 md:px-8">
          <div className="max-w-[540px]">
            <div className="mb-[26px] inline-flex items-center gap-2 rounded-full bg-accent-50 px-3.5 py-[7px] text-[13px] font-semibold text-accent">
              생년월일 하나로 시작해요
            </div>
            <h1 className="mb-[22px] text-[40px] font-bold leading-[1.06] tracking-[-0.045em] [text-wrap:balance] md:text-[clamp(46px,5.4vw,68px)]">
              당신은 어떤
              <br />
              캐릭터인가요?
            </h1>
            <p className="mb-3 text-[clamp(17px,2.1vw,20px)] font-medium leading-[1.55] text-gray-700 [text-wrap:pretty]">
              태어난 날에서 시작해 나를 여러 관점으로 읽어봐요.
            </p>
            <p className="mb-[34px] max-w-[430px] text-[15.5px] leading-[1.65] text-gray-400 [text-wrap:pretty]">
              먼저 캐릭터 한 장으로 나를 만나고, 이어서 나와 주변 사람들을 계속 탐색해나가는
              서비스예요.
            </p>
            <Link
              href="/start"
              className="inline-block rounded-[14px] bg-accent px-[30px] py-[17px] text-[16.5px] font-semibold text-white shadow-[0_14px_30px_-12px_rgba(37,99,235,.55)] hover:bg-accent-700"
            >
              내 캐릭터 알아보기
            </Link>
            <p className="mt-[15px] text-[13.5px] text-gray-400">
              로그인 없이 30초 · 생년월일만 입력해요
            </p>
          </div>

          <HeroCardStack cards={[STACK[0], STACK[1], STACK[2]]} />
        </div>
      </div>
    </section>
  );
}
