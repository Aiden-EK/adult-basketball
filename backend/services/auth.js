const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);
const configuredSessionDays = Number(process.env.SESSION_TTL_DAYS || 7);
const SESSION_DAYS = Number.isFinite(configuredSessionDays) && configuredSessionDays > 0 ? configuredSessionDays : 7;
const allowedSameSiteValues = ['strict', 'lax', 'none'];

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [algorithm, saltHex, keyHex] = String(stored || '').split('$');
  if (algorithm !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function createSessionToken() { return crypto.randomBytes(32).toString('base64url'); }
function hashSessionToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function cookieOptions() {
  const configuredSameSite = String(process.env.SESSION_COOKIE_SAME_SITE || 'strict').toLowerCase();
  const sameSite = allowedSameSiteValues.includes(configuredSameSite) ? configuredSameSite : 'strict';
  const secure = process.env.SESSION_COOKIE_SECURE === 'true';
  return { httpOnly: true, sameSite, secure: sameSite === 'none' ? true : secure, path: '/', maxAge: Math.floor(SESSION_DAYS * 86400) };
}
function serializeCookie(name, value, options = cookieOptions()) {
  return [`${name}=${encodeURIComponent(value)}`, `Max-Age=${options.maxAge}`, `Path=${options.path}`, 'HttpOnly', `SameSite=${options.sameSite}`, options.secure ? 'Secure' : ''].filter(Boolean).join('; ');
}
function readCookie(header, name) {
  for (const item of String(header || '').split(';')) { const [key, ...rest] = item.trim().split('='); if (key === name) return decodeURIComponent(rest.join('=')); }
  return null;
}

module.exports = { SESSION_DAYS, hashPassword, verifyPassword, createSessionToken, hashSessionToken, cookieOptions, serializeCookie, readCookie };
