const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
const crypto = require('crypto');
const net = require('net');
const tls = require('tls');

const ROOT_DIR = __dirname;

// Load environment variables from .env.local and .env (without overwriting existing process.env vars)
function loadEnvFiles() {
  for (const envFile of ['.env.local', '.env']) {
    const fullPath = path.join(ROOT_DIR, envFile);
    try {
      if (fs.existsSync(fullPath)) {
        const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || line.startsWith('#')) continue;
          const eqIdx = line.indexOf('=');
          if (eqIdx === -1) continue;
          const key = line.slice(0, eqIdx).trim();
          let val = line.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (key && process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
      }
    } catch (e) {
      console.warn(`[ENV] Could not read ${envFile}:`, e.message);
    }
  }
}
loadEnvFiles();

let Pool = null;
try {
  ({ Pool } = require('pg'));
} catch (e) {
  console.warn('[DB] pg module not loaded, using local file fallback.');
}

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'najam@linxtel.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '$Good4Now$';

// Neon / PostgreSQL Connection Pool
const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || '';
let dbPool = null;
let dbConnected = false;

if (Pool && DATABASE_URL) {
  dbPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });
  dbPool.on('error', (err) => {
    console.warn('[DB-POOL] Idle client error:', err.message);
  });
}

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

const STUDENTS_FILE = path.join(ROOT_DIR, 'data', 'students.json');
const PROGRESS_FILE = path.join(ROOT_DIR, 'data', 'student-progress.json');
const SCHOOLS_FILE = path.join(ROOT_DIR, 'data', 'schools.json');
const TEAMS_FILE = path.join(ROOT_DIR, 'data', 'teams.json');
const COMPETITIONS_FILE = path.join(ROOT_DIR, 'data', 'competitions.json');

let coachesList = [
  { name: 'Najam Rashid', email: 'najam@linxtel.com', role: 'admin', addedAt: new Date().toISOString() },
  { name: 'Coach Smith', email: 'coach.smith@school.org', role: 'coach', addedAt: new Date().toISOString() }
];

let accessRequestsList = [];

let schoolsList = [
  { id: 'sch_smith_ms', name: 'Smith Middle School', cityState: 'Michigan', division: 'Division B', coachName: 'Coach Smith', coachEmail: 'coach.smith@school.org', createdAt: new Date().toISOString() },
  { id: 'sch_boulan_ms', name: 'Boulan Park Middle School', cityState: 'Troy, MI', division: 'Division B', coachName: 'Coach Miller', coachEmail: 'miller@boulan.org', createdAt: new Date().toISOString() },
  { id: 'sch_larson_ms', name: 'Larson Middle School', cityState: 'Troy, MI', division: 'Division B', coachName: 'Coach Davis', coachEmail: 'davis@larson.org', createdAt: new Date().toISOString() }
];

let teamsList = [
  { id: 'team_b01', teamNumber: 'B01', name: 'Smith MS - Gold (Varsity)', schoolId: 'sch_smith_ms', schoolName: 'Smith Middle School', studentUsernames: ['ashritha', 'sumin'], deviceName: 'Copper-Core Parabolic V1', notes: 'Primary Varsity Thermodynamics pair', createdAt: new Date().toISOString() },
  { id: 'team_b02', teamNumber: 'B02', name: 'Smith MS - Blue (JV)', schoolId: 'sch_smith_ms', schoolName: 'Smith Middle School', studentUsernames: ['dhruthi', 'iba'], deviceName: 'CryoShield Foil Collector', notes: 'JV Team 1', createdAt: new Date().toISOString() },
  { id: 'team_b03', teamNumber: 'B03', name: 'Smith MS - White (JV)', schoolId: 'sch_smith_ms', schoolName: 'Smith Middle School', studentUsernames: ['aditya', 'rutvik_g'], deviceName: 'Black-Anodized Cone V2', notes: 'JV Team 2', createdAt: new Date().toISOString() },
  { id: 'team_b04', teamNumber: 'B04', name: 'Smith MS - Crimson (Alt)', schoolId: 'sch_smith_ms', schoolName: 'Smith Middle School', studentUsernames: ['vrinda', 'everett', 'rutvik_sai'], deviceName: 'Double-Wall Mylar Chamber', notes: 'Alternate Exhibition Squad', createdAt: new Date().toISOString() }
];

let competitionsList = [
  {
    id: 'comp_invitational_2027',
    title: '2027 Science Olympiad Regional & Invitational Tournament',
    eventDate: new Date().toISOString().slice(0, 10),
    location: 'Smith Middle School Science Arena',
    status: 'testing',
    settings: {
      questionCount: 20,
      maxExamRaw: 20,
      targetStartTempC: 21.0,
      lampHeightCm: 45,
      lampWattage: 120,
      heatingMinutes: 25
    },
    entries: [
      {
        teamId: 'team_b01',
        teamNumber: 'B01',
        teamName: 'Smith MS - Gold (Varsity)',
        schoolName: 'Smith Middle School',
        studentUsernames: ['ashritha', 'sumin'],
        deviceName: 'Copper-Core Parabolic V1',
        impounded: true,
        impoundTime: '08:15 AM',
        dimsCompliant: true,
        materialsCompliant: true,
        constrViolations: 0,
        compViolations: 0,
        touchedDuringHeating: false,
        prohibitedMaterials: false,
        impoundNotes: '14.8 x 14.8 x 14.9 cm — passed inspection',
        examRaw: 19,
        examMax: 20,
        examSource: 'ocr_scan',
        predictedTempC: 47.4,
        missingPrediction: false,
        startTempC: 21.0,
        finalTempC: 47.6
      },
      {
        teamId: 'team_b02',
        teamNumber: 'B02',
        teamName: 'Smith MS - Blue (JV)',
        schoolName: 'Smith Middle School',
        studentUsernames: ['dhruthi', 'iba'],
        deviceName: 'CryoShield Foil Collector',
        impounded: true,
        impoundTime: '08:18 AM',
        dimsCompliant: true,
        materialsCompliant: true,
        constrViolations: 0,
        compViolations: 0,
        touchedDuringHeating: false,
        prohibitedMaterials: false,
        impoundNotes: '14.5 x 14.6 x 14.7 cm — passed inspection',
        examRaw: 18,
        examMax: 20,
        examSource: 'ocr_scan',
        predictedTempC: 46.5,
        missingPrediction: false,
        startTempC: 21.0,
        finalTempC: 46.8
      },
      {
        teamId: 'team_b03',
        teamNumber: 'B03',
        teamName: 'Smith MS - White (JV)',
        schoolName: 'Smith Middle School',
        studentUsernames: ['aditya', 'rutvik_g'],
        deviceName: 'Black-Anodized Cone V2',
        impounded: true,
        impoundTime: '08:22 AM',
        dimsCompliant: true,
        materialsCompliant: true,
        constrViolations: 0,
        compViolations: 0,
        touchedDuringHeating: false,
        prohibitedMaterials: false,
        impoundNotes: '14.9 x 14.9 x 14.9 cm — passed inspection',
        examRaw: 18,
        examMax: 20,
        examSource: 'manual',
        predictedTempC: 45.8,
        missingPrediction: false,
        startTempC: 21.0,
        finalTempC: 46.3
      },
      {
        teamId: 'team_b04',
        teamNumber: 'B04',
        teamName: 'Smith MS - Crimson (Alt)',
        schoolName: 'Smith Middle School',
        studentUsernames: ['vrinda', 'everett', 'rutvik_sai'],
        deviceName: 'Double-Wall Mylar Chamber',
        impounded: true,
        impoundTime: '08:25 AM',
        dimsCompliant: true,
        materialsCompliant: true,
        constrViolations: 0,
        compViolations: 0,
        touchedDuringHeating: false,
        prohibitedMaterials: false,
        impoundNotes: '14.4 x 14.4 x 14.6 cm — passed inspection',
        examRaw: 17,
        examMax: 20,
        examSource: 'manual',
        predictedTempC: 44.3,
        missingPrediction: false,
        startTempC: 21.0,
        finalTempC: 45.0
      }
    ],
    winnersDeclared: false,
    declaredAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

let studentsList = [
  { username: 'admin', fullName: 'Coach Smith', email: 'coach.smith@school.org', password: 'coach2027', team: 'Science Olympiad Coaching Staff', role: 'admin', picture: null, authProvider: 'google_instant', createdAt: new Date().toISOString() },
  { username: 'sumin', fullName: 'Sumin', email: 'sumin@students.school.org', password: 'pass123', team: 'Science Olympiad (Thermodynamics & Codebusters)', role: 'student', picture: null, authProvider: 'google_instant', createdAt: new Date().toISOString() },
  { username: 'ashritha', fullName: 'Ashritha', email: 'ashritha@students.school.org', password: 'pass123', team: 'Science Olympiad (Thermodynamics & Meteorology)', role: 'student', picture: null, authProvider: 'google_instant', createdAt: new Date().toISOString() },
  { username: 'vrinda', fullName: 'Vrinda', email: 'vrinda@students.school.org', password: 'pass123', team: 'Science Olympiad (Meteorology & Codebusters)', role: 'student', picture: null, authProvider: 'google_instant', createdAt: new Date().toISOString() },
  { username: 'aditya', fullName: 'Aditya', email: 'aditya@students.school.org', password: 'pass123', team: 'Science Olympiad (Thermodynamics & Codebusters)', role: 'student', picture: null, authProvider: 'google_instant', createdAt: new Date().toISOString() },
  { username: 'everett', fullName: 'Everett', email: 'everett@students.school.org', password: 'pass123', team: 'Science Olympiad (Codebusters & STEM)', role: 'student', picture: null, authProvider: 'google_instant', createdAt: new Date().toISOString() },
  { username: 'iba', fullName: 'Iba', email: 'iba@students.school.org', password: 'pass123', team: 'Science Olympiad (Thermodynamics & Meteorology)', role: 'student', picture: null, authProvider: 'google_instant', createdAt: new Date().toISOString() },
  { username: 'dhruthi', fullName: 'Dhruthi', email: 'dhruthi@students.school.org', password: 'pass123', team: 'Science Olympiad (Thermodynamics & Meteorology)', role: 'student', picture: null, authProvider: 'google_instant', createdAt: new Date().toISOString() },
  { username: 'rutvik_sai', fullName: 'Rutvik Sai', email: 'rutvik.sai@students.school.org', password: 'pass123', team: 'Science Olympiad (Codebusters & STEM)', role: 'student', picture: null, authProvider: 'google_instant', createdAt: new Date().toISOString() },
  { username: 'rutvik_g', fullName: 'Rutvik G.', email: 'rutvik.g@students.school.org', password: 'pass123', team: 'Science Olympiad (Thermodynamics & Meteorology)', role: 'student', picture: null, authProvider: 'google_instant', createdAt: new Date().toISOString() }
];

let studentProgressMap = {};

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

// Atomic file writing with rename to prevent data corruption + Neon DB sync
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
  if (dbPool) {
    (async () => {
      try {
        for (const c of coachesList) {
          await dbPool.query(
            `INSERT INTO coaches (email, name, role, added_at)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role`,
            [c.email.toLowerCase(), c.name, c.role || 'coach', c.addedAt || new Date().toISOString()]
          );
        }
      } catch (err) {
        console.warn('[DB] saveCoaches sync error:', err.message);
      }
    })();
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

// Atomic file writing with rename to prevent data corruption + Neon DB sync
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
  if (dbPool) {
    (async () => {
      try {
        for (const r of accessRequestsList) {
          await dbPool.query(
            `INSERT INTO access_requests (id, full_name, email, team, requested_role, notes, status, created_at, reviewed_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, reviewed_at = EXCLUDED.reviewed_at`,
            [
              r.id,
              r.fullName,
              r.email.toLowerCase(),
              r.team || 'Science Olympiad Team',
              r.requestedRole || 'student',
              r.notes || '',
              r.status || 'pending',
              r.createdAt || new Date().toISOString(),
              r.reviewedAt || null
            ]
          );
        }
      } catch (err) {
        console.warn('[DB] saveAccessRequests sync error:', err.message);
      }
    })();
  }
}

function loadLocalStudentsAndProgress() {
  try {
    if (fs.existsSync(STUDENTS_FILE)) {
      studentsList = JSON.parse(fs.readFileSync(STUDENTS_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('Error loading students.json:', e.message);
  }
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      studentProgressMap = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('Error loading student-progress.json:', e.message);
  }
  try {
    if (fs.existsSync(SCHOOLS_FILE)) {
      schoolsList = JSON.parse(fs.readFileSync(SCHOOLS_FILE, 'utf8'));
    }
  } catch (e) {}
  try {
    if (fs.existsSync(TEAMS_FILE)) {
      teamsList = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'));
    }
  } catch (e) {}
  try {
    if (fs.existsSync(COMPETITIONS_FILE)) {
      competitionsList = JSON.parse(fs.readFileSync(COMPETITIONS_FILE, 'utf8'));
    }
  } catch (e) {}
}

function saveLocalStudentsAndProgress() {
  try {
    const dir = path.dirname(STUDENTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STUDENTS_FILE, JSON.stringify(studentsList, null, 2), 'utf8');
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(studentProgressMap, null, 2), 'utf8');
    fs.writeFileSync(SCHOOLS_FILE, JSON.stringify(schoolsList, null, 2), 'utf8');
    fs.writeFileSync(TEAMS_FILE, JSON.stringify(teamsList, null, 2), 'utf8');
    fs.writeFileSync(COMPETITIONS_FILE, JSON.stringify(competitionsList, null, 2), 'utf8');
  } catch (e) {
    console.warn('Error saving local student files:', e.message);
  }
}

loadCoaches();
loadAccessRequests();
loadLocalStudentsAndProgress();

/**
 * Initialize Neon PostgreSQL schema & synchronize initial state on server startup
 */
async function initDatabase() {
  if (!dbPool) {
    console.log('[DB] No DATABASE_URL configured; running with local JSON storage.');
    return;
  }
  try {
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS students (
        username TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        password TEXT DEFAULT 'pass123',
        team TEXT DEFAULT 'Science Olympiad Team',
        role TEXT DEFAULT 'student',
        picture TEXT,
        auth_provider TEXT DEFAULT 'google_instant',
        school_id TEXT DEFAULT 'sch_smith_ms',
        team_id TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE students ADD COLUMN IF NOT EXISTS school_id TEXT DEFAULT 'sch_smith_ms';
      ALTER TABLE students ADD COLUMN IF NOT EXISTS team_id TEXT DEFAULT '';
      CREATE TABLE IF NOT EXISTS student_progress (
        username TEXT PRIMARY KEY REFERENCES students(username) ON DELETE CASCADE,
        completed_lessons JSONB DEFAULT '[]'::jsonb,
        exams JSONB DEFAULT '[]'::jsonb,
        lab_runs JSONB DEFAULT '[]'::jsonb,
        predictions JSONB DEFAULT '[]'::jsonb,
        kahoot_history JSONB DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS coaches (
        email TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'coach',
        added_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS access_requests (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        team TEXT DEFAULT 'Science Olympiad Team',
        requested_role TEXT DEFAULT 'student',
        notes TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        reviewed_at TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS schools (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        city_state TEXT DEFAULT '',
        division TEXT DEFAULT 'Division B',
        coach_name TEXT DEFAULT '',
        coach_email TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        team_number TEXT NOT NULL,
        name TEXT NOT NULL,
        school_id TEXT REFERENCES schools(id) ON DELETE SET NULL,
        school_name TEXT DEFAULT '',
        student_usernames JSONB DEFAULT '[]'::jsonb,
        device_name TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS competitions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        event_date TEXT DEFAULT '',
        location TEXT DEFAULT '',
        status TEXT DEFAULT 'impound',
        settings JSONB DEFAULT '{}'::jsonb,
        entries JSONB DEFAULT '[]'::jsonb,
        winners_declared BOOLEAN DEFAULT FALSE,
        declared_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Load coaches from DB
    const coachesRes = await dbPool.query('SELECT email, name, role, added_at FROM coaches ORDER BY added_at ASC');
    if (coachesRes.rows.length > 0) {
      coachesList = coachesRes.rows.map(r => ({
        email: r.email,
        name: r.name,
        role: r.role || 'coach',
        addedAt: r.added_at ? new Date(r.added_at).toISOString() : new Date().toISOString()
      }));
    } else {
      saveCoaches();
    }

    // Load access requests from DB
    const reqRes = await dbPool.query('SELECT * FROM access_requests ORDER BY created_at DESC');
    if (reqRes.rows.length > 0) {
      accessRequestsList = reqRes.rows.map(r => ({
        id: r.id,
        fullName: r.full_name,
        email: r.email,
        team: r.team,
        requestedRole: r.requested_role,
        notes: r.notes,
        status: r.status,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null
      }));
    } else if (accessRequestsList.length > 0) {
      saveAccessRequests();
    }

    // Load schools from DB
    const schRes = await dbPool.query('SELECT * FROM schools ORDER BY created_at ASC');
    if (schRes.rows.length > 0) {
      schoolsList = schRes.rows.map(r => ({
        id: r.id,
        name: r.name,
        cityState: r.city_state || '',
        division: r.division || 'Division B',
        coachName: r.coach_name || '',
        coachEmail: r.coach_email || '',
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
      }));
    }

    // Load teams from DB
    const tmRes = await dbPool.query('SELECT * FROM teams ORDER BY team_number ASC, created_at ASC');
    if (tmRes.rows.length > 0) {
      teamsList = tmRes.rows.map(r => ({
        id: r.id,
        teamNumber: r.team_number || 'B01',
        name: r.name,
        schoolId: r.school_id || '',
        schoolName: r.school_name || '',
        studentUsernames: Array.isArray(r.student_usernames) ? r.student_usernames : [],
        deviceName: r.device_name || '',
        notes: r.notes || '',
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
      }));
    }

    // Load competitions from DB
    const compRes = await dbPool.query('SELECT * FROM competitions ORDER BY created_at DESC');
    if (compRes.rows.length > 0) {
      competitionsList = compRes.rows.map(r => ({
        id: r.id,
        title: r.title,
        eventDate: r.event_date || '',
        location: r.location || '',
        status: r.status || 'impound',
        settings: r.settings || {},
        entries: Array.isArray(r.entries) ? r.entries : [],
        winnersDeclared: !!r.winners_declared,
        declaredAt: r.declared_at ? new Date(r.declared_at).toISOString() : null,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
      }));
    } else if (competitionsList.length > 0) {
      for (const c of competitionsList) {
        await dbPool.query(
          `INSERT INTO competitions (id, title, event_date, location, status, settings, entries, winners_declared)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
           ON CONFLICT (id) DO NOTHING`,
          [c.id, c.title, c.eventDate || '', c.location || '', c.status || 'testing', JSON.stringify(c.settings || {}), JSON.stringify(c.entries || []), !!c.winnersDeclared]
        );
      }
    }

    // Load students from DB
    const stuRes = await dbPool.query('SELECT * FROM students ORDER BY created_at ASC, username ASC');
    if (stuRes.rows.length > 0) {
      studentsList = stuRes.rows.map(r => ({
        username: r.username,
        fullName: r.full_name,
        email: r.email,
        password: r.password || 'pass123',
        team: r.team || 'Science Olympiad Team',
        role: r.role || 'student',
        picture: r.picture || null,
        authProvider: r.auth_provider || 'google_instant',
        schoolId: r.school_id || 'sch_smith_ms',
        teamId: r.team_id || '',
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
      }));
    }

    // Load student_progress from DB
    const progRes = await dbPool.query('SELECT * FROM student_progress');
    if (progRes.rows.length > 0) {
      const map = {};
      for (const r of progRes.rows) {
        map[r.username.toLowerCase()] = {
          completedLessons: Array.isArray(r.completed_lessons) ? r.completed_lessons : [],
          exams: Array.isArray(r.exams) ? r.exams : [],
          labRuns: Array.isArray(r.lab_runs) ? r.lab_runs : [],
          predictions: Array.isArray(r.predictions) ? r.predictions : [],
          kahootHistory: Array.isArray(r.kahoot_history) ? r.kahoot_history : []
        };
      }
      studentProgressMap = map;
    }

    saveLocalStudentsAndProgress();
    dbConnected = true;
    console.log(`[DB] Connected to Neon PostgreSQL (${schoolsList.length} schools, ${teamsList.length} teams, ${studentsList.length} students, ${competitionsList.length} competitions).`);
  } catch (err) {
    console.warn('[DB] Neon PostgreSQL initialization warning:', err.message);
  }
}

initDatabase();

async function upsertStudentInDb(user) {
  const cleanUser = (user.username || '').toLowerCase().trim();
  if (!cleanUser) return null;
  const record = {
    username: cleanUser,
    fullName: (user.fullName || cleanUser).trim(),
    email: (user.email || `${cleanUser}@students.school.org`).toLowerCase().trim(),
    password: user.password !== undefined ? user.password : 'pass123',
    team: (user.team || 'Science Olympiad Team').trim(),
    role: user.role === 'admin' || user.role === 'coach' ? user.role : 'student',
    picture: user.picture || null,
    authProvider: user.authProvider || 'google_instant',
    createdAt: user.createdAt || new Date().toISOString()
  };

  const idx = studentsList.findIndex(u => u.username.toLowerCase() === cleanUser);
  if (idx >= 0) {
    studentsList[idx] = { ...studentsList[idx], ...record };
  } else {
    studentsList.push(record);
  }
  saveLocalStudentsAndProgress();

  if (dbPool) {
    try {
      await dbPool.query(
        `INSERT INTO students (username, full_name, email, password, team, role, picture, auth_provider, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (username) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           email = EXCLUDED.email,
           password = COALESCE(NULLIF(EXCLUDED.password, ''), students.password),
           team = EXCLUDED.team,
           role = EXCLUDED.role,
           picture = COALESCE(EXCLUDED.picture, students.picture),
           auth_provider = EXCLUDED.auth_provider,
           updated_at = NOW()`,
        [record.username, record.fullName, record.email, record.password, record.team, record.role, record.picture, record.authProvider]
      );
      await dbPool.query(
        `INSERT INTO student_progress (username) VALUES ($1) ON CONFLICT (username) DO NOTHING`,
        [record.username]
      );
    } catch (err) {
      console.warn('[DB] upsertStudentInDb error:', err.message);
    }
  }
  return record;
}

async function upsertProgressInDb(username, progress) {
  const cleanUser = (username || '').toLowerCase().trim();
  if (!cleanUser || cleanUser === 'guest') return null;

  const existing = studentProgressMap[cleanUser] || { completedLessons: [], exams: [], labRuns: [], predictions: [], kahootHistory: [] };
  const merged = {
    completedLessons: Array.isArray(progress.completedLessons) ? progress.completedLessons : existing.completedLessons,
    exams: Array.isArray(progress.exams) ? progress.exams : existing.exams,
    labRuns: Array.isArray(progress.labRuns) ? progress.labRuns : existing.labRuns,
    predictions: Array.isArray(progress.predictions) ? progress.predictions : existing.predictions,
    kahootHistory: Array.isArray(progress.kahootHistory) ? progress.kahootHistory : existing.kahootHistory
  };

  studentProgressMap[cleanUser] = merged;
  saveLocalStudentsAndProgress();

  if (dbPool) {
    try {
      // Ensure student row exists before FK insert
      if (!studentsList.some(u => u.username.toLowerCase() === cleanUser)) {
        await upsertStudentInDb({ username: cleanUser, fullName: cleanUser });
      }
      await dbPool.query(
        `INSERT INTO student_progress (username, completed_lessons, exams, lab_runs, predictions, kahoot_history, updated_at)
         VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, NOW())
         ON CONFLICT (username) DO UPDATE SET
           completed_lessons = EXCLUDED.completed_lessons,
           exams = EXCLUDED.exams,
           lab_runs = EXCLUDED.lab_runs,
           predictions = EXCLUDED.predictions,
           kahoot_history = EXCLUDED.kahoot_history,
           updated_at = NOW()`,
        [
          cleanUser,
          JSON.stringify(merged.completedLessons),
          JSON.stringify(merged.exams),
          JSON.stringify(merged.labRuns),
          JSON.stringify(merged.predictions),
          JSON.stringify(merged.kahootHistory)
        ]
      );
    } catch (err) {
      console.warn('[DB] upsertProgressInDb error:', err.message);
    }
  }
  return merged;
}

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

      const cleanName = (data.name || '').trim().slice(0, 24);
      if (!cleanName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Please enter a valid student name.' }));
        return;
      }
      const avatar = data.avatar || '🦊';

      // Strictly block duplicate participants in the same room (case-insensitive name check)
      for (const p of room.players.values()) {
        if (p.name.trim().toLowerCase() === cleanName.toLowerCase()) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: `Duplicate participant: "${cleanName}" has already joined Room ${pin}! Please enter a unique student name.`
          }));
          return;
        }
      }

      const playerId = data.playerId && !room.players.has(data.playerId)
        ? data.playerId
        : 'p_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      const player = {
        id: playerId,
        name: cleanName,
        avatar,
        score: 0,
        streak: 0,
        connected: true,
        answers: {}
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

  // 3b. Leave Room (Participant Exit): POST /api/kahoot/leave
  if (pathname === '/api/kahoot/leave' && req.method === 'POST') {
    parseJsonBody(req).then(data => {
      const pin = (data.pin || '').trim();
      const room = kahootRooms.get(pin);
      if (!room) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, pin, removed: false }));
        return;
      }

      const playerId = (data.playerId || '').trim();
      const cleanName = (data.name || '').trim().toLowerCase();
      let targetId = null;

      if (playerId && room.players.has(playerId)) {
        targetId = playerId;
      } else if (cleanName) {
        for (const [id, p] of room.players.entries()) {
          if ((p.name || '').trim().toLowerCase() === cleanName) {
            targetId = id;
            break;
          }
        }
      }

      if (targetId && room.players.has(targetId)) {
        const removedPlayer = room.players.get(targetId);
        room.players.delete(targetId);
        room.clients = room.clients.filter(c => c.playerId !== targetId);
        broadcastToRoom(pin, 'player_removed', {
          playerId: targetId,
          playerName: removedPlayer?.name || '',
          reason: 'left',
          players: Array.from(room.players.values())
        });
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        pin,
        removed: !!targetId,
        playerId: targetId,
        room: getRoomSnapshot(room)
      }));
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
      const hostOnlyActions = ['start_game', 'start_question', 'reveal_answer', 'show_leaderboard', 'show_podium', 'kick_player', 'reset_room'];
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
          room.questionSeq = (room.questionSeq || 0) + 1;
          room.lastRevealPayload = null;
          if (payload.question && room.questions[room.currentQIndex]) {
            room.questions[room.currentQIndex] = {
              ...room.questions[room.currentQIndex],
              ...payload.question
            };
          }
          const q = room.questions[room.currentQIndex] || payload.question || {};
          const timeLimit = payload.timeLimit || room.settings.timePerQuestion || 20;

          // Safe question payload for players (omit correct index & explanation)
          const publicQuestion = {
            index: room.currentQIndex,
            questionSeq: room.questionSeq,
            total: room.questions.length,
            area: q.area || '',
            level: q.level || '',
            text: q.text || '',
            options: q.options || [],
            timeLimit
          };

          broadcastToRoom(pin, 'question_start', publicQuestion);
          break;
        }

        case 'submit_answer': {
          const { playerId, qIndex, optionIndex, timeElapsed } = payload;
          const activeIdx = qIndex !== undefined ? qIndex : room.currentQIndex;
          const player = room.players.get(playerId);
          const q = room.questions[activeIdx];
          if (player && q && player.answers[activeIdx] === undefined) {
            const isCorrect = optionIndex === q.correct;
            const timeLimit = (room.settings.timePerQuestion || 20) * 1000;
            const clampedElapsed = Math.max(0, Math.min(timeLimit, Number(timeElapsed) || (Date.now() - (room.questionStartTime || Date.now()))));
            let points = 0;
            if (isCorrect) {
              const speedRatio = Math.max(0, Math.min(1, 1 - (clampedElapsed / (timeLimit * 1.5))));
              const speedBonus = Math.round(500 * speedRatio);
              const streakBonus = Math.min(500, player.streak * 100);
              points = 500 + speedBonus + streakBonus;
              player.score += points;
              player.streak += 1;
            } else {
              player.streak = 0;
            }

            player.answers[activeIdx] = {
              optionIndex,
              isCorrect,
              points,
              timeElapsed: clampedElapsed
            };

            let answeredCount = 0;
            room.players.forEach(p => {
              if (p.answers && p.answers[activeIdx] !== undefined) answeredCount++;
            });

            broadcastToRoom(pin, 'answer_count_updated', {
              qIndex: activeIdx,
              playerId: player.id,
              answer: player.answers[activeIdx],
              score: player.score,
              streak: player.streak,
              answeredCount,
              totalPlayers: room.players.size
            });
          }
          break;
        }

        case 'reveal_answer': {
          room.state = 'leaderboard';
          const qIndex = payload.qIndex !== undefined ? payload.qIndex : room.currentQIndex;
          const q = room.questions[qIndex] || {};
          
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
              lastAnswer: p.answers?.[qIndex] || null
            }))
            .sort((a, b) => b.score - a.score);

          const revealPayload = {
            qIndex,
            correct: q.correct,
            options: q.options || [],
            explanation: q.explanation || '',
            distribution,
            players: rankedPlayers,
            leaderboard: rankedPlayers,
            totalQuestions: room.questions.length,
            isLastQuestion: qIndex >= room.questions.length - 1
          };
          room.lastRevealPayload = revealPayload;

          broadcastToRoom(pin, 'answer_revealed', revealPayload);
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
              streak: p.streak
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
                totalQuestions: room.questions.length
              };
            })
            .sort((a, b) => b.score - a.score);

          const podiumPayload = {
            podium: finalStandings.slice(0, 3),
            standings: finalStandings
          };
          room.lastPodiumPayload = podiumPayload;

          broadcastToRoom(pin, 'podium_revealed', podiumPayload);
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

  // 6. List Active Kahoot Rooms: GET /api/kahoot/rooms
  if (pathname === '/api/kahoot/rooms') {
    const now = Date.now();
    const maxAgeMs = 4 * 60 * 60 * 1000; // 4 hours
    const activeRooms = [];

    for (const [pin, room] of kahootRooms.entries()) {
      if (now - (room.createdAt || now) > maxAgeMs) {
        kahootRooms.delete(pin);
        continue;
      }
      if (room.state !== 'podium') {
        activeRooms.push({
          pin: room.pin,
          title: room.title || 'ThermoOlyMaster Competition Test',
          state: room.state,
          currentQIndex: room.currentQIndex,
          totalQuestions: room.questions ? room.questions.length : 0,
          playerCount: room.players ? room.players.size : 0,
          players: Array.from(room.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            score: p.score
          })),
          createdAt: room.createdAt
        });
      }
    }

    activeRooms.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, rooms: activeRooms }));
    return true;
  }

  return false;
}

function getRoomSnapshot(room) {
  let activeQuestion = null;
  if (room.state === 'question' && room.questions[room.currentQIndex]) {
    const q = room.questions[room.currentQIndex];
    const timeLimit = room.settings?.timePerQuestion || 20;
    const elapsedSec = room.questionStartTime ? Math.floor((Date.now() - room.questionStartTime) / 1000) : 0;
    activeQuestion = {
      index: room.currentQIndex,
      questionSeq: room.questionSeq || 1,
      total: room.questions.length,
      area: q.area || '',
      level: q.level || '',
      text: q.text,
      options: q.options,
      timeLimit: Math.max(3, timeLimit - elapsedSec)
    };
  }
  return {
    pin: room.pin,
    title: room.title,
    state: room.state,
    currentQIndex: room.currentQIndex,
    questionSeq: room.questionSeq || 0,
    totalQuestions: room.questions.length,
    settings: room.settings,
    activeQuestion,
    lastRevealPayload: room.lastRevealPayload || null,
    lastPodiumPayload: room.lastPodiumPayload || null,
    players: Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      streak: p.streak,
      connected: p.connected,
      answers: p.answers || {}
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

    parseJsonBody(req).then(async data => {
      const email = (data.email || '').toLowerCase().trim();
      loadCoaches();
      coachesList = coachesList.filter(c => c.email.toLowerCase() !== email);
      saveCoaches();
      if (dbPool && email) {
        try {
          await dbPool.query('DELETE FROM coaches WHERE LOWER(email) = $1', [email]);
        } catch (err) {
          console.warn('[DB] Delete coach error:', err.message);
        }
      }
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

    parseJsonBody(req).then(async data => {
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

      // If approved, add to authorized coaches list (if coach) and enroll in students table
      if (action === 'approve') {
        if (target.requestedRole === 'coach') {
          loadCoaches();
          if (!coachesList.some(c => c.email.toLowerCase() === target.email.toLowerCase())) {
            coachesList.push({ name: target.fullName, email: target.email, role: 'coach', addedAt: new Date().toISOString() });
            saveCoaches();
          }
        }
        const uname = target.email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase() || ('student_' + Date.now());
        await upsertStudentInDb({
          username: uname,
          fullName: target.fullName,
          email: target.email,
          team: target.team || 'Science Olympiad Team',
          role: target.requestedRole === 'coach' ? 'admin' : 'student',
          password: 'pass123'
        });
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

/**
 * Student Enrollment & Progress Tracking API (Backed by Neon PostgreSQL + Local Fallback)
 */
function handleStudentsApi(req, res, pathname, parsedUrl) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  // 1. GET /api/students -> Fetch all enrolled students/users & progress map
  if (pathname === '/api/students' && req.method === 'GET') {
    (async () => {
      if (dbPool) {
        try {
          const stuRes = await dbPool.query('SELECT * FROM students ORDER BY created_at ASC, username ASC');
          if (stuRes.rows.length > 0) {
            studentsList = stuRes.rows.map(r => ({
              username: r.username,
              fullName: r.full_name,
              email: r.email,
              password: r.password || 'pass123',
              team: r.team || 'Science Olympiad Team',
              role: r.role || 'student',
              picture: r.picture || null,
              authProvider: r.auth_provider || 'google_instant',
              createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
            }));
          }
          const progRes = await dbPool.query('SELECT * FROM student_progress');
          if (progRes.rows.length > 0) {
            const map = {};
            for (const r of progRes.rows) {
              map[r.username.toLowerCase()] = {
                completedLessons: Array.isArray(r.completed_lessons) ? r.completed_lessons : [],
                exams: Array.isArray(r.exams) ? r.exams : [],
                labRuns: Array.isArray(r.lab_runs) ? r.lab_runs : [],
                predictions: Array.isArray(r.predictions) ? r.predictions : [],
                kahootHistory: Array.isArray(r.kahoot_history) ? r.kahoot_history : []
              };
            }
            studentProgressMap = map;
          }
          dbConnected = true;
        } catch (err) {
          console.warn('[DB] GET /api/students refresh warning:', err.message);
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify({
        success: true,
        dbConnected: !!dbPool && dbConnected,
        users: studentsList,
        progress: studentProgressMap
      }));
    })();
    return true;
  }

  // 2. POST /api/students/enroll -> Enroll or update a student/user profile
  if (pathname === '/api/students/enroll' && req.method === 'POST') {
    parseJsonBody(req).then(async data => {
      const username = (data.username || '').toLowerCase().trim();
      const fullName = (data.fullName || '').trim();
      if (!username || !fullName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Username and full name are required.' }));
        return;
      }
      const saved = await upsertStudentInDb(data);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        dbConnected: !!dbPool && dbConnected,
        user: saved,
        users: studentsList
      }));
    }).catch(err => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: err.message }));
    });
    return true;
  }

  // 3. POST /api/students/delete -> Remove an enrolled student
  if (pathname === '/api/students/delete' && req.method === 'POST') {
    parseJsonBody(req).then(async data => {
      const username = (data.username || '').toLowerCase().trim();
      if (!username || username === 'admin') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Cannot delete primary admin account.' }));
        return;
      }
      studentsList = studentsList.filter(u => u.username.toLowerCase() !== username);
      delete studentProgressMap[username];
      saveLocalStudentsAndProgress();

      if (dbPool) {
        try {
          await dbPool.query('DELETE FROM students WHERE LOWER(username) = $1', [username]);
        } catch (err) {
          console.warn('[DB] DELETE student error:', err.message);
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        dbConnected: !!dbPool && dbConnected,
        users: studentsList
      }));
    }).catch(err => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: err.message }));
    });
    return true;
  }

  // 4. POST /api/students/progress -> Save / sync a student's progress record
  if (pathname === '/api/students/progress' && req.method === 'POST') {
    parseJsonBody(req).then(async data => {
      const username = (data.username || '').toLowerCase().trim();
      const progress = data.progress || {};
      if (!username || username === 'guest') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, guest: true }));
        return;
      }
      const savedProgress = await upsertProgressInDb(username, progress);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        dbConnected: !!dbPool && dbConnected,
        username,
        progress: savedProgress
      }));
    }).catch(err => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: err.message }));
    });
    return true;
  }

  return false;
}

/**
 * Schools, Teams & Official Competition Director API (Backed by Neon PostgreSQL + Local Fallback)
 */
function handleTournamentApi(req, res, pathname, parsedUrl) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  // 1. GET /api/tournament/state -> Returns schools, teams, competitions, and students
  if (pathname === '/api/tournament/state' && req.method === 'GET') {
    (async () => {
      if (dbPool) {
        try {
          const schRes = await dbPool.query('SELECT * FROM schools ORDER BY created_at ASC');
          if (schRes.rows.length > 0) {
            schoolsList = schRes.rows.map(r => ({
              id: r.id,
              name: r.name,
              cityState: r.city_state || '',
              division: r.division || 'Division B',
              coachName: r.coach_name || '',
              coachEmail: r.coach_email || '',
              createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
            }));
          }
          const tmRes = await dbPool.query('SELECT * FROM teams ORDER BY team_number ASC, created_at ASC');
          if (tmRes.rows.length > 0) {
            teamsList = tmRes.rows.map(r => ({
              id: r.id,
              teamNumber: r.team_number || 'B01',
              name: r.name,
              schoolId: r.school_id || '',
              schoolName: r.school_name || '',
              studentUsernames: Array.isArray(r.student_usernames) ? r.student_usernames : [],
              deviceName: r.device_name || '',
              notes: r.notes || '',
              createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
            }));
          }
          const compRes = await dbPool.query('SELECT * FROM competitions ORDER BY created_at DESC');
          if (compRes.rows.length > 0) {
            competitionsList = compRes.rows.map(r => ({
              id: r.id,
              title: r.title,
              eventDate: r.event_date || '',
              location: r.location || '',
              status: r.status || 'impound',
              settings: r.settings || {},
              entries: Array.isArray(r.entries) ? r.entries : [],
              winnersDeclared: !!r.winners_declared,
              declaredAt: r.declared_at ? new Date(r.declared_at).toISOString() : null,
              createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
              updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
            }));
          }
          dbConnected = true;
        } catch (err) {
          console.warn('[DB] GET /api/tournament/state warning:', err.message);
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify({
        success: true,
        dbConnected: !!dbPool && dbConnected,
        schools: schoolsList,
        teams: teamsList,
        competitions: competitionsList,
        students: studentsList
      }));
    })();
    return true;
  }

  // 2. POST /api/tournament/schools -> Onboard, update, or remove a school
  if (pathname === '/api/tournament/schools' && req.method === 'POST') {
    parseJsonBody(req).then(async data => {
      const action = data.action || 'upsert';
      if (action === 'delete') {
        const id = (data.id || '').trim();
        schoolsList = schoolsList.filter(s => s.id !== id);
        saveLocalStudentsAndProgress();
        if (dbPool && id) {
          try { await dbPool.query('DELETE FROM schools WHERE id = $1', [id]); } catch (e) {}
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, schools: schoolsList }));
        return;
      }

      const school = data.school || data;
      const id = (school.id || ('sch_' + Date.now())).trim();
      const name = (school.name || '').trim();
      if (!name) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'School name is required.' }));
        return;
      }

      const record = {
        id,
        name,
        cityState: (school.cityState || '').trim(),
        division: (school.division || 'Division B').trim(),
        coachName: (school.coachName || '').trim(),
        coachEmail: (school.coachEmail || '').toLowerCase().trim(),
        createdAt: school.createdAt || new Date().toISOString()
      };

      const idx = schoolsList.findIndex(s => s.id === id);
      if (idx >= 0) schoolsList[idx] = record;
      else schoolsList.push(record);
      saveLocalStudentsAndProgress();

      if (dbPool) {
        try {
          await dbPool.query(
            `INSERT INTO schools (id, name, city_state, division, coach_name, coach_email)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               city_state = EXCLUDED.city_state,
               division = EXCLUDED.division,
               coach_name = EXCLUDED.coach_name,
               coach_email = EXCLUDED.coach_email`,
            [record.id, record.name, record.cityState, record.division, record.coachName, record.coachEmail]
          );
        } catch (err) {
          console.warn('[DB] Upsert school error:', err.message);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, school: record, schools: schoolsList }));
    }).catch(err => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: err.message }));
    });
    return true;
  }

  // 3. POST /api/tournament/teams -> Onboard, update, or remove a team & student associations
  if (pathname === '/api/tournament/teams' && req.method === 'POST') {
    parseJsonBody(req).then(async data => {
      const action = data.action || 'upsert';
      if (action === 'delete') {
        const id = (data.id || '').trim();
        teamsList = teamsList.filter(t => t.id !== id);
        saveLocalStudentsAndProgress();
        if (dbPool && id) {
          try {
            await dbPool.query('DELETE FROM teams WHERE id = $1', [id]);
            await dbPool.query("UPDATE students SET team_id = '' WHERE team_id = $1", [id]);
          } catch (e) {}
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, teams: teamsList }));
        return;
      }

      const team = data.team || data;
      const id = (team.id || ('team_' + Date.now())).trim();
      const name = (team.name || '').trim();
      const teamNumber = (team.teamNumber || 'B01').toUpperCase().trim();
      if (!name) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Team name is required.' }));
        return;
      }

      const schoolObj = schoolsList.find(s => s.id === team.schoolId);
      const schoolName = schoolObj ? schoolObj.name : (team.schoolName || 'Smith Middle School');
      const studentUsernames = Array.isArray(team.studentUsernames)
        ? team.studentUsernames.map(u => String(u).toLowerCase().trim()).filter(Boolean)
        : [];

      const record = {
        id,
        teamNumber,
        name,
        schoolId: team.schoolId || (schoolObj ? schoolObj.id : 'sch_smith_ms'),
        schoolName,
        studentUsernames,
        deviceName: (team.deviceName || '').trim(),
        notes: (team.notes || '').trim(),
        createdAt: team.createdAt || new Date().toISOString()
      };

      // Remove assigned students from other teams if reassigned
      teamsList.forEach(t => {
        if (t.id !== id && Array.isArray(t.studentUsernames)) {
          t.studentUsernames = t.studentUsernames.filter(u => !studentUsernames.includes(u.toLowerCase()));
        }
      });

      const idx = teamsList.findIndex(t => t.id === id);
      if (idx >= 0) teamsList[idx] = record;
      else teamsList.push(record);

      // Update student records' team & school labels
      studentsList.forEach(s => {
        if (studentUsernames.includes(s.username.toLowerCase())) {
          s.teamId = record.id;
          s.schoolId = record.schoolId;
          s.team = `${record.teamNumber} - ${record.name} (${record.schoolName})`;
        }
      });

      saveLocalStudentsAndProgress();

      if (dbPool) {
        try {
          for (const t of teamsList) {
            await dbPool.query(
              `INSERT INTO teams (id, team_number, name, school_id, school_name, student_usernames, device_name, notes)
               VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
               ON CONFLICT (id) DO UPDATE SET
                 team_number = EXCLUDED.team_number,
                 name = EXCLUDED.name,
                 school_id = EXCLUDED.school_id,
                 school_name = EXCLUDED.school_name,
                 student_usernames = EXCLUDED.student_usernames,
                 device_name = EXCLUDED.device_name,
                 notes = EXCLUDED.notes`,
              [t.id, t.teamNumber, t.name, t.schoolId || null, t.schoolName, JSON.stringify(t.studentUsernames || []), t.deviceName, t.notes]
            );
          }
          for (const uname of studentUsernames) {
            await dbPool.query(
              `UPDATE students SET team_id = $1, school_id = $2, team = $3, updated_at = NOW() WHERE LOWER(username) = $4`,
              [record.id, record.schoolId, `${record.teamNumber} - ${record.name}`, uname]
            );
          }
        } catch (err) {
          console.warn('[DB] Upsert team error:', err.message);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, team: record, teams: teamsList, students: studentsList }));
    }).catch(err => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: err.message }));
    });
    return true;
  }

  // 4. POST /api/tournament/competitions -> Create, update, score, or declare winners for a competition
  if (pathname === '/api/tournament/competitions' && req.method === 'POST') {
    parseJsonBody(req).then(async data => {
      const action = data.action || 'upsert';
      if (action === 'delete') {
        const id = (data.id || '').trim();
        competitionsList = competitionsList.filter(c => c.id !== id);
        saveLocalStudentsAndProgress();
        if (dbPool && id) {
          try { await dbPool.query('DELETE FROM competitions WHERE id = $1', [id]); } catch (e) {}
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, competitions: competitionsList }));
        return;
      }

      const comp = data.competition || data;
      const id = (comp.id || ('comp_' + Date.now())).trim();
      const title = (comp.title || 'Science Olympiad Thermodynamics Competition').trim();

      const record = {
        id,
        title,
        eventDate: comp.eventDate || new Date().toISOString().slice(0, 10),
        location: (comp.location || 'Main Science Arena').trim(),
        status: comp.status || 'impound',
        settings: comp.settings || {
          questionCount: 20,
          maxExamRaw: 20,
          targetStartTempC: 21.0,
          lampHeightCm: 45,
          lampWattage: 120,
          heatingMinutes: 25
        },
        entries: Array.isArray(comp.entries) ? comp.entries : [],
        winnersDeclared: !!comp.winnersDeclared,
        declaredAt: comp.winnersDeclared ? (comp.declaredAt || new Date().toISOString()) : null,
        createdAt: comp.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const idx = competitionsList.findIndex(c => c.id === id);
      if (idx >= 0) competitionsList[idx] = record;
      else competitionsList.unshift(record);

      saveLocalStudentsAndProgress();

      if (dbPool) {
        try {
          await dbPool.query(
            `INSERT INTO competitions (id, title, event_date, location, status, settings, entries, winners_declared, declared_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, NOW())
             ON CONFLICT (id) DO UPDATE SET
               title = EXCLUDED.title,
               event_date = EXCLUDED.event_date,
               location = EXCLUDED.location,
               status = EXCLUDED.status,
               settings = EXCLUDED.settings,
               entries = EXCLUDED.entries,
               winners_declared = EXCLUDED.winners_declared,
               declared_at = EXCLUDED.declared_at,
               updated_at = NOW()`,
            [
              record.id,
              record.title,
              record.eventDate,
              record.location,
              record.status,
              JSON.stringify(record.settings),
              JSON.stringify(record.entries),
              record.winnersDeclared,
              record.declaredAt
            ]
          );
        } catch (err) {
          console.warn('[DB] Upsert competition error:', err.message);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, competition: record, competitions: competitionsList }));
    }).catch(err => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: err.message }));
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

  // Check Students & Progress Tracking API
  if (pathname.startsWith('/api/students')) {
    if (handleStudentsApi(req, res, pathname, parsedUrl)) {
      return;
    }
  }

  // Check Tournament (Schools, Teams & Competitions) API
  if (pathname.startsWith('/api/tournament/')) {
    if (handleTournamentApi(req, res, pathname, parsedUrl)) {
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
