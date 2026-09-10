const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);
const configuredSessionDays = Number(process.env.SESSION_TTL_DAYS || 7);
const SESSION_DAYS = Number.isFinite(configuredSessionDays) && configuredSessionDays > 0 ? configuredSessionDays : 7;
const allowedSameSiteValues = ['strict', 'lax', 'none'];
const commonPasswords = new Set(['admin12345', 'basketball1', 'password123', 'qwerty12345', 'welcome1234']);

function validateAdminPassword(password, loginId = '') {
  if (typeof password !== 'string' || password.length < 10) return '비밀번호는 10자 이상이어야 합니다.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return '비밀번호에는 영문과 숫자가 모두 포함되어야 합니다.';
  const normalized = password.toLowerCase();
  if (commonPasswords.has(normalized)) return '너무 단순한 비밀번호는 사용할 수 없습니다.';
  const normalizedLoginId = String(loginId).trim().toLowerCase();
  if (normalizedLoginId.length >= 3 && normalized.includes(normalizedLoginId)) return '비밀번호에 관리자 ID를 포함할 수 없습니다.';
  return null;
}

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
function cookieOptions(overrides = {}) {
  const configuredSameSite = String(process.env.SESSION_COOKIE_SAME_SITE || 'strict').toLowerCase();
  const sameSite = allowedSameSiteValues.includes(configuredSameSite) ? configuredSameSite : 'strict';
  const secure = overrides.secure ?? process.env.SESSION_COOKIE_SECURE === 'true';
  return { httpOnly: true, sameSite, secure: sameSite === 'none' ? true : secure, path: '/', maxAge: Math.floor(SESSION_DAYS * 86400) };
}
function serializeCookie(name, value, options = cookieOptions()) {
  return [`${name}=${encodeURIComponent(value)}`, `Max-Age=${options.maxAge}`, `Path=${options.path}`, 'HttpOnly', `SameSite=${options.sameSite}`, options.secure ? 'Secure' : ''].filter(Boolean).join('; ');
}
function readCookie(header, name) {
  for (const item of String(header || '').split(';')) { const [key, ...rest] = item.trim().split('='); if (key === name) return decodeURIComponent(rest.join('=')); }
  return null;
}

module.exports = { SESSION_DAYS, validateAdminPassword, hashPassword, verifyPassword, createSessionToken, hashSessionToken, cookieOptions, serializeCookie, readCookie };
