/**
 * Mi a pálya? 2026 — Service Worker
 *
 * Célja KIZÁRÓLAG: telepíthető PWA + az app-héj offline elérése.
 *
 * FONTOS BIZTONSÁGI ELV:
 *  - SOHA nem nyúl az API-hívásokhoz (a backend másik origin-en van, és minden
 *    scan/pecsét POST kérés — ezeket a handler érintetlenül átengedi).
 *  - Csak a SAJÁT origin GET kéréseit cache-eli (HTML, ikonok, manifest).
 *  - A HTML-t "network-first" tölti (mindig friss verzió, ha van net),
 *    offline esetben a cache-elt változatot adja.
 *  - A statikus fájlokat "cache-first" (gyors betöltés).
 */

const CACHE = 'miapalya-2026-v1';

// Az app-héj, amit előre cache-elünk (offline induláshoz)
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/apple-touch-icon.png',
];

// ── Telepítés: app-héj előcache-elése ────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── Aktiválás: régi cache-ek törlése ─────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Kérések kezelése ─────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Csak GET kéréseket kezelünk. Minden POST/PUT/DELETE (pl. /scan, /manual,
  //    /nickname, /profile/save) ÉRINTETLENÜL átmegy a hálózatra.
  if (req.method !== 'GET') return;

  // 2. Csak a SAJÁT origin kéréseit kezeljük. A backend API (Railway) és a
  //    külső CDN-ek (fonts, unpkg) érintetlenül átmennek.
  if (url.origin !== self.location.origin) return;

  // 3. Az /api/ útvonalakat sosem cache-eljük (biztonsági tartalék, ha valaha
  //    same-origin proxy lenne).
  if (url.pathname.startsWith('/api/')) return;

  // 4. Navigáció (HTML oldal betöltése) → network-first, offline fallback cache.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/index.html')))
    );
    return;
  }

  // 5. Statikus fájlok (ikonok, manifest) → cache-first, háttérben frissítve.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
