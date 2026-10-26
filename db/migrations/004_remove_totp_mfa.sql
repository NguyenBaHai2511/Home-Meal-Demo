ALTER TABLE app_users
  DROP COLUMN IF EXISTS mfa_enabled,
  DROP COLUMN IF EXISTS mfa_secret_ciphertext,
  DROP COLUMN IF EXISTS mfa_secret_iv,
  DROP COLUMN IF EXISTS mfa_secret_tag;
