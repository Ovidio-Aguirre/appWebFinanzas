/**
 * Sesión firmada (HMAC-SHA256) sin dependencias externas.
 * Usa Web Crypto, por lo que funciona tanto en middleware como en Node.
 * Token: base64url(payload JSON) + "." + base64url(firma)
 */
export const SESSION_COOKIE = "fp_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 días

interface SessionPayload {
  u: string; // usuario
  exp: number; // epoch segundos
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): Uint8Array<ArrayBuffer> {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(
  username: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<string> {
  const payload: SessionPayload = {
    u: username,
    exp: nowSeconds + SESSION_MAX_AGE_SECONDS,
  };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign(
    "HMAC",
    await getKey(secret),
    encoder.encode(body)
  );
  return `${body}.${toBase64Url(new Uint8Array(sig))}`;
}

/** Devuelve el usuario si el token es válido y no expiró; si no, null. */
export async function verifySessionToken(
  token: string | undefined,
  secret: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<string | null> {
  if (!token || !secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await getKey(secret),
      fromBase64Url(sig),
      encoder.encode(body)
    );
    if (!ok) return null;
    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(body))
    ) as SessionPayload;
    if (typeof payload.u !== "string" || payload.exp <= nowSeconds) return null;
    return payload.u;
  } catch {
    return null;
  }
}
