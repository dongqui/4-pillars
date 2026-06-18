import { type AuthProviderName, PROVIDER_ORDER, buildAuthUrl } from "./buildAuthUrl.js";

export interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  apiBaseUrl: string;
  returnUrl: string;
  labels?: Partial<Record<AuthProviderName, string>>;
  title?: string;
  locale?: string;
}

const DEFAULT_LABELS: Record<AuthProviderName, string> = {
  kakao: "카카오로 시작하기",
  line: "LINE으로 시작하기",
  google: "Google로 시작하기",
  apple: "Apple로 시작하기",
};

/** 소셜 간편 로그인 모달 (presentational, UI 미완성 스텁). */
export function LoginModal({
  open,
  onClose,
  apiBaseUrl,
  returnUrl,
  labels,
  title = "로그인",
  locale,
}: LoginModalProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", padding: 24, borderRadius: 8, minWidth: 280, display: "flex", flexDirection: "column", gap: 8 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
        {PROVIDER_ORDER.map((provider) => (
          <a
            key={provider}
            href={buildAuthUrl({ apiBaseUrl, provider, returnUrl, locale })}
            data-provider={provider}
            style={{ display: "block", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 6, textAlign: "center", textDecoration: "none", color: "#111" }}
          >
            {labels?.[provider] ?? DEFAULT_LABELS[provider]}
          </a>
        ))}
        <button type="button" onClick={onClose} style={{ marginTop: 8, background: "none", border: "none", color: "#888" }}>
          닫기
        </button>
      </div>
    </div>
  );
}
