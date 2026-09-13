const encoder = new TextEncoder();

async function signature(value: string, password: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signed), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createAccessToken(password: string) {
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7;
  return `${expiresAt}.${await signature(String(expiresAt), password)}`;
}

export async function hasValidAccessToken(token: string | undefined, password: string) {
  if (!token) return false;
  const [expiresAt, providedSignature] = token.split(".");
  if (!expiresAt || !providedSignature || Number(expiresAt) < Date.now()) return false;
  return providedSignature === await signature(expiresAt, password);
}
