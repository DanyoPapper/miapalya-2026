-- Mi a pálya? 2026 v2 — Új táblák
-- Futtasd az eredeti schema.sql UTÁN

CREATE TABLE IF NOT EXISTS festival_settings (
    key        VARCHAR(50) PRIMARY KEY,
    value      TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO festival_settings (key, value) VALUES
  ('festival_active', 'true'),
  ('festival_name',   'Mi a pálya? 2026'),
  ('festival_date',   '2026-10-15')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS push_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message     TEXT NOT NULL,
    duration_ms INTEGER DEFAULT 10000,
    active      BOOLEAN DEFAULT TRUE,
    created_by  VARCHAR(100),
    created_at  TIMESTAMP DEFAULT NOW(),
    expires_at  TIMESTAMP
);

CREATE TABLE IF NOT EXISTS important_dates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(200) NOT NULL,
    event_date  DATE NOT NULL,
    location    VARCHAR(200),
    description TEXT,
    category    VARCHAR(50) DEFAULT 'egyeb',
    link        VARCHAR(500),
    active      BOOLEAN DEFAULT TRUE,
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exhibitors (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(200) NOT NULL,
    zone_id     VARCHAR(20),
    description TEXT,
    youtube_url VARCHAR(500),
    website_url VARCHAR(500),
    logo_url    VARCHAR(500),
    active      BOOLEAN DEFAULT TRUE,
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS festival_map (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url   TEXT NOT NULL,
    label       VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT NOW(),
    active      BOOLEAN DEFAULT TRUE
);

INSERT INTO important_dates (title, event_date, location, category) VALUES
  ('BME Nyílt Nap',              '2026-11-08', 'Budapest, Műegyetem rakpart 3.', 'iskola'),
  ('Audi Hungaria Nyílt Kapu',   '2026-11-15', 'Győr, Audi Hungaria út 1.',       'ceg'),
  ('Pannon Egyetem Nyílt Nap',   '2026-11-22', 'Veszprém, Egyetem u. 10.',        'iskola'),
  ('MVM Karriernap',             '2026-12-05', 'Budapest, Könyves Kálmán krt.',   'ceg'),
  ('Miskolci Egyetem Nyílt Nap', '2026-11-29', 'Miskolc, Egyetemváros',           'iskola')
ON CONFLICT DO NOTHING;

INSERT INTO exhibitors (name, zone_id, description, youtube_url, website_url, sort_order) VALUES
  ('MVM Csoport',     'energia', 'Magyarország vezető energetikai vállalata. Megújuló energia, okos hálózatok, villamosenergia-rendszerek.', '', 'https://mvm.hu', 1),
  ('Bosch Hungary',   'ipar',    'Ipar 4.0, robotika és automatizálás a jövő gyáraiért. Globális technológiai cég, magyarországi K+F központtal.', '', 'https://bosch.hu', 2),
  ('ESET Magyarország','kiber',  'Kiberbiztonsági megoldások és etikus hacking képzések. Közép-európai IT biztonsági piacvezető.', '', 'https://eset.com/hu', 3),
  ('Audi Hungaria',   'jarmu',   'Elektromos járművek, önvezető technológia és járműelektronika. Győri gyárban 12 000+ mérnök dolgozik.', '', 'https://audi.hu', 4),
  ('Signify',         'feny',    'Okos világítástechnika, LED rendszerek és fénytervezés. A Philips Lighting utódja.', '', 'https://signify.com', 5)
ON CONFLICT DO NOTHING;
