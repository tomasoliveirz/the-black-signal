import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';

const deriveKey = promisify(scrypt);
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const RATE_WINDOW = 15 * 60 * 1000;
const MAX_BODY = 8192;
const HASH_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const DUMMY_SALT = '14c68424532c851f2aabdc3ae8192907';
const DUMMY_HASH = Buffer.alloc(64);

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    const fail = (status, message) => {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
      req.removeListener('aborted', onAborted);
      req.resume();
      reject(Object.assign(new Error(message), { status }));
    };
    const onData = chunk => {
      size += chunk.length;
      if (size > MAX_BODY) return fail(413, 'Pedido demasiado grande.');
      chunks.push(chunk);
    };
    const onEnd = () => {
      req.removeListener('error', onError);
      req.removeListener('aborted', onAborted);
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
        resolve(value);
      } catch {
        reject(Object.assign(new Error('Pedido inválido.'), { status: 400 }));
      }
    };
    const onError = () => fail(400, 'Pedido interrompido.');
    const onAborted = () => fail(400, 'Pedido interrompido.');
    req.on('data', onData);
    req.once('end', onEnd);
    req.once('error', onError);
    req.once('aborted', onAborted);
  });
}

export function createAuth({ basePath = '/' } = {}) {
  const cookiePath = '/' + basePath.split('/').filter(Boolean).join('/');
  const directory = path.resolve(process.env.DATA_DIR || './data');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
  const filename = path.join(directory, 'auth.sqlite');
  fs.closeSync(fs.openSync(filename, 'a', 0o600));
  fs.chmodSync(filename, 0o600);
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL,
      canonical TEXT NOT NULL UNIQUE,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
  `);
  const findAccount = db.prepare('SELECT id, username, salt, password_hash FROM users WHERE canonical = ?');
  const insertAccount = db.prepare('INSERT INTO users (username, canonical, salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)');
  const findSession = db.prepare('SELECT users.id, users.username FROM sessions JOIN users ON users.id = sessions.user_id WHERE token_hash = ? AND expires_at > ?');
  const insertSession = db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)');
  const removeSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
  const removeExpired = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');
  const attempts = new Map();
  let activeDerivations = 0, lastCleanup = 0;

  const secure = req => Boolean(req.socket.encrypted || process.env.TRUST_PROXY === '1' && req.headers['x-forwarded-proto'] === 'https');
  const hashToken = token => createHash('sha256').update(token).digest('hex');
  const sessionToken = req => {
    const value = (req.headers.cookie || '').split(';').map(cookie => cookie.trim()).find(cookie => cookie.startsWith('bsignal='));
    const token = value?.slice('bsignal='.length);
    return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
  };
  function cleanup() {
    const now = Date.now();
    if (now - lastCleanup < 60000) return;
    lastCleanup = now;
    removeExpired.run(now);
    for (const [ip, attempt] of attempts) if (attempt.until <= now) attempts.delete(ip);
  }
  function user(req) {
    cleanup();
    const token = sessionToken(req);
    if (!token) return null;
    const account = findSession.get(hashToken(token), Date.now());
    return account ? { id: account.id, username: account.username } : null;
  }
  function reply(res, status, value, headers = {}) {
    if (res.destroyed || res.writableEnded) return;
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...headers,
    });
    res.end(JSON.stringify(value));
  }
  function cookie(req, value, duration) {
    return `bsignal=${value}; Path=${cookiePath}; HttpOnly; SameSite=Strict; Max-Age=${duration}${secure(req) ? '; Secure' : ''}`;
  }
  function startSession(req, account) {
    const previous = sessionToken(req);
    if (previous) removeSession.run(hashToken(previous));
    const token = randomBytes(32).toString('hex');
    insertSession.run(hashToken(token), account.id, Date.now() + SESSION_SECONDS * 1000);
    return cookie(req, token, SESSION_SECONDS);
  }
  function consumeAttempt(req) {
    cleanup();
    const ip = (process.env.TRUST_PROXY === '1' ? req.headers['x-real-ip'] : null) || req.socket.remoteAddress || 'unknown';
    let attempt = attempts.get(ip);
    if (!attempt || attempt.until <= Date.now()) {
      if (!attempt && attempts.size >= 10000) return false;
      attempt = { count: 0, until: Date.now() + RATE_WINDOW };
      attempts.set(ip, attempt);
    }
    if (attempt.count >= 10) return false;
    attempt.count++;
    return true;
  }
  async function handle(req, res, pathname) {
    if (!['/api/session', '/api/register', '/api/login', '/api/logout'].includes(pathname)) return false;
    const expectedMethod = pathname === '/api/session' ? 'GET' : 'POST';
    if (req.method !== expectedMethod) {
      reply(res, 405, { error: 'Método indisponível.' }, { allow: expectedMethod });
      return true;
    }
    if (pathname === '/api/session') {
      reply(res, 200, { user: user(req) });
      return true;
    }
    const origin = `${secure(req) ? 'https' : 'http'}://${req.headers.host}`;
    if (req.headers.origin !== origin) {
      reply(res, 403, { error: 'Origem inválida.' });
      return true;
    }
    if (pathname === '/api/logout') {
      const token = sessionToken(req);
      if (token) removeSession.run(hashToken(token));
      reply(res, 200, { user: null }, { 'set-cookie': cookie(req, '', 0) });
      return true;
    }
    if (!consumeAttempt(req)) {
      reply(res, 429, { error: 'Demasiadas tentativas. Volta a tentar dentro de 15 minutos.' }, { 'retry-after': '900' });
      return true;
    }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
      reply(res, 415, { error: 'O pedido deve usar JSON.' });
      return true;
    }
    let credentials;
    try {
      credentials = await parseBody(req);
    } catch (error) {
      reply(res, error.status || 400, { error: error.message }, error.status === 413 ? { connection: 'close' } : {});
      return true;
    }
    const { username, password } = credentials;
    if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,20}$/.test(username) ||
        typeof password !== 'string' || password.length < 10 || password.length > 128) {
      reply(res, 400, { error: 'Usa um nome de 3 a 20 letras, números ou sublinhados e uma palavra-passe de 10 a 128 caracteres.' });
      return true;
    }
    if (activeDerivations >= 4) {
      reply(res, 503, { error: 'Servidor ocupado. Tenta novamente dentro de instantes.' }, { 'retry-after': '2' });
      return true;
    }
    activeDerivations++;
    try {
      const canonical = username.toLowerCase();
      if (pathname === '/api/register') {
        if (findAccount.get(canonical)) {
          reply(res, 409, { error: 'Esse nome de utilizador já está ocupado.' });
          return true;
        }
        const salt = randomBytes(16).toString('hex');
        const key = await deriveKey(password, salt, 64, HASH_OPTIONS);
        let id;
        try {
          id = Number(insertAccount.run(username, canonical, salt, key.toString('hex'), Date.now()).lastInsertRowid);
        } catch (error) {
          if (!findAccount.get(canonical)) throw error;
          reply(res, 409, { error: 'Esse nome de utilizador já está ocupado.' });
          return true;
        }
        const account = { id, username };
        reply(res, 201, { user: account }, { 'set-cookie': startSession(req, account) });
      } else {
        const account = findAccount.get(canonical);
        const key = await deriveKey(password, account?.salt || DUMMY_SALT, 64, HASH_OPTIONS);
        const expected = account ? Buffer.from(account.password_hash, 'hex') : DUMMY_HASH;
        const matches = expected.length === key.length && timingSafeEqual(key, expected);
        if (!account || !matches) reply(res, 401, { error: 'Nome de utilizador ou palavra-passe inválidos.' });
        else {
          const identity = { id: account.id, username: account.username };
          reply(res, 200, { user: identity }, { 'set-cookie': startSession(req, identity) });
        }
      }
    } catch {
      reply(res, 500, { error: 'Não foi possível concluir o pedido.' });
    } finally {
      activeDerivations--;
    }
    return true;
  }
  return { handle, user };
}
