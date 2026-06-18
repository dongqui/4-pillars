import { useState } from "react";
import { LoginModal } from "@4-pillars/ui";
import { apiBaseUrl } from "../lib/auth";

export default function Login() {
  const [open, setOpen] = useState(true);
  const returnUrl = typeof window !== "undefined" ? window.location.origin + "/" : "/";
  return (
    <main style={{ padding: 24 }}>
      <button type="button" onClick={() => setOpen(true)}>
        로그인 열기
      </button>
      <LoginModal
        open={open}
        onClose={() => setOpen(false)}
        apiBaseUrl={apiBaseUrl}
        returnUrl={returnUrl}
      />
    </main>
  );
}
