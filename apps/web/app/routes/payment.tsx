import type { Route } from "./+types/payment";
import { localeFromRequest } from "../lib/locale";

export function loader({ request }: Route.LoaderArgs) {
  const locale = localeFromRequest(request, import.meta.env.VITE_LOCALE);
  return { locale };
}

export default function Payment({ loaderData }: Route.ComponentProps) {
  const { locale } = loaderData;
  // 시장별 결제 화면/PG 분기 지점. 분기가 커지면 payment.ko.tsx / payment.ja.tsx로 분리.
  if (locale === "ja") {
    return <main style={{ padding: 24 }}>일본 결제 화면 (스텁)</main>;
  }
  return <main style={{ padding: 24 }}>한국 결제 화면 (스텁)</main>;
}
