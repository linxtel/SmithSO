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

import { EXAM_QUESTIONS, generateDynamicQuestionVariant, selectRuleCompliantQuestions, formatMathHtml } from './exam-arena.js';
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
    this.questionSeq = 0;
    this.lastRenderedQuestionKey = null;
    this.lastRenderedRevealKey = null;
    this.lastRevealPayload = null;
    this.lastPodiumPayload = null;
    this.playerScreenId = 'kahootPlayerScreenJoin';
    this.lastFetchedRooms = [];

    this.initBroadcastChannel();
  }

  init() {
    this.bindDOM();
    this.switchMode('player');
    this.listenForExamLaunch();
    this.updateSoundButtonUI();
    this.fetchNetworkInfo();
    this.checkUrlJoinParams();
    this.fetchAndRenderActiveRooms();
    this.roomsPollInterval = setInterval(() => this.fetchAndRenderActiveRooms(), 2500);
    this.clientSyncInterval = setInterval(() => this.syncClientRoomState(), 1500);
    window.addEventListener('storage', (e) => {
      if (e.key === 'thermo_kahoot_local_rooms') {
        this.syncClientRoomState();
        this.fetchAndRenderActiveRooms();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.syncClientRoomState();
        this.fetchAndRenderActiveRooms();
      }
    });
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
    if (!msg) return;
    if (msg.event === 'rooms_updated') {
      this.fetchAndRenderActiveRooms();
      return;
    }
    if (msg.pin !== this.pin) return;
    const { event, data } = msg;

    switch (event) {
      case 'player_joined':
        if (this.role === 'host' || this.role === 'spectator' || this.isSplitViewActive()) {
          const incomingName = (data.player?.name || '').trim().toLowerCase();
          let isDuplicate = false;
          this.players.forEach(existing => {
            if (existing.id !== data.player.id && (existing.name || '').trim().toLowerCase() === incomingName) {
              isDuplicate = true;
            }
          });
          if (!isDuplicate && data.player) {
            this.players.set(data.player.id, data.player);
            this.renderHostLobbyPlayers();
          }
        }
        this.fetchAndRenderActiveRooms();
        break;

      case 'player_removed':
        if (this.role === 'host' || this.role === 'spectator' || this.isSplitViewActive()) {
          this.players.delete(data.playerId);
          this.renderHostLobbyPlayers();
        }
        if (this.myPlayer && this.myPlayer.id === data.playerId) {
          this.myPlayer = null;
          this.showPlayerScreen('kahootPlayerScreenJoin');
          this.updateJoinedArenaBanner();
          if (window.showToast && data.reason !== 'left') {
            window.showToast('You were removed from the lobby by the host.', 'warning');
          }
        }
        this.fetchAndRenderActiveRooms();
        break;

      case 'question_start':
        if (this.role === 'spectator') {
          this.renderSpectatorQuestion(data);
        }
        if (this.myPlayer || this.role === 'player' || this.isSplitViewActive()) {
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
        if (this.myPlayer || this.role === 'player' || this.isSplitViewActive()) {
          this.handlePlayerAnswerRevealed(data);
        }
        break;

      case 'leaderboard_update':
        if (this.role === 'spectator') {
          this.renderSpectatorLeaderboard(data);
        }
        if (this.myPlayer || this.role === 'player' || this.isSplitViewActive()) {
          this.handlePlayerLeaderboard(data);
        }
        break;

      case 'podium_revealed':
        if (this.role === 'spectator') {
          this.renderSpectatorPodium(data);
        }
        if (this.myPlayer || this.role === 'player' || this.isSplitViewActive()) {
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

    const btnToggleDescriptive = document.getElementById('kahootBtnToggleDescriptive');
    if (btnToggleDescriptive) {
      btnToggleDescriptive.addEventListener('click', () => this.toggleDescriptiveAnswer());
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
      nameInput.addEventListener('input', () => {
        if (Array.isArray(this.lastFetchedRooms)) {
          this.renderActiveRoomsList(this.lastFetchedRooms);
        }
      });
    }

    const btnLeaveArenaBanner = document.getElementById('kahootBtnLeaveArenaBanner');
    if (btnLeaveArenaBanner) {
      btnLeaveArenaBanner.addEventListener('click', () => this.leavePlayerRoom());
    }

    const btnLeaveLobby = document.getElementById('kahootBtnLeaveLobby');
    if (btnLeaveLobby) {
      btnLeaveLobby.addEventListener('click', () => this.leavePlayerRoom());
    }

    const btnLeavePodium = document.getElementById('kahootBtnLeavePodium');
    if (btnLeavePodium) {
      btnLeavePodium.addEventListener('click', () => this.leavePlayerRoom());
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
      btnToggleFullscreen.addEventListener('click', () => {
        if (this.role === 'player' && !this.isSplitViewActive()) {
          this.togglePlayerFullscreen();
        } else {
          this.toggleHostFullscreen();
        }
      });
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
      playerExitBtn.addEventListener('click', () => {
        if (this.myPlayer) {
          this.leavePlayerRoom();
        } else {
          this.exitArena();
        }
      });
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
        if (document.body.classList.contains('kahoot-player-fullscreen-active')) {
          this.updateFullscreenUI(false, 'player');
          document.body.classList.remove('kahoot-player-fullscreen-active');
        }
      }
    });

    // Populate student nicknames quick selector
    this.populateStudentQuickSelect();
  }

  toggleHostFullscreen() {
    document.body.classList.remove('kahoot-player-fullscreen-active');
    const hostContainer = document.getElementById('kahootHostContainer');
    const playerContainer = document.getElementById('kahootPlayerContainer');
    if (hostContainer) hostContainer.style.display = 'block';
    if (playerContainer && !this.isSplitViewActive()) playerContainer.style.display = 'none';

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
    document.body.classList.remove('kahoot-player-fullscreen-active');
    const hostContainer = document.getElementById('kahootHostContainer');
    if (hostContainer) hostContainer.style.display = 'block';
    if (!document.body.classList.contains('kahoot-host-fullscreen-active')) {
      document.body.classList.add('kahoot-host-fullscreen-active');
      this.updateFullscreenUI(true, 'host');
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    }
  }

  togglePlayerFullscreen() {
    document.body.classList.remove('kahoot-host-fullscreen-active');
    const hostContainer = document.getElementById('kahootHostContainer');
    const playerContainer = document.getElementById('kahootPlayerContainer');
    if (hostContainer && !this.isSplitViewActive()) hostContainer.style.display = 'none';
    if (playerContainer) playerContainer.style.display = 'block';

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

    if (label) label.textContent = isActive ? 'Exit Fullscreen' : 'Fullscreen';
    if (role === 'host') {
      if (hudBtn) hudBtn.textContent = isActive ? '⛶ Exit Fullscreen' : '⛶ Fullscreen';
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

    select.onchange = (e) => {
      if (nameInput && e.target.value) {
        nameInput.value = e.target.value;
        if (Array.isArray(this.lastFetchedRooms)) {
          this.renderActiveRoomsList(this.lastFetchedRooms);
        }
      }
    };
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
    this.playerScreenId = screenId;
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
    this.updateJoinedArenaBanner();
  }

  updateJoinedArenaBanner() {
    const bar = document.getElementById('kahootPlayerJoinedBar');
    const textEl = document.getElementById('kahootPlayerJoinedBarText');
    if (!bar) return;

    if (this.myPlayer && this.pin) {
      bar.style.display = 'flex';
      if (textEl) {
        textEl.innerHTML = `Joined Arena <strong style="color:var(--gold-accent); font-family:var(--font-mono);">PIN: ${this.pin}</strong> as <strong>${this.myPlayer.avatar || '🦊'} ${this.myPlayer.name}</strong>`;
      }
    } else {
      bar.style.display = 'none';
    }
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
        const incomingName = (data.player?.name || '').trim().toLowerCase();
        let isDuplicate = false;
        this.players.forEach(existing => {
          if (existing.id !== data.player.id && (existing.name || '').trim().toLowerCase() === incomingName) {
            isDuplicate = true;
          }
        });
        if (!isDuplicate && data.player) {
          const existing = this.players.get(data.player.id);
          this.players.set(data.player.id, {
            ...data.player,
            answers: existing?.answers || data.player.answers || {}
          });
          this.renderHostLobbyPlayers();
          kahootAudio.playPop();
        }
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
      if (this.myPlayer || this.role === 'player' || this.isSplitViewActive()) {
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
      if (this.myPlayer || this.role === 'player' || this.isSplitViewActive()) {
        this.handlePlayerAnswerRevealed(data);
      }
    });

    this.eventSource.addEventListener('leaderboard_update', (e) => {
      const data = JSON.parse(e.data);
      if (this.role === 'spectator') {
        this.renderSpectatorLeaderboard(data);
      }
      if (this.myPlayer || this.role === 'player' || this.isSplitViewActive()) {
        this.handlePlayerLeaderboard(data);
      }
    });

    this.eventSource.addEventListener('podium_revealed', (e) => {
      const data = JSON.parse(e.data);
      if (this.role === 'spectator') {
        this.renderSpectatorPodium(data);
      }
      if (this.myPlayer || this.role === 'player' || this.isSplitViewActive()) {
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
    if (textEl) textEl.innerHTML = formatMathHtml(q.text);
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
        textElOpt.innerHTML = formatMathHtml(q.options[i] || '');
      }
      const optBlock = document.getElementById(`kahootHostOptBlock_${i}`);
      if (optBlock) {
        optBlock.className = `kahoot-option-block kahoot-opt-${colors[i]}`;
      }
    }

    // Broadcast to Server & Local
    this.questionSeq = (this.questionSeq || 0) + 1;
    this.lastRevealPayload = null;
    this.toggleDescriptiveAnswer(false);

    const publicQ = {
      index,
      questionSeq: this.questionSeq,
      total: this.questions.length,
      area: q.area || '',
      level: q.level || '',
      text: q.text,
      options: q.options,
      timeLimit: this.timePerQuestion
    };

    this.sendServerAction('start_question', {
      qIndex: index,
      timeLimit: this.timePerQuestion,
      question: publicQ
    });
    this.broadcastLocal('question_start', publicQ);
    this.saveLocalRoomState();

    // If running in Split Test View or same page with a joined player, update Player Question screen directly
    if (this.myPlayer) {
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

  toggleDescriptiveAnswer(forceState) {
    const box = document.getElementById('kahootDescriptiveAnswerBox');
    const btn = document.getElementById('kahootBtnToggleDescriptive');
    if (!box) return;

    const shouldShow = typeof forceState === 'boolean'
      ? forceState
      : box.style.display === 'none';

    box.style.display = shouldShow ? 'block' : 'none';
    if (btn) {
      btn.innerHTML = shouldShow
        ? '<span>📖</span> Hide Descriptive Answer'
        : '<span>📖</span> Show Descriptive Answer';
    }
  }

  populateDescriptiveAnswerUI(data) {
    const optLetter = ['A', 'B', 'C', 'D'][data.correct] || 'A';
    const optStr = Array.isArray(data.options) && data.options[data.correct]
      ? data.options[data.correct]
      : (document.getElementById(`kahootHostOptText_${data.correct}`)?.textContent || '');
    const fullCorrectText = `${optLetter}: ${optStr}`;
    const explanationText = data.explanation || 'According to Science Olympiad Division B Thermodynamics rules.';

    const titleEl = document.getElementById('kahootRevealQTitle');
    const correctTextEl = document.getElementById('kahootRevealCorrectText');
    const explanationEl = document.getElementById('kahootRevealExplanation');
    if (titleEl) titleEl.textContent = `Answer Reveal • Question ${(data.qIndex || 0) + 1}`;
    if (correctTextEl) correctTextEl.innerHTML = formatMathHtml(fullCorrectText);
    if (explanationEl) explanationEl.innerHTML = formatMathHtml(explanationText);

    const lbCorrectEl = document.getElementById('kahootLeaderboardCorrectText');
    const lbExpEl = document.getElementById('kahootLeaderboardExplanation');
    if (lbCorrectEl) lbCorrectEl.innerHTML = formatMathHtml(fullCorrectText);
    if (lbExpEl) lbExpEl.innerHTML = formatMathHtml(explanationText);

    const distribution = Array.isArray(data.distribution) ? data.distribution : [0, 0, 0, 0];
    const maxVotes = Math.max(1, ...distribution);
    const shapes = ['▲', '◆', '●', '■'];
    const colors = ['#e21b3c', '#1368ce', '#ffa602', '#26890c'];

    for (let i = 0; i < 4; i++) {
      const barEl = document.getElementById(`kahootDistBar_${i}`);
      const countEl = document.getElementById(`kahootDistCount_${i}`);
      const optTextEl = document.getElementById(`kahootDistText_${i}`);
      const cardEl = document.getElementById(`kahootDistCard_${i}`);

      const count = distribution[i] || 0;
      const pct = Math.round((count / maxVotes) * 100);
      const choiceLabel = Array.isArray(data.options) ? (data.options[i] || '') : '';

      if (barEl) barEl.style.height = `${Math.max(10, pct)}%`;
      if (countEl) countEl.textContent = count.toString();
      if (optTextEl && choiceLabel) optTextEl.innerHTML = `${shapes[i]} ${formatMathHtml(choiceLabel)}`;
      if (cardEl) cardEl.classList.toggle('is-correct', i === data.correct);
    }

    const summaryEl = document.getElementById('kahootLeaderboardDistSummary');
    if (summaryEl) {
      summaryEl.innerHTML = '';
      for (let i = 0; i < 4; i++) {
        const isCorrectOpt = i === data.correct;
        const count = distribution[i] || 0;
        const choiceLabel = Array.isArray(data.options)
          ? (data.options[i] || `Option ${['A', 'B', 'C', 'D'][i]}`)
          : (document.getElementById(`kahootHostOptText_${i}`)?.textContent || `Option ${['A', 'B', 'C', 'D'][i]}`);
        const pill = document.createElement('div');
        pill.style.cssText = `padding:0.55rem 0.75rem; border-radius:8px; background:rgba(15,23,42,0.8); border:1.5px solid ${isCorrectOpt ? '#00e676' : 'rgba(255,255,255,0.1)'}; display:flex; align-items:center; justify-content:space-between; gap:0.5rem;`;
        pill.innerHTML = `
          <span style="font-size:0.82rem; font-weight:700; color:${isCorrectOpt ? '#00e676' : 'var(--text-main)'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            <span style="color:${colors[i]}; margin-right:0.3rem;">${shapes[i]}</span>${formatMathHtml(choiceLabel)} ${isCorrectOpt ? '✓' : ''}
          </span>
          <span style="font-family:var(--font-mono); font-size:0.85rem; font-weight:800; color:var(--gold-accent); flex-shrink:0;">${count}</span>
        `;
        summaryEl.appendChild(pill);
      }
    }
  }

  renderLeaderboardStandings(sortedPlayers, qIndex, totalQuestions) {
    const listEl = document.getElementById('kahootLeaderboardList');
    const titleEl = document.getElementById('kahootLeaderboardTitle');
    const isLast = qIndex >= totalQuestions - 1;

    if (titleEl) {
      titleEl.textContent = `Live Ranking • Question ${qIndex + 1} of ${totalQuestions}`;
    }

    const nextBtn = document.getElementById('kahootBtnNextFromLeaderboard');
    if (nextBtn) {
      nextBtn.innerHTML = isLast
        ? '<span>🏆</span> View Final Podium'
        : '<span>Next ▶</span> Question ' + (qIndex + 2);
    }

    if (listEl) {
      listEl.innerHTML = '';
      if (sortedPlayers.length === 0) {
        listEl.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--text-muted);">No participants scored yet.</div>`;
        return;
      }
      sortedPlayers.slice(0, 10).forEach((p, rank) => {
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

  revealAnswer() {
    if (this.state === 'reveal' || this.state === 'leaderboard') return;
    this.state = 'leaderboard';
    clearInterval(this.timerInterval);
    clearInterval(this.playerTimerInterval);
    kahootAudio.stopCountdownPulse();
    kahootAudio.playReveal();

    const q = this.questions[this.currentQIndex];
    if (!q) return;

    // Calculate Distribution across all human students
    const distribution = [0, 0, 0, 0];
    this.players.forEach(p => {
      const ans = p.answers?.[this.currentQIndex];
      if (ans && ans.optionIndex >= 0 && ans.optionIndex < 4) {
        distribution[ans.optionIndex]++;
      }
    });

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
      options: q.options,
      explanation: q.explanation,
      distribution,
      players: rankedPlayers,
      leaderboard: rankedPlayers,
      totalQuestions: this.questions.length,
      isLastQuestion: this.currentQIndex >= this.questions.length - 1
    };

    this.lastRevealPayload = payload;
    this.populateDescriptiveAnswerUI(payload);
    this.toggleDescriptiveAnswer(false);
    this.renderLeaderboardStandings(rankedPlayers, this.currentQIndex, this.questions.length);

    // Show Ranking / Leaderboard screen by default with option to toggle Descriptive Answer
    this.showScreen('kahootScreenLeaderboard');

    this.sendServerAction('reveal_answer', payload);
    this.broadcastLocal('answer_revealed', payload);
    this.saveLocalRoomState();

    if (this.myPlayer) {
      this.handlePlayerAnswerRevealed(payload);
    }
  }

  showLeaderboard() {
    this.state = 'leaderboard';
    this.showScreen('kahootScreenLeaderboard');
    const sorted = Array.from(this.players.values()).sort((a, b) => b.score - a.score);
    this.renderLeaderboardStandings(sorted, this.currentQIndex, this.questions.length);
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
    this.lastPodiumPayload = payload;
    this.sendServerAction('show_podium', payload);
    this.broadcastLocal('podium_revealed', payload);
    this.saveLocalRoomState(true);
    this.fetchAndRenderActiveRooms();

    if (this.myPlayer) {
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

    // If participant is already joined in a different arena, exit that arena first
    if (this.myPlayer && this.pin && this.pin !== pin) {
      await this.leavePlayerRoom(this.pin, this.myPlayer.id, this.myPlayer.name, true);
    }

    // If participant is already joined in THIS arena with the same name, just return to the lobby/question screen
    if (this.myPlayer && this.pin === pin && (this.myPlayer.name || '').trim().toLowerCase() === name.toLowerCase()) {
      this.showPlayerScreen('kahootPlayerScreenLobby');
      this.syncClientRoomState();
      this.fetchAndRenderActiveRooms();
      return;
    }

    // 1. Check local host/split-view player list for duplicate participant name
    const lowerName = name.toLowerCase();
    if (this.pin === pin && this.players.size > 0) {
      for (const p of this.players.values()) {
        if ((p.name || '').trim().toLowerCase() === lowerName) {
          if (window.showToast) {
            window.showToast(`Duplicate participant: "${name}" has already joined Room ${pin}! Please enter a unique student name.`, 'error');
          }
          if (nameInput) nameInput.focus();
          return;
        }
      }
    }

    // 2. Check local rooms registry for duplicate participant name
    try {
      const raw = localStorage.getItem('thermo_kahoot_local_rooms');
      if (raw) {
        const localMap = JSON.parse(raw);
        const localRoom = localMap[pin];
        if (localRoom && Array.isArray(localRoom.players)) {
          const dup = localRoom.players.find(p => (p.name || '').trim().toLowerCase() === lowerName);
          if (dup) {
            if (window.showToast) {
              window.showToast(`Duplicate participant: "${name}" has already joined Room ${pin}! Please enter a unique student name.`, 'error');
            }
            if (nameInput) nameInput.focus();
            return;
          }
        }
      }
    } catch (e) {}

    const candidateId = 'p_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    // 3. Validate and join on server first so server-side duplicate check is enforced before entering lobby
    const joinResult = await this.joinRoomOnServer({
      pin,
      playerId: candidateId,
      name,
      avatar
    });

    if (!joinResult.ok) {
      if (window.showToast) {
        window.showToast(joinResult.error || 'Unable to join room.', 'error');
      }
      if (nameInput) nameInput.focus();
      return;
    }

    this.pin = pin;
    this.myPlayer = joinResult.player || {
      id: candidateId,
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

    // Connect SSE stream
    this.connectSSE('player');

    // If room already has an active question, jump straight to it; otherwise show waiting lobby
    if (joinResult.room && joinResult.room.state === 'question' && joinResult.room.activeQuestion) {
      this.handlePlayerQuestionStart(joinResult.room.activeQuestion);
    } else {
      this.showPlayerScreen('kahootPlayerScreenLobby');
    }

    const welcomeName = document.getElementById('kahootPlayerLobbyName');
    const welcomeAvatar = document.getElementById('kahootPlayerLobbyAvatar');
    if (welcomeName) welcomeName.textContent = this.myPlayer.name;
    if (welcomeAvatar) welcomeAvatar.textContent = this.myPlayer.avatar;

    this.updateJoinedArenaBanner();
    this.fetchAndRenderActiveRooms();

    kahootAudio.playPop();

    if (window.showToast) {
      window.showToast(`Joined Arena PIN ${pin} as ${this.myPlayer.name}!`, 'success');
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
        return { ok: true, player: data.player, room: data.room };
      } else {
        const errData = await res.json().catch(() => ({}));
        return { ok: false, error: errData.error || 'Could not join Kahoot room.' };
      }
    } catch (err) {
      console.log('Server not reachable, running player in local mode');
      return { ok: true, offline: true };
    }
  }

  resumePlayerInRoom(room, existingPlayer) {
    if (!room || !existingPlayer) return;
    this.pin = room.pin;
    this.myPlayer = {
      ...existingPlayer,
      score: existingPlayer.score || 0,
      streak: existingPlayer.streak || 0,
      answers: existingPlayer.answers || {}
    };

    try {
      sessionStorage.setItem(`kahoot_pid_${room.pin}`, this.myPlayer.id);
    } catch (e) {}

    const welcomeName = document.getElementById('kahootPlayerLobbyName');
    const welcomeAvatar = document.getElementById('kahootPlayerLobbyAvatar');
    if (welcomeName) welcomeName.textContent = this.myPlayer.name;
    if (welcomeAvatar) welcomeAvatar.textContent = this.myPlayer.avatar || '🦊';

    this.connectSSE('player');
    this.showPlayerScreen('kahootPlayerScreenLobby');
    this.updateJoinedArenaBanner();
    this.syncClientRoomState();
    this.fetchAndRenderActiveRooms();

    if (window.showToast) {
      window.showToast(`Rejoined Arena PIN ${room.pin} as ${this.myPlayer.name}!`, 'success');
    }
  }

  async leavePlayerRoom(targetPin = null, targetPlayerId = null, targetName = null, silent = false) {
    const pinToLeave = (targetPin || this.pin || '').trim();
    const pidToLeave = targetPlayerId || this.myPlayer?.id || '';
    const nameToLeave = (targetName || this.myPlayer?.name || '').trim();

    if (!pinToLeave) return;

    // 1. Notify server to remove participant from room.players
    try {
      await fetch('/api/kahoot/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: pinToLeave,
          playerId: pidToLeave,
          name: nameToLeave
        })
      });
    } catch (e) {}

    // 2. Remove from local browser room registry
    try {
      const raw = localStorage.getItem('thermo_kahoot_local_rooms');
      if (raw) {
        const localMap = JSON.parse(raw);
        const localRoom = localMap[pinToLeave];
        if (localRoom && Array.isArray(localRoom.players)) {
          const lowerTarget = nameToLeave.toLowerCase();
          localRoom.players = localRoom.players.filter(p => {
            if (pidToLeave && p.id === pidToLeave) return false;
            if (lowerTarget && (p.name || '').trim().toLowerCase() === lowerTarget) return false;
            return true;
          });
          localRoom.playerCount = localRoom.players.length;
          localRoom.updatedAt = Date.now();
          localStorage.setItem('thermo_kahoot_local_rooms', JSON.stringify(localMap));
        }
      }
    } catch (e) {}

    // 3. If Split View or same-tab Host has this player, remove from this.players
    if (this.pin === pinToLeave) {
      let removedId = pidToLeave;
      if (!removedId && nameToLeave) {
        for (const [id, p] of this.players.entries()) {
          if ((p.name || '').trim().toLowerCase() === nameToLeave.toLowerCase()) {
            removedId = id;
            break;
          }
        }
      }
      if (removedId && this.players.has(removedId)) {
        this.players.delete(removedId);
        if (this.role === 'host' || this.isSplitViewActive()) {
          this.renderHostLobbyPlayers();
        }
      }
      if (this.channel) {
        try {
          this.channel.postMessage({
            event: 'player_removed',
            pin: pinToLeave,
            data: { playerId: removedId || pidToLeave, playerName: nameToLeave, reason: 'left' }
          });
          this.channel.postMessage({ event: 'rooms_updated', pin: pinToLeave });
        } catch (e) {}
      }
    }

    try {
      sessionStorage.removeItem(`kahoot_pid_${pinToLeave}`);
    } catch (e) {}

    // 4. Reset active client player state if leaving the current session's room
    if (!targetPin || targetPin === this.pin) {
      clearInterval(this.playerTimerInterval);
      if (this.eventSource && this.role !== 'host') {
        this.eventSource.close();
        this.eventSource = null;
      }
      this.myPlayer = null;
      this.myAnswer = null;
      this.lastRenderedQuestionKey = null;
      this.lastRenderedRevealKey = null;
      if (this.role !== 'host' && !this.isSplitViewActive()) {
        this.pin = null;
      }
      this.showPlayerScreen('kahootPlayerScreenJoin');
      this.updateJoinedArenaBanner();
    }

    await this.fetchAndRenderActiveRooms();

    if (!silent && window.showToast) {
      window.showToast(`Exited Arena PIN ${pinToLeave}. You can rejoin or select another available arena.`, 'info');
    }
  }

  handlePlayerQuestionStart(data) {
    if (!data) return;
    const qKey = `${data.index}_${data.questionSeq || ''}`;
    if (this.lastRenderedQuestionKey === qKey && this.playerScreenId === 'kahootPlayerScreenQuestion') {
      return;
    }
    this.lastRenderedQuestionKey = qKey;
    this.lastRenderedRevealKey = null;
    this.playerScreenId = 'kahootPlayerScreenQuestion';

    this.showPlayerScreen('kahootPlayerScreenQuestion');
    this.myAnswer = null;
    this.currentQIndex = data.index;
    this.qStartTime = Date.now();

    const qNum = document.getElementById('kahootPlayerQNum');
    if (qNum) qNum.textContent = `Question ${data.index + 1} of ${data.total}`;

    const qText = document.getElementById('kahootPlayerQText');
    if (qText) qText.innerHTML = formatMathHtml(data.text || '');

    // Populate option texts on the 4 student buttons
    if (Array.isArray(data.options)) {
      for (let i = 0; i < 4; i++) {
        const optEl = document.getElementById(`kahootPlayerOptText_${i}`);
        if (optEl) optEl.innerHTML = formatMathHtml(data.options[i] || '');
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
    if (!data) return;
    const rKey = `reveal_${data.qIndex}`;
    if (this.lastRenderedRevealKey === rKey && this.playerScreenId === 'kahootPlayerScreenFeedback') {
      return;
    }
    this.lastRenderedRevealKey = rKey;
    this.playerScreenId = 'kahootPlayerScreenFeedback';

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
          questionSeq: this.questionSeq || 0,
          totalQuestions: this.questions.length || 10,
          playerCount: this.players.size,
          players: Array.from(this.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            score: p.score || 0,
            streak: p.streak || 0,
            answers: p.answers || {}
          })),
          activeQuestion: (this.state === 'question' && currentQ) ? {
            index: this.currentQIndex,
            questionSeq: this.questionSeq || 0,
            total: this.questions.length,
            area: currentQ.area || '',
            level: currentQ.level || '',
            text: currentQ.text,
            options: currentQ.options,
            timeLimit: this.timePerQuestion
          } : null,
          lastRevealPayload: this.lastRevealPayload || null,
          lastPodiumPayload: this.lastPodiumPayload || null,
          updatedAt: now
        };
      }
      localStorage.setItem('thermo_kahoot_local_rooms', JSON.stringify(map));
      if (this.channel) {
        try {
          this.channel.postMessage({ event: 'rooms_updated', pin: this.pin });
        } catch (e) {}
      }
    } catch (e) {}
  }

  async syncClientRoomState() {
    if (!this.pin) return;
    if (this.role === 'host' && !this.isSplitViewActive()) return;
    if (!this.myPlayer && this.role !== 'spectator') return;

    let snapshot = null;
    try {
      const res = await fetch(`/api/kahoot/state?pin=${this.pin}`);
      if (res.ok) {
        const data = await res.json();
        snapshot = data.room || data;
      }
    } catch (e) {}

    if (!snapshot) {
      try {
        const raw = localStorage.getItem('thermo_kahoot_local_rooms');
        const map = raw ? JSON.parse(raw) : {};
        snapshot = map[this.pin] || null;
      } catch (e) {}
    }

    if (!snapshot) return;

    // Keep player roster updated
    if (Array.isArray(snapshot.players) && this.role !== 'host') {
      this.players.clear();
      snapshot.players.forEach(p => {
        this.players.set(p.id, { ...p, answers: p.answers || {} });
      });
      if (this.role === 'spectator' && this.state === 'lobby') {
        this.renderHostLobbyPlayers();
      }
    }

    if (snapshot.state === 'question' && snapshot.activeQuestion) {
      if (this.myPlayer) {
        this.handlePlayerQuestionStart(snapshot.activeQuestion);
      }
      if (this.role === 'spectator') {
        const qKey = `${snapshot.activeQuestion.index}_${snapshot.activeQuestion.questionSeq || snapshot.questionSeq || ''}`;
        if (this.lastSpectatorQuestionKey !== qKey) {
          this.lastSpectatorQuestionKey = qKey;
          this.renderSpectatorQuestion(snapshot.activeQuestion);
        }
      }
    } else if ((snapshot.state === 'leaderboard' || snapshot.state === 'reveal') && snapshot.lastRevealPayload) {
      if (this.myPlayer) {
        this.handlePlayerAnswerRevealed(snapshot.lastRevealPayload);
      }
      if (this.role === 'spectator') {
        const rKey = `${snapshot.lastRevealPayload.qIndex}_${this.questionSeq || snapshot.questionSeq || ''}`;
        if (this.lastSpectatorRevealKey !== rKey) {
          this.lastSpectatorRevealKey = rKey;
          this.renderSpectatorReveal(snapshot.lastRevealPayload);
        }
      }
    } else if (snapshot.state === 'podium' && snapshot.lastPodiumPayload) {
      if (this.myPlayer && this.state !== 'podium') {
        this.handlePlayerPodium(snapshot.lastPodiumPayload);
      }
      if (this.role === 'spectator' && this.state !== 'podium') {
        this.renderSpectatorPodium(snapshot.lastPodiumPayload);
      }
    }
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

    // 3. Also include current tab's hosted room if active
    if ((this.role === 'host' || this.isSplitViewActive()) && this.pin && this.state !== 'setup' && this.state !== 'podium') {
      if (!roomsByPin.has(this.pin)) {
        roomsByPin.set(this.pin, {
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
            score: p.score || 0
          }))
        });
      }
    }

    const rooms = Array.from(roomsByPin.values());
    this.lastFetchedRooms = rooms;

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

    // Auto-fill PIN input when a single arena is active and input is empty
    const pinInput = document.getElementById('kahootPlayerPinInput');
    if (pinInput && !pinInput.value.trim() && rooms.length > 0) {
      pinInput.value = rooms[0].pin;
    }

    this.renderActiveRoomsList(rooms);
    this.updateJoinedArenaBanner();
  }

  renderActiveRoomsList(rooms) {
    const listEl = document.getElementById('kahootActiveRoomsList');
    if (!listEl) return;

    if (!Array.isArray(rooms) || rooms.length === 0) {
      listEl.innerHTML = `<div style="font-size:0.82rem; color:var(--text-muted); text-align:center; padding:0.45rem;">No active Kahoot arenas right now. Enter a Game PIN below or switch to <strong>🖥️ Host Screen</strong> to launch one!</div>`;
      return;
    }

    const nameInput = document.getElementById('kahootPlayerNickname');
    const enteredNameLower = (nameInput?.value || '').trim().toLowerCase();

    listEl.innerHTML = '';
    rooms.forEach(room => {
      const isLobby = room.state === 'lobby';
      const statusBadge = isLobby
        ? `<span style="background:rgba(0,230,118,0.18); color:#00e676; padding:0.15rem 0.5rem; border-radius:999px; font-size:0.75rem; font-weight:700;">🟢 Lobby Open</span>`
        : `<span style="background:rgba(255,145,0,0.2); color:#ffab40; padding:0.15rem 0.5rem; border-radius:999px; font-size:0.75rem; font-weight:700;">🔥 Q${Math.max(1, (room.currentQIndex || 0) + 1)}/${room.totalQuestions || 10}</span>`;

      const roomPlayers = Array.isArray(room.players) ? room.players : [];
      const playerCount = typeof room.playerCount === 'number' ? room.playerCount : roomPlayers.length;

      // Check if participant is already joined in this arena
      const isCurrentSessionJoined = !!(this.myPlayer && this.pin === room.pin);
      let savedSessionPid = null;
      try {
        savedSessionPid = sessionStorage.getItem(`kahoot_pid_${room.pin}`);
      } catch (e) {}

      let matchedExistingPlayer = null;
      if (!isCurrentSessionJoined && roomPlayers.length > 0) {
        matchedExistingPlayer = roomPlayers.find(p => {
          if (savedSessionPid && p.id === savedSessionPid) return true;
          if (enteredNameLower && (p.name || '').trim().toLowerCase() === enteredNameLower) return true;
          return false;
        }) || null;
      }

      const isAlreadyJoined = isCurrentSessionJoined || !!matchedExistingPlayer;
      const joinedPlayerObj = isCurrentSessionJoined ? this.myPlayer : matchedExistingPlayer;

      const joinedBadgeHtml = isAlreadyJoined
        ? `<span style="background:rgba(0,230,118,0.22); color:#00e676; border:1px solid rgba(0,230,118,0.45); padding:0.15rem 0.55rem; border-radius:999px; font-size:0.74rem; font-weight:800;">✓ Joined as ${joinedPlayerObj.avatar || '🦊'} ${joinedPlayerObj.name}</span>`
        : '';

      const rosterPreview = roomPlayers.length > 0
        ? `<div style="font-size:0.73rem; color:var(--text-muted); margin-top:0.15rem;">Players: ${roomPlayers.map(p => `${p.avatar || '🦊'} ${p.name}`).join(', ')}</div>`
        : '';

      const row = document.createElement('div');
      row.style.cssText = `display:flex; justify-content:space-between; align-items:center; gap:0.6rem; padding:0.6rem 0.75rem; background:rgba(15,23,42,0.82); border:1px solid ${isAlreadyJoined ? 'rgba(0,230,118,0.5)' : 'rgba(255,255,255,0.12)'}; border-radius:8px; flex-wrap:wrap;`;

      let actionButtonsHtml = '';
      if (isCurrentSessionJoined) {
        actionButtonsHtml = `
          <button type="button" class="btn-exit-active-room" style="background:rgba(239,68,68,0.2); color:#fca5a5; border:1px solid rgba(239,68,68,0.5); border-radius:6px; padding:0.38rem 0.75rem; font-size:0.8rem; font-weight:800; cursor:pointer;">🚪 Exit Arena</button>
          <button type="button" class="btn-spectate-active-room" style="background:rgba(0,229,255,0.15); color:var(--thermal-accent); border:1px solid rgba(0,229,255,0.35); border-radius:6px; padding:0.38rem 0.7rem; font-size:0.8rem; font-weight:700; cursor:pointer;">👁️ View</button>
        `;
      } else if (matchedExistingPlayer) {
        actionButtonsHtml = `
          <button type="button" class="btn-resume-active-room" style="background:linear-gradient(135deg,#00e676,#00c853); color:#052e16; border:none; border-radius:6px; padding:0.38rem 0.75rem; font-size:0.8rem; font-weight:800; cursor:pointer;">🔄 Rejoin</button>
          <button type="button" class="btn-exit-active-room" style="background:rgba(239,68,68,0.2); color:#fca5a5; border:1px solid rgba(239,68,68,0.5); border-radius:6px; padding:0.38rem 0.75rem; font-size:0.8rem; font-weight:800; cursor:pointer;">🚪 Exit Arena</button>
          <button type="button" class="btn-spectate-active-room" style="background:rgba(0,229,255,0.15); color:var(--thermal-accent); border:1px solid rgba(0,229,255,0.35); border-radius:6px; padding:0.38rem 0.7rem; font-size:0.8rem; font-weight:700; cursor:pointer;">👁️ View</button>
        `;
      } else {
        actionButtonsHtml = `
          <button type="button" class="btn-join-active-room" style="background:linear-gradient(135deg,#00e676,#00c853); color:#052e16; border:none; border-radius:6px; padding:0.38rem 0.8rem; font-size:0.8rem; font-weight:800; cursor:pointer;">🚀 Join Arena</button>
          <button type="button" class="btn-spectate-active-room" style="background:rgba(0,229,255,0.15); color:var(--thermal-accent); border:1px solid rgba(0,229,255,0.35); border-radius:6px; padding:0.38rem 0.7rem; font-size:0.8rem; font-weight:700; cursor:pointer;">👁️ View</button>
        `;
      }

      row.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.2rem; text-align:left; flex:1; min-width:180px;">
          <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap;">
            <strong style="font-family:var(--font-mono); font-size:0.98rem; color:var(--gold-accent); letter-spacing:1px;">PIN: ${room.pin}</strong>
            ${statusBadge}
            ${joinedBadgeHtml}
          </div>
          <span style="font-size:0.76rem; color:var(--text-secondary);">👥 ${playerCount} Human ${(playerCount === 1) ? 'Student' : 'Students'}</span>
          ${rosterPreview}
        </div>
        <div style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
          ${actionButtonsHtml}
        </div>
      `;

      const joinBtn = row.querySelector('.btn-join-active-room');
      if (joinBtn) {
        joinBtn.addEventListener('click', () => {
          const pinEl = document.getElementById('kahootPlayerPinInput');
          if (pinEl) pinEl.value = room.pin;
          const nickEl = document.getElementById('kahootPlayerNickname');
          if (nickEl && nickEl.value.trim()) {
            this.handlePlayerJoin();
          } else {
            this.showPlayerScreen('kahootPlayerScreenJoin');
            if (nickEl) nickEl.focus();
            if (window.showToast) window.showToast(`PIN ${room.pin} selected! Enter or choose your student name to join.`, 'info');
          }
        });
      }

      const resumeBtn = row.querySelector('.btn-resume-active-room');
      if (resumeBtn && matchedExistingPlayer) {
        resumeBtn.addEventListener('click', () => {
          this.resumePlayerInRoom(room, matchedExistingPlayer);
        });
      }

      const exitBtn = row.querySelector('.btn-exit-active-room');
      if (exitBtn && joinedPlayerObj) {
        exitBtn.addEventListener('click', () => {
          this.leavePlayerRoom(room.pin, joinedPlayerObj.id, joinedPlayerObj.name);
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
        const data = await res.json();
        snapshot = data.room || data;
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
    } else if (snapshot && (snapshot.state === 'leaderboard' || snapshot.state === 'reveal') && snapshot.lastRevealPayload) {
      this.renderSpectatorReveal(snapshot.lastRevealPayload);
    } else if (snapshot && snapshot.state === 'podium' && snapshot.lastPodiumPayload) {
      this.renderSpectatorPodium(snapshot.lastPodiumPayload);
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
    this.toggleDescriptiveAnswer(false);
    this.showScreen('kahootScreenQuestion');

    const idxEl = document.getElementById('kahootHostQIndex');
    const areaEl = document.getElementById('kahootHostQArea');
    const textEl = document.getElementById('kahootHostQText');
    const timerEl = document.getElementById('kahootHostQTimer');
    const countEl = document.getElementById('kahootHostAnsweredCount');

    if (idxEl) idxEl.textContent = `Question ${data.index + 1} of ${data.total}`;
    if (areaEl) areaEl.textContent = `${data.area || 'Thermodynamics'} • ${data.level || 'Live Spectator'}`;
    if (textEl) textEl.innerHTML = formatMathHtml(data.text || '');
    if (countEl) countEl.textContent = `0 / ${this.players.size} answered`;

    const colors = ['red', 'blue', 'yellow', 'green'];
    if (Array.isArray(data.options)) {
      for (let i = 0; i < 4; i++) {
        const textElOpt = document.getElementById(`kahootHostOptText_${i}`);
        if (textElOpt) textElOpt.innerHTML = formatMathHtml(data.options[i] || '');
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
    this.state = 'leaderboard';
    this.lastRevealPayload = data;
    this.populateDescriptiveAnswerUI(data);
    this.toggleDescriptiveAnswer(false);
    this.renderLeaderboardStandings(
      data.leaderboard || data.players || [],
      data.qIndex || 0,
      data.totalQuestions || 10
    );
    this.showScreen('kahootScreenLeaderboard');
  }

  renderSpectatorLeaderboard(data) {
    this.state = 'leaderboard';
    this.renderLeaderboardStandings(
      data.leaderboard || data.players || [],
      data.qIndex || 0,
      data.totalQuestions || 10
    );
    this.showScreen('kahootScreenLeaderboard');
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
