CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  expires_at INTEGER
);