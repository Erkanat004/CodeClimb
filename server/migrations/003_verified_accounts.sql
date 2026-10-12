ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'player' CHECK(role IN ('player','admin'));
ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1));
CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE TABLE pending_registrations (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_pending_expires ON pending_registrations(expires_at);
CREATE TABLE admin_audit (
  id INTEGER PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id),
  target_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_admin_audit_created ON admin_audit(created_at);
CREATE TABLE full_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK(language IN ('python','cpp')),
  data TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id, language)
);
