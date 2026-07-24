CREATE TABLE IF NOT EXISTS users (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider          text NOT NULL CHECK (provider IN ('google', 'line', 'kakao')),
  provider_user_id  text NOT NULL,
  email             text,
  display_name      text,
  avatar_url        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_login_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);
