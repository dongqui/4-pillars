export function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">{children}</div>;
}
