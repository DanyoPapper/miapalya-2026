-- Mi a pálya? 2026 v4

-- QR kapcsolók zónánként
ALTER TABLE zones ADD COLUMN IF NOT EXISTS qr_enabled BOOLEAN DEFAULT TRUE;

-- Globális QR kapcsoló a festival_settings-ben
INSERT INTO festival_settings (key, value) VALUES ('qr_global_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- Audit log részletesebb mezők
ALTER TABLE security_log ADD COLUMN IF NOT EXISTS admin_email VARCHAR(100);
ALTER TABLE security_log ADD COLUMN IF NOT EXISTS admin_role VARCHAR(20);

-- QR scan log (éles beolvasásokhoz)
CREATE TABLE IF NOT EXISTS qr_scans (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID REFERENCES sessions(id) ON DELETE CASCADE,
    zone_id     VARCHAR(20) REFERENCES zones(id),
    token_used  VARCHAR(20),
    success     BOOLEAN NOT NULL,
    error_code  VARCHAR(50),
    ip_address  INET,
    scanned_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_scans_session ON qr_scans(session_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_zone ON qr_scans(zone_id, scanned_at DESC);
