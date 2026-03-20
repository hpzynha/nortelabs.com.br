import fs from 'fs/promises';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');
const waitlistPath = path.join(__dirname, 'waitlist.json');
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const ensureWaitlistFile = async () => {
  try {
    await fs.access(waitlistPath);
  } catch {
    await fs.writeFile(waitlistPath, '[]\n', 'utf-8');
  }
};

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  res.end(JSON.stringify(payload));
};

const serveFile = async (res, filePath) => {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const content = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream'
    });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
};

const handleWaitlist = async (req, res) => {
  await ensureWaitlistFile();
  let body = '';

  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 1e6) {
      req.socket.destroy();
    }
  });

  req.on('end', async () => {
    try {
      const data = JSON.parse(body || '{}');
      const name = String(data.name || '').trim();
      const email = String(data.email || '').trim().toLowerCase();

      if (!name || name.length < 2) {
        return sendJson(res, 400, { message: 'Informe um nome válido.' });
      }

      if (!isValidEmail(email)) {
        return sendJson(res, 400, { message: 'Informe um e-mail válido.' });
      }

      const raw = await fs.readFile(waitlistPath, 'utf-8');
      const current = JSON.parse(raw || '[]');
      const duplicate = current.some((entry) => entry.email === email);

      if (duplicate) {
        return sendJson(res, 409, { message: 'Este e-mail já está na lista.' });
      }

      current.push({
        id: crypto.randomUUID(),
        name,
        email,
        createdAt: new Date().toISOString()
      });

      await fs.writeFile(waitlistPath, `${JSON.stringify(current, null, 2)}\n`, 'utf-8');
      return sendJson(res, 201, {
        message: 'Você entrou para a lista! Em breve entraremos em contato.'
      });
    } catch (error) {
      console.error('Erro ao salvar waitlist:', error);
      return sendJson(res, 500, { message: 'Não foi possível salvar seu cadastro agora.' });
    }
  });
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    await ensureWaitlistFile();
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/waitlist') {
    return handleWaitlist(req, res);
  }

  if (req.method === 'GET') {
    const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const safePath = path.normalize(requestedPath).replace(/^\.+/, '');
    const filePath = path.join(publicDir, safePath);

    if (!filePath.startsWith(publicDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    try {
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        return serveFile(res, filePath);
      }
    } catch {
      return serveFile(res, path.join(publicDir, 'index.html'));
    }
  }

  res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Method not allowed');
});

server.listen(PORT, async () => {
  await ensureWaitlistFile();
  console.log(`NorteLabs running at http://localhost:${PORT}`);
});
