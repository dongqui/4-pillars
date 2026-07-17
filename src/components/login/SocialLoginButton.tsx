import { PROVIDER_CONFIG, type SocialProvider } from "./providers";

interface SocialLoginButtonProps {
  provider: SocialProvider;
  showLastLogin?: boolean;
}

export function SocialLoginButton({
  provider,
  showLastLogin = false,
}: SocialLoginButtonProps) {
  const config = PROVIDER_CONFIG[provider];

  return (
    <button
      type="button"
      className={`relative font-inherit h-[52px] rounded-[14px] text-[15px] font-semibold cursor-default flex items-center justify-center transition-[filter,background-color] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${config.buttonClassName}`}
    >
      <span className="absolute left-[18px] flex">{config.icon}</span>
      {config.label}
      {showLastLogin ? (
        <span className="absolute right-3.5 text-[11px] font-bold text-white bg-black/70 px-[9px] py-1 rounded-full">
          최근 로그인
        </span>
      ) : null}
    </button>
  );
}
