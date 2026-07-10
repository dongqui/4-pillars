import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

const base =
  "inline-flex items-center justify-center font-semibold rounded-xl transition-all disabled:cursor-default cursor-pointer";

const variants: Record<Variant, string> = {
  primary:
    "text-white bg-accent shadow-[0_8px_20px_rgba(37,99,235,.28)] hover:opacity-92 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none",
  secondary:
    "text-slate-700 bg-white border border-slate-300 hover:bg-slate-50",
  ghost: "text-slate-600 bg-transparent hover:bg-slate-100",
  danger:
    "text-red-600 bg-red-50 border border-red-200 hover:bg-red-100",
};

export function Button({
  variant = "primary",
  fullWidth,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${
        fullWidth ? "w-full" : ""
      } px-5 py-3 text-[15px] ${className}`}
      {...props}
    />
  );
}
