/**
 * ThermoOlyMaster - Official Science Olympiad Tournament & Onboarding Director
 * Manages:
 * 1. Onboarding of Schools, Teams, and associating Students to Teams (persisted to Neon PostgreSQL).
 * 2. Launching and running official Thermodynamics competitions:
 *    - Stage 1: Device Impound & Rule Compliance Inspection
 *    - Stage 2: Exam Generation, Packet Printing & Bubble Sheet OCR Grading per Team
 *    - Stage 3: Recording Sealed Temperature Predictions & Starting/Final Water Temperatures
 *    - Stage 4: Rule 6 Score Aggregation (ES 50 + TS 30 + PS 20 = 100 pts) & Tie-Breakers
 *    - Stage 5: Declaring Official Winners, Championship Podium & Printable Supervisor Results
 */

import { calculateOfficialScores } from './physics.js';
import { authManager } from './auth-manager.js';

export class TournamentManager {
  constructor({ testPrinter = null, testScanner = null } = {}) {
    this.testPrinter = testPrinter;
    this.testScanner = testScanner;

    this.schools = [];
    this.teams = [];
    this.competitions = [];
    this.students = [];
    this.dbConnected = false;

    this.activeSubTab = 'competition'; // 'onboarding' | 'competition'
    this.activeCompetitionId = null;
    this.activeStageFilter = 'all'; // 'all' | 'impound' | 'exam' | 'thermal' | 'standings'
    this.activeOcrTargetTeamId = null;

    // Rule 5 Official Event Countdown Timer state
    this.timerPresetSeconds = 1500; // 25:00 default
    this.timerRemainingSeconds = 1500;
    this.timerRunning = false;
    this.timerInterval = null;
    this.timerLabel = '25-Min Collector Heat Lamp Run';

    // Debounced save handle
    this.saveDebounceTimer = null;
  }

  async init() {
    this.bindStaticEvents();
    await this.loadStateFromServer();
    this.render();

    window.addEventListener('thermo_auth_changed', () => this.render());
    window.addEventListener('thermo_progress_updated', () => {
      this.students = authManager.getAllUsers();
      this.render();
    });

    // Listen for Bubble Sheet OCR scan completion when linked to a Tournament Team
    window.addEventListener('thermo_bubble_scanned', (e) => {
      if (this.activeOcrTargetTeamId && e.detail) {
        this.applyScannedScoreToTeam(this.activeOcrTargetTeamId, e.detail);
      }
    });
  }

  async loadStateFromServer() {
    try {
      const res = await fetch('/api/tournament/state');
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.success) {
        this.dbConnected = !!data.dbConnected;
        this.schools = Array.isArray(data.schools) ? data.schools : [];
        this.teams = Array.isArray(data.teams) ? data.teams : [];
        this.competitions = Array.isArray(data.competitions) ? data.competitions : [];
        this.students = Array.isArray(data.students) && data.students.length > 0
          ? data.students
          : authManager.getAllUsers();

        if (!this.activeCompetitionId && this.competitions.length > 0) {
          this.activeCompetitionId = this.competitions[0].id;
        }
      }
    } catch (e) {
      console.warn('TournamentManager offline fallback:', e.message);
      this.students = authManager.getAllUsers();
    }
  }

  getActiveCompetition() {
    if (!this.competitions || this.competitions.length === 0) return null;
    return this.competitions.find(c => c.id === this.activeCompetitionId) || this.competitions[0];
  }

  bindStaticEvents() {
    // Sub-tab switchers (Onboarding vs Competition Director)
    document.querySelectorAll('[data-tourn-subtab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeSubTab = btn.getAttribute('data-tourn-subtab');
        document.querySelectorAll('[data-tourn-subtab]').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-tourn-subtab') === this.activeSubTab);
        });
        const secOnboard = document.getElementById('tournSectionOnboarding');
        const secComp = document.getElementById('tournSectionCompetition');
        if (secOnboard) secOnboard.style.display = this.activeSubTab === 'onboarding' ? 'block' : 'none';
        if (secComp) secComp.style.display = this.activeSubTab === 'competition' ? 'block' : 'none';
        this.render();
      });
    });

    // Stage filter buttons
    document.querySelectorAll('[data-tourn-stage]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeStageFilter = btn.getAttribute('data-tourn-stage');
        document.querySelectorAll('[data-tourn-stage]').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-tourn-stage') === this.activeStageFilter);
        });
        this.renderCompetitionView();
      });
    });

    // Add School Form
    const formAddSchool = document.getElementById('formTournAddSchool');
    if (formAddSchool) {
      formAddSchool.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = (document.getElementById('tournSchoolName')?.value || '').trim();
        const cityState = (document.getElementById('tournSchoolCity')?.value || '').trim();
        const division = (document.getElementById('tournSchoolDiv')?.value || 'Division B').trim();
        const coachName = (document.getElementById('tournSchoolCoach')?.value || '').trim();
        const coachEmail = (document.getElementById('tournSchoolEmail')?.value || '').trim();
        if (!name) return;

        const res = await fetch('/api/tournament/schools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upsert',
            school: { name, cityState, division, coachName, coachEmail }
          })
        });
        const data = await res.json();
        if (data.success) {
          this.schools = data.schools;
          formAddSchool.reset();
          this.renderOnboardingView();
          if (window.showToast) window.showToast(`School "${name}" onboarded to Neon database!`, 'success');
        }
      });
    }

    // Add / Update Team Form
    const formAddTeam = document.getElementById('formTournAddTeam');
    if (formAddTeam) {
      formAddTeam.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = (document.getElementById('tournTeamEditId')?.value || '').trim();
        const teamNumber = (document.getElementById('tournTeamNumber')?.value || 'B01').toUpperCase().trim();
        const name = (document.getElementById('tournTeamName')?.value || '').trim();
        const schoolId = document.getElementById('tournTeamSchool')?.value || '';
        const deviceName = (document.getElementById('tournTeamDevice')?.value || '').trim();
        const notes = (document.getElementById('tournTeamNotes')?.value || '').trim();

        const checkedBoxes = document.querySelectorAll('input[name="tournTeamStudentChk"]:checked');
        const studentUsernames = Array.from(checkedBoxes).map(cb => cb.value);

        if (!name) return;

        const res = await fetch('/api/tournament/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upsert',
            team: {
              id: editId || ('team_' + Date.now()),
              teamNumber,
              name,
              schoolId,
              studentUsernames,
              deviceName,
              notes
            }
          })
        });
        const data = await res.json();
        if (data.success) {
          this.teams = data.teams;
          if (Array.isArray(data.students)) {
            this.students = data.students;
            localStorage.setItem(authManager.STORAGE_KEY_USERS, JSON.stringify(data.students));
          }
          // Also sync team metadata into active competition entries if team is already enrolled
          const comp = this.getActiveCompetition();
          if (comp && Array.isArray(comp.entries)) {
            const savedTeam = data.team;
            const entry = comp.entries.find(en => en.teamId === savedTeam.id);
            if (entry) {
              entry.teamNumber = savedTeam.teamNumber;
              entry.teamName = savedTeam.name;
              entry.schoolName = savedTeam.schoolName;
              entry.studentUsernames = savedTeam.studentUsernames;
              entry.deviceName = savedTeam.deviceName || entry.deviceName;
              await this.saveCompetition(comp, false);
            }
          }
          formAddTeam.reset();
          const elEditId = document.getElementById('tournTeamEditId');
          if (elEditId) elEditId.value = '';
          const btnSaveTeam = document.getElementById('btnTournSaveTeam');
          if (btnSaveTeam) btnSaveTeam.innerHTML = '<span>➕</span> Onboard Team &amp; Save Associations';
          this.render();
          if (window.showToast) window.showToast(`Team "${teamNumber} - ${name}" saved to Neon database!`, 'success');
        }
      });
    }

    // Launch New Competition Modal / Form
    const btnOpenNewComp = document.getElementById('btnTournOpenNewComp');
    const boxNewComp = document.getElementById('tournNewCompDrawer');
    const btnCancelNewComp = document.getElementById('btnTournCancelNewComp');
    const formNewComp = document.getElementById('formTournNewComp');

    if (btnOpenNewComp && boxNewComp) {
      btnOpenNewComp.addEventListener('click', () => {
        boxNewComp.style.display = boxNewComp.style.display === 'none' ? 'block' : 'none';
        const dateInput = document.getElementById('newCompDate');
        if (dateInput && !dateInput.value) {
          dateInput.value = new Date().toISOString().slice(0, 10);
        }
      });
    }
    if (btnCancelNewComp && boxNewComp) {
      btnCancelNewComp.addEventListener('click', () => {
        boxNewComp.style.display = 'none';
      });
    }

    if (formNewComp) {
      formNewComp.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = (document.getElementById('newCompTitle')?.value || '').trim();
        const eventDate = document.getElementById('newCompDate')?.value || new Date().toISOString().slice(0, 10);
        const location = (document.getElementById('newCompLocation')?.value || 'Main Science Arena').trim();
        const questionCount = parseInt(document.getElementById('newCompQCount')?.value || '20', 10);
        const targetStartTempC = parseFloat(document.getElementById('newCompStartTemp')?.value || '21.0');
        const lampHeightCm = parseFloat(document.getElementById('newCompLampHeight')?.value || '45');
        const lampWattage = parseFloat(document.getElementById('newCompWattage')?.value || '120');

        if (!title) return;

        // Enroll all current teams into the new competition
        const entries = this.teams.map(t => ({
          teamId: t.id,
          teamNumber: t.teamNumber,
          teamName: t.name,
          schoolName: t.schoolName,
          studentUsernames: t.studentUsernames || [],
          deviceName: t.deviceName || 'Thermal Collector Cube',
          impounded: false,
          impoundTime: '',
          dimsCompliant: true,
          materialsCompliant: true,
          constrViolations: 0,
          compViolations: 0,
          touchedDuringHeating: false,
          prohibitedMaterials: false,
          impoundNotes: '',
          examRaw: 0,
          examMax: questionCount,
          examSource: 'pending',
          predictedTempC: null,
          missingPrediction: false,
          startTempC: targetStartTempC,
          finalTempC: null
        }));

        const newComp = {
          id: 'comp_' + Date.now(),
          title,
          eventDate,
          location,
          status: 'impound',
          settings: {
            questionCount,
            maxExamRaw: questionCount,
            targetStartTempC,
            lampHeightCm,
            lampWattage,
            heatingMinutes: 25
          },
          entries,
          winnersDeclared: false,
          declaredAt: null
        };

        await this.saveCompetition(newComp, true);
        this.activeCompetitionId = newComp.id;
        if (boxNewComp) boxNewComp.style.display = 'none';
        formNewComp.reset();
        this.renderCompetitionView();
        if (window.showToast) window.showToast(`Launched competition "${title}" with ${entries.length} teams!`, 'success');
      });
    }

    // Active Competition Selector Dropdown
    const selComp = document.getElementById('tournActiveCompSelect');
    if (selComp) {
      selComp.addEventListener('change', () => {
        this.activeCompetitionId = selComp.value;
        this.renderCompetitionView();
      });
    }

    // Competition Action Buttons (Sync Enrolled Teams, Impound All, Pull Student Scores, Delete Comp, Print Exam Packet, Declare Winners, Print Results, Export CSV)
    const btnSyncTeams = document.getElementById('btnTournSyncTeams');
    if (btnSyncTeams) {
      btnSyncTeams.addEventListener('click', () => this.syncAllTeamsIntoCompetition());
    }

    const btnImpoundAll = document.getElementById('btnTournImpoundAll');
    if (btnImpoundAll) {
      btnImpoundAll.addEventListener('click', () => this.impoundAllTeams());
    }

    const btnPullStudentScores = document.getElementById('btnTournPullStudentScores');
    if (btnPullStudentScores) {
      btnPullStudentScores.addEventListener('click', () => this.pullScoresFromStudentGradebook());
    }

    const btnDeleteComp = document.getElementById('btnTournDeleteComp');
    if (btnDeleteComp) {
      btnDeleteComp.addEventListener('click', () => this.deleteActiveCompetition());
    }

    const btnPrintExamPacket = document.getElementById('btnTournPrintExamPacket');
    if (btnPrintExamPacket) {
      btnPrintExamPacket.addEventListener('click', () => {
        const comp = this.getActiveCompetition();
        const qCount = comp?.settings?.questionCount || 20;
        if (this.testPrinter) {
          this.testPrinter.printFullCompetitionPacket(qCount);
        }
      });
    }

    const btnDeclareWinners = document.getElementById('btnTournDeclareWinners');
    if (btnDeclareWinners) {
      btnDeclareWinners.addEventListener('click', () => this.declareWinners());
    }

    const btnPrintStandings = document.getElementById('btnTournPrintStandings');
    if (btnPrintStandings) {
      btnPrintStandings.addEventListener('click', () => this.printOfficialStandingsSheet());
    }

    const btnExportStandingsCsv = document.getElementById('btnTournExportCsv');
    if (btnExportStandingsCsv) {
      btnExportStandingsCsv.addEventListener('click', () => this.exportStandingsCsv());
    }

    // Rule 5 Official Countdown Timer Controls
    const btnTimerStartPause = document.getElementById('btnTournTimerStartPause');
    if (btnTimerStartPause) {
      btnTimerStartPause.addEventListener('click', () => this.toggleTimer());
    }

    const btnTimerReset = document.getElementById('btnTournTimerReset');
    if (btnTimerReset) {
      btnTimerReset.addEventListener('click', () => this.resetTimer());
    }

    document.querySelectorAll('[data-timer-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const secs = parseInt(btn.getAttribute('data-timer-preset') || '1500', 10);
        const label = btn.getAttribute('data-timer-label') || 'Official Event Timer';
        this.setTimerPreset(secs, label);
      });
    });

    // Jump link from Classroom Admin
    const btnJumpFromAdmin = document.getElementById('adminBtnOpenTournamentDirector');
    if (btnJumpFromAdmin) {
      btnJumpFromAdmin.addEventListener('click', () => {
        const tabBtn = document.getElementById('navTabTournament');
        if (tabBtn) tabBtn.click();
      });
    }
  }

  scheduleSaveCompetition(comp) {
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      this.saveCompetition(comp, false);
    }, 350);
  }

  setTimerPreset(seconds, label) {
    this.pauseTimer();
    this.timerPresetSeconds = seconds;
    this.timerRemainingSeconds = seconds;
    this.timerLabel = label;
    this.updateTimerDisplay();
  }

  toggleTimer() {
    if (this.timerRunning) {
      this.pauseTimer();
    } else {
      this.startTimer();
    }
  }

  startTimer() {
    if (this.timerRemainingSeconds <= 0) {
      this.timerRemainingSeconds = this.timerPresetSeconds;
    }
    this.timerRunning = true;
    this.updateTimerDisplay();

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.timerRemainingSeconds > 0) {
        this.timerRemainingSeconds--;
        this.updateTimerDisplay();

        if (this.timerRemainingSeconds === 60) {
          this.playTimerChime(660, 0.25);
          if (window.showToast) window.showToast('⏱️ 1:00 Remaining in Tournament Timer!', 'warning');
        } else if (this.timerRemainingSeconds === 0) {
          this.pauseTimer();
          this.playTimerChime(880, 0.65);
          if (window.showToast) window.showToast(`🚨 TIME UP: ${this.timerLabel} complete! Record final temperatures now.`, 'success');
        }
      }
    }, 1000);
  }

  pauseTimer() {
    this.timerRunning = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.updateTimerDisplay();
  }

  resetTimer() {
    this.pauseTimer();
    this.timerRemainingSeconds = this.timerPresetSeconds;
    this.updateTimerDisplay();
  }

  updateTimerDisplay() {
    const elDisp = document.getElementById('tournTimerDisplay');
    const elLabel = document.getElementById('tournTimerPhaseLabel');
    const btnStart = document.getElementById('btnTournTimerStartPause');

    const mins = Math.floor(this.timerRemainingSeconds / 60);
    const secs = this.timerRemainingSeconds % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (elDisp) {
      elDisp.textContent = formatted;
      elDisp.style.color = this.timerRemainingSeconds === 0
        ? 'var(--danger)'
        : (this.timerRemainingSeconds <= 60 ? 'var(--gold-accent)' : 'var(--cryo-cyan)');
    }
    if (elLabel) {
      elLabel.textContent = `${this.timerRunning ? '🔥 RUNNING' : '⏸️ READY'}: ${this.timerLabel}`;
    }
    if (btnStart) {
      btnStart.innerHTML = this.timerRunning
        ? '<span>⏸️</span> Pause Timer'
        : '<span>▶️</span> Start Timer';
    }
  }

  playTimerChime(freq = 880, duration = 0.4) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (_) {}
  }

  async saveCompetition(comp, showToastMsg = false) {
    try {
      const res = await fetch('/api/tournament/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert', competition: comp })
      });
      const data = await res.json();
      if (data && data.success) {
        this.competitions = data.competitions;
        if (showToastMsg && window.showToast) {
          window.showToast('Competition state saved to Neon database.', 'success');
        }
      }
    } catch (e) {
      console.warn('Save competition error:', e.message);
    }
  }

  /**
   * Computes official Rule 6 scores (ES 50 + TS 30 + PS 20 = 100) and tie-breaker rankings for a competition
   */
  computeAggregatedStandings(comp) {
    if (!comp || !Array.isArray(comp.entries)) return { entries: [], highExam: 20, highTG: 0, highPE: 1 };

    const entries = comp.entries.map(e => ({ ...e }));

    // 1. Determine Tournament High Benchmarks across all non-disqualified entries
    let highExam = 0;
    let highTG = 0;
    let highPE = 0;

    entries.forEach(en => {
      const raw = Math.max(0, Number(en.examRaw) || 0);
      if (raw > highExam) highExam = raw;

      const startT = en.startTempC !== null && en.startTempC !== undefined && en.startTempC !== ''
        ? Number(en.startTempC)
        : (comp.settings?.targetStartTempC || 21.0);
      const finalT = en.finalTempC !== null && en.finalTempC !== undefined && en.finalTempC !== ''
        ? Number(en.finalTempC)
        : startT;
      const tg = Math.max(0, finalT - startT);
      if (!en.touchedDuringHeating && !en.prohibitedMaterials && tg > highTG) {
        highTG = tg;
      }

      if (en.predictedTempC !== null && en.predictedTempC !== undefined && en.predictedTempC !== '' && !en.missingPrediction && finalT > 0) {
        const predT = Number(en.predictedTempC);
        const pe = Math.max(0, 1 - (Math.abs(finalT - predT) / finalT));
        if (pe > highPE) highPE = pe;
      }
    });

    if (highExam <= 0) highExam = comp.settings?.maxExamRaw || 20;
    if (highTG <= 0) highTG = 15.0;
    if (highPE <= 0) highPE = 1.0;

    // 2. Compute each team's ES, TS, PS, and Final Score
    const scored = entries.map(en => {
      const startT = en.startTempC !== null && en.startTempC !== undefined && en.startTempC !== ''
        ? Number(en.startTempC)
        : (comp.settings?.targetStartTempC || 21.0);
      const hasFinal = en.finalTempC !== null && en.finalTempC !== undefined && en.finalTempC !== '';
      const finalT = hasFinal ? Number(en.finalTempC) : startT;
      const hasPred = en.predictedTempC !== null && en.predictedTempC !== undefined && en.predictedTempC !== '';
      const predT = hasPred ? Number(en.predictedTempC) : startT;

      const constrViolations = (Number(en.constrViolations) || 0) + (en.dimsCompliant === false ? 1 : 0) + (en.materialsCompliant === false ? 1 : 0);
      const compViolations = (Number(en.compViolations) || 0) + (en.impounded === false ? 1 : 0);

      const calc = calculateOfficialScores({
        part1Score: Math.max(0, Number(en.examRaw) || 0),
        highPart1: highExam,
        finalTemp: finalT,
        startTemp: startT,
        highTG,
        predTemp: predT,
        highPE,
        compViolations,
        constrViolations,
        touchedDuringHeating: !!en.touchedDuringHeating,
        prohibitedMaterials: !!en.prohibitedMaterials,
        missingPrediction: !!en.missingPrediction || !hasPred
      });

      // If final temperature hasn't been recorded yet, TS and PS are 0
      if (!hasFinal) {
        calc.tempGain = 0;
        calc.tempScore = 0;
        calc.predictionScore = 0;
        calc.finalScore = calc.examScore;
      }

      return {
        ...en,
        computed: calc
      };
    });

    // 3. Sort by Final Score DESC, then official tie-breakers:
    // Tie-breaker 1: Highest TS (Thermal Score)
    // Tie-breaker 2: Highest PS (Prediction Score)
    // Tie-breaker 3: Highest ES (Exam Score)
    const ranked = [...scored].sort((a, b) => {
      if (b.computed.finalScore !== a.computed.finalScore) return b.computed.finalScore - a.computed.finalScore;
      if (b.computed.tempScore !== a.computed.tempScore) return b.computed.tempScore - a.computed.tempScore;
      if (b.computed.predictionScore !== a.computed.predictionScore) return b.computed.predictionScore - a.computed.predictionScore;
      return b.computed.examScore - a.computed.examScore;
    });

    const medals = ['🥇 1st Gold', '🥈 2nd Silver', '🥉 3rd Bronze', '🎖️ 4th Place', '🎖️ 5th Place', '🎖️ 6th Place'];
    ranked.forEach((item, idx) => {
      item.rank = idx + 1;
      item.medal = idx < medals.length ? medals[idx] : `#${idx + 1}`;
    });

    return {
      entries: scored,
      ranked,
      highExam,
      highTG: Number(highTG.toFixed(2)),
      highPE: Number(highPE.toFixed(4))
    };
  }

  render() {
    const badgeDb = document.getElementById('tournDbStatusBadge');
    if (badgeDb) {
      badgeDb.innerHTML = this.dbConnected
        ? '🟢 Neon Postgres Live'
        : '⚡ Local Storage Active';
    }
    this.applyRolePermissions();
    this.updateTimerDisplay();
    this.renderOnboardingView();
    this.renderCompetitionView();
  }

  applyRolePermissions() {
    const isCoach = authManager.isCoachOrAdmin();

    // Hide/show coach-only controls
    document.querySelectorAll('.tourn-coach-only').forEach(el => {
      el.style.display = isCoach ? '' : 'none';
    });

    const btnOnboardTab = document.getElementById('btnTournSubTabOnboarding');
    if (btnOnboardTab) {
      btnOnboardTab.style.display = isCoach ? '' : 'none';
    }

    // If non-coach was on onboarding sub-tab, switch them back to competition standings
    if (!isCoach && this.activeSubTab === 'onboarding') {
      this.activeSubTab = 'competition';
      const secOnboard = document.getElementById('tournSectionOnboarding');
      const secComp = document.getElementById('tournSectionCompetition');
      if (secOnboard) secOnboard.style.display = 'none';
      if (secComp) secComp.style.display = 'block';
      document.querySelectorAll('[data-tourn-subtab]').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-tourn-subtab') === 'competition');
      });
    }
  }

  renderRoleSpotlightBanner(comp, aggregated) {
    const banner = document.getElementById('tournRoleSpotlightBanner');
    if (!banner) return;

    const isCoach = authManager.isCoachOrAdmin();
    const isGuest = authManager.isGuest();
    const user = authManager.getCurrentUser();

    if (isCoach) {
      banner.style.display = 'none';
      return;
    }

    banner.style.display = 'block';

    if (isGuest) {
      banner.innerHTML = `
        <div style="background:rgba(255,171,64,0.1); border:1px solid rgba(255,171,64,0.45); border-radius:var(--radius-md); padding:0.9rem 1.15rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
          <div>
            <span class="badge-official" style="color:var(--gold-accent); border-color:var(--gold-accent);">👁️ LIVE TOURNAMENT SCOREBOARD (GUEST READ-ONLY)</span>
            <div style="font-size:0.84rem; color:var(--text-secondary); margin-top:0.25rem;">
              You are viewing live Science Olympiad standings in read-only mode. Sign in as a registered team member to sync your team's exam/prediction, or sign in as Coach (<span class="mono">najam@linxtel.com</span>) to run the tournament.
            </div>
          </div>
          <button type="button" id="btnTournGuestSignIn" class="btn btn-primary btn-sm">
            <span>🔐</span> Sign In / Register
          </button>
        </div>
      `;
      document.getElementById('btnTournGuestSignIn')?.addEventListener('click', () => {
        document.getElementById('navbarUserBadge')?.click();
      });
      return;
    }

    // Registered Student: find their assigned team in the active competition
    const uname = (user?.username || '').toLowerCase();
    const myRankedEntry = (aggregated?.ranked || []).find(r =>
      Array.isArray(r.studentUsernames) && r.studentUsernames.map(u => u.toLowerCase()).includes(uname)
    );

    if (!myRankedEntry) {
      banner.innerHTML = `
        <div style="background:rgba(0,229,255,0.08); border:1px solid rgba(0,229,255,0.35); border-radius:var(--radius-md); padding:0.9rem 1.15rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
          <div>
            <span class="badge-official" style="color:var(--cryo-cyan); border-color:var(--cryo-cyan);">🎓 COMPETITOR VIEW • ${user.fullName}</span>
            <div style="font-size:0.84rem; color:var(--text-secondary); margin-top:0.25rem;">
              You are signed in as <strong>${user.fullName}</strong>, but not yet assigned to a team in <strong>${comp?.title || 'this competition'}</strong>. Ask Coach Najam Rashid to associate your account to your Division B team.
            </div>
          </div>
        </div>
      `;
      return;
    }

    const c = myRankedEntry.computed;
    const locked = !!comp?.winnersDeclared;

    banner.innerHTML = `
      <div style="background:linear-gradient(135deg, rgba(0,229,255,0.12), rgba(34,197,94,0.08)); border:2px solid var(--cryo-cyan); border-radius:var(--radius-md); padding:1rem 1.2rem;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
          <div>
            <span class="badge-official" style="color:var(--cryo-cyan); border-color:var(--cryo-cyan);">🎓 MY TEAM COMPETITOR CONSOLE</span>
            <h3 style="font-size:1.15rem; font-weight:800; color:#fff; margin:0.3rem 0 0.15rem;">
              ${myRankedEntry.teamNumber} — ${myRankedEntry.teamName} <span style="font-size:0.85rem; color:var(--gold-accent);">(${myRankedEntry.medal})</span>
            </h3>
            <div style="font-size:0.8rem; color:var(--text-secondary);">
              🏫 ${myRankedEntry.schoolName} • 🧊 Device: <strong>${myRankedEntry.deviceName || 'Collector'}</strong> • 📦 ${myRankedEntry.impounded ? '<span style="color:var(--safe-green);">✓ Impounded</span>' : '<span style="color:var(--gold-accent);">⏳ Pending Impound</span>'}
            </div>
            <div class="mono" style="font-size:0.82rem; color:var(--cryo-cyan); margin-top:0.4rem;">
              Total Score: <strong>${c.finalScore.toFixed(2)} / 100</strong> &nbsp;|&nbsp; ES: ${c.examScore.toFixed(1)}/50 &nbsp;|&nbsp; TS: ${c.tempScore.toFixed(1)}/30 &nbsp;|&nbsp; PS: ${c.predictionScore.toFixed(1)}/20
            </div>
          </div>
          ${!locked ? `
            <div style="display:flex; align-items:flex-end; gap:0.6rem; flex-wrap:wrap; background:rgba(5,10,20,0.65); padding:0.65rem 0.85rem; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
              <div>
                <label style="font-size:0.7rem; color:var(--gold-accent); font-weight:700; display:block; margin-bottom:0.2rem;">🎯 Team Sealed Prediction (°C)</label>
                <div style="display:flex; gap:0.35rem;">
                  <input type="number" step="0.1" id="studentTeamPredInput" value="${myRankedEntry.predictedTempC ?? ''}" placeholder="e.g. 47.0" class="text-input mono" style="width:95px; padding:0.3rem 0.5rem; font-size:0.85rem;">
                  <button type="button" id="btnStudentSaveTeamPred" class="btn btn-primary btn-sm">Lock Prediction</button>
                </div>
              </div>
              <button type="button" id="btnStudentSyncTeamExam" class="btn btn-secondary btn-sm" title="Sync your latest online exam & predictor score to your team">
                <span>⚡</span> Sync My Exam Score to Team
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    document.getElementById('btnStudentSaveTeamPred')?.addEventListener('click', async () => {
      const val = parseFloat(document.getElementById('studentTeamPredInput')?.value || '');
      if (isNaN(val) || val < 0 || val > 100) {
        if (window.showToast) window.showToast('Enter a valid water temperature prediction between 0°C and 100°C.', 'warning');
        return;
      }
      const targetEntry = comp.entries.find(e => e.teamId === myRankedEntry.teamId);
      if (targetEntry) {
        targetEntry.predictedTempC = Number(val.toFixed(1));
        await this.saveCompetition(comp, false);
        this.renderCompetitionView();
        if (window.showToast) window.showToast(`Locked sealed prediction of ${val.toFixed(1)}°C for Team ${targetEntry.teamNumber}!`, 'success');
      }
    });

    document.getElementById('btnStudentSyncTeamExam')?.addEventListener('click', () => {
      this.pullScoresFromStudentGradebook(myRankedEntry.teamId);
    });
  }

  renderOnboardingView() {
    // 1. Populate School Dropdown in Team Form
    const selSchool = document.getElementById('tournTeamSchool');
    if (selSchool) {
      const currentVal = selSchool.value;
      selSchool.innerHTML = this.schools.map(s => `<option value="${s.id}">${s.name} (${s.division || 'Div B'})</option>`).join('');
      if (currentVal && this.schools.some(s => s.id === currentVal)) {
        selSchool.value = currentVal;
      }
    }

    // 2. Populate Student Checkboxes in Team Form
    const studentChecklist = document.getElementById('tournTeamStudentsChecklist');
    if (studentChecklist) {
      const studentUsers = (this.students || []).filter(u => u.role !== 'admin' && u.username !== 'guest');
      studentChecklist.innerHTML = studentUsers.map(st => {
        const assignedTeam = this.teams.find(t => Array.isArray(t.studentUsernames) && t.studentUsernames.includes(st.username.toLowerCase()));
        const teamTag = assignedTeam ? `<span style="font-size:0.68rem; color:var(--cryo-cyan);">(${assignedTeam.teamNumber})</span>` : '';
        return `
          <label style="display:inline-flex; align-items:center; gap:0.35rem; padding:0.3rem 0.6rem; background:rgba(255,255,255,0.04); border:1px solid var(--border-subtle); border-radius:999px; font-size:0.78rem; cursor:pointer;">
            <input type="checkbox" name="tournTeamStudentChk" value="${st.username}" style="cursor:pointer;">
            <span>🎓 ${st.fullName}</span>
            ${teamTag}
          </label>
        `;
      }).join('');
    }

    // 3. Render Schools Table
    const elSchoolsTable = document.getElementById('tournSchoolsTableWrap');
    if (elSchoolsTable) {
      let html = `
        <table class="reference-table">
          <thead>
            <tr>
              <th>School Name</th>
              <th>City / State</th>
              <th>Division</th>
              <th>Head Coach</th>
              <th>Teams</th>
              <th style="text-align:center;">Action</th>
            </tr>
          </thead>
          <tbody>
      `;
      if (this.schools.length === 0) {
        html += `<tr><td colspan="6" style="text-align:center; padding:1rem; color:var(--text-muted);">No schools onboarded yet.</td></tr>`;
      } else {
        this.schools.forEach(s => {
          const teamCount = this.teams.filter(t => t.schoolId === s.id).length;
          html += `
            <tr>
              <td><strong>🏫 ${s.name}</strong></td>
              <td>${s.cityState || '—'}</td>
              <td><span class="badge-official" style="color:var(--cryo-cyan); border-color:var(--cryo-cyan);">${s.division || 'Division B'}</span></td>
              <td>${s.coachName || '—'} <span class="mono" style="font-size:0.75rem; color:var(--text-muted);">${s.coachEmail ? `(${s.coachEmail})` : ''}</span></td>
              <td class="mono">${teamCount} Team${teamCount === 1 ? '' : 's'}</td>
              <td style="text-align:center;">
                <button class="btn btn-secondary btn-sm" data-del-school="${s.id}" style="padding:0.2rem 0.5rem; font-size:0.72rem; color:var(--danger);">🗑️</button>
              </td>
            </tr>
          `;
        });
      }
      html += `</tbody></table>`;
      elSchoolsTable.innerHTML = html;

      elSchoolsTable.querySelectorAll('[data-del-school]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-del-school');
          const res = await fetch('/api/tournament/schools', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id })
          });
          const data = await res.json();
          if (data.success) {
            this.schools = data.schools;
            this.renderOnboardingView();
          }
        });
      });
    }

    // 4. Render Teams & Student Associations Table
    const elTeamsTable = document.getElementById('tournTeamsTableWrap');
    if (elTeamsTable) {
      let html = `
        <table class="reference-table">
          <thead>
            <tr>
              <th>Team #</th>
              <th>Team Name</th>
              <th>School</th>
              <th>Associated Students</th>
              <th>Collector Device Name</th>
              <th style="text-align:center;">Actions</th>
            </tr>
          </thead>
          <tbody>
      `;
      if (this.teams.length === 0) {
        html += `<tr><td colspan="6" style="text-align:center; padding:1rem; color:var(--text-muted);">No teams created yet. Use the form above to onboard a team.</td></tr>`;
      } else {
        this.teams.forEach(t => {
          const memberBadges = (t.studentUsernames || []).map(uname => {
            const st = this.students.find(u => u.username.toLowerCase() === uname.toLowerCase());
            const label = st ? st.fullName : uname;
            return `<span class="badge-official" style="color:var(--safe-green); border-color:rgba(34,197,94,0.4); margin-right:0.25rem;">🎓 ${label}</span>`;
          }).join('') || '<span style="color:var(--text-muted); font-size:0.78rem;">Unassigned</span>';

          html += `
            <tr>
              <td><span class="mono" style="font-weight:800; color:var(--gold-accent); font-size:0.95rem;">${t.teamNumber}</span></td>
              <td><strong>${t.name}</strong></td>
              <td style="color:var(--text-secondary);">${t.schoolName || '—'}</td>
              <td>${memberBadges}</td>
              <td class="mono" style="font-size:0.8rem; color:var(--cryo-cyan);">${t.deviceName || 'Standard Collector'}</td>
              <td style="text-align:center; white-space:nowrap;">
                <button class="btn btn-secondary btn-sm" data-edit-team="${t.id}" style="padding:0.2rem 0.55rem; font-size:0.72rem;">✏️ Edit / Assign</button>
                <button class="btn btn-secondary btn-sm" data-del-team="${t.id}" style="padding:0.2rem 0.5rem; font-size:0.72rem; color:var(--danger);">🗑️</button>
              </td>
            </tr>
          `;
        });
      }
      html += `</tbody></table>`;
      elTeamsTable.innerHTML = html;

      elTeamsTable.querySelectorAll('[data-edit-team]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-edit-team');
          const team = this.teams.find(t => t.id === id);
          if (!team) return;
          document.getElementById('tournTeamEditId').value = team.id;
          document.getElementById('tournTeamNumber').value = team.teamNumber;
          document.getElementById('tournTeamName').value = team.name;
          if (document.getElementById('tournTeamSchool')) {
            document.getElementById('tournTeamSchool').value = team.schoolId;
          }
          document.getElementById('tournTeamDevice').value = team.deviceName || '';
          document.getElementById('tournTeamNotes').value = team.notes || '';

          document.querySelectorAll('input[name="tournTeamStudentChk"]').forEach(cb => {
            cb.checked = Array.isArray(team.studentUsernames) && team.studentUsernames.includes(cb.value.toLowerCase());
          });

          const btnSaveTeam = document.getElementById('btnTournSaveTeam');
          if (btnSaveTeam) btnSaveTeam.innerHTML = `<span>💾</span> Update Team ${team.teamNumber}`;
          document.getElementById('formTournAddTeam')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });

      elTeamsTable.querySelectorAll('[data-del-team]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-del-team');
          const res = await fetch('/api/tournament/teams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id })
          });
          const data = await res.json();
          if (data.success) {
            this.teams = data.teams;
            this.renderOnboardingView();
          }
        });
      });
    }
  }

  renderCompetitionView() {
    this.applyRolePermissions();
    const isCoach = authManager.isCoachOrAdmin();
    const selComp = document.getElementById('tournActiveCompSelect');
    const comp = this.getActiveCompetition();

    if (selComp) {
      selComp.innerHTML = this.competitions.map(c =>
        `<option value="${c.id}" ${comp && c.id === comp.id ? 'selected' : ''}>🏆 ${c.title} (${c.eventDate || '2027'})</option>`
      ).join('');
    }

    if (!comp) return;

    // Preserve active focused input before re-rendering table DOM
    const activeEl = document.activeElement;
    const focusedTeam = activeEl?.getAttribute?.('data-team') || null;
    const focusedField = activeEl?.getAttribute?.('data-field') || null;

    const aggregated = this.computeAggregatedStandings(comp);
    this.renderRoleSpotlightBanner(comp, aggregated);

    // Update Summary Metric Cards
    const elTeamsCount = document.getElementById('tournMetricTeams');
    const elImpoundedCount = document.getElementById('tournMetricImpounded');
    const elHighExam = document.getElementById('tournMetricHighExam');
    const elHighTG = document.getElementById('tournMetricHighTG');
    const elLeader = document.getElementById('tournMetricLeader');

    const totalTeams = comp.entries.length;
    const impoundedCount = comp.entries.filter(e => e.impounded).length;
    const topTeam = aggregated.ranked[0];

    if (elTeamsCount) elTeamsCount.textContent = `${totalTeams} Teams`;
    if (elImpoundedCount) elImpoundedCount.textContent = `${impoundedCount} / ${totalTeams}`;
    if (elHighExam) elHighExam.textContent = `${aggregated.highExam} / ${comp.settings?.maxExamRaw || 20}`;
    if (elHighTG) elHighTG.textContent = `+${aggregated.highTG.toFixed(1)}°C`;
    if (elLeader) {
      elLeader.textContent = topTeam
        ? `${topTeam.teamNumber} (${topTeam.computed.finalScore.toFixed(1)} pts)`
        : '—';
    }

    // Render Official Winners Podium Banner if declared
    const elPodiumBanner = document.getElementById('tournWinnersPodiumBanner');
    if (elPodiumBanner) {
      if (comp.winnersDeclared && aggregated.ranked.length > 0) {
        elPodiumBanner.style.display = 'block';
        const top3 = aggregated.ranked.slice(0, 3);
        elPodiumBanner.innerHTML = `
          <div style="background:linear-gradient(135deg, rgba(255,214,0,0.16), rgba(0,229,255,0.1)); border:2px solid var(--gold-accent); border-radius:var(--radius-md); padding:1.25rem; margin-bottom:1.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; margin-bottom:1rem;">
              <div>
                <span class="badge-official" style="color:var(--gold-accent); border-color:var(--gold-accent);">🏆 OFFICIAL TOURNAMENT RESULTS DECLARED</span>
                <h3 style="font-size:1.35rem; font-weight:800; color:#fff; margin:0.35rem 0 0;">${comp.title} — Official Medal Standings</h3>
              </div>
              <div style="font-size:0.8rem; color:var(--text-secondary);">
                📍 ${comp.location} • 📅 ${comp.eventDate}
              </div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:1rem;">
              ${top3.map((t, i) => {
                const colors = ['#ffd600', '#e0e0e0', '#ffab40'];
                const titles = ['🥇 1st Place Champion', '🥈 2nd Place Silver', '🥉 3rd Place Bronze'];
                const stuNames = (t.studentUsernames || []).map(u => {
                  const s = this.students.find(st => st.username.toLowerCase() === u.toLowerCase());
                  return s ? s.fullName : u;
                }).join(' & ') || 'Team Members';
                return `
                  <div style="background:rgba(8,14,28,0.85); border:2px solid ${colors[i]}; border-radius:var(--radius-sm); padding:1rem;">
                    <div style="font-size:0.8rem; font-weight:800; color:${colors[i]}; text-transform:uppercase;">${titles[i]}</div>
                    <div style="font-size:1.15rem; font-weight:800; color:#fff; margin-top:0.25rem;">${t.teamNumber} — ${t.teamName}</div>
                    <div style="font-size:0.8rem; color:var(--cryo-cyan); margin-top:0.15rem;">🏫 ${t.schoolName} • 🎓 ${stuNames}</div>
                    <div class="mono" style="margin-top:0.65rem; font-size:1.3rem; font-weight:900; color:${colors[i]};">
                      ${t.computed.finalScore.toFixed(2)} <span style="font-size:0.75rem; color:var(--text-muted);">/ 100 pts</span>
                    </div>
                    <div class="mono" style="font-size:0.74rem; color:var(--text-secondary); margin-top:0.25rem;">
                      ES: ${t.computed.examScore.toFixed(1)} | TS: ${t.computed.tempScore.toFixed(1)} (+${t.computed.tempGain.toFixed(1)}°C) | PS: ${t.computed.predictionScore.toFixed(1)}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      } else {
        elPodiumBanner.style.display = 'none';
      }
    }

    // Render Interactive Competition Console Table
    const container = document.getElementById('tournCompetitionTableWrap');
    if (!container) return;

    const showImpound = this.activeStageFilter === 'all' || this.activeStageFilter === 'impound';
    const showExam = this.activeStageFilter === 'all' || this.activeStageFilter === 'exam';
    const showThermal = this.activeStageFilter === 'all' || this.activeStageFilter === 'thermal';
    const showStandings = this.activeStageFilter === 'all' || this.activeStageFilter === 'standings';

    // Display sorted by Rank when in 'standings' view, otherwise by Team Number
    const displayRows = this.activeStageFilter === 'standings'
      ? aggregated.ranked
      : aggregated.entries.map(en => {
          const rItem = aggregated.ranked.find(r => r.teamId === en.teamId);
          return { ...en, rank: rItem ? rItem.rank : '-', medal: rItem ? rItem.medal : '-' };
        });

    const disabledAttr = isCoach ? '' : 'disabled';

    let html = `
      <table class="reference-table" style="font-size:0.82rem;">
        <thead>
          <tr>
            <th>Rank / Medal</th>
            <th>Team &amp; Students</th>
            ${showImpound ? `<th>📦 1. Impound &amp; Violations</th>` : ''}
            ${showExam ? `<th>📝 2. Written Exam &amp; Bubble OCR (ES 50)</th>` : ''}
            ${showThermal ? `<th>🎯 3. Prediction &amp; 🌡️ Temps (TS 30 / PS 20)</th>` : ''}
            ${showStandings ? `<th>🏆 4. Aggregated Rule 6 Score (Max 100)</th>` : ''}
          </tr>
        </thead>
        <tbody>
    `;

    if (displayRows.length === 0) {
      html += `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No teams enrolled in this competition yet. Click "Sync Enrolled Teams" above.</td></tr>`;
    } else {
      displayRows.forEach(row => {
        const stuNames = (row.studentUsernames || []).map(u => {
          const s = this.students.find(st => st.username.toLowerCase() === u.toLowerCase());
          return s ? s.fullName : u;
        }).join(', ') || 'Unassigned';

        const c = row.computed;
        const examSourceBadge = row.examSource === 'ocr_scan'
          ? '📷 OCR Scanned'
          : (row.examSource === 'student_sync' ? '⚡ Student Synced' : '✍️ Manual');

        html += `
          <tr data-comp-team="${row.teamId}">
            <td class="mono" style="white-space:nowrap;">
              <div style="font-weight:800; font-size:0.92rem; color:${row.rank <= 3 ? 'var(--gold-accent)' : 'var(--text-main)'};">
                ${row.medal}
              </div>
              <div style="font-size:0.7rem; color:var(--text-muted);">Rank #${row.rank}</div>
            </td>
            <td>
              <div><strong style="color:var(--cryo-cyan); font-family:var(--font-mono);">${row.teamNumber}</strong> — <strong>${row.teamName}</strong></div>
              <div style="font-size:0.74rem; color:var(--text-secondary);">🏫 ${row.schoolName}</div>
              <div style="font-size:0.73rem; color:var(--safe-green);">🎓 ${stuNames}</div>
              <div style="font-size:0.7rem; color:var(--text-muted);">🧊 Device: ${row.deviceName || 'Collector'}</div>
            </td>
            ${showImpound ? `
              <td style="min-width:210px;">
                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.35rem;">
                  <label style="display:inline-flex; align-items:center; gap:0.3rem; font-weight:700; cursor:${isCoach ? 'pointer' : 'default'}; color:${row.impounded ? 'var(--safe-green)' : 'var(--gold-accent)'};">
                    <input type="checkbox" data-field="impounded" data-team="${row.teamId}" ${row.impounded ? 'checked' : ''} ${disabledAttr}>
                    <span>${row.impounded ? '✓ Impounded' : '⏳ Not Impounded'}</span>
                  </label>
                  <span class="mono" style="font-size:0.68rem; color:var(--text-muted);">${row.impoundTime || ''}</span>
                </div>
                <div style="display:flex; gap:0.5rem; flex-wrap:wrap; font-size:0.72rem;">
                  <label title="Cube <= 30.0 cm check">
                    <input type="checkbox" data-field="dimsCompliant" data-team="${row.teamId}" ${row.dimsCompliant !== false ? 'checked' : ''} ${disabledAttr}> ≤30cm Cube
                  </label>
                  <label title="Construction Violations (0.7x penalty each)">
                    Constr Viol:
                    <input type="number" min="0" max="3" data-field="constrViolations" data-team="${row.teamId}" value="${row.constrViolations || 0}" ${disabledAttr} style="width:42px; padding:1px 4px; background:rgba(0,0,0,0.4); color:#fff; border:1px solid var(--border-subtle); border-radius:4px;">
                  </label>
                </div>
                <input type="text" data-field="impoundNotes" data-team="${row.teamId}" value="${row.impoundNotes || ''}" ${disabledAttr} placeholder="Impound dimensions / notes..." style="margin-top:0.3rem; width:100%; font-size:0.72rem; padding:2px 6px; background:rgba(0,0,0,0.3); color:var(--text-main); border:1px solid var(--border-subtle); border-radius:4px;">
              </td>
            ` : ''}
            ${showExam ? `
              <td style="min-width:235px;">
                <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.35rem;">
                  <span style="font-size:0.74rem; color:var(--text-secondary);">Raw:</span>
                  <input type="number" min="0" max="100" step="0.5" data-field="examRaw" data-team="${row.teamId}" value="${row.examRaw ?? 0}" ${disabledAttr} style="width:58px; padding:3px 6px; font-family:var(--font-mono); font-weight:700; background:rgba(0,0,0,0.45); color:var(--cryo-cyan); border:1px solid var(--border-subtle); border-radius:4px;">
                  <span class="mono" style="font-size:0.75rem; color:var(--text-muted);">/ ${comp.settings?.maxExamRaw || 20}</span>
                  <span class="badge-official" style="font-size:0.63rem; margin-left:auto;">${examSourceBadge}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.35rem; flex-wrap:wrap;">
                  <span class="mono" style="font-size:0.78rem; color:var(--thermal-primary); font-weight:700;">ES = ${c.examScore.toFixed(2)} / 50</span>
                  ${isCoach ? `
                    <div style="display:flex; gap:0.25rem;">
                      <button type="button" class="btn btn-secondary btn-sm" data-pull-team="${row.teamId}" style="padding:0.18rem 0.45rem; font-size:0.68rem;" title="Pull best online exam & prediction score from associated students">
                        ⚡ Pull
                      </button>
                      <button type="button" class="btn btn-secondary btn-sm" data-ocr-team="${row.teamId}" style="padding:0.18rem 0.45rem; font-size:0.68rem;" title="Scan & grade paper bubble sheet for this team">
                        📷 OCR
                      </button>
                    </div>
                  ` : ''}
                </div>
              </td>
            ` : ''}
            ${showThermal ? `
              <td style="min-width:255px;">
                <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.35rem; margin-bottom:0.35rem;">
                  <div>
                    <label style="font-size:0.66rem; color:var(--text-muted); display:block;">Pred (°C)</label>
                    <input type="number" step="0.1" data-field="predictedTempC" data-team="${row.teamId}" value="${row.predictedTempC ?? ''}" ${disabledAttr} placeholder="e.g. 47.0" style="width:100%; padding:3px 5px; font-family:var(--font-mono); font-size:0.78rem; background:rgba(0,0,0,0.45); color:var(--gold-accent); border:1px solid var(--border-subtle); border-radius:4px;">
                  </div>
                  <div>
                    <label style="font-size:0.66rem; color:var(--text-muted); display:block;">Start (°C)</label>
                    <input type="number" step="0.1" data-field="startTempC" data-team="${row.teamId}" value="${row.startTempC ?? (comp.settings?.targetStartTempC || 21.0)}" ${disabledAttr} style="width:100%; padding:3px 5px; font-family:var(--font-mono); font-size:0.78rem; background:rgba(0,0,0,0.45); color:#fff; border:1px solid var(--border-subtle); border-radius:4px;">
                  </div>
                  <div>
                    <label style="font-size:0.66rem; color:var(--text-muted); display:block;">Final (°C)</label>
                    <input type="number" step="0.1" data-field="finalTempC" data-team="${row.teamId}" value="${row.finalTempC ?? ''}" ${disabledAttr} placeholder="e.g. 47.5" style="width:100%; padding:3px 5px; font-family:var(--font-mono); font-size:0.78rem; background:rgba(0,0,0,0.45); color:var(--safe-green); border:1px solid var(--border-subtle); border-radius:4px;">
                  </div>
                </div>
                <div class="mono" style="font-size:0.73rem; display:flex; justify-content:space-between; color:var(--text-secondary);">
                  <span>ΔT: <strong style="color:var(--gold-accent);">+${c.tempGain.toFixed(1)}°C</strong> (TS ${c.tempScore.toFixed(1)})</span>
                  <span>PE: <strong style="color:var(--safe-green);">${(c.predictionEstimate * 100).toFixed(1)}%</strong> (PS ${c.predictionScore.toFixed(1)})</span>
                </div>
              </td>
            ` : ''}
            ${showStandings ? `
              <td class="mono" style="min-width:170px;">
                <div style="font-size:1.1rem; font-weight:900; color:var(--cryo-cyan);">
                  ${c.finalScore.toFixed(2)} <span style="font-size:0.72rem; color:var(--text-muted);">/ 100</span>
                </div>
                <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:0.15rem;">
                  ES ${c.examScore.toFixed(1)} + TS ${c.tempScore.toFixed(1)} + PS ${c.predictionScore.toFixed(1)}
                </div>
                ${c.penaltyMultiplier < 1 ? `<div style="font-size:0.68rem; color:var(--danger);">Penalty: ×${c.penaltyMultiplier}</div>` : ''}
              </td>
            ` : ''}
          </tr>
        `;
      });
    }

    html += `</tbody></table>`;
    container.innerHTML = html;

    if (!isCoach) return;

    // Restore focus if supervisor was editing an inline field
    if (focusedTeam && focusedField) {
      const targetInput = container.querySelector(`[data-team="${focusedTeam}"][data-field="${focusedField}"]`);
      if (targetInput) {
        targetInput.focus();
      }
    }

    // Bind inline changes & Enter/ArrowDown/ArrowUp row navigation for supervisor speed entry
    container.querySelectorAll('[data-field]').forEach(input => {
      input.addEventListener('change', () => {
        const teamId = input.getAttribute('data-team');
        const field = input.getAttribute('data-field');
        const entry = comp.entries.find(e => e.teamId === teamId);
        if (!entry) return;

        if (input.type === 'checkbox') {
          entry[field] = input.checked;
          if (field === 'impounded' && input.checked && !entry.impoundTime) {
            entry.impoundTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
        } else if (input.type === 'number') {
          entry[field] = input.value === '' ? null : parseFloat(input.value);
          if (field === 'examRaw') {
            entry.examSource = 'manual';
          }
        } else {
          entry[field] = input.value;
        }

        this.scheduleSaveCompetition(comp);
        this.renderCompetitionView();
      });

      // Keyboard navigation: Enter or ArrowDown jumps to same field in next team row; ArrowUp jumps to previous row
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          const field = input.getAttribute('data-field');
          const allSameField = Array.from(container.querySelectorAll(`[data-field="${field}"]`));
          const idx = allSameField.indexOf(input);
          if (idx === -1) return;

          const nextIdx = (e.key === 'ArrowUp') ? idx - 1 : idx + 1;
          if (nextIdx >= 0 && nextIdx < allSameField.length) {
            e.preventDefault();
            input.dispatchEvent(new Event('change'));
            const nextTeamId = allSameField[nextIdx].getAttribute('data-team');
            setTimeout(() => {
              const target = container.querySelector(`[data-team="${nextTeamId}"][data-field="${field}"]`);
              if (target) {
                target.focus();
                if (typeof target.select === 'function') target.select();
              }
            }, 10);
          }
        }
      });
    });

    // Bind "Scan Bubble OCR" buttons per team
    container.querySelectorAll('[data-ocr-team]').forEach(btn => {
      btn.addEventListener('click', () => {
        const teamId = btn.getAttribute('data-ocr-team');
        this.launchBubbleOcrForTeam(teamId);
      });
    });

    // Bind "Pull Student Score" buttons per team
    container.querySelectorAll('[data-pull-team]').forEach(btn => {
      btn.addEventListener('click', () => {
        const teamId = btn.getAttribute('data-pull-team');
        this.pullScoresFromStudentGradebook(teamId);
      });
    });
  }

  /**
   * Launches the OMR Bubble Sheet Scanner pre-targeted to a specific tournament team
   */
  launchBubbleOcrForTeam(teamId) {
    const comp = this.getActiveCompetition();
    const entry = comp?.entries?.find(e => e.teamId === teamId);
    if (!entry) return;

    this.activeOcrTargetTeamId = teamId;

    // Navigate to Written Exam -> Scan Bubble Sheet sub-view
    const examTab = document.querySelector('.nav-tab-btn[data-target="view-exam"]');
    if (examTab) examTab.click();

    const scanModeBtn = document.getElementById('subTabExamScan') || document.querySelector('.exam-mode-btn[data-exam-mode="scan"]');
    if (scanModeBtn) scanModeBtn.click();

    // Show target team banner inside Scanner view
    let banner = document.getElementById('scannerActiveTournamentTeamBanner');
    const scanContainer = document.getElementById('examModeScan') || document.getElementById('examSubViewScan');
    if (scanContainer && !banner) {
      banner = document.createElement('div');
      banner.id = 'scannerActiveTournamentTeamBanner';
      scanContainer.prepend(banner);
    }
    if (banner) {
      banner.style.display = 'flex';
      banner.style.cssText = 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; background:rgba(0,229,255,0.12); border:2px solid var(--cryo-cyan); border-radius:var(--radius-sm); padding:0.75rem 1rem; margin-bottom:1rem;';
      banner.innerHTML = `
        <div>
          <span class="badge-official" style="color:var(--cryo-cyan); border-color:var(--cryo-cyan);">🎯 TOURNAMENT OCR GRADING TARGET</span>
          <strong style="color:#fff; margin-left:0.5rem;">${entry.teamNumber} — ${entry.teamName} (${entry.schoolName})</strong>
          <span style="font-size:0.8rem; color:var(--text-secondary); margin-left:0.4rem;">Scan or load a test bubble sheet below to auto-record this team's Exam Score.</span>
        </div>
        <button type="button" id="btnReturnToTournamentFromOcr" class="btn btn-primary btn-sm">
          <span>⬅</span> Return to Tournament Director
        </button>
      `;
      document.getElementById('btnReturnToTournamentFromOcr')?.addEventListener('click', () => {
        const tournTab = document.getElementById('navTabTournament');
        if (tournTab) tournTab.click();
      });
    }

    if (window.showToast) {
      window.showToast(`Bubble OCR Scanner linked to ${entry.teamNumber} (${entry.teamName}). Load or scan their sheet now!`, 'info');
    }
  }

  /**
   * Automatically pulls Written Exam & Sealed Prediction scores from associated students' gradebook records
   */
  async pullScoresFromStudentGradebook(targetTeamId = null) {
    const comp = this.getActiveCompetition();
    if (!comp || !Array.isArray(comp.entries)) return;

    this.students = authManager.getAllUsers();
    const maxExamRaw = comp.settings?.maxExamRaw || 20;
    let updatedTeams = 0;

    comp.entries.forEach(entry => {
      if (targetTeamId && entry.teamId !== targetTeamId) return;

      const usernames = (entry.studentUsernames || []).map(u => u.toLowerCase());
      const teamStudents = this.students.filter(s => usernames.includes((s.username || '').toLowerCase()));
      if (teamStudents.length === 0) return;

      let bestExamPct = -1;
      let latestPred = null;

      teamStudents.forEach(stu => {
        const exams = stu.progress?.examHistory || [];
        exams.forEach(ex => {
          const total = ex.totalQ || 20;
          const pct = total > 0 ? (ex.rawScore / total) : 0;
          if (pct > bestExamPct) bestExamPct = pct;
        });

        const preds = stu.progress?.predictionHistory || [];
        if (preds.length > 0) {
          latestPred = preds[preds.length - 1];
        }
      });

      let changed = false;
      if (bestExamPct >= 0) {
        entry.examRaw = Number((bestExamPct * maxExamRaw).toFixed(1));
        entry.examMax = maxExamRaw;
        entry.examSource = 'student_sync';
        changed = true;
      }

      if (latestPred) {
        if ((entry.predictedTempC === null || entry.predictedTempC === undefined || entry.predictedTempC === '') && latestPred.predTemp !== undefined) {
          entry.predictedTempC = Number(Number(latestPred.predTemp).toFixed(1));
          changed = true;
        }
        if ((entry.finalTempC === null || entry.finalTempC === undefined || entry.finalTempC === '') && latestPred.actualTemp !== undefined) {
          entry.finalTempC = Number(Number(latestPred.actualTemp).toFixed(1));
          changed = true;
        }
      }

      if (changed) updatedTeams++;
    });

    if (updatedTeams > 0) {
      await this.saveCompetition(comp, false);
      this.renderCompetitionView();
      if (window.showToast) {
        window.showToast(`Pulled online exam & prediction records for ${updatedTeams} team${updatedTeams === 1 ? '' : 's'}!`, 'success');
      }
    } else {
      if (window.showToast) {
        window.showToast('No new student exam or prediction history found for the selected team(s).', 'info');
      }
    }
  }

  async deleteActiveCompetition() {
    if (!authManager.isCoachOrAdmin()) return;
    const comp = this.getActiveCompetition();
    if (!comp) return;
    if (this.competitions.length <= 1) {
      if (window.showToast) {
        window.showToast('Cannot delete the only active tournament. Create another competition first.', 'warning');
      }
      return;
    }

    try {
      const res = await fetch('/api/tournament/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: comp.id })
      });
      const data = await res.json();
      if (data && data.success) {
        this.competitions = data.competitions;
        this.activeCompetitionId = this.competitions[0]?.id || null;
        this.renderCompetitionView();
        if (window.showToast) {
          window.showToast(`Deleted competition "${comp.title}".`, 'info');
        }
      }
    } catch (e) {
      console.warn('Delete competition error:', e.message);
    }
  }

  async applyScannedScoreToTeam(teamId, scanDetail) {
    const comp = this.getActiveCompetition();
    if (!comp || !Array.isArray(comp.entries)) return;
    const entry = comp.entries.find(e => e.teamId === teamId);
    if (!entry) return;

    entry.examRaw = scanDetail.rawScore;
    entry.examMax = scanDetail.totalQ || comp.settings?.maxExamRaw || 20;
    entry.examSource = 'ocr_scan';

    await this.saveCompetition(comp, false);
    this.renderCompetitionView();

    if (window.showToast) {
      window.showToast(`Recorded OCR Exam Score ${scanDetail.rawScore}/${entry.examMax} for Team ${entry.teamNumber} (${entry.teamName})!`, 'success');
    }
  }

  async syncAllTeamsIntoCompetition() {
    const comp = this.getActiveCompetition();
    if (!comp) return;
    let added = 0;
    this.teams.forEach(t => {
      const existing = comp.entries.find(e => e.teamId === t.id);
      if (!existing) {
        comp.entries.push({
          teamId: t.id,
          teamNumber: t.teamNumber,
          teamName: t.name,
          schoolName: t.schoolName,
          studentUsernames: t.studentUsernames || [],
          deviceName: t.deviceName || 'Thermal Collector Cube',
          impounded: false,
          impoundTime: '',
          dimsCompliant: true,
          materialsCompliant: true,
          constrViolations: 0,
          compViolations: 0,
          touchedDuringHeating: false,
          prohibitedMaterials: false,
          impoundNotes: '',
          examRaw: 0,
          examMax: comp.settings?.maxExamRaw || 20,
          examSource: 'pending',
          predictedTempC: null,
          missingPrediction: false,
          startTempC: comp.settings?.targetStartTempC || 21.0,
          finalTempC: null
        });
        added++;
      } else {
        existing.teamNumber = t.teamNumber;
        existing.teamName = t.name;
        existing.schoolName = t.schoolName;
        existing.studentUsernames = t.studentUsernames || [];
        if (t.deviceName) existing.deviceName = t.deviceName;
      }
    });
    await this.saveCompetition(comp, false);
    this.renderCompetitionView();
    if (window.showToast) {
      window.showToast(`Synced ${this.teams.length} teams into "${comp.title}" (${added} newly added).`, 'success');
    }
  }

  async impoundAllTeams() {
    const comp = this.getActiveCompetition();
    if (!comp || !Array.isArray(comp.entries)) return;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    comp.entries.forEach(e => {
      e.impounded = true;
      if (!e.impoundTime) e.impoundTime = nowTime;
      e.dimsCompliant = true;
      e.materialsCompliant = true;
    });
    comp.status = 'testing';
    await this.saveCompetition(comp, false);
    this.renderCompetitionView();
    if (window.showToast) {
      window.showToast(`All ${comp.entries.length} team devices marked as Impounded & Compliant!`, 'success');
    }
  }

  async declareWinners() {
    const comp = this.getActiveCompetition();
    if (!comp) return;
    comp.winnersDeclared = true;
    comp.declaredAt = new Date().toISOString();
    comp.status = 'completed';
    await this.saveCompetition(comp, false);
    this.renderCompetitionView();
    document.getElementById('tournWinnersPodiumBanner')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (window.showToast) {
      window.showToast(`🏆 Official Winners & Medals declared for "${comp.title}"!`, 'success');
    }
  }

  printOfficialStandingsSheet() {
    const comp = this.getActiveCompetition();
    if (!comp) return;
    const agg = this.computeAggregatedStandings(comp);

    const rowsHtml = agg.ranked.map(r => {
      const stuNames = (r.studentUsernames || []).map(u => {
        const s = this.students.find(st => st.username.toLowerCase() === u.toLowerCase());
        return s ? s.fullName : u;
      }).join(', ') || '—';
      const c = r.computed;
      return `
        <tr>
          <td style="font-weight:bold; text-align:center;">${r.medal}</td>
          <td><strong>${r.teamNumber}</strong> — ${r.teamName}</td>
          <td>${r.schoolName}</td>
          <td>${stuNames}</td>
          <td style="text-align:center;">${r.impounded ? 'Yes' : 'No'}</td>
          <td style="text-align:center;">${r.examRaw ?? 0}/${comp.settings?.maxExamRaw || 20} (<strong>${c.examScore.toFixed(2)}</strong>)</td>
          <td style="text-align:center;">+${c.tempGain.toFixed(1)}°C (<strong>${c.tempScore.toFixed(2)}</strong>)</td>
          <td style="text-align:center;">${r.predictedTempC ?? '—'}°C vs ${r.finalTempC ?? '—'}°C (<strong>${c.predictionScore.toFixed(2)}</strong>)</td>
          <td style="text-align:center; font-weight:bold; font-size:10pt;">${c.finalScore.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const w = window.open('', '_blank', 'width=1050,height=800');
    if (!w) return;
    w.document.open();
    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${comp.title} - Official Results</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #000; margin: 0; }
          h1 { font-size: 14pt; margin: 0 0 4px 0; }
          .meta { font-size: 8.5pt; color: #333; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
          th, td { border: 1px solid #222; padding: 4px 6px; text-align: left; }
          th { background: #eee; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>🏆 ${comp.title} — Official Science Olympiad Thermodynamics Results</h1>
        <div class="meta">
          Date: ${comp.eventDate} | Location: ${comp.location} | High Exam: ${agg.highExam} | High ΔT Gain: +${agg.highTG.toFixed(1)}°C | Formula: FS = ES (50) + TS (30) + PS (20)
        </div>
        <table>
          <thead>
            <tr>
              <th>Place / Medal</th>
              <th>Team</th>
              <th>School</th>
              <th>Students</th>
              <th>Impound</th>
              <th>Exam (ES / 50)</th>
              <th>Thermal (TS / 30)</th>
              <th>Prediction (PS / 20)</th>
              <th>Final Score (100)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <script>window.onload = () => setTimeout(() => window.print(), 250);</script>
      </body>
      </html>
    `);
    w.document.close();
  }

  exportStandingsCsv() {
    const comp = this.getActiveCompetition();
    if (!comp) return;
    const agg = this.computeAggregatedStandings(comp);

    let csv = 'Rank,Medal,Team Number,Team Name,School,Students,Impounded,Exam Raw,Exam Score (ES/50),Start Temp (C),Final Temp (C),Temp Gain (dT),Thermal Score (TS/30),Predicted Temp (C),Prediction Accuracy (PE),Prediction Score (PS/20),Penalty Multiplier,Final Score (FS/100)\n';
    agg.ranked.forEach(r => {
      const stuNames = (r.studentUsernames || []).map(u => {
        const s = this.students.find(st => st.username.toLowerCase() === u.toLowerCase());
        return s ? s.fullName : u;
      }).join(' & ');
      const c = r.computed;
      csv += `${r.rank},"${r.medal}","${r.teamNumber}","${r.teamName}","${r.schoolName}","${stuNames}",${r.impounded ? 'Yes' : 'No'},${r.examRaw ?? 0},${c.examScore.toFixed(2)},${r.startTempC ?? ''},${r.finalTempC ?? ''},${c.tempGain.toFixed(2)},${c.tempScore.toFixed(2)},${r.predictedTempC ?? ''},${c.predictionEstimate.toFixed(4)},${c.predictionScore.toFixed(2)},${c.penaltyMultiplier},${c.finalScore.toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Official_Results_${comp.title.replace(/[^a-z0-9]/gi, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

