/**
 * Persistencia local del piloto.
 * - Duradera (localStorage): identidad + estado de piloto (matches, reportes, cupos, etc.).
 * - Sesión (sessionStorage): solo `zunela.session` (pestaña abierta).
 * Al leer, si hay valor viejo en sessionStorage se migra a localStorage.
 */

export function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function readDurable(key: string): string | null {
  if (!canUseBrowserStorage()) {
    return null;
  }
  const durable = localStorage.getItem(key);
  if (durable !== null) {
    return durable;
  }
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  const legacy = sessionStorage.getItem(key);
  if (legacy === null) {
    return null;
  }
  localStorage.setItem(key, legacy);
  sessionStorage.removeItem(key);
  return legacy;
}

export function writeDurable(key: string, value: string) {
  if (!canUseBrowserStorage()) {
    return;
  }
  localStorage.setItem(key, value);
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(key);
  }
}

export function removeDurable(key: string) {
  if (!canUseBrowserStorage()) {
    return;
  }
  localStorage.removeItem(key);
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(key);
  }
}

export function clearDurableKeys(keys: string[]) {
  for (const key of keys) {
    removeDurable(key);
  }
}
