/**
 * ThermoOlyMaster - ThermoKahoot Live Online Competition Engine
 * Converts any Science Olympiad Written Exam test into an electrifying,
 * real-time Kahoot-style classroom tournament exclusively for human students.
 *
 * Features:
 * - 100% Human Student Multiplayer (Phones, Tablets, Chromebooks, Laptops)
 * - 4-Color Iconic Shape Grid: ▲ Red, ◆ Blue, ● Yellow, ■ Green with full option text
 * - Real-time Network Multiplayer (Node.js Server SSE + REST with automatic reconnect)
 * - Zero-Latency Local Fallback (BroadcastChannel for same-device / Split View testing)
 * - Dynamic Speed Scoring & Fire Streaks (up to 1,000+ pts per question)
 * - Dynamic Math Parameter Generation & Option Shuffling (Anti-Memorization)
 * - Rich Thermodynamic Explanations for every revealed question
 * - 3D Winner Podium + Particle Confetti Celebration
 * - Gradebook & Google Sheets Progress Sync
 */

import { EXAM_QUESTIONS, generateDynamicQuestionVariant, selectRuleCompliantQuestions } from './exam-arena.js';
import { authManager } from './auth-manager.js';
import { kahootAudio } from './kahoot-audio.js';
import { QRCodeGenerator } from './qr-code.js';

export class KahootManager {
  constructor() {
    this.allQuestions = [...EXAM_QUESTIONS];
    this.activeQuestions = [...this.allQuestions];
    this.questions = [];
    this.pin = null;
    this.role = 'player'; // 'host' | 'player'
    this.state = 'setup'; // setup, lobby, countdown, question, reveal, leaderboard, podium
    this.currentQIndex = -1;
    this.timePerQuestion = 20;
    this.timerSeconds = 20;
    this.timerInterval = null;
    this.playerTimerInterval = null;
    this.qStartTime = 0;
    this.players = new Map(); // id -> human student player object
    this.myPlayer = null; // for player mode
    this.myAnswer = null;
    this.eventSource = null;
    this.channel = null;
    this.confettiAnimationId = null;
    this.serverLanIp = null;
    this.joinUrl = '';
    this.hostSecret = null;

    this.initBroadcastChannel();
  }

  init() {
    this.bindDOM();
    this.listenForExamLaunch();
    this.updateSoundButtonUI();
    this.fetchNetworkInfo();
    this.checkUrlJoinParams();
    this.fetchAndRenderActiveRooms();
    this.roomsPollInterval = setInterval(() => this.fetchAndRenderActiveRooms(), 5000);
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
        if (this.role === 'host' || this.role === 'spectator' || this.isSplitViewActive()) {
          this.players.set(data.player.id, data.player);
          this.renderHostLobbyPlayers();
        }
        break;

      case 'player_removed':
        if (this.role === 'host' || this.role === 'spectator' || this.isSplitViewActive()) {
          this.players.delete(data.playerId);
          this.renderHostLobbyPlayers();
        }
        if (this.myPlayer && this.myPlayer.id === data.playerId) {
          this.myPlayer = null;
          this.showPlayerScreen('kahootPlayerScreenJoin');
          if (window.showToast) window.showToast('You were removed from the lobby by the host.', 'warning');
        }
        break;

      case 'question_start':
        if (this.role === 'spectator') {
          this.renderSpectatorQuestion(data);
        }
        if (this.role === 'player' || this.isSplitViewActive()) {
          this.handlePlayerQuestionStart(data);
        }
        break;

      case 'answer_count_updated':
        if (this.role === 'host' || this.role === 'spectator' || this.isSplitViewActive()) {
          this.syncRemotePlayerAnswer(data);
        }
        break;

      case 'answer_revealed':
        if (this.role === 'spectator') {
          this.renderSpectatorReveal(data);
        }
        if (this.role === 'player' || this.isSplitViewActive()) {
          this.handlePlayerAnswerRevealed(data);
        }
        break;

      case 'leaderboard_update':
        if (this.role === 'spectator') {
          this.renderSpectatorLeaderboard(data);
        }
        if (this.role === 'player' || this.isSplitViewActive()) {
          this.handlePlayerLeaderboard(data);
        }
        break;

      case 'podium_revealed':
        if (this.role === 'spectator') {
          this.renderSpectatorPodium(data);
        }
        if (this.role === 'player' || this.isSplitViewActive()) {
          this.handlePlayerPodium(data);
        }
        break;
    }
  }

  isSplitViewActive() {
    const wrapper = document.getElementById('kahootMainWrapper');
    return !!(wrapper && wrapper.classList.contains('kahoot-split-mode'));
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
      const len = this.activeQuestions.length;
      if ([5, 10, 18, 20, 24, 30, 60].includes(len)) {
        countSelect.value = len.toString();
      } else {
        countSelect.value = Math.min(len, 10).toString();
      }
    }

    this.showScreen('kahootScreenSetup');

    if (window.showToast) {
      window.showToast(`Loaded ${this.activeQuestions.length} exam questions into Kahoot Setup!`, 'success');
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

    const btnSpectateGame = document.getElementById('kahootBtnSpectateGame');
    if (btnSpectateGame) {
      btnSpectateGame.addEventListener('click', () => this.handleSpectateFromInput());
    }

    const btnRefreshRooms = document.getElementById('kahootBtnRefreshRooms');
    if (btnRefreshRooms) {
      btnRefreshRooms.addEventListener('click', () => this.fetchAndRenderActiveRooms());
    }

    const nameInput = document.getElementById('kahootPlayerNickname');
    if (nameInput) {
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handlePlayerJoin();
        }
      });
    }

    // Player 4-Shape Answer Buttons
    const shapeButtons = document.querySelectorAll('.kahoot-player-btn');
    shapeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
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
        kahootAudio.toggleSound();
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
    clearInterval(this.timerInterval);
    clearInterval(this.playerTimerInterval);
    kahootAudio.stopCountdownPulse();
    document.body.classList.remove('kahoot-host-fullscreen-active');
    document.body.classList.remove('kahoot-player-fullscreen-active');
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    const examSection = document.getElementById('view-exam');
    if (examSection) {
      const subNavBar = examSection.querySelector('.sub-nav-bar');
      const sectionHeader = examSection.querySelector('.section-header');
      if (subNavBar) subNavBar.style.display = '';
      if (sectionHeader) sectionHeader.style.display = '';
    }
    const subInteractive = document.getElementById('subTabExamInteractive');
    if (subInteractive) subInteractive.click();
  }

  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      const kahootView = document.getElementById('examModeKahoot');
      if (!kahootView || kahootView.style.display === 'none') return;

      // Student answer shortcuts: 1-4 or A-D when Player Question Screen is active
      const playerQScreen = document.getElementById('kahootPlayerScreenQuestion');
      if (playerQScreen && playerQScreen.style.display !== 'none' && this.myAnswer === null) {
        const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3, 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
        if (keyMap[e.key] !== undefined) {
          e.preventDefault();
          this.submitPlayerAnswer(keyMap[e.key]);
          return;
        }
      }

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
    const nameInput = document.getElementById('kahootPlayerNickname');
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

    // Auto-populate if current logged-in user is a student
    if (authManager && authManager.getCurrentUser) {
      const current = authManager.getCurrentUser();
      if (current && current.role === 'student' && current.fullName) {
        select.value = current.fullName;
        if (nameInput && !nameInput.value) {
          nameInput.value = current.fullName;
        }
      }
    }

    select.addEventListener('change', (e) => {
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
    const wrapper = document.getElementById('kahootMainWrapper');
    const splitBtn = document.getElementById('kahootBtnSplitView');

    if (wrapper) wrapper.classList.remove('kahoot-split-mode');
    if (splitBtn) splitBtn.classList.remove('active');

    if (btnHost) btnHost.classList.toggle('active', role === 'host');
    if (btnPlayer) btnPlayer.classList.toggle('active', role === 'player');

    if (hostContainer) hostContainer.style.display = (role === 'host' || role === 'spectator') ? 'block' : 'none';
    if (playerContainer) playerContainer.style.display = role === 'player' ? 'block' : 'none';

    this.setHostControlsVisibility(role === 'host');

    if (role === 'player') {
      document.body.classList.remove('kahoot-host-fullscreen-active');
      this.populateStudentQuickSelect();
      this.fetchAndRenderActiveRooms();
    } else {
      document.body.classList.remove('kahoot-player-fullscreen-active');
    }
  }

  setHostControlsVisibility(isHost) {
    const hostBtnIds = [
      'kahootBtnStartGame',
      'kahootBtnRevealNow',
      'kahootBtnNextFromReveal',
      'kahootBtnNextFromLeaderboard',
      'kahootBtnSyncScores'
    ];
    hostBtnIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = isHost ? '' : 'none';
    });
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
      if (this.pin) {
        const pinInput = document.getElementById('kahootPlayerPinInput');
        if (pinInput) pinInput.value = this.pin;
      }
      if (window.showToast) {
        window.showToast('Split View Active: Host & Student Player Controller side-by-side!', 'info');
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
    const dynamicMathCheckbox = document.getElementById('kahootSetupDynamicMath');

    const count = parseInt(qCountSelect?.value || '10', 10);
    this.timePerQuestion = parseInt(timerSelect?.value || '20', 10);
    const randomize = !!randomizeCheckbox?.checked;
    const useDynamicMath = dynamicMathCheckbox ? !!dynamicMathCheckbox.checked : true;

    // Prepare questions pool (use rule-compliant selection when pulling from full 60-Q bank)
    let pool = [...this.activeQuestions];
    if (pool.length >= 50 && [18, 20, 24, 30].includes(count)) {
      pool = selectRuleCompliantQuestions(pool, count, randomize);
    } else {
      if (randomize) {
        pool.sort(() => 0.5 - Math.random());
      }
      pool = pool.slice(0, count);
    }

    if (useDynamicMath) {
      pool = pool.map(q => generateDynamicQuestionVariant(q, true));
    }

    this.questions = pool;

    // Generate 6-digit Game PIN
    this.pin = Math.floor(100000 + Math.random() * 900000).toString();
    this.players.clear();
    this.currentQIndex = -1;
    this.state = 'lobby';

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

    // Connect to server API
    await this.createRoomOnServer({
      pin: this.pin,
      title: 'ThermoOlyMaster Competition Test',
      questions: this.questions,
      settings: {
        timePerQuestion: this.timePerQuestion,
        randomize,
        useDynamicMath
      }
    });

    this.showScreen('kahootScreenLobby');
    this.renderHostLobbyPlayers();
    this.saveLocalRoomState();
    this.fetchAndRenderActiveRooms();

    // Auto-fill pin into player input if open in split view
    const playerPinInput = document.getElementById('kahootPlayerPinInput');
    if (playerPinInput) playerPinInput.value = this.pin;

    if (window.showToast) {
      window.showToast(`Kahoot Room ${this.pin} ready! Waiting for students to join.`, 'success');
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
      const examTab = document.querySelector('.nav-tab-btn[data-target="view-exam"]');
      if (examTab) {
        document.querySelectorAll('.nav-tab-btn').forEach(t => t.classList.remove('active'));
        examTab.classList.add('active');
        document.querySelectorAll('.view-section').forEach(s => s.classList.toggle('active', s.id === 'view-exam'));
      }

      const kahootSubTab = document.getElementById('subTabExamKahoot');
      if (kahootSubTab) kahootSubTab.click();

      this.switchMode('player');
      const pinInput = document.getElementById('kahootPlayerPinInput');
      if (pinInput) {
        pinInput.value = pin.trim();
      }
      const nameInput = document.getElementById('kahootPlayerNickname');
      if (nameInput && !nameInput.value) {
        setTimeout(() => nameInput.focus(), 300);
      }
      if (window.showToast) {
        window.showToast(`Game PIN ${pin} loaded! Select your student name or enter your nickname to join.`, 'success');
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
      const data = await res.json();
      if (res.ok && data.hostSecret) {
        this.hostSecret = data.hostSecret;
      }
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

    this.eventSource.addEventListener('room_snapshot', (e) => {
      const snapshot = JSON.parse(e.data);
      if (this.role === 'host' || this.role === 'spectator') {
        if (Array.isArray(snapshot.players)) {
          snapshot.players.forEach(p => {
            if (!this.players.has(p.id)) {
              this.players.set(p.id, { ...p, answers: p.answers || {} });
            }
          });
          if (this.state === 'lobby') this.renderHostLobbyPlayers();
        }
        if (this.role === 'spectator' && snapshot.activeQuestion) {
          this.renderSpectatorQuestion(snapshot.activeQuestion);
        }
      } else if (this.role === 'player' && snapshot.activeQuestion) {
        this.handlePlayerQuestionStart(snapshot.activeQuestion);
      }
    });

    this.eventSource.addEventListener('player_joined', (e) => {
      const data = JSON.parse(e.data);
      if (this.role === 'host' || this.role === 'spectator' || this.isSplitViewActive()) {
        const existing = this.players.get(data.player.id);
        this.players.set(data.player.id, {
          ...data.player,
          answers: existing?.answers || data.player.answers || {}
        });
        this.renderHostLobbyPlayers();
        kahootAudio.playPop();
      }
    });

    this.eventSource.addEventListener('player_removed', (e) => {
      const data = JSON.parse(e.data);
      if (this.role === 'host' || this.role === 'spectator' || this.isSplitViewActive()) {
        this.players.delete(data.playerId);
        this.renderHostLobbyPlayers();
      }
      if (this.myPlayer && this.myPlayer.id === data.playerId) {
        this.myPlayer = null;
        this.showPlayerScreen('kahootPlayerScreenJoin');
        if (window.showToast) window.showToast('You were removed from the lobby by the host.', 'warning');
      }
    });

    this.eventSource.addEventListener('question_start', (e) => {
      const data = JSON.parse(e.data);
      if (this.role === 'spectator') {
        this.renderSpectatorQuestion(data);
      }
      if (this.role === 'player' || this.isSplitViewActive()) {
        this.handlePlayerQuestionStart(data);
      }
    });

    this.eventSource.addEventListener('answer_count_updated', (e) => {
      const data = JSON.parse(e.data);
      if (this.role === 'host' || this.role === 'spectator' || this.isSplitViewActive()) {
        this.syncRemotePlayerAnswer(data);
      }
    });

    this.eventSource.addEventListener('answer_revealed', (e) => {
      const data = JSON.parse(e.data);
      if (this.role === 'spectator') {
        this.renderSpectatorReveal(data);
      }
      if (this.role === 'player' || this.isSplitViewActive()) {
        this.handlePlayerAnswerRevealed(data);
      }
    });

    this.eventSource.addEventListener('leaderboard_update', (e) => {
      const data = JSON.parse(e.data);
      if (this.role === 'spectator') {
        this.renderSpectatorLeaderboard(data);
      }
      if (this.role === 'player' || this.isSplitViewActive()) {
        this.handlePlayerLeaderboard(data);
      }
    });

    this.eventSource.addEventListener('podium_revealed', (e) => {
      const data = JSON.parse(e.data);
      if (this.role === 'spectator') {
        this.renderSpectatorPodium(data);
      }
      if (this.role === 'player' || this.isSplitViewActive()) {
        this.handlePlayerPodium(data);
      }
    });
  }

  /**
   * Synchronizes a remote human student's submitted answer and score into the Host's state,
   * and auto-reveals early once all students have answered.
   */
  syncRemotePlayerAnswer(data) {
    if (!data) return;
    const { playerId, qIndex, answer, score, streak } = data;
    if (playerId && this.players.has(playerId)) {
      const p = this.players.get(playerId);
      if (typeof score === 'number') p.score = score;
      if (typeof streak === 'number') p.streak = streak;
      if (!p.answers) p.answers = {};
      if (answer && qIndex !== undefined) {
        p.answers[qIndex] = answer;
      }
    }

    let answeredCount = 0;
    const activeIdx = qIndex !== undefined ? qIndex : this.currentQIndex;
    this.players.forEach(p => {
      if (p.answers && p.answers[activeIdx] !== undefined) answeredCount++;
    });

    const total = this.players.size || data.totalPlayers || 0;
    const finalAnswered = Math.max(answeredCount, data.answeredCount || 0);
    this.updateHostAnsweredCount(finalAnswered, total);

    if (this.state === 'question' && total > 0 && finalAnswered >= total) {
      clearInterval(this.timerInterval);
      setTimeout(() => {
        if (this.state === 'question') this.revealAnswer();
      }, 500);
    }
  }

  kickPlayer(playerId) {
    if (!this.players.has(playerId)) return;
    const removed = this.players.get(playerId);
    this.players.delete(playerId);
    this.renderHostLobbyPlayers();
    this.sendServerAction('kick_player', { playerId });
    this.broadcastLocal('player_removed', { playerId });
    if (window.showToast && removed) {
      window.showToast(`Removed ${removed.name} from lobby.`, 'info');
    }
  }

  renderHostLobbyPlayers() {
    const container = document.getElementById('kahootLobbyPlayerGrid');
    const countEl = document.getElementById('kahootLobbyPlayerCount');
    const btnStart = document.getElementById('kahootBtnStartGame');

    if (!container) return;
    container.innerHTML = '';

    const playerList = Array.from(this.players.values());
    if (countEl) {
      countEl.textContent = `${playerList.length} ${playerList.length === 1 ? 'Student' : 'Students'} Joined`;
    }

    if (btnStart) {
      btnStart.disabled = playerList.length === 0;
      btnStart.style.opacity = playerList.length === 0 ? '0.5' : '1';
    }

    if (playerList.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--text-muted); font-size:1.05rem;">
          Waiting for human students to join with PIN <strong style="color:var(--gold-accent);">${this.pin}</strong>...
          <div style="margin-top:0.5rem; font-size:0.85rem;">Students can scan the QR code, open the Direct Join Link, or use <strong>⚡ Split Test View</strong> above!</div>
        </div>
      `;
      return;
    }

    playerList.forEach(p => {
      const card = document.createElement('div');
      card.className = 'kahoot-lobby-player-pill';
      const showKick = this.role === 'host';
      card.innerHTML = `
        <span class="player-avatar">${p.avatar}</span>
        <span class="player-name">${p.name}</span>
        ${showKick ? '<button type="button" class="kick-player-btn" title="Remove student from lobby" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.85rem; margin-left:0.35rem; padding:0 0.25rem;">✕</button>' : ''}
      `;
      const kickBtn = card.querySelector('.kick-player-btn');
      if (kickBtn) {
        kickBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.kickPlayer(p.id);
        });
      }
      container.appendChild(card);
    });
    if (this.role === 'host') this.saveLocalRoomState();
  }

  startGame() {
    if (this.players.size === 0) {
      if (window.showToast) window.showToast('Waiting for at least 1 human student to join before starting!', 'warning');
      return;
    }

    if (!this.isSplitViewActive()) {
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
    this.saveLocalRoomState();

    // If running in Split Test View on same page, also update Player Question screen directly
    if (this.isSplitViewActive() && this.myPlayer) {
      this.handlePlayerQuestionStart(publicQ);
    }

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
  }

  recordPlayerAnswer(playerId, qIndex, optionIndex, timeElapsed) {
    const player = this.players.get(playerId);
    const q = this.questions[qIndex];
    if (!player || !q) return;
    if (player.answers && player.answers[qIndex] !== undefined) return;

    const isCorrect = optionIndex === q.correct;
    const timeLimitMs = this.timePerQuestion * 1000;
    const clampedElapsed = Math.max(0, Math.min(timeLimitMs, timeElapsed));
    let points = 0;

    if (isCorrect) {
      const speedRatio = Math.max(0, Math.min(1, 1 - (clampedElapsed / (timeLimitMs * 1.5))));
      const speedBonus = Math.round(500 * speedRatio);
      const streakBonus = Math.min(500, player.streak * 100);
      points = 500 + speedBonus + streakBonus;
      player.score += points;
      player.streak += 1;
    } else {
      player.streak = 0;
    }

    if (!player.answers) player.answers = {};
    player.answers[qIndex] = {
      optionIndex,
      isCorrect,
      points,
      timeElapsed: clampedElapsed
    };

    let answeredCount = 0;
    this.players.forEach(p => {
      if (p.answers && p.answers[qIndex] !== undefined) answeredCount++;
    });

    this.updateHostAnsweredCount(answeredCount, this.players.size);
    this.broadcastLocal('answer_count_updated', {
      qIndex,
      playerId: player.id,
      answer: player.answers[qIndex],
      score: player.score,
      streak: player.streak,
      answeredCount,
      totalPlayers: this.players.size
    });

    // If all human students answered early, auto reveal!
    if (this.players.size > 0 && answeredCount >= this.players.size) {
      clearInterval(this.timerInterval);
      setTimeout(() => {
        if (this.state === 'question') this.revealAnswer();
      }, 500);
    }
  }

  updateHostAnsweredCount(answered, total) {
    const countEl = document.getElementById('kahootHostAnsweredCount');
    if (countEl) {
      countEl.textContent = `${answered} / ${total} answered`;
    }
  }

  revealAnswer() {
    if (this.state === 'reveal') return;
    this.state = 'reveal';
    clearInterval(this.timerInterval);
    clearInterval(this.playerTimerInterval);
    kahootAudio.stopCountdownPulse();
    kahootAudio.playReveal();

    const q = this.questions[this.currentQIndex];
    if (!q) return;

    this.showScreen('kahootScreenReveal');

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

    // Calculate Distribution across all human students
    const distribution = [0, 0, 0, 0];
    this.players.forEach(p => {
      const ans = p.answers?.[this.currentQIndex];
      if (ans && ans.optionIndex >= 0 && ans.optionIndex < 4) {
        distribution[ans.optionIndex]++;
      }
    });

    const maxVotes = Math.max(1, ...distribution);
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

    const rankedPlayers = Array.from(this.players.values())
      .map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        streak: p.streak,
        lastAnswer: p.answers?.[this.currentQIndex] || null
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
    this.saveLocalRoomState();

    if (this.isSplitViewActive() && this.myPlayer) {
      this.handlePlayerAnswerRevealed(payload);
    }
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
      sorted.slice(0, 8).forEach((p, rank) => {
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
    this.saveLocalRoomState();

    if (this.isSplitViewActive() && this.myPlayer) {
      this.handlePlayerLeaderboard(payload);
    }
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

    const pillar1 = document.querySelector('.podium-pillar.pillar-1');
    const pillar2 = document.querySelector('.podium-pillar.pillar-2');
    const pillar3 = document.querySelector('.podium-pillar.pillar-3');

    // Podium 1st
    const p1Name = document.getElementById('kahootPodiumP1Name');
    const p1Score = document.getElementById('kahootPodiumP1Score');
    const p1Avatar = document.getElementById('kahootPodiumP1Avatar');
    if (p1 && p1Name) {
      if (pillar1) pillar1.style.display = 'flex';
      p1Name.textContent = p1.name;
      p1Score.textContent = `${p1.score.toLocaleString()} pts`;
      if (p1Avatar) p1Avatar.textContent = p1.avatar;
    }

    // Podium 2nd
    const p2Name = document.getElementById('kahootPodiumP2Name');
    const p2Score = document.getElementById('kahootPodiumP2Score');
    const p2Avatar = document.getElementById('kahootPodiumP2Avatar');
    if (p2 && p2Name) {
      if (pillar2) pillar2.style.display = 'flex';
      p2Name.textContent = p2.name;
      p2Score.textContent = `${p2.score.toLocaleString()} pts`;
      if (p2Avatar) p2Avatar.textContent = p2.avatar;
    } else if (pillar2) {
      pillar2.style.display = 'none';
    }

    // Podium 3rd
    const p3Name = document.getElementById('kahootPodiumP3Name');
    const p3Score = document.getElementById('kahootPodiumP3Score');
    const p3Avatar = document.getElementById('kahootPodiumP3Avatar');
    if (p3 && p3Name) {
      if (pillar3) pillar3.style.display = 'flex';
      p3Name.textContent = p3.name;
      p3Score.textContent = `${p3.score.toLocaleString()} pts`;
      if (p3Avatar) p3Avatar.textContent = p3.avatar;
    } else if (pillar3) {
      pillar3.style.display = 'none';
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
          <td><span style="margin-right:0.4rem;">${p.avatar}</span> ${p.name}</td>
          <td><strong style="color:var(--thermal-primary);">${p.score.toLocaleString()}</strong></td>
          <td>${correctCount} / ${this.questions.length}</td>
          <td><span class="badge-pct">${pct}%</span></td>
        `;
        tbody.appendChild(tr);
      });
    }

    this.launchConfetti();

    const payload = {
      podium: sorted.slice(0, 3),
      standings: sorted
    };
    this.sendServerAction('show_podium', payload);
    this.broadcastLocal('podium_revealed', payload);
    this.saveLocalRoomState(true);
    this.fetchAndRenderActiveRooms();

    if (this.isSplitViewActive() && this.myPlayer) {
      this.handlePlayerPodium(payload);
    }
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
      let correctCount = 0;
      Object.values(p.answers || {}).forEach(ans => {
        if (ans.isCorrect) correctCount++;
      });
      const percent = Math.round((correctCount / this.questions.length) * 100);
      const examScore50 = parseFloat(((correctCount / this.questions.length) * 50).toFixed(1));

      if (authManager && authManager.recordExamResult) {
        authManager.recordExamResult({
          raw: correctCount,
          total: this.questions.length,
          es: examScore50,
          percent: percent,
          type: 'kahoot_competition',
          rank: rank + 1,
          kahootScore: p.score,
          studentName: p.name
        });
        recorded++;
      }
    });

    if (window.showToast) {
      window.showToast(`Synced ${recorded} human student scores into Team Gradebook & Google Sheets!`, 'success');
    }
  }

  resetGameToSetup() {
    this.saveLocalRoomState(true);
    this.state = 'setup';
    if (this.confettiAnimationId) cancelAnimationFrame(this.confettiAnimationId);
    document.body.classList.remove('kahoot-host-fullscreen-active');
    this.updateFullscreenUI(false, 'host');
    this.showScreen('kahootScreenSetup');
    this.fetchAndRenderActiveRooms();
  }

  async sendServerAction(action, payload) {
    if (!this.pin) return;
    try {
      await fetch('/api/kahoot/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: this.pin, action, payload, hostSecret: this.hostSecret })
      });
    } catch (err) {}
  }

  // =========================================================================
  // PLAYER CONTROLLER WORKFLOW (HUMAN STUDENTS)
  // =========================================================================

  async handlePlayerJoin() {
    const pinInput = document.getElementById('kahootPlayerPinInput');
    const nameInput = document.getElementById('kahootPlayerNickname');
    const avatarSelect = document.getElementById('kahootPlayerAvatarSelect');

    const pin = (pinInput?.value || '').trim();
    const name = (nameInput?.value || '').trim();
    const avatar = avatarSelect?.value || '🦊';

    if (!pin || pin.length < 4) {
      if (window.showToast) window.showToast('Please enter a valid 6-digit Game PIN!', 'warning');
      return;
    }

    if (!name) {
      if (window.showToast) window.showToast('Please enter your student name or select from the roster!', 'warning');
      if (nameInput) nameInput.focus();
      return;
    }

    this.pin = pin;
    let savedId = null;
    try {
      savedId = sessionStorage.getItem(`kahoot_pid_${pin}`);
    } catch (e) {}

    this.myPlayer = {
      id: savedId || ('p_' + Date.now() + '_' + Math.floor(Math.random() * 1000)),
      name,
      avatar,
      score: 0,
      streak: 0,
      answers: {}
    };

    try {
      sessionStorage.setItem(`kahoot_pid_${pin}`, this.myPlayer.id);
    } catch (e) {}

    // If Host is running in this same browser tab (Split Test View), register directly too
    if (this.isSplitViewActive() || this.role === 'host') {
      this.players.set(this.myPlayer.id, this.myPlayer);
      this.renderHostLobbyPlayers();
    }

    // Broadcast locally so if host is in another tab on same device, it adds instantly
    this.broadcastLocal('player_joined', { player: this.myPlayer });

    // Join on server
    await this.joinRoomOnServer({
      pin,
      playerId: this.myPlayer.id,
      name,
      avatar
    });

    // Show waiting lobby on player controller (unless room snapshot already moved to active question)
    if (this.state !== 'question') {
      this.showPlayerScreen('kahootPlayerScreenLobby');
    }
    const welcomeName = document.getElementById('kahootPlayerLobbyName');
    const welcomeAvatar = document.getElementById('kahootPlayerLobbyAvatar');
    if (welcomeName) welcomeName.textContent = this.myPlayer.name;
    if (welcomeAvatar) welcomeAvatar.textContent = this.myPlayer.avatar;

    kahootAudio.playPop();

    if (window.showToast) {
      window.showToast(`Joined Room ${pin} as ${this.myPlayer.name}!`, 'success');
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
        const data = await res.json();
        if (data.player && data.player.id) {
          this.myPlayer = { ...this.myPlayer, ...data.player };
        }
        this.connectSSE('player');
        if (data.room && data.room.activeQuestion) {
          this.handlePlayerQuestionStart(data.room.activeQuestion);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.error && window.showToast) {
          window.showToast(errData.error, 'error');
        }
      }
    } catch (err) {
      console.log('Server not reachable, running player in local mode');
    }
  }

  handlePlayerQuestionStart(data) {
    this.showPlayerScreen('kahootPlayerScreenQuestion');
    this.myAnswer = null;
    this.currentQIndex = data.index;
    this.qStartTime = Date.now();

    const qNum = document.getElementById('kahootPlayerQNum');
    if (qNum) qNum.textContent = `Question ${data.index + 1} of ${data.total}`;

    const qText = document.getElementById('kahootPlayerQText');
    if (qText) qText.textContent = data.text || '';

    // Populate option texts on the 4 student buttons
    if (Array.isArray(data.options)) {
      for (let i = 0; i < 4; i++) {
        const optEl = document.getElementById(`kahootPlayerOptText_${i}`);
        if (optEl) optEl.textContent = data.options[i] || '';
      }
    }

    // Start student device countdown timer
    const timerEl = document.getElementById('kahootPlayerQTimer');
    let remaining = data.timeLimit || this.timePerQuestion || 20;
    if (timerEl) timerEl.textContent = `${remaining}s`;
    clearInterval(this.playerTimerInterval);
    this.playerTimerInterval = setInterval(() => {
      remaining = Math.max(0, remaining - 1);
      if (timerEl) timerEl.textContent = `${remaining}s`;
      if (remaining <= 0) clearInterval(this.playerTimerInterval);
    }, 1000);

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
    if (statusEl) statusEl.textContent = 'Answer locked in! Waiting for reveal... ⏳';

    // If host is running in this same instance (split view)
    if (this.players.has(this.myPlayer.id)) {
      this.recordPlayerAnswer(this.myPlayer.id, this.currentQIndex, optionIndex, timeElapsed);
    }

    // Always send to server so remote/multi-tab host stays synced
    this.sendServerAction('submit_answer', {
      playerId: this.myPlayer.id,
      qIndex: this.currentQIndex,
      optionIndex,
      timeElapsed
    });
  }

  handlePlayerAnswerRevealed(data) {
    clearInterval(this.playerTimerInterval);
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
    const statusEl = document.getElementById('kahootPlayerFeedbackStatus');
    if (statusEl) {
      const myRank = data.leaderboard.findIndex(p => p.id === this.myPlayer?.id) + 1;
      statusEl.textContent = `Current Standing: #${myRank || '-'} • Host moving to next question...`;
    }
  }

  handlePlayerPodium(data) {
    clearInterval(this.playerTimerInterval);
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

  // =========================================================================
  // STANDALONE ACTIVE KAHOOT DISCOVERY, ONE-CLICK JOIN & LIVE SPECTATOR VIEW
  // =========================================================================

  saveLocalRoomState(remove = false) {
    if (!this.pin) return;
    try {
      const raw = localStorage.getItem('thermo_kahoot_local_rooms');
      const map = raw ? JSON.parse(raw) : {};
      const now = Date.now();
      // Purge expired local entries (> 2 hours)
      Object.keys(map).forEach(k => {
        if (now - (map[k].updatedAt || 0) > 2 * 60 * 60 * 1000) delete map[k];
      });

      if (remove) {
        delete map[this.pin];
      } else {
        const currentQ = this.questions[this.currentQIndex];
        map[this.pin] = {
          pin: this.pin,
          title: 'ThermoOlyMaster Competition Test',
          state: this.state,
          currentQIndex: this.currentQIndex,
          totalQuestions: this.questions.length || 10,
          playerCount: this.players.size,
          players: Array.from(this.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            score: p.score || 0,
            streak: p.streak || 0
          })),
          activeQuestion: (this.state === 'question' && currentQ) ? {
            index: this.currentQIndex,
            total: this.questions.length,
            area: currentQ.area || '',
            level: currentQ.level || '',
            text: currentQ.text,
            options: currentQ.options,
            timeLimit: this.timePerQuestion
          } : null,
          updatedAt: now
        };
      }
      localStorage.setItem('thermo_kahoot_local_rooms', JSON.stringify(map));
    } catch (e) {}
  }

  async fetchAndRenderActiveRooms() {
    const roomsByPin = new Map();

    // 1. Check server active rooms
    try {
      const res = await fetch('/api/kahoot/rooms');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.rooms)) {
          data.rooms.forEach(r => {
            if (r && r.pin) roomsByPin.set(r.pin, r);
          });
        }
      }
    } catch (e) {}

    // 2. Merge local browser rooms (supports offline / static-file tabs)
    try {
      const raw = localStorage.getItem('thermo_kahoot_local_rooms');
      if (raw) {
        const localMap = JSON.parse(raw);
        const now = Date.now();
        Object.values(localMap).forEach(r => {
          if (r && r.pin && (now - (r.updatedAt || 0) < 2 * 60 * 60 * 1000) && r.state !== 'podium' && r.state !== 'setup') {
            if (!roomsByPin.has(r.pin)) {
              roomsByPin.set(r.pin, r);
            }
          }
        });
      }
    } catch (e) {}

    const rooms = Array.from(roomsByPin.values());

    // Update topbar live badge
    const badge = document.getElementById('topbarKahootActiveBadge');
    if (badge) {
      if (rooms.length > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = `${rooms.length} Live`;
      } else {
        badge.style.display = 'none';
      }
    }

    // Render active rooms list in Join screen
    const listEl = document.getElementById('kahootActiveRoomsList');
    if (!listEl) return;

    if (rooms.length === 0) {
      listEl.innerHTML = `<div style="font-size:0.82rem; color:var(--text-muted); text-align:center; padding:0.4rem;">No active Kahoot rooms right now. Enter a Game PIN below or switch to <strong>🖥️ Host Screen</strong> to launch one!</div>`;
      return;
    }

    listEl.innerHTML = '';
    rooms.forEach(room => {
      const isLobby = room.state === 'lobby';
      const statusBadge = isLobby
        ? `<span style="background:rgba(0,230,118,0.18); color:#00e676; padding:0.15rem 0.5rem; border-radius:999px; font-size:0.75rem; font-weight:700;">🟢 Lobby Open</span>`
        : `<span style="background:rgba(255,145,0,0.2); color:#ffab40; padding:0.15rem 0.5rem; border-radius:999px; font-size:0.75rem; font-weight:700;">🔥 Q${Math.max(1, (room.currentQIndex || 0) + 1)}/${room.totalQuestions || 10}</span>`;

      const row = document.createElement('div');
      row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:0.5rem; padding:0.55rem 0.7rem; background:rgba(15,23,42,0.75); border:1px solid rgba(255,255,255,0.1); border-radius:8px; flex-wrap:wrap;';
      row.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.2rem; text-align:left;">
          <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap;">
            <strong style="font-family:var(--font-mono); font-size:0.98rem; color:var(--gold-accent); letter-spacing:1px;">PIN: ${room.pin}</strong>
            ${statusBadge}
          </div>
          <span style="font-size:0.76rem; color:var(--text-secondary);">👥 ${room.playerCount || 0} Human ${(room.playerCount === 1) ? 'Student' : 'Students'}</span>
        </div>
        <div style="display:flex; gap:0.4rem;">
          <button type="button" class="btn-join-active-room" style="background:linear-gradient(135deg,#00e676,#00c853); color:#052e16; border:none; border-radius:6px; padding:0.38rem 0.75rem; font-size:0.8rem; font-weight:800; cursor:pointer;">🚀 Join</button>
          <button type="button" class="btn-spectate-active-room" style="background:rgba(0,229,255,0.15); color:var(--thermal-accent); border:1px solid rgba(0,229,255,0.35); border-radius:6px; padding:0.38rem 0.7rem; font-size:0.8rem; font-weight:700; cursor:pointer;">👁️ View</button>
        </div>
      `;

      const joinBtn = row.querySelector('.btn-join-active-room');
      if (joinBtn) {
        joinBtn.addEventListener('click', () => {
          const pinInput = document.getElementById('kahootPlayerPinInput');
          if (pinInput) pinInput.value = room.pin;
          const nameInput = document.getElementById('kahootPlayerNickname');
          if (nameInput && nameInput.value.trim()) {
            this.handlePlayerJoin();
          } else {
            if (nameInput) nameInput.focus();
            if (window.showToast) window.showToast(`PIN ${room.pin} selected! Enter or choose your student name to join.`, 'info');
          }
        });
      }

      const viewBtn = row.querySelector('.btn-spectate-active-room');
      if (viewBtn) {
        viewBtn.addEventListener('click', () => {
          this.spectateRoom(room.pin);
        });
      }

      listEl.appendChild(row);
    });
  }

  handleSpectateFromInput() {
    const pinInput = document.getElementById('kahootPlayerPinInput');
    const pin = (pinInput?.value || '').trim();
    if (!pin || pin.length < 4) {
      if (window.showToast) window.showToast('Select an active room above or enter a valid 6-digit Game PIN to spectate!', 'warning');
      if (pinInput) pinInput.focus();
      return;
    }
    this.spectateRoom(pin);
  }

  async spectateRoom(pin) {
    this.pin = pin.trim();
    this.switchMode('spectator');

    const elPin = document.getElementById('kahootLobbyPin');
    if (elPin) elPin.textContent = this.pin;
    const hudPin = document.getElementById('kahootHudRoomPin');
    if (hudPin) hudPin.textContent = `👁️ Spectating PIN: ${this.pin}`;

    this.joinUrl = this.getJoinUrl();
    const urlEl = document.getElementById('kahootLobbyDirectUrl');
    if (urlEl) urlEl.textContent = this.joinUrl;
    const qrCanvas = document.getElementById('kahootLobbyQrCanvas');
    if (qrCanvas) {
      QRCodeGenerator.draw(qrCanvas, this.joinUrl, 140);
    }

    let snapshot = null;
    try {
      const res = await fetch(`/api/kahoot/state?pin=${this.pin}`);
      if (res.ok) {
        snapshot = await res.json();
      }
    } catch (e) {}

    if (!snapshot) {
      try {
        const raw = localStorage.getItem('thermo_kahoot_local_rooms');
        const map = raw ? JSON.parse(raw) : {};
        snapshot = map[this.pin] || null;
      } catch (e) {}
    }

    this.players.clear();
    if (snapshot && Array.isArray(snapshot.players)) {
      snapshot.players.forEach(p => {
        this.players.set(p.id, { ...p, answers: p.answers || {} });
      });
    }

    if (snapshot && snapshot.state === 'question' && snapshot.activeQuestion) {
      this.renderSpectatorQuestion(snapshot.activeQuestion);
    } else {
      this.state = 'lobby';
      this.showScreen('kahootScreenLobby');
      this.renderHostLobbyPlayers();
    }

    this.connectSSE('spectator');
    if (window.showToast) {
      window.showToast(`👁️ Spectating live Kahoot room ${this.pin}!`, 'info');
    }
  }

  renderSpectatorQuestion(data) {
    this.state = 'question';
    this.currentQIndex = data.index;
    this.showScreen('kahootScreenQuestion');

    const idxEl = document.getElementById('kahootHostQIndex');
    const areaEl = document.getElementById('kahootHostQArea');
    const textEl = document.getElementById('kahootHostQText');
    const timerEl = document.getElementById('kahootHostQTimer');
    const countEl = document.getElementById('kahootHostAnsweredCount');

    if (idxEl) idxEl.textContent = `Question ${data.index + 1} of ${data.total}`;
    if (areaEl) areaEl.textContent = `${data.area || 'Thermodynamics'} • ${data.level || 'Live Spectator'}`;
    if (textEl) textEl.textContent = data.text || '';
    if (countEl) countEl.textContent = `0 / ${this.players.size} answered`;

    const colors = ['red', 'blue', 'yellow', 'green'];
    if (Array.isArray(data.options)) {
      for (let i = 0; i < 4; i++) {
        const textElOpt = document.getElementById(`kahootHostOptText_${i}`);
        if (textElOpt) textElOpt.textContent = data.options[i] || '';
        const optBlock = document.getElementById(`kahootHostOptBlock_${i}`);
        if (optBlock) optBlock.className = `kahoot-option-block kahoot-opt-${colors[i]}`;
      }
    }

    let remaining = data.timeLimit || 20;
    if (timerEl) {
      timerEl.textContent = remaining.toString();
      timerEl.classList.remove('urgent');
    }
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      remaining = Math.max(0, remaining - 1);
      if (timerEl) {
        timerEl.textContent = remaining.toString();
        if (remaining <= 5) timerEl.classList.add('urgent');
      }
      if (remaining <= 0) clearInterval(this.timerInterval);
    }, 1000);
  }

  renderSpectatorReveal(data) {
    clearInterval(this.timerInterval);
    this.state = 'reveal';
    this.showScreen('kahootScreenReveal');

    const titleEl = document.getElementById('kahootRevealQTitle');
    const correctTextEl = document.getElementById('kahootRevealCorrectText');
    const explanationEl = document.getElementById('kahootRevealExplanation');

    if (titleEl) titleEl.textContent = `Answer Reveal • Question ${(data.qIndex || 0) + 1}`;
    if (correctTextEl) {
      const optLetter = ['A', 'B', 'C', 'D'][data.correct] || '';
      const optEl = document.getElementById(`kahootHostOptText_${data.correct}`);
      const optStr = optEl ? optEl.textContent : '';
      correctTextEl.textContent = `${optLetter}: ${optStr}`;
    }
    if (explanationEl) {
      explanationEl.textContent = data.explanation || 'According to Science Olympiad Division B Thermodynamics rules.';
    }

    const distribution = Array.isArray(data.distribution) ? data.distribution : [0, 0, 0, 0];
    const maxVotes = Math.max(1, ...distribution);
    for (let i = 0; i < 4; i++) {
      const barEl = document.getElementById(`kahootDistBar_${i}`);
      const countEl = document.getElementById(`kahootDistCount_${i}`);
      const cardEl = document.getElementById(`kahootDistCard_${i}`);
      const count = distribution[i] || 0;
      const pct = Math.round((count / maxVotes) * 100);
      if (barEl) barEl.style.height = `${Math.max(10, pct)}%`;
      if (countEl) countEl.textContent = count.toString();
      if (cardEl) cardEl.classList.toggle('is-correct', i === data.correct);
    }
  }

  renderSpectatorLeaderboard(data) {
    this.state = 'leaderboard';
    this.showScreen('kahootScreenLeaderboard');
    const listEl = document.getElementById('kahootLeaderboardList');
    const titleEl = document.getElementById('kahootLeaderboardTitle');
    if (titleEl) {
      titleEl.textContent = `Scoreboard • Question ${(data.qIndex || 0) + 1} of ${data.totalQuestions || 10}`;
    }
    if (listEl && Array.isArray(data.leaderboard)) {
      listEl.innerHTML = '';
      data.leaderboard.slice(0, 8).forEach((p, rank) => {
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
            <span class="points">${(p.score || 0).toLocaleString()}</span>
            <span class="pts-label">pts</span>
          </div>
        `;
        listEl.appendChild(item);
      });
    }
  }

  renderSpectatorPodium(data) {
    this.state = 'podium';
    this.showScreen('kahootScreenPodium');
    kahootAudio.playFanfare();
    const sorted = Array.isArray(data.standings) ? data.standings : [];
    const [p1, p2, p3] = sorted;
    const setPillar = (p, idx) => {
      const pillar = document.querySelector(`.podium-pillar.pillar-${idx}`);
      const nameEl = document.getElementById(`kahootPodiumP${idx}Name`);
      const scoreEl = document.getElementById(`kahootPodiumP${idx}Score`);
      const avatarEl = document.getElementById(`kahootPodiumP${idx}Avatar`);
      if (p && nameEl) {
        if (pillar) pillar.style.display = 'flex';
        nameEl.textContent = p.name;
        if (scoreEl) scoreEl.textContent = `${(p.score || 0).toLocaleString()} pts`;
        if (avatarEl) avatarEl.textContent = p.avatar;
      } else if (pillar) {
        pillar.style.display = 'none';
      }
    };
    setPillar(p1, 1);
    setPillar(p2, 2);
    setPillar(p3, 3);
    this.launchConfetti();
  }
}

export const kahootManager = new KahootManager();
