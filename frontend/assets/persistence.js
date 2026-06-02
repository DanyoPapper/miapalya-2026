/**
 * Mi a pálya? 2026 — Adat-perzisztencia modul
 * 
 * Kétrétegű megoldás:
 *   1. localStorage — azonnali, offline is működik, böngésző-szintű
 *   2. Szerver szinkron — session token alapján, bármilyen eszközön visszaállítható
 * 
 * Hogyan működik a diák szemszögéből:
 *   - Belépéskor (QR-kód a bejáratnál) kap egy egyedi linket:
 *     https://miapálya.hu/app?token=A3KX9M2P
 *   - Ez a token az URL-ben van → ha bezárja és visszanyitja, minden ott van
 *   - A localStorage ráadásul cache-eli az adatot → offline is látható
 */

const STORAGE_KEY = 'miapálya_2026';
const API_BASE = 'https://api.miapálya.hu'; // élesben

// ─── HELYI TÁROLÁS (localStorage) ───────────────────────────────────────────

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocal(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...data,
      savedAt: new Date().toISOString()
    }));
  } catch (e) {
    console.warn('localStorage nem elérhető:', e);
  }
}

// ─── SESSION TOKEN (URL-ből) ─────────────────────────────────────────────────

function getSessionToken() {
  // Először URL paraméterből
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token');
  if (urlToken) {
    // Elmentjük localStorage-ba is, ha elveszítené az URL-t
    const local = loadLocal() || {};
    if (!local.sessionToken) {
      saveLocal({ ...local, sessionToken: urlToken });
    }
    return urlToken;
  }
  // Ha nincs URL paraméter, localStorage-ból
  const local = loadLocal();
  return local?.sessionToken || null;
}

// ─── FŐ ÁLLAPOT BETÖLTÉSE ────────────────────────────────────────────────────

async function loadState() {
  const token = getSessionToken();
  
  // Ha nincs session token → teljesen új látogató, kezdőállapot
  if (!token) {
    return getDefaultState();
  }

  // 1. Azonnal betöltjük a localStorage-t (gyors, offline is megy)
  const local = loadLocal();
  const localState = local?.gameState || null;

  // 2. Háttérben szinkronizálunk a szerverrel
  try {
    const response = await fetch(`${API_BASE}/api/profile/${token}`);
    if (response.ok) {
      const serverData = await response.json();
      // Szerver az igazság forrása — felülírja a lokálisat
      const merged = mergeStates(localState, serverData);
      saveLocal({ sessionToken: token, gameState: merged });
      return merged;
    }
  } catch (e) {
    console.warn('Szerver nem elérhető, lokális adatból töltünk:', e);
  }

  // Ha a szerver nem elérhető, a lokális adatból dolgozunk
  return localState || getDefaultState();
}

// ─── ÁLLAPOT MENTÉSE ─────────────────────────────────────────────────────────

async function saveState(state) {
  const token = getSessionToken();
  
  // 1. Azonnal localStorage-ba
  saveLocal({ sessionToken: token, gameState: state });

  // 2. Aszinkron szerverre is
  if (token) {
    try {
      await fetch(`${API_BASE}/api/profile/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: token,
          quizAnswers: state.answers,
          profileId: state.profile,
          collectedStamps: state.collectedStamps
        })
      });
    } catch (e) {
      // Offline → majd legközelebbi online szinkronizálja
      console.warn('Offline — csak lokálisan mentve');
    }
  }
}

// ─── PECSÉT BEGYŰJTÉSE ───────────────────────────────────────────────────────

async function collectStamp(zoneId, qrToken) {
  const token = getSessionToken();
  
  if (!token) {
    return { success: false, error: 'NO_SESSION', message: 'Kérj session tokent a bejáratnál!' };
  }

  // Szerver oldali validálás — itt történik a QR token ellenőrzés
  try {
    const response = await fetch(`${API_BASE}/api/stamps/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken: token, zoneId, qrToken })
    });

    const result = await response.json();

    if (result.success) {
      // Lokálisan is frissítjük azonnal
      const local = loadLocal();
      const gameState = local?.gameState || getDefaultState();
      if (!gameState.collectedStamps.includes(zoneId)) {
        gameState.collectedStamps.push(zoneId);
        saveLocal({ sessionToken: token, gameState });
      }
    }

    return result;

  } catch (e) {
    // Offline esetén: jelezzük, de ne gyűjtsük be lokálisan
    // (majd szerveren is validálni kell)
    return { 
      success: false, 
      error: 'OFFLINE', 
      message: 'Nincs internetkapcsolat. Kérj segítséget az animátortól!' 
    };
  }
}

// ─── SEGÉDFÜGGVÉNYEK ─────────────────────────────────────────────────────────

function getDefaultState() {
  return {
    currentQ: 0,
    answers: [],
    selected: null,
    collectedStamps: [],
    profile: null
  };
}

function mergeStates(local, server) {
  // A szerver a truth source, de ha valami lokálisan újabb, azt megtartjuk
  const stamps = new Set([
    ...(server.collectedStamps || []),
    ...(local?.collectedStamps || [])
  ]);
  return {
    currentQ: server.quizCompleted ? 4 : (local?.currentQ || 0),
    answers: server.quizAnswers || local?.answers || [],
    collectedStamps: Array.from(stamps),
    profile: server.profileId || local?.profile || null,
    selected: null
  };
}

// ─── EXPORTÁLÁS ──────────────────────────────────────────────────────────────

export { loadState, saveState, collectStamp, getSessionToken };
