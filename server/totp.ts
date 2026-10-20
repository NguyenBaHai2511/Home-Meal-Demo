import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret() {
  const bytes = randomBytes(20);
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  let secret = '';
  for (let index = 0; index < bits.length; index += 5) secret += ALPHABET[parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  return secret;
}

function decodeBase32(value: string) {
  let bits = '';
  for (const character of value.toUpperCase().replace(/=+$/g, '')) {
    const index = ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Invalid base32 secret.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

export function verifyTotp(secret: string, input: string, now = Date.now()) {
  const code = input.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) return false;
  const key = decodeBase32(secret);
  const counter = Math.floor(now / 30_000);
  for (let offset = -1; offset <= 1; offset += 1) {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(counter + offset));
    const digest = createHmac('sha1', key).update(buffer).digest();
    const index = digest[digest.length - 1] & 0x0f;
    const value = (digest.readUInt32BE(index) & 0x7fffffff) % 1_000_000;
    const expected = String(value).padStart(6, '0');
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return true;
  }
  return false;
}

function encryptionKey() {
  const value = process.env.MFA_ENCRYPTION_KEY;
  if (!value) throw new Error('MFA_ENCRYPTION_KEY must be configured before enabling admin MFA.');
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('MFA_ENCRYPTION_KEY must be a base64 encoded 32-byte key.');
  return key;
}

export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64url'), iv: iv.toString('base64url'), tag: cipher.getAuthTag().toString('base64url') };
}

export function decryptTotpSecret(value: { ciphertext: string; iv: string; tag: string }) {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(value.iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(value.tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}
