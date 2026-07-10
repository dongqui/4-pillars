import { ProgressBar } from "@/components/ProgressBar";

interface Props {
  index: number;
  total: number;
}

export function FunnelProgress({ index, total }: Props) {
  return (
    <div className="flex items-center gap-5">
      <ProgressBar value={index + 1} max={total} />
      <span className="text-[13px] font-semibold text-slate-400 whitespace-nowrap">
        {index + 1} / {total}
      </span>
    </div>
  );
}
