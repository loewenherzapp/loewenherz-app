// Testet das Öffnen der Datenbank in js/db.js mit einer IndexedDB-Attrappe.
//
//   npm run test:db
//
// Warum es diesen Test gibt: Scheiterte das Öffnen ein einziges Mal, lief
// die App früher still im Arbeitsspeicher weiter und begann mit dem
// Onboarding von vorn — für die Nutzerin sah das aus wie „alle Punkte
// weg" (Tester-Rückmeldung 06.10.2026). Geprüft wird: Wiederholung bei
// Fehlschlägen, ehrliche Meldung des Arbeitsspeicher-Modus, kein ewiges
// Warten bei einer blockierten Datenbank.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../js/db.js');

// Attrappe: IndexedDB, deren open() die ersten `fehler` Male scheitert
function fakeIDB(fehler, art = 'error') {
  let aufrufe = 0;
  return {
    get aufrufe() { return aufrufe; },
    open() {
      aufrufe++;
      const req = {};
      setTimeout(() => {
        if (aufrufe <= fehler) {
          if (art === 'throw') return; // nicht genutzt
          if (art === 'blocked') { req.onblocked && req.onblocked(); return; }
          req.error = new Error('UnknownError: Internal error opening backing store');
          req.onerror && req.onerror();
        } else {
          const db = { objectStoreNames: { contains: () => true }, close() {} };
          req.onsuccess && req.onsuccess({ target: { result: db } });
        }
      }, 5);
      return req;
    }
  };
}

async function lade(idb) {
  const dir = mkdtempSync(join(tmpdir(), 'db-'));
  const f = join(dir, 'db.mjs');
  writeFileSync(f, readFileSync(SRC, 'utf8'));
  globalThis.window = { indexedDB: idb };
  globalThis.indexedDB = idb;
  globalThis.self = { indexedDB: idb };
  return import(f + '?' + Math.random());
}

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok    ' : 'FAIL  ') + msg); if (!ok) fails++; };
const origWarn = console.warn; console.warn = () => {};

{ const idb = fakeIDB(2); const m = await lade(idb); const r = await m.initDB();
  check(r !== null && !m.nurArbeitsspeicher() && idb.aufrufe === 3, `2 Fehlschläge, 3. Versuch klappt → Datenbank da (Versuche: ${idb.aufrufe})`); }
{ const idb = fakeIDB(5); const m = await lade(idb); const r = await m.initDB();
  check(r === null && m.nurArbeitsspeicher() && idb.aufrufe === 3, `3 Fehlschläge → Arbeitsspeicher-Modus gemeldet (Versuche: ${idb.aufrufe})`); }
{ const idb = fakeIDB(0); const m = await lade(idb); const r = await m.initDB();
  check(r !== null && !m.nurArbeitsspeicher() && idb.aufrufe === 1, 'Normalfall: ein Versuch, kein Arbeitsspeicher'); }
{ const t0 = Date.now(); const idb = fakeIDB(1, 'blocked'); const m = await lade(idb); const r = await m.initDB();
  check(r !== null && Date.now() - t0 >= 4000 && Date.now() - t0 < 6000, `blockiert → nach ~4 s neuer Versuch klappt (${Date.now() - t0} ms)`); }
console.warn = origWarn;
console.log(fails ? `${fails} FEHLER` : 'Alle Tests bestanden.');
process.exit(fails ? 1 : 0);
