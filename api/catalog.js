'use strict';

const { createHash, createHmac, randomBytes, timingSafeEqual } = require('node:crypto');
const { Pool } = require('pg');
const catalog = require('../catalogo.js');

const keys = new Set(catalog.flatMap((group, g) =>
  group.items.flatMap((item, i) => item.options.map((_, v) => [g, i, v].join('-')))
));
const cookieName = 'villa_master';
const sessionSeconds = 4 * 60 * 60;
const maxImageBytes = 1024 * 1024;
let pool;
let initialization;

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}

async function database() {
  pool ??= new Pool({ connectionString: databaseUrl(), max: 2, connectionTimeoutMillis: 4000 });
  initialization ??= pool.query(`
    SELECT pg_advisory_xact_lock(763480923);
    CREATE TABLE IF NOT EXISTS villa_catalog_updates (
      id text PRIMARY KEY,
      price integer NOT NULL CHECK (price > 0),
      image bytea,
      image_hash text
    );
    CREATE TABLE IF NOT EXISTS villa_login_limits (
      id text PRIMARY KEY,
      attempts integer NOT NULL,
      expires_at timestamptz NOT NULL
    );
  `).catch(error => {
    initialization = undefined;
    throw error;
  });
  await initialization;
  return pool;
}

function equal(left, right) {
  const digest = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(left), digest(right));
}

function signature(value) {
  return createHmac('sha256', process.env.ADMIN_SESSION_SECRET).update(value).digest('base64url');
}

function authenticated(request) {
  const cookie = (request.headers.cookie || '').split(';').map(part => part.trim())
    .find(part => part.startsWith(cookieName + '='));
  const match = cookie?.slice(cookieName.length + 1).match(/^(\d+)\.([\w-]{24})\.([\w-]{43})$/);
  return Boolean(match && Number(match[1]) > Date.now() && equal(match[3], signature(match[1] + '.' + match[2])));
}

function setCookie(response, value, age) {
  response.setHeader('Set-Cookie', cookieName + '=' + value + '; Path=/api/catalog; HttpOnly; Secure; SameSite=Strict; Max-Age=' + age);
}

function send(response, status, body) {
  return response.status(status).json(body);
}

function decodeImage(value) {
  if (typeof value !== 'string' || value.length > Math.ceil(maxImageBytes / 3) * 4 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  const data = Buffer.from(value, 'base64');
  if (data.length < 16 || data.length > maxImageBytes ||
      data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WEBP' ||
      data.readUInt32LE(4) !== data.length - 8 ||
      !['VP8 ', 'VP8L', 'VP8X'].includes(data.toString('ascii', 12, 16))) return null;
  return data;
}

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  const adminCheck = request.query.admin === '1';
  const imageKey = request.query.image;
  const adminConfigured = Boolean(databaseUrl() && process.env.ADMIN_PASSWORD?.length >= 12 && process.env.ADMIN_SESSION_SECRET?.length >= 32);

  try {
    if (request.method === 'GET') {
      if (adminCheck) return send(response, 200, { configured: adminConfigured, authenticated: adminConfigured && authenticated(request) });
      if (!databaseUrl()) return imageKey ? send(response, 404, { error: 'Imagem indisponível.' }) : send(response, 200, { items: {} });
      const db = await database();
      if (imageKey) {
        if (!keys.has(imageKey)) return send(response, 404, { error: 'Imagem indisponível.' });
        const { rows } = await db.query('SELECT image FROM villa_catalog_updates WHERE id = $1 AND image_hash = $2', [imageKey, typeof request.query.v === 'string' ? request.query.v : '']);
        if (!rows[0]?.image) return send(response, 404, { error: 'Imagem indisponível.' });
        response.setHeader('Content-Type', 'image/webp');
        return response.status(200).send(rows[0].image);
      }
      const { rows } = await db.query('SELECT id, price, image_hash FROM villa_catalog_updates');
      const items = Object.fromEntries(rows.map(row => [row.id, { price: row.price, image: row.image_hash }]));
      return send(response, 200, { items });
    }

    if (request.method !== 'POST') {
      response.setHeader('Allow', 'GET, POST');
      return send(response, 405, { error: 'Método não permitido.' });
    }
    if (request.headers['x-villa-master'] !== '1' || !request.headers['content-type']?.startsWith('application/json')) {
      return send(response, 403, { error: 'Requisição inválida.' });
    }
    if (!adminConfigured) return send(response, 503, { error: 'Configure o banco de dados e as credenciais do painel na Vercel.' });

    const body = request.body || {};
    if (body.action === 'login') {
      const db = await database();
      const ip = String(request.headers['x-vercel-forwarded-for'] || request.socket?.remoteAddress || 'unknown').split(',')[0].trim();
      const bucket = signature(ip);
      await db.query('DELETE FROM villa_login_limits WHERE expires_at <= now()');
      const { rows } = await db.query(`
        INSERT INTO villa_login_limits (id, attempts, expires_at)
        VALUES ($1, 1, now() + interval '15 minutes')
        ON CONFLICT (id) DO UPDATE SET attempts = LEAST(villa_login_limits.attempts + 1, 9)
        RETURNING attempts
      `, [bucket]);
      if (rows[0].attempts > 8) return send(response, 429, { error: 'Muitas tentativas. Aguarde 15 minutos.' });
      if (typeof body.password !== 'string' || body.password.length > 256 || !equal(body.password, process.env.ADMIN_PASSWORD)) {
        return send(response, 401, { error: 'Senha incorreta.' });
      }
      await db.query('DELETE FROM villa_login_limits WHERE id = $1', [bucket]);
      const value = (Date.now() + sessionSeconds * 1000) + '.' + randomBytes(18).toString('base64url');
      setCookie(response, value + '.' + signature(value), sessionSeconds);
      return send(response, 200, { ok: true });
    }

    if (body.action === 'logout') {
      setCookie(response, '', 0);
      return send(response, 200, { ok: true });
    }
    if (!authenticated(request)) return send(response, 401, { error: 'Entre no painel para continuar.' });
    if (body.action !== 'save' || !keys.has(body.id) || !Number.isInteger(body.price) || body.price < 1 || body.price > 99999999) {
      return send(response, 400, { error: 'Item ou preço inválido.' });
    }
    const image = body.image == null ? null : decodeImage(body.image);
    if (body.image != null && !image) return send(response, 400, { error: 'Envie uma imagem WebP de até 1 MB.' });
    const hash = image && createHash('sha256').update(image).digest('hex');
    const db = await database();
    const { rows } = await db.query(`
      INSERT INTO villa_catalog_updates (id, price, image, image_hash) VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price,
        image = CASE WHEN $5 THEN NULL ELSE COALESCE(EXCLUDED.image, villa_catalog_updates.image) END,
        image_hash = CASE WHEN $5 THEN NULL ELSE COALESCE(EXCLUDED.image_hash, villa_catalog_updates.image_hash) END
      RETURNING price, image_hash
    `, [body.id, body.price, image, hash, body.restoreImage === true && !image]);
    return send(response, 200, { price: rows[0].price, image: rows[0].image_hash });
  } catch (error) {
    console.error('Villa Burguer catalog:', error.code || error.name);
    return send(response, 503, { error: 'O armazenamento está indisponível. Confira a conexão com o banco.' });
  }
};
