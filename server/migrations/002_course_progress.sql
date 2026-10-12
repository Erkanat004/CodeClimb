-- Keep the original progress table untouched: it remains the classic route.
CREATE TABLE course_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('python','cpp')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  data TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, language, difficulty)
);
