-- ════════════════════════════════════════════════════════════════════════════
-- schema_v5.sql — Teljesítmény-indexek nagy terheléshez (fesztiválnap)
-- Futtatás: psql "$DATABASE_URL" -f database/schema_v5.sql
-- Minden IF NOT EXISTS — biztonságosan újrafuttatható.
-- ════════════════════════════════════════════════════════════════════════════

-- Pecsét-keresés session + zóna szerint (a /scan endpoint duplikátum-ellenőrzése)
CREATE INDEX IF NOT EXISTS idx_stamps_session_zone ON stamps(session_id, zone_id);

-- Session created_at — a 24 órás lejárat-ellenőrzéshez
CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at DESC);

-- Aktív push üzenet gyors lekérése (a publikus /push cache mögött)
CREATE INDEX IF NOT EXISTS idx_push_active ON push_messages(active, created_at DESC) WHERE active = TRUE;

-- Aktív dátumok rendezve
CREATE INDEX IF NOT EXISTS idx_dates_active ON important_dates(active, event_date ASC) WHERE active = TRUE;

-- Aktív kiállítók zónánként
CREATE INDEX IF NOT EXISTS idx_exhibitors_active ON exhibitors(active, zone_id) WHERE active = TRUE;

-- QR scan napló (statisztikákhoz, ha sok adat gyűlik)
CREATE INDEX IF NOT EXISTS idx_qr_scans_zone ON qr_scans(zone_id, created_at DESC);

-- last_seen az élő felhasználók nézethez
CREATE INDEX IF NOT EXISTS idx_sessions_lastseen ON sessions(last_seen DESC NULLS LAST);
