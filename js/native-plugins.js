// ============================================================
// Löwenherz — Zugriff auf offizielle Capacitor-Plugins (nur nativ)
// ============================================================
//
// Die App hat keinen Bundler. Statt für jedes offizielle Plugin dessen
// JS-Dist zu vendorn (wie bei OneSignal nötig, siehe build-ios.mjs),
// nutzt dieser Weg registerPlugin() aus dem bereits gevendorten
// @capacitor/core: Die offiziellen Plugin-Pakete sind dünne
// registerPlugin-Wrapper — nativ ist der direkte Proxy funktionsgleich.
// Die npm-Pakete braucht es trotzdem: Sie liefern die Swift-Seite via SPM.
//
// Enum-Werte sind hier Strings ('LIGHT', 'CACHE', …) — verifiziert gegen
// die dist/esm/definitions.js der installierten Plugin-Versionen.
//
// www/js/vendor/capacitor-core.js existiert NUR im iOS-Bundle, nie im Web
// und nie im Repo — deshalb der dynamische Import hinter isNative(),
// gleiches Muster wie SDK_PATH in push-native.js.
// ============================================================

import { isNative } from './platform.js';

const CORE_PATH = './vendor/capacitor-core.js';
let corePromise = null;
const registered = new Map();

/**
 * Liefert den nativen Plugin-Proxy oder null (Web, Ladefehler).
 * Wirft nie — Aufrufer prüfen auf null.
 * @param {string} name  Nativer Plugin-Name, z.B. 'Haptics', 'Browser'
 */
export function nativePlugin(name) {
  if (!isNative()) return Promise.resolve(null);
  if (!corePromise) {
    corePromise = import(CORE_PATH).catch((e) => {
      console.warn('[Native] Vendor-Core nicht ladbar:', e);
      return null;
    });
  }
  if (!registered.has(name)) {
    registered.set(name, corePromise.then((core) => {
      if (!core) return null;
      const proxy = core.registerPlugin(name);
      // Der Capacitor-Proxy beantwortet JEDEN Property-Zugriff mit einem
      // Methoden-Wrapper — auch `.then`. Ein Promise, das mit ihm resolved,
      // hält ihn deshalb für ein Thenable und ruft `then()` als native
      // Methode auf: „X.then() is not implemented on ios", und die
      // Aufrufer-Kette hängt für immer. Die Hülle maskiert nur `then`.
      return new Proxy(proxy, {
        get: (target, prop) => (prop === 'then' ? undefined : target[prop])
      });
    }));
  }
  return registered.get(name);
}
