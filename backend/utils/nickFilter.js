/**
 * Becenév szűrő — szerveroldali validáció (v4.7.2)
 *
 * OKOS NORMALIZÁLÁS, ami az elkerülő próbálkozásokat is elkapja:
 *   - ékezet-hajtogatás:      "kúrva"  → "kurva"
 *   - szeparátor-eltávolítás: "k.u.r.v.a", "k u r v a" → "kurva"
 *   - leetspeak-visszafejtés: "f4sz" → "fasz", "b1tch" → "bitch", "g3ci" → "geci"
 *
 * FONTOS: a tiltólista szavai MÁR ékezet nélküli, kisbetűs formában vannak,
 * mert a normalizálás is ilyenre alakítja a becenevet.
 */

const ACCENTS = { 'á':'a','é':'e','í':'i','ó':'o','ö':'o','ő':'o','ú':'u','ü':'u','ű':'u' };
function foldAccents(s) {
  return s.replace(/[áéíóöőúüű]/g, (c) => ACCENTS[c] || c);
}

function normalize(s, leet) {
  let t = foldAccents(String(s || '').toLowerCase());
  if (leet) {
    t = t.replace(/@/g, 'a').replace(/\$/g, 's');
  }
  t = t.replace(/[^a-z0-9]/g, '');
  if (leet) {
    t = t.replace(/4/g, 'a').replace(/3/g, 'e').replace(/1/g, 'i')
         .replace(/0/g, 'o').replace(/5/g, 's').replace(/7/g, 't')
         .replace(/8/g, 'b').replace(/9/g, 'g');
  }
  return t;
}

// Részkarakterlánc egyezés — megkülönböztető szavak (ékezet nélkül, kisbetűvel)
const SUBSTRING_BLACKLIST = [
  // Magyar szitokszavak
  'kurva','kurvanyad','kirva','k1rva','fasz','faszfej','faszkalap','baszik',
  'baszd','baszom','baszott','baszdmeg','bazdmeg','kibaszott','megbaszott',
  'geci','gecis','gecifej','pocs','pocsom','picsa','segg','segget','segger',
  'pina','pinas','ribanc','ribancok','rohadek','rohadt','szar','szaros',
  'szarja','szarhazi','dogolj','idiota','takony','taknyos','kocsog','buzi',
  'buzis','spasztics','retardalt',
  // Rasszista / népcsoportot sértő (magyar)
  'cigany','ciganyok','ciganyozom','budoscigany','zsido','zsidok','zsidozom',
  'neger','negerek',
  // Angol szitokszavak + erőszak
  'fuck','fucking','fucked','fucker','shit','shitting','bitch','bastard','kill',
  'asshole','dickhead','dick','cunt','whore','slut','cock','prick','pussy',
  'wanker','twat','bollocks','motherfucker','motherfucking','retard','faggot',
  'dyke','blowjob','dildo',
  // Rasszista / gyűlöletkeltő (angol)
  'nigger','nigga','negro','chink','spic','kike','nazi','hitler','heilhitler',
  'whitepower','fascist','fasiszta',
  // Szélsőséges / erőszak / terror
  'terrorist','terror','isis','pedofil','pedophile','bomb','murder','gyilkos',
  // Szexuális tartalom
  'porno','porn','anal','cum',
];

// Pontos egyezés — rövid / gyakori szavak (részkarakterláncként ártatlan neveket
// blokkolnának). Csak akkor tiltjuk, ha a TELJES becenév ez a szó (opcionális
// záró számokkal, pl. "mod", "admin42").
const EXACT_BLACKLIST = [
  'admin','administrator','root','system','owner','support','moderator','mod',
  'staff','szervezo','rendszergazda','tanar','szemelyzet',
  'sex','kkk',
];

function validateNickname(v) {
  const trimmed = (v == null ? '' : String(v)).trim();

  if (trimmed.length < 2) return 'Legalább 2 karakter szükséges!';
  if (trimmed.length > 20) return 'Maximum 20 karakter lehet!';

  if (/^\d+$/.test(trimmed)) return 'A becenév nem állhat csak számokból!';

  if (/[^a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ0-9 ._-]/.test(trimmed)) {
    return 'Csak betűket, számokat és szóközt használhatsz!';
  }

  if (/  /.test(trimmed)) return 'Egymást követő szóközök nem engedélyezettek!';

  const basic = normalize(trimmed, false);
  const leet  = normalize(trimmed, true);

  for (const word of SUBSTRING_BLACKLIST) {
    if (basic.includes(word) || leet.includes(word)) {
      return 'Ez a becenév nem megfelelő. Válassz másikat!';
    }
  }

  const basicNoTrailNum = basic.replace(/\d+$/, '');
  const leetNoTrailNum  = leet.replace(/\d+$/, '');
  for (const word of EXACT_BLACKLIST) {
    if (basic === word || leet === word ||
        basicNoTrailNum === word || leetNoTrailNum === word) {
      return 'Ez a név nem választható. Válassz másikat!';
    }
  }

  return null;
}

function sanitizeNickname(v) {
  return (v == null ? '' : String(v)).trim().slice(0, 20);
}

module.exports = { validateNickname, sanitizeNickname, SUBSTRING_BLACKLIST, EXACT_BLACKLIST };
