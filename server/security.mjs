import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const options = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const digest = await scrypt(password, salt, 64, options);
  return `scrypt$${salt}$${digest.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, salt, hex] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hex || hex.length !== 128) return false;
  const actual = Buffer.from(hex, 'hex');
  const candidate = await scrypt(password, salt, 64, options);
  return timingSafeEqual(candidate, actual);
}

export function newSessionToken() { return randomBytes(32).toString('base64url'); }
export function tokenHash(token) { return createHash('sha256').update(token).digest('hex'); }

export function cookieToken(header = '') {
  const match = header.split(';').map(part => part.trim()).find(part => part.startsWith('bookhaven_session='));
  return match ? match.slice('bookhaven_session='.length) : null;
}
