-- Alap zóna adatok
INSERT INTO zones (id, name, emoji, location) VALUES
  ('energia', 'Zöld Energia & Fenntartható Tech', '⚡', 'A-csarnok, 3. sor'),
  ('ipar',    'Ipar 4.0 & Automatizálás',         '🤖', 'B-csarnok, 1. sor'),
  ('kiber',   'Kiberbiztonság & IT Biztonság',     '🔐', 'B-csarnok, 4. sor'),
  ('jarmu',   'Smart Mobilitás & Járműipar',       '🚗', 'A-csarnok, 1. sor'),
  ('feny',    'Fény és Világítástechnika',         '💡', 'C-csarnok, 2. sor'),
  ('smart',   'Okos Otthonok & IoT',               '🏠', 'C-csarnok, 5. sor'),
  ('halo',    'Hálózati Tech & Telekommunikáció',  '📡', 'D-csarnok, 3. sor'),
  ('print3d', 'Additív Gyártás & 3D Világ',        '🖨', 'D-csarnok, 1. sor')
ON CONFLICT (id) DO NOTHING;

-- Demo admin (jelszó: Admin2026! — éles környezetben cseréld le!)
-- Generálás: node -e "const b=require('bcrypt');b.hash('Admin2026!',12).then(console.log)"
INSERT INTO admin_users (email, password_hash, role) VALUES
  ('admin@mee.hu', '$2b$12$PLACEHOLDER_REPLACE_WITH_REAL_HASH', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Demo belépési kódok (teszteléshez)
INSERT INTO entry_codes (code, expires_at) VALUES
  ('DEMO0001', NOW() + INTERVAL '30 days'),
  ('DEMO0002', NOW() + INTERVAL '30 days'),
  ('DEMO0003', NOW() + INTERVAL '30 days')
ON CONFLICT (code) DO NOTHING;
