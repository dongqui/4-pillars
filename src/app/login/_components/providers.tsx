import type { ReactNode } from "react";
import { AppleIcon, GoogleIcon, KakaoIcon, LineIcon } from "./social-icons";

export type SocialProvider = "kakao" | "line" | "google" | "apple";

export const SOCIAL_PROVIDERS: SocialProvider[] = [
  "kakao",
  "line",
  "google",
  "apple",
];

interface ProviderConfig {
  label: string;
  icon: ReactNode;
  buttonClassName: string;
}

export const PROVIDER_CONFIG: Record<SocialProvider, ProviderConfig> = {
  kakao: {
    label: "카카오로 계속하기",
    icon: <KakaoIcon />,
    buttonClassName:
      "bg-[#FEE500] text-black/85 hover:brightness-[0.97] border-0",
  },
  line: {
    label: "LINE으로 계속하기",
    icon: <LineIcon />,
    buttonClassName:
      "bg-[#06C755] text-white hover:brightness-[0.96] border-0",
  },
  google: {
    label: "Google로 계속하기",
    icon: <GoogleIcon />,
    buttonClassName:
      "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
  },
  apple: {
    label: "Apple로 계속하기",
    icon: <AppleIcon />,
    buttonClassName:
      "bg-slate-900 text-white hover:bg-slate-800 border-0",
  },
};
