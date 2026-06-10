CREATE TABLE IF NOT EXISTS status (
  id INTEGER PRIMARY KEY,
  isLocked TEXT,
  sentryOn TEXT,
  battery INTEGER,
  updated_at INTEGER
);