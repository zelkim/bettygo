const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function importKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function generateState(secret: string): Promise<string> {
  const ts = Date.now().toString();
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ts));
  return `${ts}.${bufToHex(sig)}`;
}

export async function verifyState(state: string, secret: string): Promise<boolean> {
  const dot = state.indexOf(".");
  if (dot === -1) return false;

  const ts = state.slice(0, dot);
  const sig = state.slice(dot + 1);

  const age = Date.now() - parseInt(ts, 10);
  if (isNaN(age) || age < 0 || age > STATE_TTL_MS) return false;

  const key = await importKey(secret);
  const expected = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ts));

  return sig === bufToHex(expected);
}
