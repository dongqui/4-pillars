interface Props {
  role: "user" | "counselor";
  text: string;
  /** 진입 애니메이션(pv-bubble-in)을 태울지. 방금 온 상담사 답에만 true 다 */
  animate?: boolean;
  /** 순차 노출 지연(ms). animate 가 true 인 말풍선 중 두 번째부터에 준다 */
  delay?: number;
}

export function Bubble({ role, text, animate = false, delay = 0 }: Props) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[78%] rounded-[18px] px-[14px] py-2.5 text-[14.5px] leading-[1.55] [text-wrap:pretty] ${
          mine ? "bg-accent text-white" : "bg-slate-100 text-slate-800"
        } ${animate ? "pv-bubble-in" : ""}`}
        // 재생은 pv-bubble-in 클래스가 맡는다(reduced-motion 이 꺼야 하므로). 여기선
        // 말풍선마다 다른 지연만 준다 — animate 와 delay 는 서로 다른 질문이다.
        // "태울지"는 animate 가 정하고, delay(>0) 는 그중 몇 번째로 뜰지만 정한다.
        style={delay > 0 ? { animationDelay: `${delay}ms` } : undefined}
      >
        {text}
      </p>
    </div>
  );
}
