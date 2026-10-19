// Tiny key-value store on IndexedDB with a localStorage fallback.
// Chats live in IndexedDB (large, async); small settings stay in localStorage.
const DB_NAME = 'nova', STORE = 'kv';

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no idb'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function kvGet(key, fallback = null) {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result ?? fallback);
      r.onerror = () => reject(r.error);
    });
  } catch {
    try { const v = localStorage.getItem('nova:' + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  }
}

export async function kvSet(key, value) {
  try {
    const db = await open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try { localStorage.setItem('nova:' + key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
  }
}

/** Load chats; migrate the legacy v0 localStorage key once. */
export async function loadChats() {
  const chats = await kvGet('chats', null);
  if (chats) return chats;
  try {
    const legacy = JSON.parse(localStorage.getItem('nova-chats') || '[]');
    if (Array.isArray(legacy) && legacy.length) {
      const migrated = legacy.map(migrateChat);
      await kvSet('chats', migrated);
      return migrated;
    }
  } catch { /* ignore */ }
  return [];
}

function migrateChat(c) {
  return {
    id: c.id, title: c.title || 'Chat', updatedAt: c.updatedAt || Date.now(),
    messages: (c.messages || []).map((m, i) => ({
      id: `${c.id}-${i}`, role: m.role === 'user' ? 'user' : 'assistant', status: 'done',
      text: m.text || (m.sections ? m.sections.map((s) => `**${s.title}**\n${s.body}`).join('\n\n') : ''),
      sources: (m.results || []).filter((r) => r.kind !== 'image'), images: (m.results || []).filter((r) => r.kind === 'image'),
    })),
  };
}

export const settingsStore = {
  load(defaults) {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem('nova-settings') || '{}') }; } catch { return { ...defaults }; }
  },
  save(s) { try { localStorage.setItem('nova-settings', JSON.stringify(s)); } catch { /* ignore */ } },
};
