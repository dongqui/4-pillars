import { LoginNotice } from "@/components/login/LoginNotice";
import { LoginShell } from "@/components/login/LoginShell";
import {
  SOCIAL_PROVIDERS,
  type SocialProvider,
} from "@/components/login/providers";
import { SocialLoginButton } from "@/components/login/SocialLoginButton";

const DEFAULT_LAST_LOGIN_PROVIDER: SocialProvider = "kakao";

export default function LoginPage() {
  return (
    <LoginShell>
      <h1 className="text-[clamp(24px,5vw,28px)] font-bold tracking-tight leading-tight m-0 mb-2.5 break-keep">
        사주에 오신 걸 환영해요
      </h1>
      <p className="text-[15px] text-slate-400 m-0 mb-9 break-keep">
        간편 로그인으로 3초 만에 시작하세요.
        <br />
        처음이라면 자동으로 가입돼요.
      </p>

      <div className="flex flex-col gap-2.5">
        {SOCIAL_PROVIDERS.map((provider) => (
          <SocialLoginButton
            key={provider}
            provider={provider}
            showLastLogin={provider === DEFAULT_LAST_LOGIN_PROVIDER}
          />
        ))}
      </div>

      <LoginNotice />
    </LoginShell>
  );
}
