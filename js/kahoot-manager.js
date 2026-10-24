/**
 * ThermoOlyMaster - ThermoKahoot Live Online Competition Engine
 * Converts any Science Olympiad Written Exam test into an electrifying,
 * real-time Kahoot-style classroom tournament.
 * 
 * Features:
 * - 4-Color Iconic Shape Grid: ▲ Red, ◆ Blue, ● Yellow, ■ Green
 * - Real-time Network Multiplayer (Node.js Server SSE + REST)
 * - Zero-Latency Local Fallback (BroadcastChannel + LocalStorage for multi-tab play)
 * - Dynamic Speed Scoring & Fire Streaks (up to 1,000 pts per question)
 * - Realistic Science Olympiad AI Rival Bots (Troy High, Solon MS, Beckendorff, etc.)
 * - Rich Thermodynamic Explanations for every revealed question
 * - 3D Winner Podium + Particle Confetti Celebration
 * - Gradebook & Google Sheets Progress Sync
 */

import { EXAM_QUESTIONS } from './exam-arena.js';
import { authManager } from './auth-manager.js';
import { kahootAudio } from './kahoot-audio.js';
import { QRCodeGenerator } from './qr-code.js';

// Iconic Science Olympiad Rivals for AI Bots
export const RIVAL_BOTS = [
  { name: 'Troy High SO (CA)', avatar: '🏆', accuracy: 0.88, minDelay: 2500, maxDelay: 7000 },
  { name: 'Solon MS (OH)', avatar: '⚡', accuracy: 0.84, minDelay: 3000, maxDelay: 8500 },
  { name: 'Beckendorff JH (TX)', avatar: '🔬', accuracy: 0.80, minDelay: 3500, maxDelay: 9000 },
  { name: 'Kennedy MS (CA)', avatar: '🦉', accuracy: 0.76, minDelay: 4000, maxDelay: 10000 },
  { name: 'Mason MS (OH)', avatar: '🔥', accuracy: 0.72, minDelay: 4500, maxDelay: 11000 }
];

export class KahootManager {
  constructor() {
    this.allQuestions = [...EXAM_QUESTIONS];
    this.activeQuestions = [...this.allQuestions];
    this.pin = null;
    this.role = 'host'; // 'host' | 'player'
    this.state = 'setup'; // setup, lobby, countdown, question, reveal, leaderboard, podium
    this.currentQIndex = -1;
    this.timePerQuestion = 20;
    this.timerSeconds = 20;
    this.timerInterval = null;
    this.qStartTime = 0;
    this.players = new Map(); // id -> player object
    this.myPlayer = null; // for player mode
    this.myAnswer = null;
    this.eventSource = null;
    this.channel = null;
    this.botTimeouts = [];
    this.confettiAnimationId = null;
    this.serverLanIp = null;
    this.joinUrl = '';

    this.initBroadcastChannel();
  }

  init() {
    this.bindDOM();
    this.listenForExamLaunch();
    this.updateSoundButtonUI();
    this.fetchNetworkInfo();
    this.checkUrlJoinParams();
  }

  initBroadcastChannel() {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('thermo_kahoot_v1');
        this.channel.onmessage = (e) => this.handleBroadcastMessage(e.data);
      } catch (err) {
        console.warn('BroadcastChannel not supported in this environment');
      }
    }
  }

  broadcastLocal(event, data) {
    if (this.channel) {
      try {
        this.channel.postMessage({ event, data, pin: this.pin });
      } catch (err) {}
    }
  }

  handleBroadcastMessage(msg) {
    if (!msg || msg.pin !== this.pin) return;
    const { event, data } = msg;

    switch (event) {
      case 'player_joined':
        if (this.role === 'host') {
          this.players.set(data.player.id, data.player);
          this.renderHostLobbyPlayers();
        }
        break;

      case 'question_start':
        if (this.role === 'player') {
          this.handlePlayerQuestionStart(data);
        }
        break;

      case 'answer_count_updated':
        if (this.role === 'host') {
          this.updateHostAnsweredCount(data.answeredCount, data.totalPlayers);
        }
        break;

      case 'answer_revealed':
        if (this.role === 'player') {
          this.handlePlayerAnswerRevealed(data);
        }
        break;

      case 'leaderboard_update':
        if (this.role === 'player') {
          this.handlePlayerLeaderboard(data);
        }
        break;

      case 'podium_revealed':
        if (this.role === 'player') {
          this.handlePlayerPodium(data);
        }
        break;
    }
  }

  listenForExamLaunch() {
    window.addEventListener('launch_kahoot_from_exam', (e) => {
      const { questions, filterLabel } = e.detail || {};
      this.switchMode('host');
      this.openSetupWithQuestions(questions, filterLabel);
    });
  }

  /**
   * Pre-configures host room creation with questions filtered from Exam Arena
   */
  openSetupWithQuestions(questions, filterLabel = 'Filtered Test') {
    if (questions && questions.length > 0) {
      this.activeQuestions = [...questions];
    } else {
      this.activeQuestions = [...this.allQuestions];
    }

    // Switch sub-tab in exam view
    const btnTab = document.getElementById('subTabExamKahoot');
    if (btnTab) btnTab.click();

    const titleEl = document.getElementById('kahootSetupTestTitle');
    if (titleEl) {
      titleEl.textContent = `Source: ${filterLabel} (${this.activeQuestions.length} Available Questions)`;
    }

    const countSelect = document.getElementById('kahootSetupQCount');
    if (countSelect) {
      countSelect.value = Math.min(this.activeQuestions.length, 10).toString();
    }

    this.showScreen('kahootScreenSetup');

    if (window.showToast) {
      window.showToast(`Converted ${this.activeQuestions.length} exam questions into Kahoot competition!`, 'success');
    }
  }

  bindDOM() {
    // Mode Switcher: Host Screen vs Player Controller
    const btnRoleHost = document.getElementById('kahootBtnRoleHost');
    const btnRolePlayer = document.getElementById('kahootBtnRolePlayer');
    const btnSplitView = document.getElementById('kahootBtnSplitView');

    if (btnRoleHost) {
      btnRoleHost.addEventListener('click', () => {
        this.switchMode('host');
      });
    }
    if (btnRolePlayer) {
      btnRolePlayer.addEventListener('click', () => {
        this.switchMode('player');
      });
    }
    if (btnSplitView) {
      btnSplitView.addEventListener('click', () => {
        this.toggleSplitView();
      });
    }

    // Sound toggle button
    const btnSound = document.getElementById('kahootBtnToggleSound');
    if (btnSound) {
      btnSound.addEventListener('click', () => {
        const enabled = kahootAudio.toggleSound();
        this.updateSoundButtonUI();
        if (window.showToast) {
          window.showToast(`Sound ${enabled ? 'Enabled 🔊' : 'Muted 🔇'}`, 'info');
        }
      });
    }

    // Host Setup: Create Room Button
    const btnCreateRoom = document.getElementById('kahootBtnCreateRoom');
    if (btnCreateRoom) {
      btnCreateRoom.addEventListener('click', () => this.handleCreateRoom());
    }

    // Host Lobby Controls
    const btnStartGame = document.getElementById('kahootBtnStartGame');
    if (btnStartGame) {
      btnStartGame.addEventListener('click', () => this.startGame());
    }

    const btnAddBot = document.getElementById('kahootBtnAddBot');
    if (btnAddBot) {
      btnAddBot.addEventListener('click', () => this.addRandomBot());
    }

    const btnCopyPin = document.getElementById('kahootBtnCopyPin');
    if (btnCopyPin) {
      btnCopyPin.addEventListener('click', () => {
        if (this.pin) {
          navigator.clipboard.writeText(this.pin).then(() => {
            if (window.showToast) window.showToast(`Game PIN ${this.pin} copied to clipboard!`, 'success');
          }).catch(() => {
            if (window.showToast) window.showToast(`PIN: ${this.pin}`, 'info');
          });
        }
      });
    }

    const btnCopyDirectLink = document.getElementById('kahootBtnCopyDirectLink');
    if (btnCopyDirectLink) {
      btnCopyDirectLink.addEventListener('click', () => {
        if (this.joinUrl) {
          navigator.clipboard.writeText(this.joinUrl).then(() => {
            if (window.showToast) window.showToast('Direct Join Link copied to clipboard! Share with students.', 'success');
          }).catch(() => {
            if (window.showToast) window.showToast(this.joinUrl, 'info');
          });
        }
      });
    }

    // Host In-Game Controls
    const btnRevealAnswer = document.getElementById('kahootBtnRevealNow');
    if (btnRevealAnswer) {
      btnRevealAnswer.addEventListener('click', () => this.revealAnswer());
    }

    const btnNextFromReveal = document.getElementById('kahootBtnNextFromReveal');
    if (btnNextFromReveal) {
      btnNextFromReveal.addEventListener('click', () => this.showLeaderboard());
    }

    const btnNextFromLeaderboard = document.getElementById('kahootBtnNextFromLeaderboard');
    if (btnNextFromLeaderboard) {
      btnNextFromLeaderboard.addEventListener('click', () => this.proceedFromLeaderboard());
    }

    const btnPlayAgain = document.getElementById('kahootBtnPlayAgain');
    if (btnPlayAgain) {
      btnPlayAgain.addEventListener('click', () => this.resetGameToSetup());
    }

    const btnSyncScores = document.getElementById('kahootBtnSyncScores');
    if (btnSyncScores) {
      btnSyncScores.addEventListener('click', () => this.syncScoresToGradebook());
    }

    // Player Join Controls
    const btnJoinGame = document.getElementById('kahootBtnJoinGame');
    if (btnJoinGame) {
      btnJoinGame.addEventListener('click', () => this.handlePlayerJoin());
    }

    // Player 4-Shape Answer Buttons
    const shapeButtons = document.querySelectorAll('.kahoot-player-btn');
    shapeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const optIdx = parseInt(btn.getAttribute('data-opt'), 10);
        this.submitPlayerAnswer(optIdx);
      });
    });

    // Fullscreen and Exit Controls
    const btnToggleFullscreen = document.getElementById('kahootBtnToggleFullscreen');
    if (btnToggleFullscreen) {
      btnToggleFullscreen.addEventListener('click', () => this.toggleHostFullscreen());
    }

    const btnExitArena = document.getElementById('kahootBtnExitArena');
    if (btnExitArena) {
      btnExitArena.addEventListener('click', () => this.exitArena());
    }

    const hudFullscreenBtn = document.getElementById('kahootHudFullscreenBtn');
    if (hudFullscreenBtn) {
      hudFullscreenBtn.addEventListener('click', () => this.toggleHostFullscreen());
    }

    const hudSoundBtn = document.getElementById('kahootHudSoundBtn');
    if (hudSoundBtn) {
      hudSoundBtn.addEventListener('click', () => {
        const enabled = kahootAudio.toggleSound();
        this.updateSoundButtonUI();
        if (window.showToast) {
          window.showToast(`Sound ${enabled ? 'Enabled 🔊' : 'Muted 🔇'}`, 'info');
        }
      });
    }

    const hudExitBtn = document.getElementById('kahootHudExitBtn');
    if (hudExitBtn) {
      hudExitBtn.addEventListener('click', () => this.exitArena());
    }

    // Player Topbar Controls
    const playerFsBtn = document.getElementById('kahootPlayerFullscreenBtn');
    if (playerFsBtn) {
      playerFsBtn.addEventListener('click', () => this.togglePlayerFullscreen());
    }

    const playerSoundBtn = document.getElementById('kahootPlayerSoundBtn');
    if (playerSoundBtn) {
      playerSoundBtn.addEventListener('click', () => {
        const enabled = kahootAudio.toggleSound();
        this.updateSoundButtonUI();
      });
    }

    const playerExitBtn = document.getElementById('kahootPlayerExitBtn');
    if (playerExitBtn) {
      playerExitBtn.addEventListener('click', () => this.exitArena());
    }

    // Keyboard Shortcuts
    this.setupKeyboardShortcuts();

    // Fullscreen change listener
    document.addEventListener('fullscreenchange', () => {
      const isFs = !!document.fullscreenElement;
      if (!isFs) {
        if (document.body.classList.contains('kahoot-host-fullscreen-active')) {
          this.updateFullscreenUI(false, 'host');
          document.body.classList.remove('kahoot-host-fullscreen-active');
        }
      }
    });

    // Populate student nicknames quick selector
    this.populateStudentQuickSelect();
  }

  toggleHostFullscreen() {
    const isActive = document.body.classList.toggle('kahoot-host-fullscreen-active');
    this.updateFullscreenUI(isActive, 'host');
    if (isActive) {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  enableHostFullscreen() {
    if (!document.body.classList.contains('kahoot-host-fullscreen-active')) {
      document.body.classList.add('kahoot-host-fullscreen-active');
      this.updateFullscreenUI(true, 'host');
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    }
  }

  togglePlayerFullscreen() {
    const isActive = document.body.classList.toggle('kahoot-player-fullscreen-active');
    this.updateFullscreenUI(isActive, 'player');
    if (isActive) {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  updateFullscreenUI(isActive, role) {
    const label = document.getElementById('kahootFullscreenLabel');
    const hudBtn = document.getElementById('kahootHudFullscreenBtn');
    const playerFsBtn = document.getElementById('kahootPlayerFullscreenBtn');

    if (role === 'host') {
      if (label) label.textContent = isActive ? 'Exit Fullscreen' : 'Fullscreen Projector';
      if (hudBtn) hudBtn.textContent = isActive ? '⛶ Exit Fullscreen' : '⛶ Fullscreen Projector';
    } else {
      if (playerFsBtn) playerFsBtn.textContent = isActive ? '↙' : '⛶';
    }
  }

  exitArena() {
    document.body.classList.remove('kahoot-host-fullscreen-active');
    document.body.classList.remove('kahoot-player-fullscreen-active');
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    // Switch to Interactive Screen Test tab
    const subInteractive = document.getElementById('subTabExamInteractive');
    if (subInteractive) subInteractive.click();
  }

  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Don't intercept when user is typing in an input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      const kahootView = document.getElementById('examModeKahoot');
      if (!kahootView || kahootView.style.display === 'none') return;

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (this.role === 'host') {
          this.toggleHostFullscreen();
        } else {
          this.togglePlayerFullscreen();
        }
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        const enabled = kahootAudio.toggleSound();
        this.updateSoundButtonUI();
        if (window.showToast) {
          window.showToast(`Sound ${enabled ? 'Enabled 🔊' : 'Muted 🔇'}`, 'info');
        }
      } else if (e.key === ' ' || e.key === 'Enter') {
        const screenReveal = document.getElementById('kahootScreenReveal');
        const screenLeaderboard = document.getElementById('kahootScreenLeaderboard');
        if (screenReveal && screenReveal.style.display !== 'none') {
          e.preventDefault();
          this.showLeaderboard();
        } else if (screenLeaderboard && screenLeaderboard.style.display !== 'none') {
          e.preventDefault();
          this.proceedFromLeaderboard();
        }
      }
    });
  }

  updateSoundButtonUI() {
    const btn = document.getElementById('kahootBtnToggleSound');
    const hudBtn = document.getElementById('kahootHudSoundBtn');
    const playerSoundBtn = document.getElementById('kahootPlayerSoundBtn');
    const enabled = kahootAudio.isSoundEnabled();

    if (btn) {
      btn.innerHTML = enabled ? '<span>🔊</span> Sound ON' : '<span>🔇</span> Sound Muted';
      btn.classList.toggle('active', enabled);
    }
    if (hudBtn) {
      hudBtn.innerHTML = `<span>${enabled ? '🔊' : '🔇'}</span> Sound ${enabled ? 'ON' : 'OFF'}`;
    }
    if (playerSoundBtn) {
      playerSoundBtn.textContent = enabled ? '🔊' : '🔇';
    }
  }

  populateStudentQuickSelect() {
    const select = document.getElementById('kahootPlayerStudentSelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- Choose Science Olympiad Student --</option>';
    if (authManager && authManager.getAllUsers) {
      const users = authManager.getAllUsers();
      users.filter(u => u.role === 'student').forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.fullName;
        opt.textContent = `${s.fullName} (${s.username})`;
        select.appendChild(opt);
      });
    }

    select.addEventListener('change', (e) => {
      const nameInput = document.getElementById('kahootPlayerNickname');
      if (nameInput && e.target.value) {
        nameInput.value = e.target.value;
      }
    });
  }

  switchMode(role) {
    this.role = role;
    const btnHost = document.getElementById('kahootBtnRoleHost');
    const btnPlayer = document.getElementById('kahootBtnRolePlayer');
    const hostContainer = document.getElementById('kahootHostContainer');
    const playerContainer = document.getElementById('kahootPlayerContainer');

    if (btnHost) btnHost.classList.toggle('active', role === 'host');
    if (btnPlayer) btnPlayer.classList.toggle('active', role === 'player');

    if (hostContainer) hostContainer.style.display = role === 'host' ? 'block' : 'none';
    if (playerContainer) playerContainer.style.display = role === 'player' ? 'block' : 'none';

    if (role === 'player') {
      document.body.classList.remove('kahoot-host-fullscreen-active');
      document.body.classList.add('kahoot-player-fullscreen-active');
    } else {
      document.body.classList.remove('kahoot-player-fullscreen-active');
    }
  }

  toggleSplitView() {
    const splitBtn = document.getElementById('kahootBtnSplitView');
    const wrapper = document.getElementById('kahootMainWrapper');
    const hostContainer = document.getElementById('kahootHostContainer');
    const playerContainer = document.getElementById('kahootPlayerContainer');

    const isSplit = wrapper.classList.toggle('kahoot-split-mode');
    if (splitBtn) splitBtn.classList.toggle('active', isSplit);

    if (isSplit) {
      document.body.classList.remove('kahoot-player-fullscreen-active');
      document.body.classList.remove('kahoot-host-fullscreen-active');
      if (hostContainer) hostContainer.style.display = 'block';
      if (playerContainer) playerContainer.style.display = 'block';
      // Pre-fill PIN if host has one
      if (this.pin) {
        const pinInput = document.getElementById('kahootPlayerPinInput');
        if (pinInput) pinInput.value = this.pin;
      }
      if (window.showToast) {
        window.showToast('Split View Active: Test Host & Player Controller side-by-side!', 'info');
      }
    } else {
      this.switchMode(this.role);
    }
  }

  showScreen(screenId) {
    const screens = [
      'kahootScreenSetup',
      'kahootScreenLobby',
      'kahootScreenCountdown',
      'kahootScreenQuestion',
      'kahootScreenReveal',
      'kahootScreenLeaderboard',
      'kahootScreenPodium'
    ];

    screens.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = (id === screenId) ? 'block' : 'none';
    });
  }

  showPlayerScreen(screenId) {
    const screens = [
      'kahootPlayerScreenJoin',
      'kahootPlayerScreenLobby',
      'kahootPlayerScreenQuestion',
      'kahootPlayerScreenFeedback',
      'kahootPlayerScreenPodium'
    ];

    screens.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = (id === screenId) ? 'block' : 'none';
    });
  }

  // =========================================================================
  // HOST WORKFLOW
  // =========================================================================

  async handleCreateRoom() {
    if (!this.serverLanIp) {
      await this.fetchNetworkInfo();
    }
    const qCountSelect = document.getElementById('kahootSetupQCount');
    const timerSelect = document.getElementById('kahootSetupTimer');
    const randomizeCheckbox = document.getElementById('kahootSetupRandomize');
    const addBotsCheckbox = document.getElementById('kahootSetupAddBots');

    const count = parseInt(qCountSelect?.value || '10', 10);
    this.timePerQuestion = parseInt(timerSelect?.value || '20', 10);
    const randomize = !!randomizeCheckbox?.checked;
    const addInitialBots = !!addBotsCheckbox?.checked;

    // Prepare questions pool
    let pool = [...this.activeQuestions];
    if (randomize) {
      pool.sort(() => 0.5 - Math.random());
    }
    this.questions = pool.slice(0, count);

    // Generate 6-digit Game PIN
    this.pin = Math.floor(100000 + Math.random() * 900000).toString();
    this.players.clear();
    this.currentQIndex = -1;

    // Update PIN in lobby display
    const elPin = document.getElementById('kahootLobbyPin');
    if (elPin) elPin.textContent = this.pin;
    const hudPin = document.getElementById('kahootHudRoomPin');
    if (hudPin) hudPin.textContent = `PIN: ${this.pin}`;

    // Render Direct Join Link & QR Code
    this.joinUrl = this.getJoinUrl();
    const urlEl = document.getElementById('kahootLobbyDirectUrl');
    if (urlEl) urlEl.textContent = this.joinUrl;

    const qrCanvas = document.getElementById('kahootLobbyQrCanvas');
    if (qrCanvas) {
      QRCodeGenerator.draw(qrCanvas, this.joinUrl, 140);
    }

    // Update question count label
    const elCount = document.getElementById('kahootLobbyQCount');
    if (elCount) elCount.textContent = `${this.questions.length} Competition Questions`;

    // Connect to server API if available
    this.createRoomOnServer({
      pin: this.pin,
      title: 'ThermoOlyMaster Competition Test',
      questions: this.questions,
      settings: {
        timePerQuestion: this.timePerQuestion,
        randomize
      }
    });

    // Populate auto-bots if requested
    if (addInitialBots) {
      RIVAL_BOTS.slice(0, 3).forEach(b => this.addBotPlayer(b));
    }

    this.showScreen('kahootScreenLobby');
    this.renderHostLobbyPlayers();

    // Auto-fill pin into player input if open in split view
    const playerPinInput = document.getElementById('kahootPlayerPinInput');
    if (playerPinInput) playerPinInput.value = this.pin;

    if (window.showToast) {
      window.showToast(`Kahoot Room ${this.pin} created! Invite players to join.`, 'success');
    }
  }

  async fetchNetworkInfo() {
    try {
      const res = await fetch('/api/kahoot/network-info');
      if (res.ok) {
        const data = await res.json();
        this.serverLanIp = data.lanIp;
      }
    } catch (e) {
      this.serverLanIp = window.location.hostname || 'localhost';
    }
  }

  getJoinUrl() {
    const port = window.location.port ? `:${window.location.port}` : '';
    const host = (this.serverLanIp && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
      ? this.serverLanIp
      : window.location.hostname;
    return `${window.location.protocol}//${host}${port}/?pin=${this.pin}`;
  }

  checkUrlJoinParams() {
    const params = new URLSearchParams(window.location.search);
    const pin = params.get('pin') || params.get('join');
    if (pin) {
      // Ensure Written Exam tab is active
      const examTab = document.querySelector('.nav-tab-btn[data-target="view-exam"]');
      if (examTab) {
        document.querySelectorAll('.nav-tab-btn').forEach(t => t.classList.remove('active'));
        examTab.classList.add('active');
        document.querySelectorAll('.view-section').forEach(s => s.classList.toggle('active', s.id === 'view-exam'));
      }

      // Switch to Live Kahoot subtab
      const kahootSubTab = document.getElementById('subTabExamKahoot');
      if (kahootSubTab) kahootSubTab.click();

      // Switch to player controller mode
      this.switchMode('player');
      const pinInput = document.getElementById('kahootPlayerPinInput');
      if (pinInput) {
        pinInput.value = pin.trim();
      }
      const nameInput = document.getElementById('kahootPlayerNickname');
      if (nameInput) {
        setTimeout(() => nameInput.focus(), 300);
      }
      if (window.showToast) {
        window.showToast(`Game PIN ${pin} loaded! Enter your nickname or pick your student name to join.`, 'success');
      }
    }
  }

  async createRoomOnServer(payload) {
    try {
      const res = await fetch('/api/kahoot/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        this.connectSSE('host');
      }
    } catch (err) {
      console.log('Server not reachable, running in offline/BroadcastChannel mode');
    }
  }

  connectSSE(role) {
    if (typeof EventSource === 'undefined') return;
    if (this.eventSource) {
      this.eventSource.close();
    }

    const playerId = this.myPlayer ? this.myPlayer.id : 'host';
    const sseUrl = `/api/kahoot/events?pin=${this.pin}&role=${role}&playerId=${playerId}`;
    this.eventSource = new EventSource(sseUrl);

    this.eventSource.addEventListener('player_joined', (e) => {
      const data = JSON.parse(e.data);
      if (this.role === 'host') {
        this.players.set(data.player.id, data.player);
        this.renderHostLobbyPlayers();
        kahootAudio.playPop();
      }
    });

    this.eventSource.addEventListener('question_start', (e) => {
      const data = JSON.parse(e.data);
      if (this.role === 'player') {
        this.handlePlayerQuestionStart(data);
      }
    });

    this.eventSource.addEventListener('answer_count_updated', (e) => {
      const data = JSON.parse(e.data);
      if (this.role === 'host') {
        this.updateHostAnsweredCount(data.answeredCount, data.totalPlayers);
      }
    });

    this.eventSource.addEventListener('answer_revealed', (e) => {
      const data = JSON.parse(e.data);
      if (this.role === 'player') {
        this.handlePlayerAnswerRevealed(data);
      }
    });

    this.eventSource.addEventListener('leaderboard_update', (e) => {
      const data = JSON.parse(e.data);
      if (this.role === 'player') {
        this.handlePlayerLeaderboard(data);
      }
    });

    this.eventSource.addEventListener('podium_revealed', (e) => {
      const data = JSON.parse(e.data);
      if (this.role === 'player') {
        this.handlePlayerPodium(data);
      }
    });
  }

  addRandomBot() {
    const unadded = RIVAL_BOTS.filter(b => !this.players.has(b.name));
    if (unadded.length === 0) {
      if (window.showToast) window.showToast('All standard AI rival teams already added!', 'info');
      return;
    }
    const bot = unadded[Math.floor(Math.random() * unadded.length)];
    this.addBotPlayer(bot);
  }

  addBotPlayer(botConfig) {
    const botPlayer = {
      id: botConfig.name,
      name: botConfig.name,
      avatar: botConfig.avatar,
      score: 0,
      streak: 0,
      answers: {},
      isBot: true,
      config: botConfig
    };

    this.players.set(botPlayer.id, botPlayer);
    this.renderHostLobbyPlayers();
    kahootAudio.playPop();

    // Notify server & broadcast
    this.sendServerAction('add_bot', {
      name: botConfig.name,
      avatar: botConfig.avatar,
      accuracy: botConfig.accuracy
    });
    this.broadcastLocal('player_joined', { player: botPlayer });
  }

  renderHostLobbyPlayers() {
    const container = document.getElementById('kahootLobbyPlayerGrid');
    const countEl = document.getElementById('kahootLobbyPlayerCount');
    const btnStart = document.getElementById('kahootBtnStartGame');

    if (!container) return;
    container.innerHTML = '';

    const playerList = Array.from(this.players.values());
    if (countEl) countEl.textContent = `${playerList.length} Players Joined`;

    if (btnStart) {
      btnStart.disabled = playerList.length === 0;
      btnStart.style.opacity = playerList.length === 0 ? '0.5' : '1';
    }

    if (playerList.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--text-muted); font-size:1.05rem;">
          Waiting for players to join with PIN <strong style="color:var(--gold-accent);">${this.pin}</strong>...
          <div style="margin-top:0.5rem; font-size:0.85rem;">Click "Add AI Bot Rival" to test solo immediately!</div>
        </div>
      `;
      return;
    }

    playerList.forEach(p => {
      const card = document.createElement('div');
      card.className = 'kahoot-lobby-player-pill';
      card.innerHTML = `
        <span class="player-avatar">${p.avatar}</span>
        <span class="player-name">${p.name}</span>
        ${p.isBot ? '<span class="badge-bot">AI Rival</span>' : ''}
      `;
      container.appendChild(card);
    });
  }

  startGame() {
    if (this.players.size === 0) {
      if (window.showToast) window.showToast('Please add at least 1 player or AI bot to start!', 'warning');
      return;
    }

    const wrapper = document.getElementById('kahootMainWrapper');
    if (wrapper && !wrapper.classList.contains('kahoot-split-mode')) {
      this.enableHostFullscreen();
    }

    // Reset scores
    this.players.forEach(p => {
      p.score = 0;
      p.streak = 0;
      p.answers = {};
    });

    this.currentQIndex = 0;
    this.sendServerAction('start_game', {});
    this.showCountdownScreen();
  }

  showCountdownScreen() {
    this.showScreen('kahootScreenCountdown');
    const countEl = document.getElementById('kahootCountdownNumber');
    let count = 3;

    if (countEl) countEl.textContent = count.toString();
    kahootAudio.playTick(false);

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        if (countEl) countEl.textContent = count.toString();
        kahootAudio.playTick(true);
      } else {
        clearInterval(interval);
        this.startQuestion(this.currentQIndex);
      }
    }, 1000);
  }

  startQuestion(index) {
    this.currentQIndex = index;
    const q = this.questions[index];
    if (!q) return;

    this.state = 'question';
    this.showScreen('kahootScreenQuestion');
    this.qStartTime = Date.now();
    this.timerSeconds = this.timePerQuestion;

    // Clear previous bot timeouts
    this.botTimeouts.forEach(t => clearTimeout(t));
    this.botTimeouts = [];

    // Render Question Header
    const idxEl = document.getElementById('kahootHostQIndex');
    const areaEl = document.getElementById('kahootHostQArea');
    const textEl = document.getElementById('kahootHostQText');
    const timerEl = document.getElementById('kahootHostQTimer');
    const countEl = document.getElementById('kahootHostAnsweredCount');

    if (idxEl) idxEl.textContent = `Question ${index + 1} of ${this.questions.length}`;
    if (areaEl) areaEl.textContent = `${q.area || 'Thermodynamics'} • ${q.level || 'Official'}`;
    if (textEl) textEl.textContent = q.text;
    if (timerEl) {
      timerEl.textContent = this.timerSeconds.toString();
      timerEl.classList.remove('urgent');
    }
    if (countEl) countEl.textContent = `0 / ${this.players.size} answered`;

    // Render 4 Kahoot Options
    const shapes = ['▲', '◆', '●', '■'];
    const colors = ['red', 'blue', 'yellow', 'green'];
    for (let i = 0; i < 4; i++) {
      const textElOpt = document.getElementById(`kahootHostOptText_${i}`);
      if (textElOpt) {
        textElOpt.textContent = q.options[i] || '';
      }
      const optBlock = document.getElementById(`kahootHostOptBlock_${i}`);
      if (optBlock) {
        optBlock.className = `kahoot-option-block kahoot-opt-${colors[i]}`;
      }
    }

    // Broadcast to Server & Local
    const publicQ = {
      index,
      total: this.questions.length,
      area: q.area || '',
      level: q.level || '',
      text: q.text,
      options: q.options,
      timeLimit: this.timePerQuestion
    };

    this.sendServerAction('start_question', { qIndex: index, timeLimit: this.timePerQuestion });
    this.broadcastLocal('question_start', publicQ);

    // Audio tension pulse
    kahootAudio.startCountdownPulse(false);

    // Timer Loop
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timerSeconds--;
      if (timerEl) {
        timerEl.textContent = this.timerSeconds.toString();
        if (this.timerSeconds <= 5) {
          timerEl.classList.add('urgent');
          kahootAudio.playTick(true);
        }
      }

      if (this.timerSeconds <= 0) {
        clearInterval(this.timerInterval);
        this.revealAnswer();
      }
    }, 1000);

    // Trigger AI Bot responses
    this.scheduleBotAnswers(q, index);
  }

  scheduleBotAnswers(question, qIndex) {
    this.players.forEach(player => {
      if (!player.isBot) return;
      const config = player.config || RIVAL_BOTS[0];
      const delay = Math.floor(config.minDelay + Math.random() * (config.maxDelay - config.minDelay));

      const t = setTimeout(() => {
        if (this.state !== 'question' || this.currentQIndex !== qIndex) return;

        // Choose answer: correct or random mistake based on accuracy
        const isCorrect = Math.random() < config.accuracy;
        let chosenOption = question.correct;
        if (!isCorrect) {
          const wrongOptions = [0, 1, 2, 3].filter(idx => idx !== question.correct);
          chosenOption = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
        }

        const timeElapsed = delay;
        this.recordPlayerAnswer(player.id, qIndex, chosenOption, timeElapsed);
      }, Math.min(delay, (this.timePerQuestion - 1) * 1000));

      this.botTimeouts.push(t);
    });
  }

  recordPlayerAnswer(playerId, qIndex, optionIndex, timeElapsed) {
    const player = this.players.get(playerId);
    const q = this.questions[qIndex];
    if (!player || !q) return;

    const isCorrect = optionIndex === q.correct;
    const timeLimitMs = this.timePerQuestion * 1000;
    let points = 0;

    if (isCorrect) {
      const speedRatio = Math.max(0, Math.min(1, 1 - (timeElapsed / (timeLimitMs * 1.5))));
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

    // Count how many answered
    let answeredCount = 0;
    this.players.forEach(p => {
      if (p.answers && p.answers[qIndex] !== undefined) answeredCount++;
    });

    this.updateHostAnsweredCount(answeredCount, this.players.size);
    this.broadcastLocal('answer_count_updated', { answeredCount, totalPlayers: this.players.size });

    // If all players answered early, auto reveal!
    if (answeredCount >= this.players.size) {
      clearInterval(this.timerInterval);
      setTimeout(() => this.revealAnswer(), 600);
    }
  }

  updateHostAnsweredCount(answered, total) {
    const countEl = document.getElementById('kahootHostAnsweredCount');
    if (countEl) {
      countEl.textContent = `${answered} / ${total} answered`;
    }
  }

  revealAnswer() {
    this.state = 'reveal';
    clearInterval(this.timerInterval);
    kahootAudio.stopCountdownPulse();
    kahootAudio.playReveal();

    const q = this.questions[this.currentQIndex];
    if (!q) return;

    this.showScreen('kahootScreenReveal');

    // Reveal Header
    const titleEl = document.getElementById('kahootRevealQTitle');
    const correctTextEl = document.getElementById('kahootRevealCorrectText');
    const explanationEl = document.getElementById('kahootRevealExplanation');

    if (titleEl) titleEl.textContent = `Answer Reveal • Question ${this.currentQIndex + 1}`;
    if (correctTextEl) {
      const optLetter = ['A', 'B', 'C', 'D'][q.correct];
      correctTextEl.textContent = `${optLetter}: ${q.options[q.correct]}`;
    }
    if (explanationEl) {
      explanationEl.textContent = q.explanation || 'According to Science Olympiad Division B Thermodynamics rules.';
    }

    // Calculate Distribution
    const distribution = [0, 0, 0, 0];
    this.players.forEach(p => {
      const ans = p.answers[this.currentQIndex];
      if (ans && ans.optionIndex >= 0 && ans.optionIndex < 4) {
        distribution[ans.optionIndex]++;
      }
    });

    const maxVotes = Math.max(1, ...distribution);
    const colors = ['red', 'blue', 'yellow', 'green'];
    const shapes = ['▲', '◆', '●', '■'];

    for (let i = 0; i < 4; i++) {
      const barEl = document.getElementById(`kahootDistBar_${i}`);
      const countEl = document.getElementById(`kahootDistCount_${i}`);
      const optTextEl = document.getElementById(`kahootDistText_${i}`);
      const cardEl = document.getElementById(`kahootDistCard_${i}`);

      const count = distribution[i];
      const pct = Math.round((count / maxVotes) * 100);

      if (barEl) barEl.style.height = `${Math.max(10, pct)}%`;
      if (countEl) countEl.textContent = count.toString();
      if (optTextEl) optTextEl.textContent = `${shapes[i]} ${q.options[i]}`;
      if (cardEl) {
        cardEl.classList.toggle('is-correct', i === q.correct);
      }
    }

    // Broadcast to server & local
    const rankedPlayers = Array.from(this.players.values())
      .map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        streak: p.streak,
        lastAnswer: p.answers[this.currentQIndex] || null,
        isBot: p.isBot
      }))
      .sort((a, b) => b.score - a.score);

    const payload = {
      qIndex: this.currentQIndex,
      correct: q.correct,
      explanation: q.explanation,
      distribution,
      players: rankedPlayers
    };

    this.sendServerAction('reveal_answer', payload);
    this.broadcastLocal('answer_revealed', payload);
  }

  showLeaderboard() {
    this.state = 'leaderboard';
    this.showScreen('kahootScreenLeaderboard');

    const listEl = document.getElementById('kahootLeaderboardList');
    const titleEl = document.getElementById('kahootLeaderboardTitle');
    const isLast = this.currentQIndex >= this.questions.length - 1;

    if (titleEl) {
      titleEl.textContent = `Scoreboard • Question ${this.currentQIndex + 1} of ${this.questions.length}`;
    }

    const nextBtn = document.getElementById('kahootBtnNextFromLeaderboard');
    if (nextBtn) {
      nextBtn.innerHTML = isLast ? '<span>🏆</span> View Final Podium' : '<span>Next ▶</span> Question ' + (this.currentQIndex + 2);
    }

    const sorted = Array.from(this.players.values()).sort((a, b) => b.score - a.score);

    if (listEl) {
      listEl.innerHTML = '';
      sorted.slice(0, 5).forEach((p, rank) => {
        const item = document.createElement('div');
        item.className = `kahoot-leaderboard-row rank-${rank + 1}`;
        item.innerHTML = `
          <div class="rank-badge">${rank + 1}</div>
          <div class="player-info">
            <span class="avatar">${p.avatar}</span>
            <span class="name">${p.name}</span>
            ${p.streak >= 2 ? `<span class="streak-pill">🔥 ${p.streak} Streak</span>` : ''}
          </div>
          <div class="score-display">
            <span class="points">${p.score.toLocaleString()}</span>
            <span class="pts-label">pts</span>
          </div>
        `;
        listEl.appendChild(item);
      });
    }

    const payload = {
      qIndex: this.currentQIndex,
      totalQuestions: this.questions.length,
      isLastQuestion: isLast,
      leaderboard: sorted
    };

    this.sendServerAction('show_leaderboard', payload);
    this.broadcastLocal('leaderboard_update', payload);
  }

  proceedFromLeaderboard() {
    if (this.currentQIndex >= this.questions.length - 1) {
      this.showPodium();
    } else {
      this.startQuestion(this.currentQIndex + 1);
    }
  }

  showPodium() {
    this.state = 'podium';
    this.showScreen('kahootScreenPodium');
    kahootAudio.playFanfare();

    const sorted = Array.from(this.players.values()).sort((a, b) => b.score - a.score);
    const p1 = sorted[0];
    const p2 = sorted[1];
    const p3 = sorted[2];

    // Podium 1st
    const p1Name = document.getElementById('kahootPodiumP1Name');
    const p1Score = document.getElementById('kahootPodiumP1Score');
    const p1Avatar = document.getElementById('kahootPodiumP1Avatar');
    if (p1 && p1Name) {
      p1Name.textContent = p1.name;
      p1Score.textContent = `${p1.score.toLocaleString()} pts`;
      if (p1Avatar) p1Avatar.textContent = p1.avatar;
    }

    // Podium 2nd
    const p2Name = document.getElementById('kahootPodiumP2Name');
    const p2Score = document.getElementById('kahootPodiumP2Score');
    const p2Avatar = document.getElementById('kahootPodiumP2Avatar');
    if (p2 && p2Name) {
      p2Name.textContent = p2.name;
      p2Score.textContent = `${p2.score.toLocaleString()} pts`;
      if (p2Avatar) p2Avatar.textContent = p2.avatar;
    }

    // Podium 3rd
    const p3Name = document.getElementById('kahootPodiumP3Name');
    const p3Score = document.getElementById('kahootPodiumP3Score');
    const p3Avatar = document.getElementById('kahootPodiumP3Avatar');
    if (p3 && p3Name) {
      p3Name.textContent = p3.name;
      p3Score.textContent = `${p3.score.toLocaleString()} pts`;
      if (p3Avatar) p3Avatar.textContent = p3.avatar;
    }

    // Full table breakdown
    const tbody = document.getElementById('kahootPodiumTableBody');
    if (tbody) {
      tbody.innerHTML = '';
      sorted.forEach((p, idx) => {
        let correctCount = 0;
        Object.values(p.answers || {}).forEach(ans => {
          if (ans.isCorrect) correctCount++;
        });
        const pct = Math.round((correctCount / this.questions.length) * 100);

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>#${idx + 1}</strong></td>
          <td><span style="margin-right:0.4rem;">${p.avatar}</span> ${p.name} ${p.isBot ? '<span class="badge-bot">AI</span>' : ''}</td>
          <td><strong style="color:var(--thermal-primary);">${p.score.toLocaleString()}</strong></td>
          <td>${correctCount} / ${this.questions.length}</td>
          <td><span class="badge-pct">${pct}%</span></td>
        `;
        tbody.appendChild(tr);
      });
    }

    // Start Confetti Celebration
    this.launchConfetti();

    const payload = {
      podium: sorted.slice(0, 3),
      standings: sorted
    };
    this.sendServerAction('show_podium', payload);
    this.broadcastLocal('podium_revealed', payload);
  }

  launchConfetti() {
    const canvas = document.getElementById('kahootConfettiCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth || 800;
    canvas.height = canvas.parentElement.clientHeight || 500;

    const particles = [];
    const colors = ['#ff3d00', '#ff9100', '#00e5ff', '#ffd700', '#00e676', '#e21b3c', '#1368ce'];

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height,
        w: 8 + Math.random() * 8,
        h: 6 + Math.random() * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: -2 + Math.random() * 4,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * 360,
        vrot: -4 + Math.random() * 8
      });
    }

    let frame = 0;
    const animate = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();

        if (p.y > canvas.height + 20) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }
      });

      if (frame < 360) {
        this.confettiAnimationId = requestAnimationFrame(animate);
      }
    };

    if (this.confettiAnimationId) cancelAnimationFrame(this.confettiAnimationId);
    animate();
  }

  syncScoresToGradebook() {
    const sorted = Array.from(this.players.values()).sort((a, b) => b.score - a.score);
    let recorded = 0;

    sorted.forEach((p, rank) => {
      if (p.isBot) return; // Do not record AI bots into official gradebook

      let correctCount = 0;
      Object.values(p.answers || {}).forEach(ans => {
        if (ans.isCorrect) correctCount++;
      });
      const percent = Math.round((correctCount / this.questions.length) * 100);
      const examScore50 = parseFloat(((correctCount / this.questions.length) * 50).toFixed(1));

      // Record to user profile in authManager
      if (authManager && authManager.recordExamResult) {
        authManager.recordExamResult({
          raw: correctCount,
          total: this.questions.length,
          es: examScore50,
          percent: percent,
          type: 'kahoot_competition',
          rank: rank + 1,
          kahootScore: p.score
        });
        recorded++;
      }
    });

    if (window.showToast) {
      window.showToast(`Synced ${recorded} player scores into Team Gradebook & Google Sheets!`, 'success');
    }
  }

  resetGameToSetup() {
    this.state = 'setup';
    if (this.confettiAnimationId) cancelAnimationFrame(this.confettiAnimationId);
    document.body.classList.remove('kahoot-host-fullscreen-active');
    this.updateFullscreenUI(false, 'host');
    this.showScreen('kahootScreenSetup');
  }

  async sendServerAction(action, payload) {
    if (!this.pin) return;
    try {
      await fetch('/api/kahoot/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: this.pin, action, payload })
      });
    } catch (err) {}
  }

  // =========================================================================
  // PLAYER CONTROLLER WORKFLOW
  // =========================================================================

  handlePlayerJoin() {
    const pinInput = document.getElementById('kahootPlayerPinInput');
    const nameInput = document.getElementById('kahootPlayerNickname');
    const avatarSelect = document.getElementById('kahootPlayerAvatarSelect');

    const pin = (pinInput?.value || '').trim();
    const name = (nameInput?.value || '').trim() || 'Student';
    const avatar = avatarSelect?.value || '🦊';

    if (!pin) {
      if (window.showToast) window.showToast('Please enter a 6-digit Game PIN!', 'warning');
      return;
    }

    this.pin = pin;
    this.myPlayer = {
      id: 'p_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name,
      avatar,
      score: 0,
      streak: 0,
      answers: {}
    };

    // Broadcast locally so if host is in another tab on same device, it adds instantly
    this.broadcastLocal('player_joined', { player: this.myPlayer });

    // Also join on server
    this.joinRoomOnServer({
      pin,
      playerId: this.myPlayer.id,
      name,
      avatar
    });

    // Show waiting lobby on player controller
    this.showPlayerScreen('kahootPlayerScreenLobby');
    const welcomeName = document.getElementById('kahootPlayerLobbyName');
    const welcomeAvatar = document.getElementById('kahootPlayerLobbyAvatar');
    if (welcomeName) welcomeName.textContent = name;
    if (welcomeAvatar) welcomeAvatar.textContent = avatar;

    kahootAudio.playPop();

    if (window.showToast) {
      window.showToast(`Joined game ${pin}! Look at the host screen.`, 'success');
    }
  }

  async joinRoomOnServer(payload) {
    try {
      const res = await fetch('/api/kahoot/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        this.connectSSE('player');
      }
    } catch (err) {
      console.log('Server not reachable, running player in local mode');
    }
  }

  handlePlayerQuestionStart(data) {
    this.showPlayerScreen('kahootPlayerScreenQuestion');
    this.myAnswer = null;
    this.qStartTime = Date.now();

    const qNum = document.getElementById('kahootPlayerQNum');
    if (qNum) qNum.textContent = `Question ${data.index + 1} of ${data.total}`;

    // Re-enable 4 player buttons
    const btns = document.querySelectorAll('.kahoot-player-btn');
    btns.forEach(b => {
      b.disabled = false;
      b.classList.remove('selected');
    });

    const statusEl = document.getElementById('kahootPlayerWaitingStatus');
    if (statusEl) statusEl.textContent = 'Tap your answer fast for max points!';
  }

  submitPlayerAnswer(optionIndex) {
    if (this.myAnswer !== null || !this.myPlayer) return;

    this.myAnswer = optionIndex;
    const timeElapsed = Date.now() - this.qStartTime;

    kahootAudio.playPop();

    // Mark button selected
    const btns = document.querySelectorAll('.kahoot-player-btn');
    btns.forEach(b => {
      const opt = parseInt(b.getAttribute('data-opt'), 10);
      if (opt === optionIndex) {
        b.classList.add('selected');
      } else {
        b.disabled = true;
      }
    });

    const statusEl = document.getElementById('kahootPlayerWaitingStatus');
    if (statusEl) statusEl.textContent = 'Answer locked in! Hang tight... ⏳';

    // If host is running in this same instance (split view or single instance)
    if (this.players.has(this.myPlayer.id)) {
      this.recordPlayerAnswer(this.myPlayer.id, this.currentQIndex, optionIndex, timeElapsed);
    } else {
      // Send to server
      this.sendServerAction('submit_answer', {
        playerId: this.myPlayer.id,
        qIndex: this.currentQIndex,
        optionIndex,
        timeElapsed
      });
    }
  }

  handlePlayerAnswerRevealed(data) {
    this.showPlayerScreen('kahootPlayerScreenFeedback');

    const playerRecord = data.players.find(p => p.id === this.myPlayer?.id);
    const isCorrect = this.myAnswer === data.correct;

    const banner = document.getElementById('kahootPlayerResultBanner');
    const pointsEl = document.getElementById('kahootPlayerResultPoints');
    const streakEl = document.getElementById('kahootPlayerResultStreak');
    const rankEl = document.getElementById('kahootPlayerResultRank');

    if (banner) {
      banner.className = `kahoot-player-banner ${isCorrect ? 'is-correct' : 'is-wrong'}`;
      banner.innerHTML = isCorrect ? '<span>✅</span> Correct!' : '<span>❌</span> Incorrect';
    }

    if (isCorrect) {
      kahootAudio.playCorrect();
      if (playerRecord?.streak >= 2) kahootAudio.playStreak();
    } else {
      kahootAudio.playWrong();
    }

    if (pointsEl) {
      const lastPts = playerRecord?.lastAnswer?.points || 0;
      pointsEl.textContent = isCorrect ? `+${lastPts} Points` : '+0 Points';
    }

    if (streakEl) {
      const streak = playerRecord?.streak || 0;
      streakEl.innerHTML = streak >= 2 ? `🔥 ${streak} Answer Streak!` : '';
    }

    if (rankEl && playerRecord) {
      const rankIdx = data.players.findIndex(p => p.id === this.myPlayer.id) + 1;
      rankEl.textContent = `Rank: #${rankIdx} of ${data.players.length}`;
    }
  }

  handlePlayerLeaderboard(data) {
    // Keep feedback screen or show standings status
    const statusEl = document.getElementById('kahootPlayerFeedbackStatus');
    if (statusEl) {
      const myRank = data.leaderboard.findIndex(p => p.id === this.myPlayer?.id) + 1;
      statusEl.textContent = `Current Standing: #${myRank || '-'} • Host moving to next question...`;
    }
  }

  handlePlayerPodium(data) {
    this.showPlayerScreen('kahootPlayerScreenPodium');
    kahootAudio.playFanfare();

    const myRank = data.standings.findIndex(p => p.id === this.myPlayer?.id) + 1;
    const myData = data.standings.find(p => p.id === this.myPlayer?.id);

    const titleEl = document.getElementById('kahootPlayerPodiumTitle');
    const rankEl = document.getElementById('kahootPlayerFinalRank');
    const scoreEl = document.getElementById('kahootPlayerFinalScore');

    if (titleEl) {
      if (myRank === 1) titleEl.textContent = '🏆 CHAMPION! 1st PLACE! 🥇';
      else if (myRank === 2) titleEl.textContent = '🥈 2nd Place Podium Finish!';
      else if (myRank === 3) titleEl.textContent = '🥉 3rd Place Podium Finish!';
      else titleEl.textContent = '🏅 Competition Complete!';
    }

    if (rankEl) rankEl.textContent = `Final Place: #${myRank || '-'}`;
    if (scoreEl && myData) scoreEl.textContent = `Total Score: ${myData.score.toLocaleString()} pts`;
  }
}

export const kahootManager = new KahootManager();
