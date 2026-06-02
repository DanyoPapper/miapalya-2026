-- Mi a pálya? 2026 — Adatbázis séma
-- Futtatás: psql -U postgres -d miapálya -f database/schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Zónák
CREATE TABLE IF NOT EXISTS zones (
    id          VARCHAR(20) PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    emoji       VARCHAR(10),
    location    VARCHAR(100),
    active      BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Bejárati kódok (belépéskor kiosztva)
CREATE TABLE IF NOT EXISTS entry_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(20) UNIQUE NOT NULL,
    used        BOOLEAN DEFAULT FALSE,
    used_at     TIMESTAMP,
    expires_at  TIMESTAMP NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Diák sessionök
CREATE TABLE IF NOT EXISTS sessions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token        VARCHAR(32) UNIQUE NOT NULL,
    name         VARCHAR(100),
    quiz_answers JSONB,
    profile_id   VARCHAR(20),
    created_at   TIMESTAMP DEFAULT NOW(),
    last_seen    TIMESTAMP DEFAULT NOW()
);

-- Pecsétek (egy zónából csak egy session-onként)
CREATE TABLE IF NOT EXISTS stamps (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   UUID REFERENCES sessions(id) ON DELETE CASCADE,
    zone_id      VARCHAR(20) REFERENCES zones(id),
    qr_token     VARCHAR(20),
    ip_address   INET,
    collected_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(session_id, zone_id)
);

-- Biztonsági napló
CREATE TABLE IF NOT EXISTS security_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type  VARCHAR(50) NOT NULL,
    session_id  UUID,
    zone_id     VARCHAR(20),
    ip_address  INET,
    token_used  VARCHAR(20),
    details     JSONB,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Blokkolt IP-k
CREATE TABLE IF NOT EXISTS blocked_ips (
    ip_address  INET PRIMARY KEY,
    reason      TEXT,
    blocked_by  VARCHAR(100),
    blocked_at  TIMESTAMP DEFAULT NOW()
);

-- Admin felhasználók
CREATE TABLE IF NOT EXISTS admin_users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    role          VARCHAR(20) NOT NULL CHECK (role IN ('admin','animator','exhibitor')),
    zone_id       VARCHAR(20) REFERENCES zones(id),
    created_at    TIMESTAMP DEFAULT NOW()
);

-- Indexek a gyors lekérdezésekhez
CREATE INDEX IF NOT EXISTS idx_stamps_session    ON stamps(session_id);
CREATE INDEX IF NOT EXISTS idx_stamps_zone       ON stamps(zone_id);
CREATE INDEX IF NOT EXISTS idx_security_log_type ON security_log(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_token    ON sessions(token);
