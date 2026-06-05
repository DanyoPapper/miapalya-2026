-- Mi a pálya? 2026 v3 — Séma frissítés
-- Futtatsd a schema_v2.sql UTÁN

-- Becenév hozzáadása a sessions táblához (ha még nincs)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS nickname VARCHAR(20);

-- Admin felhasználók jelszó reset token támogatással
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

-- Zóna látogatások (animátor dashboardhoz)
CREATE TABLE IF NOT EXISTS zone_visits (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID REFERENCES sessions(id) ON DELETE CASCADE,
    zone_id     VARCHAR(20) REFERENCES zones(id),
    visited_at  TIMESTAMP DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_sessions_nickname ON sessions(nickname);
CREATE INDEX IF NOT EXISTS idx_zone_visits_zone ON zone_visits(zone_id, visited_at DESC);
