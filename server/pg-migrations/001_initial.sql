CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at BIGINT NOT NULL);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  email TEXT UNIQUE,
  email_verified_at BIGINT,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player','admin')),
  disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0,1))
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL
);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE TABLE progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('python','cpp')),
  data TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY(user_id,language)
);
CREATE TABLE course_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('python','cpp')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  data TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY(user_id,language,difficulty)
);
CREATE TABLE full_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('python','cpp')),
  data TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY(user_id,language)
);
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at BIGINT NOT NULL
);
CREATE INDEX idx_rate_limits_expires_at ON rate_limits(expires_at);
CREATE TABLE pending_registrations (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL
);
CREATE INDEX idx_pending_expires ON pending_registrations(expires_at);
CREATE TABLE admin_audit (
  id BIGSERIAL PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id),
  target_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX idx_admin_audit_created ON admin_audit(created_at);
CREATE TABLE app_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at BIGINT NOT NULL);
CREATE TABLE hint_unlocks (
  user_id TEXT NOT NULL REFERENCES users(id),
  language TEXT NOT NULL,
  task_id INTEGER NOT NULL,
  round_key TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY(user_id,language,task_id)
);
CREATE INDEX idx_hint_round ON hint_unlocks(user_id,language,round_key);
CREATE TABLE ad_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  language TEXT NOT NULL,
  task_id INTEGER NOT NULL,
  round_key TEXT NOT NULL,
  provider TEXT NOT NULL,
  game_key TEXT NOT NULL,
  game_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  round_limit INTEGER NOT NULL DEFAULT 3 CHECK(round_limit BETWEEN 1 AND 3)
);
CREATE INDEX idx_ad_attempt_user ON ad_attempts(user_id,expires_at);
CREATE TABLE ad_transactions (tid TEXT PRIMARY KEY,attempt_id TEXT NOT NULL REFERENCES ad_attempts(id),created_at BIGINT NOT NULL);
CREATE TABLE duels (
  id TEXT PRIMARY KEY,
  invite TEXT NOT NULL UNIQUE,
  language TEXT NOT NULL CHECK(language IN ('python','cpp')),
  status TEXT NOT NULL DEFAULT 'waiting',
  created_at BIGINT NOT NULL,
  start_at BIGINT,
  end_at BIGINT,
  winner_id TEXT REFERENCES users(id),
  finished_at BIGINT
);
CREATE TABLE duel_players (
  duel_id TEXT NOT NULL REFERENCES duels(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  ready INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  last_pass_at BIGINT,
  PRIMARY KEY(duel_id,user_id)
);
CREATE INDEX idx_duel_player_user ON duel_players(user_id);
CREATE TABLE duel_submissions (
  id TEXT PRIMARY KEY,
  duel_id TEXT NOT NULL REFERENCES duels(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  level INTEGER NOT NULL,
  code_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  received_at BIGINT NOT NULL,
  finished_at BIGINT,
  verdict TEXT
);
CREATE INDEX idx_duel_submission_room ON duel_submissions(duel_id,status);
CREATE UNIQUE INDEX idx_duel_pending_user ON duel_submissions(duel_id,user_id) WHERE status='pending';
