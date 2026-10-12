CREATE TABLE app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE hint_unlocks(
 user_id TEXT NOT NULL REFERENCES users(id),language TEXT NOT NULL,task_id INTEGER NOT NULL,
 round_key TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,language,task_id)
);
CREATE INDEX idx_hint_round ON hint_unlocks(user_id,language,round_key);
CREATE TABLE ad_attempts(
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),language TEXT NOT NULL,task_id INTEGER NOT NULL,
 round_key TEXT NOT NULL,provider TEXT NOT NULL,game_key TEXT NOT NULL,game_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL
);
CREATE INDEX idx_ad_attempt_user ON ad_attempts(user_id,expires_at);
CREATE TABLE ad_transactions(tid TEXT PRIMARY KEY,attempt_id TEXT NOT NULL REFERENCES ad_attempts(id),created_at INTEGER NOT NULL);
CREATE TABLE duels(
 id TEXT PRIMARY KEY,invite TEXT NOT NULL UNIQUE,language TEXT NOT NULL CHECK(language IN ('python','cpp')),
 status TEXT NOT NULL DEFAULT 'waiting',created_at INTEGER NOT NULL,start_at INTEGER,end_at INTEGER,
 winner_id TEXT REFERENCES users(id),finished_at INTEGER
);
CREATE TABLE duel_players(
 duel_id TEXT NOT NULL REFERENCES duels(id),user_id TEXT NOT NULL REFERENCES users(id),
 ready INTEGER NOT NULL DEFAULT 0,completed INTEGER NOT NULL DEFAULT 0,last_pass_at INTEGER,
 PRIMARY KEY(duel_id,user_id)
);
CREATE INDEX idx_duel_player_user ON duel_players(user_id);
CREATE TABLE duel_submissions(
 id TEXT PRIMARY KEY,duel_id TEXT NOT NULL REFERENCES duels(id),user_id TEXT NOT NULL REFERENCES users(id),
 level INTEGER NOT NULL,code_hash TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',
 received_at INTEGER NOT NULL,finished_at INTEGER,verdict TEXT
);
CREATE INDEX idx_duel_submission_room ON duel_submissions(duel_id,status);
CREATE UNIQUE INDEX idx_duel_pending_user ON duel_submissions(duel_id,user_id) WHERE status='pending';
