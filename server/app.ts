import { randomBytes, randomUUID, createHash, createHmac } from 'node:crypto';
import express, { NextFunction, Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { pool, requireDatabaseUrl } from './db.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { OrderError, createOrder, getOrder, listOrders, mutateOrder, type OrderActor } from './orderService.js';
import { deleteEvidenceObject, isObjectStorageConfigured, makeEvidenceObjectKey, signEvidenceRead, signEvidenceUpload, verifyEvidenceObject } from './objectStorage.js';
import { sendAccountEmail } from './email.js';
import { appPath } from './appPaths.js';
import { createSmartMenuHandler } from './smart-menu/handler.js';
import { matchesAllowedOrigin } from './originPolicy.js';

type UserRole = 'customer' | 'cook' | 'admin';
type AuthUser = {
  id: string;
  email: string;
  name: string;
  phone: string;
  address: string;
  role: UserRole;
};
type AuthRequest = Request & { authUser?: AuthUser; requestId?: string };

const SESSION_COOKIE = 'homemeal_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const smartMenuHandler = createSmartMenuHandler();

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.VERCEL_ENV || process.env.NODE_ENV, tracesSampleRate: 0.05 });
}

const app = express();
app.set('trust proxy', 1);
// Compressed JSON bodies are not used by the browser client; rejecting them also
// avoids the vulnerable request-inflation path in the current Express dependency.
app.use(express.json({ limit: '64kb', inflate: false }));
app.use((req: AuthRequest, res, next) => {
  req.requestId = randomUUID();
  res.set({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'X-Request-Id': req.requestId,
  });
  const startedAt = Date.now();
  res.on('finish', () => {
    console.info(JSON.stringify({ level: 'info', event: 'http_request', requestId: req.requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - startedAt }));
  });
  next();
});

function dbUnavailable(res: Response) {
  if (!process.env.DATABASE_URL) {
    res.status(503).json({ error: 'Database is not configured.' });
    return true;
  }
  return false;
}

function getCookie(req: Request, name: string) {
  const cookies = (req.headers.cookie || '').split(';');
  const entry = cookies.map((value) => value.trim()).find((value) => value.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : undefined;
}

function baseCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
}

function sessionCookieOptions() {
  return { ...baseCookieOptions(), maxAge: SESSION_TTL_MS };
}

function assertSameOrigin(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }
  const originHeader = req.get('origin');
  if (!originHeader) {
    res.status(403).json({ error: 'Request origin is required.' });
    return;
  }
  try {
    const configuredOrigin = process.env.APP_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
    if (process.env.NODE_ENV === 'production' && !configuredOrigin) {
      res.status(503).json({ error: 'APP_ORIGIN must be configured in production.' });
      return;
    }
    const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
    const requestOrigin = `${req.protocol}://${forwardedHost || req.get('host')}`;
    const allowedOrigins = [requestOrigin, configuredOrigin].filter((origin): origin is string => Boolean(origin));
    if (!matchesAllowedOrigin(originHeader, allowedOrigins)) {
      res.status(403).json({ error: 'Cross-origin request rejected.' });
      return;
    }
  } catch {
    res.status(403).json({ error: 'Invalid request origin.' });
    return;
  }
  next();
}

async function createSession(userId: string, res: Response) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await pool.query('DELETE FROM auth_sessions WHERE expires_at <= NOW()');
  await pool.query('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tokenHash, userId, expiresAt]);
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
}

function mapUser(row: { id: string; email: string; full_name: string; phone: string; address: string; role: UserRole }): AuthUser {
  return { id: row.id, email: row.email, name: row.full_name, phone: row.phone, address: row.address, role: row.role };
}

async function authenticate(req: AuthRequest) {
  const token = getCookie(req, SESSION_COOKIE);
  if (!token || token.length > 128) return undefined;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const result = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.phone, u.address, u.role
     FROM auth_sessions s JOIN app_users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.email_verified = TRUE`,
    [tokenHash],
  );
  if (!result.rowCount) return undefined;
  req.authUser = mapUser(result.rows[0]);
  return req.authUser;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function getPassword(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function hashOpaqueToken(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

let cleanupTick = 0;
async function takeRateLimit(req: Request, scope: string, identity: string, limit: number, windowMs: number) {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET || process.env.DATABASE_URL || 'development-rate-limit-key';
  const bucketKey = createHmac('sha256', secret).update(`${scope}:${req.ip || 'unknown'}:${identity}`).digest('hex');
  const result = await pool.query(
    `INSERT INTO auth_rate_limits(bucket_key, attempts, window_started_at, expires_at)
     VALUES ($1, 1, NOW(), NOW() + ($2 * INTERVAL '1 millisecond'))
     ON CONFLICT (bucket_key) DO UPDATE SET
       attempts = CASE WHEN auth_rate_limits.expires_at <= NOW() THEN 1 ELSE auth_rate_limits.attempts + 1 END,
       window_started_at = CASE WHEN auth_rate_limits.expires_at <= NOW() THEN NOW() ELSE auth_rate_limits.window_started_at END,
       expires_at = CASE WHEN auth_rate_limits.expires_at <= NOW() THEN NOW() + ($2 * INTERVAL '1 millisecond') ELSE auth_rate_limits.expires_at END
     RETURNING attempts`,
    [bucketKey, windowMs],
  );
  cleanupTick += 1;
  if (cleanupTick % 64 === 0) void pool.query('DELETE FROM auth_rate_limits WHERE expires_at <= NOW()').catch(() => undefined);
  return Number(result.rows[0]?.attempts || 0) <= limit;
}

function appOrigin(req: Request) {
  return new URL(process.env.APP_ORIGIN || req.get('origin') || 'http://localhost:3000').origin;
}

async function issueEmailToken(userId: string, table: 'auth_email_tokens' | 'password_reset_tokens', ttlMs: number) {
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashOpaqueToken(token);
  const expiresAt = new Date(Date.now() + ttlMs);
  await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
  await pool.query(`INSERT INTO ${table}(token_hash, user_id, expires_at) VALUES ($1, $2, $3)`, [tokenHash, userId, expiresAt]);
  return token;
}

async function sendVerificationEmail(req: Request, email: string, userId: string) {
  const token = await issueEmailToken(userId, 'auth_email_tokens', 24 * 60 * 60 * 1000);
  const url = new URL(appPath('/verify-email'), appOrigin(req));
  url.searchParams.set('token', token);
  await sendAccountEmail(email, 'Xác minh email HomeMeal', `<p>Nhấn liên kết để xác minh tài khoản HomeMeal:</p><p><a href="${url.toString()}">Xác minh email</a></p>`, `Xác minh email HomeMeal: ${url.toString()}`);
}

async function sendPasswordResetEmail(req: Request, email: string, userId: string) {
  const token = await issueEmailToken(userId, 'password_reset_tokens', 60 * 60 * 1000);
  const url = new URL(appPath('/reset-password'), appOrigin(req));
  url.searchParams.set('token', token);
  await sendAccountEmail(email, 'Đặt lại mật khẩu HomeMeal', `<p>Liên kết đặt lại mật khẩu có hiệu lực trong 60 phút:</p><p><a href="${url.toString()}">Đặt lại mật khẩu</a></p>`, `Đặt lại mật khẩu HomeMeal: ${url.toString()}`);
}

async function requireActor(req: AuthRequest, res: Response): Promise<AuthUser | undefined> {
  const user = await authenticate(req);
  if (!user) res.status(401).json({ error: 'Please sign in.' });
  return user;
}

async function writeSecurityAudit(actorId: string | null, action: string, subjectId: string | null, req: AuthRequest) {
  await pool.query(
    "INSERT INTO audit_events(actor_user_id, entity_type, entity_id, action, details, request_id) VALUES ($1, 'security', $2, $3, '{}'::jsonb, $4)",
    [actorId, subjectId || 'system', action, req.requestId || null],
  );
}

const fileTypes: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

app.all([...new Set(['/api', appPath('/api')])], assertSameOrigin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  const resource = getString(req.query.resource, 32);
  const action = getString(req.query.action, 40) || getString(req.body?.action, 40);
  try {
    if (resource === 'smart-menu') {
      await smartMenuHandler(req, res);
      return;
    }
    if (resource === 'health' && req.method === 'GET') {
      try {
        requireDatabaseUrl();
        await pool.query('SELECT 1');
        const tables = await pool.query(
          `SELECT COUNT(*)::int AS present
           FROM unnest($1::text[]) AS required(name)
           WHERE to_regclass(format('public.%I', required.name)) IS NOT NULL`,
          [['schema_migrations', 'app_users', 'auth_sessions', 'auth_email_tokens', 'password_reset_tokens', 'auth_rate_limits', 'orders', 'audit_events', 'order_files']],
        );
        if (tables.rows[0]?.present !== 9) {
          res.status(503).json({ status: 'degraded', dependencies: { database: 'connected', schema: 'migrations_pending' } });
          return;
        }
        const migrations = await pool.query(
          'SELECT COUNT(DISTINCT version)::int AS applied FROM schema_migrations WHERE version = ANY($1::text[])',
          [['001_auth_core.sql', '002_orders_audit_storage.sql', '003_auth_security.sql']],
        );
        if (migrations.rows[0]?.applied !== 3) {
          res.status(503).json({ status: 'degraded', dependencies: { database: 'connected', schema: 'migrations_pending' } });
          return;
        }
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
      } catch {
        res.status(503).json({ status: 'degraded', dependencies: { database: 'unavailable' } });
      }
      return;
    }
    if (dbUnavailable(res)) return;

    if (resource === 'auth' && req.method === 'GET' && action === 'me') {
      const user = await authenticate(req);
      if (!user && getCookie(req, SESSION_COOKIE)) res.clearCookie(SESSION_COOKIE, baseCookieOptions());
      res.json({ user: user || null });
      return;
    }

    if (resource === 'auth' && req.method === 'POST' && action === 'register') {
      const name = getString(req.body?.name, 100);
      const email = getString(req.body?.email, 254).toLowerCase();
      const password = getPassword(req.body?.password);
      const phone = getString(req.body?.phone, 32);
      const address = getString(req.body?.address, 300);
      if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: 'Enter a valid name and email.' }); return; }
      if (password.length < 12 || password.length > 128) { res.status(400).json({ error: 'Password must be between 12 and 128 characters.' }); return; }
      if (!(await takeRateLimit(req, 'register', email, 5, 60 * 60 * 1000))) { res.status(429).json({ error: 'Too many registration attempts. Try again later.' }); return; }
      const id = randomUUID();
      const passwordHash = await hashPassword(password);
      await pool.query(
        `INSERT INTO app_users(id, email, full_name, phone, address, password_hash, role, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6, 'customer', FALSE)`,
        [id, email, name, phone, address, passwordHash],
      );
      try {
        await sendVerificationEmail(req, email, id);
      } catch (error) {
        await Sentry.captureException(error, { extra: { requestId: req.requestId, operation: 'registration-email' } });
        res.status(503).json({ error: 'Account created. Email delivery is not configured yet; configure it, then request a new verification link.' });
        return;
      }
      await writeSecurityAudit(id, 'auth.registered', id, req);
      res.status(201).json({ message: 'Check your email for the verification link.' });
      return;
    }

    if (resource === 'auth' && req.method === 'POST' && action === 'verify-email') {
      const token = getString(req.body?.token, 128);
      if (!token) { res.status(400).json({ error: 'Verification token is required.' }); return; }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const updated = await client.query(
          `UPDATE app_users SET email_verified = TRUE, updated_at = NOW()
           WHERE id = (SELECT user_id FROM auth_email_tokens WHERE token_hash = $1 AND expires_at > NOW() FOR UPDATE)
           RETURNING id`,
          [hashOpaqueToken(token)],
        );
        await client.query('DELETE FROM auth_email_tokens WHERE token_hash = $1', [hashOpaqueToken(token)]);
        await client.query('COMMIT');
        if (!updated.rowCount) { res.status(400).json({ error: 'This verification link is invalid or expired.' }); return; }
        await writeSecurityAudit(updated.rows[0].id, 'auth.email_verified', updated.rows[0].id, req);
        res.json({ ok: true });
      } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
      finally { client.release(); }
      return;
    }

    if (resource === 'auth' && req.method === 'POST' && action === 'resend-verification') {
      const email = getString(req.body?.email, 254).toLowerCase();
      if (!(await takeRateLimit(req, 'resend-verification', email, 5, 60 * 60 * 1000))) { res.status(429).json({ error: 'Too many requests. Try again later.' }); return; }
      if (process.env.NODE_ENV === 'production' && (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)) { res.status(503).json({ error: 'Email delivery is not configured.' }); return; }
      const result = await pool.query('SELECT id, email FROM app_users WHERE email = $1 AND email_verified = FALSE', [email]);
      if (result.rowCount) await sendVerificationEmail(req, result.rows[0].email, result.rows[0].id);
      res.json({ message: 'If the account needs verification, a link has been sent.' });
      return;
    }

    if (resource === 'auth' && req.method === 'POST' && action === 'login') {
      const email = getString(req.body?.email, 254).toLowerCase();
      const password = getPassword(req.body?.password);
      if (password.length > 128) { res.status(400).json({ error: 'Password must be no longer than 128 characters.' }); return; }
      if (!(await takeRateLimit(req, 'login', email, 8, 15 * 60 * 1000))) { res.status(429).json({ error: 'Too many sign-in attempts. Try again later.' }); return; }
      const result = await pool.query(
        'SELECT id, email, full_name, phone, address, role, password_hash, email_verified FROM app_users WHERE email = $1',
        [email],
      );
      const row = result.rows[0];
      const verified = row ? await verifyPassword(password, row.password_hash) : (await hashPassword(password || randomBytes(16).toString('hex')), false);
      if (!row || !verified) { res.status(401).json({ error: 'Email or password is incorrect.' }); return; }
      if (!row.email_verified) { res.status(403).json({ code: 'EMAIL_VERIFICATION_REQUIRED', error: 'Verify your email before signing in.' }); return; }
      await createSession(row.id, res);
      res.json({ user: mapUser(row) });
      return;
    }

    if (resource === 'auth' && req.method === 'PATCH' && action === 'profile') {
      const user = await requireActor(req, res);
      if (!user) return;
      const name = getString(req.body?.name, 100);
      const phone = getString(req.body?.phone, 32);
      const address = getString(req.body?.address, 300);
      if (name.length < 2) { res.status(400).json({ error: 'Name must contain at least 2 characters.' }); return; }
      const updated = await pool.query(
        'UPDATE app_users SET full_name = $2, phone = $3, address = $4, updated_at = NOW() WHERE id = $1 RETURNING id, email, full_name, phone, address, role',
        [user.id, name, phone, address],
      );
      const profile = mapUser(updated.rows[0]);
      await writeSecurityAudit(user.id, 'auth.profile_updated', user.id, req);
      res.json({ user: profile });
      return;
    }

    if (resource === 'auth' && req.method === 'POST' && action === 'request-password-reset') {
      const email = getString(req.body?.email, 254).toLowerCase();
      if (!(await takeRateLimit(req, 'password-reset', email, 5, 60 * 60 * 1000))) { res.status(429).json({ error: 'Too many requests. Try again later.' }); return; }
      if (process.env.NODE_ENV === 'production' && (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)) { res.status(503).json({ error: 'Email delivery is not configured.' }); return; }
      const result = await pool.query('SELECT id, email FROM app_users WHERE email = $1 AND email_verified = TRUE', [email]);
      if (result.rowCount) {
        try { await sendPasswordResetEmail(req, result.rows[0].email, result.rows[0].id); }
        catch (error) { await Sentry.captureException(error, { extra: { requestId: req.requestId, operation: 'password-reset-email' } }); }
      }
      res.json({ message: 'If a verified account exists for that email, a reset link has been sent.' });
      return;
    }

    if (resource === 'auth' && req.method === 'POST' && action === 'reset-password') {
      const token = getString(req.body?.token, 128);
      const password = getPassword(req.body?.password);
      if (password.length < 12 || password.length > 128) { res.status(400).json({ error: 'Password must be between 12 and 128 characters.' }); return; }
      const passwordHash = await hashPassword(password);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const tokenResult = await client.query('SELECT user_id FROM password_reset_tokens WHERE token_hash = $1 AND expires_at > NOW() FOR UPDATE', [hashOpaqueToken(token)]);
        if (!tokenResult.rowCount) { await client.query('ROLLBACK'); res.status(400).json({ error: 'This reset link is invalid or expired.' }); return; }
        const userId = tokenResult.rows[0].user_id;
        await client.query('UPDATE app_users SET password_hash = $2, updated_at = NOW() WHERE id = $1', [userId, passwordHash]);
        await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM auth_sessions WHERE user_id = $1', [userId]);
        await client.query('COMMIT');
        await writeSecurityAudit(userId, 'auth.password_reset', userId, req);
        res.json({ ok: true });
      } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
      finally { client.release(); }
      return;
    }

    if (resource === 'auth' && req.method === 'POST' && action === 'logout') {
      const token = getCookie(req, SESSION_COOKIE);
      if (token && token.length <= 128) await pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [hashOpaqueToken(token)]);
      res.clearCookie(SESSION_COOKIE, baseCookieOptions());
      res.json({ ok: true });
      return;
    }

    if (resource === 'orders' && req.method === 'GET') {
      const user = await requireActor(req, res);
      if (!user) return;
      const client = await pool.connect();
      try {
        const orderId = getString(req.query.id, 100);
        if (orderId) res.json({ order: await getOrder(orderId, user as OrderActor, client) });
        else res.json({ orders: await listOrders(user as OrderActor, client) });
      } finally { client.release(); }
      return;
    }

    if (resource === 'orders' && req.method === 'POST') {
      const user = await requireActor(req, res);
      if (!user) return;
      const client = await pool.connect();
      try {
        if (action === 'create') {
          const order = await createOrder(user as OrderActor, req.body?.draft, client, req.requestId);
          res.status(201).json({ order });
          return;
        }
        const orderId = getString(req.body?.orderId, 100);
        if (!orderId) { res.status(400).json({ error: 'Order ID is required.' }); return; }
        const order = await mutateOrder(user as OrderActor, orderId, action, req.body?.payload, client, req.requestId);
        res.json({ order });
      } finally { client.release(); }
      return;
    }

    if (resource === 'evidence' && req.method === 'GET') {
      const user = await requireActor(req, res);
      if (!user) return;
      const fileId = getString(req.query.id, 64);
      const result = await pool.query(
        'SELECT f.object_key, f.state, o.customer_id, o.assigned_cook_id FROM order_files f JOIN orders o ON o.id = f.order_id WHERE f.id = $1',
        [fileId],
      );
      const file = result.rows[0];
      if (!file || file.state !== 'ready' || (user.role === 'customer' && file.customer_id !== user.id) || (user.role === 'cook' && file.assigned_cook_id !== user.id) || !['customer', 'cook', 'admin'].includes(user.role)) {
        res.status(404).json({ error: 'Evidence file not found.' });
        return;
      }
      res.redirect(302, await signEvidenceRead(file.object_key));
      return;
    }

    if (resource === 'evidence' && req.method === 'POST' && ['prepare-upload', 'finalize-upload'].includes(action)) {
      const user = await requireActor(req, res);
      if (!user) return;
      if (user.role !== 'cook') { res.status(403).json({ error: 'Cook access required.' }); return; }
      if (!isObjectStorageConfigured()) { res.status(503).json({ error: 'Private object storage is not configured.' }); return; }
      if (action === 'prepare-upload') {
        const orderId = getString(req.body?.orderId, 100);
        const contentType = getString(req.body?.contentType, 80).toLowerCase();
        const byteSize = Number(req.body?.byteSize);
        const originalName = getString(req.body?.fileName, 160).replace(/[\\/]/g, '_');
        const extension = fileTypes[contentType];
        if (!extension || !Number.isInteger(byteSize) || byteSize < 1 || byteSize > 5 * 1024 * 1024 || !originalName) { res.status(400).json({ error: 'Choose a JPEG, PNG, or WebP image up to 5 MB.' }); return; }
        const orderResult = await pool.query("SELECT assigned_cook_id, status FROM orders WHERE id = $1", [orderId]);
        if (!orderResult.rowCount || orderResult.rows[0].assigned_cook_id !== user.id || orderResult.rows[0].status !== 'shopping_in_progress') { res.status(403).json({ error: 'You can only upload evidence to your active shopping order.' }); return; }
        const id = randomUUID();
        const objectKey = makeEvidenceObjectKey(orderId, id, extension);
        await pool.query('INSERT INTO order_files(id, order_id, uploader_user_id, object_key, original_name, content_type, byte_size) VALUES ($1, $2, $3, $4, $5, $6, $7)', [id, orderId, user.id, objectKey, originalName, contentType, byteSize]);
        const uploadUrl = await signEvidenceUpload(objectKey, contentType);
        res.json({ fileId: id, uploadUrl, fileUrl: `${appPath('/api')}?resource=evidence&id=${encodeURIComponent(id)}`, headers: { 'Content-Type': contentType } });
        return;
      }
      const fileId = getString(req.body?.fileId, 64);
      const fileResult = await pool.query('SELECT id, order_id, object_key, content_type, byte_size FROM order_files WHERE id = $1 AND uploader_user_id = $2 AND state = $3', [fileId, user.id, 'pending']);
      if (!fileResult.rowCount) { res.status(404).json({ error: 'Pending upload not found.' }); return; }
      const file = fileResult.rows[0];
      try {
        const head = await verifyEvidenceObject(file.object_key);
        if (head.byteSize !== Number(file.byte_size) || head.byteSize > 5 * 1024 * 1024 || head.contentType !== file.content_type || !head.validSignature) {
          await deleteEvidenceObject(file.object_key).catch(() => undefined);
          await pool.query('DELETE FROM order_files WHERE id = $1', [file.id]);
          res.status(400).json({ error: 'Uploaded file did not match its declared type or size.' });
          return;
        }
      } catch {
        res.status(400).json({ error: 'Upload was not found in private storage.' });
        return;
      }
      await pool.query("UPDATE order_files SET state = 'ready' WHERE id = $1", [file.id]);
      await writeSecurityAudit(user.id, 'evidence.uploaded', file.order_id, req);
      res.json({ fileUrl: `${appPath('/api')}?resource=evidence&id=${encodeURIComponent(file.id)}` });
      return;
    }

    if (resource === 'cook' && req.method === 'GET' && action === 'portal') {
      const user = await requireActor(req, res);
      if (!user) return;
      if (user.role !== 'cook') { res.status(403).json({ error: 'Cook access required.' }); return; }
      res.json({ user });
      return;
    }

    if (resource === 'admin/users' && req.method === 'GET') {
      const user = await requireActor(req, res);
      if (!user) return;
      if (user.role !== 'admin') { res.status(403).json({ error: 'Administrator access required.' }); return; }
      const result = await pool.query('SELECT id, email, full_name, phone, role, email_verified, created_at FROM app_users ORDER BY created_at DESC LIMIT 500');
      res.json({ users: result.rows });
      return;
    }

    if (resource === 'admin/users' && req.method === 'PATCH') {
      const user = await requireActor(req, res);
      if (!user) return;
      if (user.role !== 'admin') { res.status(403).json({ error: 'Administrator access required.' }); return; }
      const targetId = getString(req.body?.userId, 64);
      const newRole = getString(req.body?.role, 16) as UserRole;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId) || !['customer', 'cook', 'admin'].includes(newRole)) { res.status(400).json({ error: 'A valid user ID and role are required.' }); return; }
      if (targetId === user.id && newRole !== 'admin') { res.status(409).json({ error: 'You cannot remove your own administrator role.' }); return; }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const admins = await client.query("SELECT id FROM app_users WHERE role = 'admin' FOR UPDATE");
        const target = await client.query('SELECT id, role FROM app_users WHERE id = $1 FOR UPDATE', [targetId]);
        if (!target.rowCount) { await client.query('ROLLBACK'); res.status(404).json({ error: 'User not found.' }); return; }
        if (target.rows[0].role === 'admin' && newRole !== 'admin' && (admins.rowCount ?? admins.rows.length) <= 1) { await client.query('ROLLBACK'); res.status(409).json({ error: 'The last administrator cannot be demoted.' }); return; }
        const updated = await client.query('UPDATE app_users SET role = $2, updated_at = NOW() WHERE id = $1 RETURNING id, email, full_name, phone, role, created_at', [targetId, newRole]);
        await client.query("INSERT INTO audit_events(actor_user_id, entity_type, entity_id, action, details, request_id) VALUES ($1, 'user', $2, 'user.role_changed', $3::jsonb, $4)", [user.id, targetId, JSON.stringify({ role: newRole }), req.requestId || null]);
        await client.query('COMMIT');
        res.json({ user: updated.rows[0] });
      } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
      finally { client.release(); }
      return;
    }

    res.status(404).json({ error: 'API route not found.' });
  } catch (error) {
    if (error instanceof OrderError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    if (isObject(error) && error.code === '23505') {
      res.status(409).json({ error: 'Email is already registered.' });
      return;
    }
    console.error(JSON.stringify({ level: 'error', event: 'api_error', requestId: req.requestId, method: req.method, path: req.path, message: error instanceof Error ? error.message : 'Unknown error' }));
    Sentry.captureException(error, { extra: { requestId: req.requestId, path: req.path, method: req.method } });
    next(error);
  }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('HomeMeal API request failed.');
  if (isObject(error) && error.code === '23505') { res.status(409).json({ error: 'Email is already registered.' }); return; }
  const requestId = res.getHeader('X-Request-Id');
  res.status(500).json({ error: 'An unexpected server error occurred.', code: 'INTERNAL_SERVER_ERROR', requestId });
});

export default app;
