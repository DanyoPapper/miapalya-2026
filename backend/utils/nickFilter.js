/**
 * Becenév szűrő — szerveroldali validáció
 *
 * A frontend `filterNickname`-jével AZONOS logika, hogy érvényes becenevek
 * ne akadjanak el, de a nem megfelelő nevek a szerveren is elbukjanak
 * (a frontend megkerülhető DevTools-szal, a szerver nem).
 *
 * Tiltott: speciális karakterek, csak-szám, szitokszavak (magyar + angol),
 * rasszista / népcsoportot sértő kifejezések, egymást követő szóközök.
 */

const NICK_BLACKLIST = [
  // Magyar szitokszavak
  'kurva','fasz','baszik','baszd','baszom','baszott','kibaszott','megbaszott',
  'szar','szaros','szarja','geci','gecis','pöcs','pöcsöm','segg','segget',
  'segger','pina','pinás','ribanc','ribancok','rohadék','rohadt','dögölj',
  'ökör','bika','állat','idióta','hülye','takony','taknyos','köcsög',
  'buzi','buzis','meleg','melegek','retard','retardált','spasztics',
  // Rasszista / népcsoportot sértő (magyar)
  'cigány','cigányok','cigányozom','büdöscigány','zsidó','zsidók','zsidózom',
  'néger','négerek','fekete','kínai','mongol','mongolos',
  // Angol szitokszavak
  'fuck','fucking','fucked','fucker','shit','shitting','bitch','bastard',
  'asshole','dickhead','cunt','whore','slut','cock','prick','pussy',
  'wanker','twat','bollocks','motherfucker','motherfucking',
  // Rasszista / angol
  'nigger','nigga','negro','chink','spic','kike','faggot','dyke',
  'nazi','hitler','fascist',
  // Egyéb
  'terrorist','pedofil','pedophile',
];

/**
 * Becenév validálás.
 * @returns {string|null} hibaüzenet, vagy null ha érvényes
 */
function validateNickname(v) {
  const trimmed = (v == null ? '' : String(v)).trim();

  // Hossz
  if (trimmed.length < 2) return 'Legalább 2 karakter szükséges!';
  if (trimmed.length > 20) return 'Maximum 20 karakter lehet!';

  // Csak számok
  if (/^\d+$/.test(trimmed)) return 'A becenév nem állhat csak számokból!';

  // Engedélyezett karakterek: betű (magyar ékezetek is), szám, szóköz, . _ -
  if (/[^a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ0-9 ._-]/.test(trimmed)) {
    return 'Csak betűket, számokat és szóközt használhatsz!';
  }

  // Egymást követő szóközök
  if (/  /.test(trimmed)) return 'Egymást követő szóközök nem engedélyezettek!';

  // Blacklist ellenőrzés (kis/nagybetű + szóközök nélkül)
  const lower = trimmed.toLowerCase().replace(/\s/g, '');
  for (const word of NICK_BLACKLIST) {
    if (lower.includes(word)) {
      return 'Ez a becenév nem megfelelő. Kérj segítséget egy szervezőtől!';
    }
  }

  return null; // OK
}

/**
 * Becenév tisztítása mentés előtt (trim + max hossz).
 * A validáció után hívjuk, csak a biztonság kedvéért vág.
 */
function sanitizeNickname(v) {
  return (v == null ? '' : String(v)).trim().slice(0, 20);
}

module.exports = { validateNickname, sanitizeNickname, NICK_BLACKLIST };
