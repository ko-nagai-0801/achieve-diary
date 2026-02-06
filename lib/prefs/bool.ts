/* lib/prefs/bool.ts */
export function loadBool(storage: Storage, key: string, defaultValue: boolean): boolean {
  const raw = storage.getItem(key);
  if (!raw) return defaultValue;
  if (raw === "1") return true;
  if (raw === "0") return false;
  return defaultValue;
}

export function saveBool(storage: Storage, key: string, value: boolean): void {
  storage.setItem(key, value ? "1" : "0");
}
