interface Props {
  role: "user" | "counselor";
  text: string;
  /** 순차 노출 지연(ms). 상담사 말풍선에만 준다 */
  delay?: number;
}

export function Bubble({ role, text, delay = 0 }: Props) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[78%] rounded-[18px] px-[14px] py-2.5 text-[14.5px] leading-[1.55] [text-wrap:pretty] ${
          mine ? "bg-accent text-white" : "bg-slate-100 text-slate-800"
        } ${delay > 0 ? "pv-bubble-in" : ""}`}
        // 재생은 pv-bubble-in 클래스가 맡는다(reduced-motion 이 꺼야 하므로). 여기선
        // 말풍선마다 다른 지연만 준다.
        style={delay > 0 ? { animationDelay: `${delay}ms` } : undefined}
      >
        {text}
      </p>
    </div>
  );
}
