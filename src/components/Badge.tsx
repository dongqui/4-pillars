type Element = "wood" | "fire" | "earth" | "metal" | "water";

interface Props {
  element?: Element;
  children: React.ReactNode;
}

const elementStyles: Record<Element, string> = {
  wood: "text-wood-ink bg-wood-soft",
  fire: "text-fire-ink bg-fire-soft",
  earth: "text-earth-ink bg-earth-soft",
  metal: "text-metal-ink bg-metal-soft",
  water: "text-water-ink bg-water-soft",
};

const dotColor: Record<Element, string> = {
  wood: "#2E9E6B",
  fire: "#DC5A4B",
  earth: "#C99A3F",
  metal: "#8492A6",
  water: "#3E6FB0",
};

export function Badge({ element, children }: Props) {
  if (!element) {
    return (
      <span className="text-[13px] font-semibold text-slate-700 bg-slate-100 px-[11px] py-[5px] rounded-lg">
        {children}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[13px] font-semibold px-[11px] py-[5px] rounded-full ${elementStyles[element]}`}
    >
      <span
        className="w-[7px] h-[7px] rounded-full"
        style={{ background: dotColor[element] }}
      />
      {children}
    </span>
  );
}
