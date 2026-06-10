CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  expires_at INTEGER
);