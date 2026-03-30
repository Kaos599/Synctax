const UNSAFE_NAME_FRAGMENT = /[\/\\\0]/;

export function isSafeResourceName(name: string): boolean {
  if (typeof name !== "string") return false;

  const trimmed = name.trim();
  if (trimmed.length === 0) return false;
  if (trimmed !== name) return false;
  if (name === "." || name === "..") return false;
  if (name.includes("..")) return false;
  if (UNSAFE_NAME_FRAGMENT.test(name)) return false;

  return true;
}

export function assertSafeResourceName(name: string, label: string): void {
  if (!isSafeResourceName(name)) {
    throw new Error(`Invalid ${label} key: ${name}`);
  }
}

export function assertSafeResourceMapKeys(
  records: Record<string, unknown> | undefined,
  label: string,
): void {
  if (!records) return;

  for (const key of Object.keys(records)) {
    assertSafeResourceName(key, label);
  }
}
