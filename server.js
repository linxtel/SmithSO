const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
const crypto = require('crypto');
const net = require('net');
const tls = require('tls');

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = __dirname;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'najam@linxtel.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '$Good4Now$';

/**
 * Built-in native SMTP email dispatcher (Zero external dependencies).
 * Uses Node's native tls and net sockets to connect directly to SMTP host.
 */
function sendSmtpEmail({ to, subject, text }) {
  return new Promise((resolve, reject) => {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || process.env.ADMIN_EMAIL || (user ? user : 'no-reply@smithso.org');

    if (!host || !user || !pass) {
      return reject(new Error('SMTP not configured (missing SMTP_HOST, SMTP_USER, or SMTP_PASS)'));
    }

    let socket;
    let buffer = '';
    let step = 0;
    let settled = false;

    const timeoutMs = 8000;
    const timer = setTimeout(() => {
      finish(new Error('SMTP connection timed out after 8s'));
    }, timeoutMs);

    function finish(err, res) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (socket) {
        try { socket.end(); } catch (e) {}
        try { socket.destroy(); } catch (e) {}
      }
      if (err) reject(err);
      else resolve(res || { success: true });
    }

    function send(cmd) {
      if (socket && !socket.destroyed && socket.writable) {
        socket.write(cmd + '\r\n');
      }
    }

    function onData(chunk) {
      buffer += chunk.toString();
      const lines = buffer.split('\r\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        const code = parseInt(line.substring(0, 3), 10);
        const isMultline = line.charAt(3) === '-';
        if (isMultline) continue;

        if (code >= 400) {
          return finish(new Error(`SMTP error (${code}): ${line}`));
        }

        switch (step) {
          case 0: // Greeting 220
            step = 1;
            send(`EHLO ${process.env.SMTP_DOMAIN || 'localhost'}`);
            break;
          case 1: // EHLO ok 250
            step = 2;
            send('AUTH LOGIN');
            break;
          case 2: // Username prompt 334
            step = 3;
            send(Buffer.from(user).toString('base64'));
            break;
          case 3: // Password prompt 334
            step = 4;
            send(Buffer.from(pass).toString('base64'));
            break;
          case 4: // Auth ok 235
            step = 5;
            const fromAddr = from.includes('<') ? from.replace(/.*<([^>]+)>.*/, '$1') : from;
            send(`MAIL FROM:<${fromAddr}>`);
            break;
          case 5: // MAIL FROM ok 250
            step = 6;
            const toAddr = to.includes('<') ? to.replace(/.*<([^>]+)>.*/, '$1') : to;
            send(`RCPT TO:<${toAddr}>`);
            break;
          case 6: // RCPT TO ok 250
            step = 7;
            send('DATA');
            break;
          case 7: // DATA prompt 354
            step = 8;
            const emailContent = [
              `From: ${from}`,
              `To: ${to}`,
              `Subject: ${subject}`,
              'MIME-Version: 1.0',
              'Content-Type: text/plain; charset=UTF-8',
              'Content-Transfer-Encoding: 7bit',
              '',
              text.replace(/\r?\n/g, '\r\n'),
              '.'
            ].join('\r\n');
            send(emailContent);
            break;
          case 8: // Message accepted 250
            step = 9;
            send('QUIT');
            finish(null, { success: true });
            break;
        }
      }
    }

    try {
      if (port === 465) {
        socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false }, () => {
          socket.on('data', onData);
        });
      } else {
        socket = net.connect({ host, port }, () => {
          socket.on('data', onData);
        });
      }

      socket.on('error', (err) => finish(err));
    } catch (err) {
      finish(err);
    }
  });
}

const COACHES_FILE = path.join(ROOT_DIR, 'data', 'coaches.json');
const REQUESTS_FILE = path.join(ROOT_DIR, 'data', 'access-requests.json');

// Timing-safe comparison to prevent side-channel timing attacks
function verifyPasswordTimingSafe(providedPassword, actualPassword) {
  if (typeof providedPassword !== 'string' || typeof actualPassword !== 'string') return false;
  const hashProvided = crypto.createHash('sha256').update(providedPassword).digest();
  const hashActual = crypto.createHash('sha256').update(actualPassword).digest();
  return crypto.timingSafeEqual(hashProvided, hashActual);
}

// In-memory sliding-window rate limiter
const ipRateLimitMap = new Map();
function checkRateLimit(ip, isAuth = false) {
  const now = Date.now();
  const windowMs = 60000;
  const maxReq = isAuth ? 15 : 120;
  let rec = ipRateLimitMap.get(ip);
  if (!rec || (now - rec.windowStart > windowMs)) {
    rec = { count: 1, authCount: isAuth ? 1 : 0, windowStart: now };
    ipRateLimitMap.set(ip, rec);
    return true;
  }
  rec.count++;
  if (isAuth) rec.authCount = (rec.authCount || 0) + 1;
  return isAuth ? rec.authCount <= maxReq : rec.count <= maxReq;
}

// Periodically purge old rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of ipRateLimitMap.entries()) {
    if (now - rec.windowStart > 300000) ipRateLimitMap.delete(ip);
  }
}, 300000);

// Set standard defensive HTTP headers
function applySecurityHeaders(res) {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
}

function getAppVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
    return pkg.version || '1.1.0';
  } catch (e) {
    return '1.1.0';
  }
}

let coachesList = [
  { name: 'Najam Rashid', email: 'najam@linxtel.com', role: 'admin', addedAt: new Date().toISOString() },
  { name: 'Coach Smith', email: 'coach.smith@school.org', role: 'coach', addedAt: new Date().toISOString() }
];

let accessRequestsList = [];

function loadCoaches() {
  try {
    if (fs.existsSync(COACHES_FILE)) {
      const data = fs.readFileSync(COACHES_FILE, 'utf8');
      coachesList = JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading coaches.json:', e);
  }
}

// Atomic file writing with rename to prevent data corruption
function saveCoaches() {
  try {
    const dir = path.dirname(COACHES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tempFile = `${COACHES_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(coachesList, null, 2), 'utf8');
    fs.renameSync(tempFile, COACHES_FILE);
  } catch (e) {
    console.error('Error saving coaches.json:', e);
  }
}

function loadAccessRequests() {
  try {
    if (fs.existsSync(REQUESTS_FILE)) {
      const data = fs.readFileSync(REQUESTS_FILE, 'utf8');
      accessRequestsList = JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading access-requests.json:', e);
  }
}

// Atomic file writing with rename to prevent data corruption
function saveAccessRequests() {
  try {
    const dir = path.dirname(REQUESTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tempFile = `${REQUESTS_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(accessRequestsList, null, 2), 'utf8');
    fs.renameSync(tempFile, REQUESTS_FILE);
  } catch (e) {
    console.error('Error saving access-requests.json:', e);
  }
}

loadCoaches();
loadAccessRequests();

// In-memory coach tokens: key -> { code, token, expiresAt, name, email }
const coachTokens = new Map();
// Active admin tokens
const adminTokens = new Set();

function verifyAdminToken(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return !!token && adminTokens.has(token);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8'
};

// =========================================================================
// ThermoKahoot Real-Time Competition Room State & SSE Hub
// =========================================================================
const kahootRooms = new Map();

function broadcastToRoom(pin, event, data) {
  const room = kahootRooms.get(pin);
  if (!room || !room.clients) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  room.clients.forEach(client => {
    try {
      client.res.write(payload);
    } catch (e) {
      // client connection closed
    }
  });
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) { // 5MB guard
        req.destroy();
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function handleKahootApi(req, res, pathname, parsedUrl) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  // Network info for multi-device Wi-Fi join URL
  if (pathname === '/api/kahoot/network-info') {
    const nets = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          ips.push(net.address);
        }
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      port: PORT,
      lanIp: ips[0] || 'localhost',
      allIps: ips
    }));
    return true;
  }

  // 1. SSE Stream: /api/kahoot/events?pin=123456&playerId=abc&role=host
  if (pathname === '/api/kahoot/events') {
    const query = new URLSearchParams(parsedUrl.query || '');
    const pin = (query.get('pin') || '').trim();
    const playerId = query.get('playerId') || '';
    const role = query.get('role') || 'player';

    if (!pin || !kahootRooms.has(pin)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Room not found' }));
      return true;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write(':\n\n'); // SSE comment to establish stream

    const room = kahootRooms.get(pin);
    const clientRecord = { res, playerId, role };
    room.clients.push(clientRecord);

    // Send initial snapshot
    res.write(`event: room_snapshot\ndata: ${JSON.stringify(getRoomSnapshot(room))}\n\n`);

    // Keepalive ping every 15 seconds
    const pingInterval = setInterval(() => {
      try {
        res.write('event: ping\ndata: {}\n\n');
      } catch (err) {
        clearInterval(pingInterval);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(pingInterval);
      room.clients = room.clients.filter(c => c !== clientRecord);
      if (role === 'player' && playerId && room.players.has(playerId)) {
        const p = room.players.get(playerId);
        p.connected = false;
        broadcastToRoom(pin, 'player_status', { playerId, connected: false, players: Array.from(room.players.values()) });
      }
    });

    return true;
  }

  // 2. Create Room: POST /api/kahoot/create
  if (pathname === '/api/kahoot/create' && req.method === 'POST') {
    parseJsonBody(req).then(data => {
      const pin = data.pin || Math.floor(100000 + Math.random() * 900000).toString();
      const hostSecret = crypto.randomBytes(16).toString('hex');
      const room = {
        pin,
        title: data.title || 'ThermoOlyMaster Competition Test',
        questions: data.questions || [],
        settings: {
          timePerQuestion: data.settings?.timePerQuestion || 20,
          randomize: !!data.settings?.randomize
        },
        hostId: data.hostId || 'host_' + Date.now(),
        hostSecret,
        state: 'lobby', // lobby, countdown, question, reveal, leaderboard, podium
        currentQIndex: -1,
        questionStartTime: null,
        players: new Map(),
        clients: [],
        createdAt: Date.now()
      };

      kahootRooms.set(pin, room);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, pin, hostSecret, room: getRoomSnapshot(room) }));
    }).catch(err => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return true;
  }

  // 3. Join Room: POST /api/kahoot/join
  if (pathname === '/api/kahoot/join' && req.method === 'POST') {
    parseJsonBody(req).then(data => {
      const pin = (data.pin || '').trim();
      const room = kahootRooms.get(pin);
      if (!room) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid Game PIN. Room not found.' }));
        return;
      }

      const playerId = data.playerId || 'p_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      const player = {
        id: playerId,
        name: (data.name || 'Student').trim().slice(0, 24),
        avatar: data.avatar || '🦊',
        score: 0,
        streak: 0,
        connected: true,
        answers: {},
        isBot: !!data.isBot
      };

      room.players.set(playerId, player);
      broadcastToRoom(pin, 'player_joined', { player, players: Array.from(room.players.values()) });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, pin, player, room: getRoomSnapshot(room) }));
    }).catch(err => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return true;
  }

  // 4. Game Action: POST /api/kahoot/action
  if (pathname === '/api/kahoot/action' && req.method === 'POST') {
    parseJsonBody(req).then(data => {
      const pin = (data.pin || '').trim();
      const room = kahootRooms.get(pin);
      if (!room) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Room not found' }));
        return;
      }

      const action = data.action;
      const payload = data.payload || {};

      // Host-only tournament lifecycle actions require valid hostSecret
      const hostOnlyActions = ['start_game', 'start_question', 'reveal_answer', 'show_leaderboard', 'show_podium', 'reset_room'];
      if (hostOnlyActions.includes(action)) {
        if (!data.hostSecret || data.hostSecret !== room.hostSecret) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized: Invalid or missing host secret.' }));
          return;
        }
      }

      switch (action) {
        case 'start_game':
          room.state = 'countdown';
          room.currentQIndex = 0;
          room.players.forEach(p => { p.score = 0; p.streak = 0; p.answers = {}; });
          broadcastToRoom(pin, 'game_started', { totalQuestions: room.questions.length });
          break;

        case 'start_question': {
          room.state = 'question';
          room.currentQIndex = payload.qIndex !== undefined ? payload.qIndex : room.currentQIndex;
          room.questionStartTime = Date.now();
          const q = room.questions[room.currentQIndex];
          const timeLimit = payload.timeLimit || room.settings.timePerQuestion || 20;

          // Safe question payload for players (omit correct index & explanation)
          const publicQuestion = {
            index: room.currentQIndex,
            total: room.questions.length,
            area: q.area || '',
            level: q.level || '',
            text: q.text,
            options: q.options,
            timeLimit
          };

          broadcastToRoom(pin, 'question_start', publicQuestion);
          break;
        }

        case 'submit_answer': {
          const { playerId, qIndex, optionIndex, timeElapsed } = payload;
          const player = room.players.get(playerId);
          const q = room.questions[qIndex];
          if (player && q) {
            const isCorrect = optionIndex === q.correct;
            const timeLimit = (room.settings.timePerQuestion || 20) * 1000;
            let points = 0;
            if (isCorrect) {
              const speedRatio = Math.max(0, Math.min(1, 1 - (timeElapsed / (timeLimit * 1.5))));
              const speedBonus = Math.round(500 * speedRatio);
              const streakBonus = Math.min(500, player.streak * 100);
              points = 500 + speedBonus + streakBonus;
              player.score += points;
              player.streak += 1;
            } else {
              player.streak = 0;
            }

            player.answers[qIndex] = {
              optionIndex,
              isCorrect,
              points,
              timeElapsed
            };

            let answeredCount = 0;
            room.players.forEach(p => {
              if (p.answers && p.answers[qIndex] !== undefined) answeredCount++;
            });

            broadcastToRoom(pin, 'answer_count_updated', {
              qIndex,
              answeredCount,
              totalPlayers: room.players.size
            });
          }
          break;
        }

        case 'reveal_answer': {
          room.state = 'reveal';
          const qIndex = payload.qIndex !== undefined ? payload.qIndex : room.currentQIndex;
          const q = room.questions[qIndex];
          
          const distribution = [0, 0, 0, 0];
          room.players.forEach(p => {
            const ans = p.answers?.[qIndex];
            if (ans && ans.optionIndex >= 0 && ans.optionIndex < 4) {
              distribution[ans.optionIndex]++;
            }
          });

          const rankedPlayers = Array.from(room.players.values())
            .map(p => ({
              id: p.id,
              name: p.name,
              avatar: p.avatar,
              score: p.score,
              streak: p.streak,
              lastAnswer: p.answers?.[qIndex] || null,
              isBot: p.isBot
            }))
            .sort((a, b) => b.score - a.score);

          broadcastToRoom(pin, 'answer_revealed', {
            qIndex,
            correct: q.correct,
            explanation: q.explanation || '',
            distribution,
            players: rankedPlayers
          });
          break;
        }

        case 'show_leaderboard': {
          room.state = 'leaderboard';
          const topPlayers = Array.from(room.players.values())
            .map(p => ({
              id: p.id,
              name: p.name,
              avatar: p.avatar,
              score: p.score,
              streak: p.streak,
              isBot: p.isBot
            }))
            .sort((a, b) => b.score - a.score);

          broadcastToRoom(pin, 'leaderboard_update', {
            qIndex: room.currentQIndex,
            totalQuestions: room.questions.length,
            isLastQuestion: room.currentQIndex >= room.questions.length - 1,
            leaderboard: topPlayers
          });
          break;
        }

        case 'show_podium': {
          room.state = 'podium';
          const finalStandings = Array.from(room.players.values())
            .map(p => {
              let correctCount = 0;
              Object.values(p.answers || {}).forEach(ans => {
                if (ans.isCorrect) correctCount++;
              });
              return {
                id: p.id,
                name: p.name,
                avatar: p.avatar,
                score: p.score,
                correctCount,
                totalQuestions: room.questions.length,
                isBot: p.isBot
              };
            })
            .sort((a, b) => b.score - a.score);

          broadcastToRoom(pin, 'podium_revealed', {
            podium: finalStandings.slice(0, 3),
            standings: finalStandings
          });
          break;
        }

        case 'add_bot': {
          const botId = 'bot_' + Date.now() + '_' + Math.floor(Math.random() * 100);
          const botName = payload.name || 'AI Rival';
          const botAvatar = payload.avatar || '🤖';
          const botAccuracy = payload.accuracy || 0.8;
          const bot = {
            id: botId,
            name: botName,
            avatar: botAvatar,
            score: 0,
            streak: 0,
            connected: true,
            answers: {},
            isBot: true,
            accuracy: botAccuracy
          };
          room.players.set(botId, bot);
          broadcastToRoom(pin, 'player_joined', { player: bot, players: Array.from(room.players.values()) });
          break;
        }

        case 'kick_player': {
          const targetId = payload.playerId;
          if (room.players.has(targetId)) {
            room.players.delete(targetId);
            broadcastToRoom(pin, 'player_removed', { playerId: targetId, players: Array.from(room.players.values()) });
          }
          break;
        }

        case 'reset_room': {
          room.state = 'lobby';
          room.currentQIndex = -1;
          room.players.forEach(p => {
            p.score = 0;
            p.streak = 0;
            p.answers = {};
          });
          broadcastToRoom(pin, 'room_reset', { room: getRoomSnapshot(room) });
          break;
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, roomState: room.state }));
    }).catch(err => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return true;
  }

  // 5. Room State Query: GET /api/kahoot/state?pin=123456
  if (pathname === '/api/kahoot/state') {
    const query = new URLSearchParams(parsedUrl.query || '');
    const pin = (query.get('pin') || '').trim();
    const room = kahootRooms.get(pin);
    if (!room) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Room not found' }));
      return true;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, room: getRoomSnapshot(room) }));
    return true;
  }

  return false;
}

function getRoomSnapshot(room) {
  return {
    pin: room.pin,
    title: room.title,
    state: room.state,
    currentQIndex: room.currentQIndex,
    totalQuestions: room.questions.length,
    settings: room.settings,
    players: Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      streak: p.streak,
      connected: p.connected,
      isBot: p.isBot
    }))
  };
}

function handleAuthApi(req, res, pathname, parsedUrl) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  // 1. Admin Password Verification: POST /api/auth/admin-verify
  if (pathname === '/api/auth/admin-verify' && req.method === 'POST') {
    parseJsonBody(req).then(data => {
      const password = (data.password || '').trim();
      const identity = (data.email || data.username || '').toLowerCase().trim();
      const isValidIdentity = !identity || 
        identity === 'admin' || 
        identity === ADMIN_EMAIL.toLowerCase() ||
        identity.includes('admin') ||
        identity.includes('najam') ||
        identity.includes('@');

      if (verifyPasswordTimingSafe(password, ADMIN_PASSWORD) && isValidIdentity) {
        const token = crypto.randomBytes(24).toString('hex');
        adminTokens.add(token);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          token,
          role: 'admin',
          fullName: 'Najam Rashid (Admin)',
          email: ADMIN_EMAIL,
          username: 'admin'
        }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Incorrect Admin email or password.' }));
      }
    }).catch(err => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Invalid request body.' }));
    });
    return true;
  }

  // 2. Coach Login Request (Send OTP & Magic Link): POST /api/auth/coach-request
  if (pathname === '/api/auth/coach-request' && req.method === 'POST') {
    parseJsonBody(req).then(async (data) => {
      const email = (data.email || '').toLowerCase().trim();
      if (!email || !email.includes('@')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Please provide a valid email address.' }));
        return;
      }

      loadCoaches();
      const coach = coachesList.find(c => c.email.toLowerCase() === email);
      if (!coach) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          message: `The email "${email}" is not registered as an authorized coach. Please contact the administrator.`
        }));
        return;
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const magicToken = crypto.randomBytes(20).toString('hex');
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

      const sessionRecord = {
        code,
        token: magicToken,
        expiresAt,
        name: coach.name,
        email
      };

      coachTokens.set(email, sessionRecord);
      coachTokens.set(magicToken, sessionRecord);

      const host = req.headers.host || `localhost:${PORT}`;
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const magicUrl = `${protocol}://${host}/?coach_magic=${magicToken}`;

      let emailSent = false;
      let emailError = null;

      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
          await sendSmtpEmail({
            to: email,
            subject: 'Science Olympiad - Coach Verification Code & Magic Link',
            text: `Hello ${coach.name},\n\nYour 6-digit coach verification code is:\n\n    ${code}\n\nAlternatively, you can sign in directly with 1-click using your secure magic link:\n${magicUrl}\n\nThis verification code and link will expire in 15 minutes.\n\nBest regards,\nScience Olympiad Thermodynamics Platform`
          });
          emailSent = true;
          console.log(`[AUTH-EMAIL] Real email successfully sent to ${email} via SMTP.`);
        } catch (mailErr) {
          console.warn(`[AUTH-EMAIL-WARN] SMTP delivery failed to ${email}:`, mailErr.message);
          emailError = mailErr.message;
        }
      }

      console.log(`[AUTH-SECURE] Coach OTP created for ${email}. Code: ${code} | Email sent: ${emailSent}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        emailSent,
        expiresAt,
        message: emailSent
          ? `Verification code and 1-click magic link have been delivered to ${email}.`
          : `SMTP is not configured on this host. For evaluation/testing, use verification code: ${code}`,
        ...(!emailSent ? { code, token: magicToken } : {})
      }));
    }).catch(err => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Invalid request body.' }));
    });
    return true;
  }

  // 3. Coach Verification (via Code or Magic Token): POST /api/auth/coach-verify
  if (pathname === '/api/auth/coach-verify' && req.method === 'POST') {
    parseJsonBody(req).then(data => {
      const token = (data.token || '').trim();
      const email = (data.email || '').toLowerCase().trim();
      const code = (data.code || '').trim();

      // Check magic token first
      if (token && coachTokens.has(token)) {
        const record = coachTokens.get(token);
        if (Date.now() <= record.expiresAt) {
          coachTokens.delete(token);
          if (record.email) coachTokens.delete(record.email);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            role: 'coach',
            user: {
              fullName: record.name,
              email: record.email,
              username: record.email.split('@')[0],
              role: 'coach'
            }
          }));
          return;
        }
      }

      // Check email + 6-digit code
      if (email && code) {
        const record = coachTokens.get(email);
        if (record && record.code === code && Date.now() <= record.expiresAt) {
          const coachName = record?.name || coachesList.find(c => c.email.toLowerCase() === email)?.name || 'Coach';
          if (record) {
            coachTokens.delete(email);
            if (record.token) coachTokens.delete(record.token);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            role: 'coach',
            user: {
              fullName: coachName,
              email,
              username: email.split('@')[0],
              role: 'coach'
            }
          }));
          return;
        }
      }

      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Invalid or expired verification code / magic link.' }));
    }).catch(err => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Invalid request body.' }));
    });
    return true;
  }

  // 4. Get Authorized Coaches: GET /api/auth/coaches
  if (pathname === '/api/auth/coaches' && req.method === 'GET') {
    loadCoaches();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, coaches: coachesList }));
    return true;
  }

  // 5. Add Authorized Coach: POST /api/auth/coaches/add (Admin Only)
  if (pathname === '/api/auth/coaches/add' && req.method === 'POST') {
    if (!verifyAdminToken(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Admin authentication required.' }));
      return true;
    }

    parseJsonBody(req).then(data => {
      const name = (data.name || '').trim();
      const email = (data.email || '').toLowerCase().trim();

      if (!name || !email || !email.includes('@')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Coach name and valid email are required.' }));
        return;
      }

      loadCoaches();
      if (coachesList.some(c => c.email.toLowerCase() === email)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: `Coach with email "${email}" already exists.` }));
        return;
      }

      coachesList.push({ name, email, addedAt: new Date().toISOString() });
      saveCoaches();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, coaches: coachesList }));
    }).catch(err => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Invalid request body.' }));
    });
    return true;
  }

  // 6. Remove Authorized Coach: POST /api/auth/coaches/remove (Admin Only)
  if (pathname === '/api/auth/coaches/remove' && req.method === 'POST') {
    if (!verifyAdminToken(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Admin authentication required.' }));
      return true;
    }

    parseJsonBody(req).then(data => {
      const email = (data.email || '').toLowerCase().trim();
      loadCoaches();
      coachesList = coachesList.filter(c => c.email.toLowerCase() !== email);
      saveCoaches();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, coaches: coachesList }));
    }).catch(err => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Invalid request body.' }));
    });
    return true;
  }

  // 7. Student / Coach Sign-Up Request: POST /api/auth/signup-request
  if (pathname === '/api/auth/signup-request' && req.method === 'POST') {
    parseJsonBody(req).then(data => {
      const fullName = (data.fullName || '').trim();
      const email = (data.email || '').toLowerCase().trim();
      const team = (data.team || 'Science Olympiad Team').trim();
      const requestedRole = (data.requestedRole || 'student').trim();
      const notes = (data.notes || '').trim();

      if (!fullName || !email || !email.includes('@')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Full name and a valid email are required.' }));
        return;
      }

      loadAccessRequests();
      const newReq = {
        id: 'req_' + Date.now(),
        fullName,
        email,
        team,
        requestedRole,
        notes,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      accessRequestsList.unshift(newReq);
      saveAccessRequests();

      console.log(`[SIGNUP REQUEST] New registration from ${fullName} (${email}) for role "${requestedRole}". Notification dispatched to ${ADMIN_EMAIL}.`);

      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        sendSmtpEmail({
          to: ADMIN_EMAIL,
          subject: `[SmithSO] New ${requestedRole} Access Request: ${fullName}`,
          text: `A new access request has been submitted:\n\nName: ${fullName}\nEmail: ${email}\nRole: ${requestedRole}\nTeam: ${team}\nNotes: ${notes}\n\nReview and approve in the Admin Roster Management portal.`
        }).catch(e => console.warn('[SMTP-WARN] Could not notify admin of signup:', e.message));
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: `Your sign-up request has been sent to admin (${ADMIN_EMAIL}) for review and approval!`,
        adminEmail: ADMIN_EMAIL,
        request: newReq
      }));
    }).catch(err => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Invalid request body.' }));
    });
    return true;
  }

  // 8. Get All Sign-Up Requests: GET /api/auth/access-requests (Admin Only)
  if (pathname === '/api/auth/access-requests' && req.method === 'GET') {
    if (!verifyAdminToken(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Admin authentication required.' }));
      return true;
    }

    loadAccessRequests();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, requests: accessRequestsList }));
    return true;
  }

  // 9. Approve or Decline Sign-Up Request: POST /api/auth/access-requests/action (Admin Only)
  if (pathname === '/api/auth/access-requests/action' && req.method === 'POST') {
    if (!verifyAdminToken(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Admin authentication required.' }));
      return true;
    }

    parseJsonBody(req).then(data => {
      const id = (data.id || '').trim();
      const action = (data.action || '').trim(); // 'approve' or 'decline'

      loadAccessRequests();
      const target = accessRequestsList.find(r => r.id === id);
      if (!target) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Access request not found.' }));
        return;
      }

      target.status = action === 'approve' ? 'approved' : 'declined';
      target.reviewedAt = new Date().toISOString();
      saveAccessRequests();

      // If approved as coach, also add to authorized coaches list
      if (action === 'approve' && target.requestedRole === 'coach') {
        loadCoaches();
        if (!coachesList.some(c => c.email.toLowerCase() === target.email.toLowerCase())) {
          coachesList.push({ name: target.fullName, email: target.email, role: 'coach', addedAt: new Date().toISOString() });
          saveCoaches();
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        requests: accessRequestsList,
        approvedUser: action === 'approve' ? {
          fullName: target.fullName,
          email: target.email,
          team: target.team,
          role: target.requestedRole
        } : null
      }));
    }).catch(err => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Invalid request body.' }));
    });
    return true;
  }

  return false;
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  let pathname = decodeURIComponent(parsedUrl.pathname);
  const clientIp = req.socket?.remoteAddress || 'unknown';

  // Apply defensive HTTP headers across all responses (SEC-06)
  applySecurityHeaders(res);

  // Rate Limiting Protection (SEC-07)
  const isAuthRequest = pathname.startsWith('/api/auth/');
  if (!checkRateLimit(clientIp, isAuthRequest)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Too many requests. Please slow down.' }));
    return;
  }

  console.log(`[${new Date().toISOString()}] ${req.method} ${pathname} (client: ${clientIp})`);

  // Check Auth API
  if (pathname.startsWith('/api/auth/')) {
    if (handleAuthApi(req, res, pathname, parsedUrl)) {
      return;
    }
  }

  // Check Kahoot API
  if (pathname.startsWith('/api/kahoot/')) {
    if (handleKahootApi(req, res, pathname, parsedUrl)) {
      return;
    }
  }

  // Version Endpoint: GET /api/version
  if (pathname === '/api/version') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify({ success: true, version: getAppVersion() }));
    return;
  }

  // =========================================================================
  // Static File Serving & Directory Traversal Protection (SEC-01)
  // =========================================================================
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.resolve(path.join(ROOT_DIR, safePath));

  // Confinement check: path MUST remain strictly within ROOT_DIR
  if (!filePath.startsWith(path.resolve(ROOT_DIR))) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden: Path traversal attempt blocked.');
    return;
  }

  // Blacklist: prevent direct exposure of dotfiles (.git, .env, etc), data/, Plan/, node_modules/, server code & configs
  const lowerPath = pathname.toLowerCase();
  const isDotFileOrDir = pathname.startsWith('/.') || pathname.includes('/.');
  const isForbiddenDir = lowerPath.startsWith('/data/') ||
                         lowerPath.startsWith('/plan/') ||
                         lowerPath.startsWith('/node_modules/');
  const isForbiddenFile = ['/server.js', '/package.json', '/package-lock.json', '/dockerfile', '/render.yaml'].includes(lowerPath);

  if (isDotFileOrDir || isForbiddenDir || isForbiddenFile) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden: Access to sensitive system or internal asset is denied.');
    return;
  }

  // Default to index.html for root or directories
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 Not Found: ${pathname}`);
      console.log(`[${new Date().toISOString()}] 404 ${req.method} ${pathname}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Dynamically inject package.json version into all HTML files on deployment
    if (ext === '.html') {
      fs.readFile(filePath, 'utf8', (readErr, htmlContent) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Server Error reading HTML');
          return;
        }
        const currentVersion = getAppVersion();
        const injectedHtml = htmlContent.replace(/\{\{APP_VERSION\}\}/g, currentVersion);
        const buf = Buffer.from(injectedHtml, 'utf8');
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': buf.length,
          'Cache-Control': 'no-cache'
        });
        res.end(buf);
      });
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`ThermoOlyMaster Node server running at http://localhost:${PORT}/`);
  console.log(`Bound to ${HOST}:${PORT}, serving directory: ${ROOT_DIR}`);
});
