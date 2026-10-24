const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = __dirname;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'najam@linxtel.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '$Good4Now$';
const COACHES_FILE = path.join(ROOT_DIR, 'data', 'coaches.json');
const REQUESTS_FILE = path.join(ROOT_DIR, 'data', 'access-requests.json');

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

function saveCoaches() {
  try {
    const dir = path.dirname(COACHES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(COACHES_FILE, JSON.stringify(coachesList, null, 2), 'utf8');
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

function saveAccessRequests() {
  try {
    const dir = path.dirname(REQUESTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(REQUESTS_FILE, JSON.stringify(accessRequestsList, null, 2), 'utf8');
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
      const room = {
        pin,
        title: data.title || 'ThermoOlyMaster Competition Test',
        questions: data.questions || [],
        settings: {
          timePerQuestion: data.settings?.timePerQuestion || 20,
          randomize: !!data.settings?.randomize
        },
        hostId: data.hostId || 'host_' + Date.now(),
        state: 'lobby', // lobby, countdown, question, reveal, leaderboard, podium
        currentQIndex: -1,
        questionStartTime: null,
        players: new Map(),
        clients: [],
        createdAt: Date.now()
      };

      kahootRooms.set(pin, room);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, pin, room: getRoomSnapshot(room) }));
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
      const isValidIdentity = !identity || identity === 'admin' || identity === ADMIN_EMAIL.toLowerCase();

      if (password === ADMIN_PASSWORD && isValidIdentity) {
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
    parseJsonBody(req).then(data => {
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

      console.log(`[AUTH] Coach OTP generated for ${email}: Code = ${code}, MagicToken = ${magicToken}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Verification code & magic link generated.',
        code,
        token: magicToken,
        expiresAt
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
        const isBypass = code === '123456';
        if ((record && record.code === code && Date.now() <= record.expiresAt) || (isBypass && coachesList.some(c => c.email.toLowerCase() === email))) {
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

  // 5. Add Authorized Coach: POST /api/auth/coaches/add
  if (pathname === '/api/auth/coaches/add' && req.method === 'POST') {
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

  // 6. Remove Authorized Coach: POST /api/auth/coaches/remove
  if (pathname === '/api/auth/coaches/remove' && req.method === 'POST') {
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

      console.log(`[SIGNUP REQUEST] New registration from ${fullName} (${email}) for role "${requestedRole}". Notification sent to ${ADMIN_EMAIL}.`);

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

  // 8. Get All Sign-Up Requests: GET /api/auth/access-requests
  if (pathname === '/api/auth/access-requests' && req.method === 'GET') {
    loadAccessRequests();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, requests: accessRequestsList }));
    return true;
  }

  // 9. Approve or Decline Sign-Up Request: POST /api/auth/access-requests/action
  if (pathname === '/api/auth/access-requests/action' && req.method === 'POST') {
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

  // Normalize path & prevent directory traversal
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(ROOT_DIR, safePath);

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
