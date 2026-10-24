const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = __dirname;

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

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  let pathname = decodeURIComponent(parsedUrl.pathname);
  const clientIp = req.socket?.remoteAddress || 'unknown';

  console.log(`[${new Date().toISOString()}] ${req.method} ${pathname} (client: ${clientIp})`);

  // Check Kahoot API
  if (pathname.startsWith('/api/kahoot/')) {
    if (handleKahootApi(req, res, pathname, parsedUrl)) {
      return;
    }
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
