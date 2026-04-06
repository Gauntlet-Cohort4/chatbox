/**
 * Crypto utilities for token / code / session ID generation.
 *
 * Uses the WebCrypto API (crypto.getRandomValues) which is available in
 * Cloudflare Workers, Node 18+, and Vitest's node environment.
 */

const HEX_ALPHABET = '0123456789abcdef'
const JOIN_CODE_ALPHABET = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) {
    out += HEX_ALPHABET[(b >> 4) & 0xf] + HEX_ALPHABET[b & 0xf]
  }
  return out
}

/** Generate `lengthBytes` of random data as a hex string (2× length chars). */
export function randomHex(lengthBytes: number): string {
  const bytes = new Uint8Array(lengthBytes)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

/** Generate a 6-character uppercase alphanumeric join code (no ambiguous glyphs). */
export function randomJoinCode(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  let code = ''
  for (const b of bytes) {
    code += JOIN_CODE_ALPHABET[b % JOIN_CODE_ALPHABET.length]
  }
  return code
}

/** Generate a URL-safe-ish random token (hex, fixed length). */
export function randomToken(lengthBytes = 32): string {
  return randomHex(lengthBytes)
}
