"use client";

import { OptionCard } from "@/components/OptionCard";
import { useFunnel } from "../../_context/FunnelContext";
import { StepHeading } from "../StepHeading";

export function GenderStep() {
  const { data, update } = useFunnel();
  const name = data.name.trim() || "회원";
  return (
    <div>
      <StepHeading
        title={
          <>
            {name}님의 성별은
            <br className="md:hidden" /> 무엇인가요?
          </>
        }
        sub="양·음 기운 해석에 사용돼요."
      />
      {/* 시안: 세로로 쌓인 전폭 카드, 왼쪽 정렬 */}
      <div className="flex flex-col gap-3" role="radiogroup" aria-label="성별">
        <OptionCard
          selected={data.gender === "male"}
          onClick={() => update({ gender: "male" })}
          className="w-full text-left text-[17px] px-5 py-5"
        >
          남성
        </OptionCard>
        <OptionCard
          selected={data.gender === "female"}
          onClick={() => update({ gender: "female" })}
          className="w-full text-left text-[17px] px-5 py-5"
        >
          여성
        </OptionCard>
      </div>
    </div>
  );
}
