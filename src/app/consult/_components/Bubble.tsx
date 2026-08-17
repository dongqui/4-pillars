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
        }`}
        style={delay > 0 ? { animation: `pv-bubble-in 220ms ease-out ${delay}ms both` } : undefined}
      >
        {text}
      </p>
    </div>
  );
}
