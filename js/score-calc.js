/**
 * ThermoOlyMaster - Module 5: Standalone Official Tournament Score Calculator
 * Implements the exact 2027 Division B scoring formulas:
 * FS = ES (50 pts) + TS (30 pts) + PS (20 pts)
 * Handles tiered penalties, disqualifications, and official tiebreakers (Rule 6.e).
 */

import { calculateOfficialScores } from './physics.js';

export class ScoreCalculator {
  constructor() {
    this.mockCompetitors = [
      { name: 'Centerville MS', exam: 48, startT: 21.0, finalT: 44.5, predT: 44.2, compV: 0, constrV: 0 },
      { name: 'Troy Science Club', exam: 45, startT: 21.2, finalT: 46.8, predT: 45.0, compV: 0, constrV: 0 },
      { name: 'Solon STEM Lab', exam: 42, startT: 20.8, finalT: 43.1, predT: 43.0, compV: 0, constrV: 0 }
    ];
  }

  init() {
    this.bindEvents();
    this.calculate();
  }

  bindEvents() {
    const inputs = [
      'calcTeamExam', 'calcHighExam',
      'calcStartTemp', 'calcFinalTemp', 'calcHighTG',
      'calcPredTemp', 'calcHighPE',
      'calcCompViolations', 'calcConstrViolations'
    ];

    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.calculate());
        el.addEventListener('change', () => this.calculate());
      }
    });

    const checks = [
      'calcCheckWaterTouch',
      'calcCheckTouchedHeating',
      'calcCheckNoPrediction',
      'calcCheckProhibited'
    ];

    checks.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => this.calculate());
      }
    });

    const btnPreset1st = document.getElementById('calcBtnPresetGold');
    const btnPresetMedal = document.getElementById('calcBtnPresetMedal');
    const btnReset = document.getElementById('calcBtnReset');

    if (btnPreset1st) {
      btnPreset1st.addEventListener('click', () => this.loadPreset('gold'));
    }
    if (btnPresetMedal) {
      btnPresetMedal.addEventListener('click', () => this.loadPreset('medal'));
    }
    if (btnReset) {
      btnReset.addEventListener('click', () => this.loadPreset('reset'));
    }
  }

  loadPreset(type) {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    const setCheck = (id, checked) => {
      const el = document.getElementById(id);
      if (el) el.checked = checked;
    };

    if (type === 'gold') {
      setVal('calcTeamExam', 49);
      setVal('calcHighExam', 50);
      setVal('calcStartTemp', 21.0);
      setVal('calcFinalTemp', 47.5);
      setVal('calcHighTG', 26.5);
      setVal('calcPredTemp', 47.2);
      setVal('calcHighPE', 0.9937);
      setVal('calcCompViolations', 0);
      setVal('calcConstrViolations', 0);
      setCheck('calcCheckWaterTouch', false);
      setCheck('calcCheckTouchedHeating', false);
      setCheck('calcCheckNoPrediction', false);
      setCheck('calcCheckProhibited', false);
    } else if (type === 'medal') {
      setVal('calcTeamExam', 44);
      setVal('calcHighExam', 50);
      setVal('calcStartTemp', 21.2);
      setVal('calcFinalTemp', 42.0);
      setVal('calcHighTG', 26.5);
      setVal('calcPredTemp', 41.0);
      setVal('calcHighPE', 0.9937);
      setVal('calcCompViolations', 0);
      setVal('calcConstrViolations', 0);
      setCheck('calcCheckWaterTouch', false);
      setCheck('calcCheckTouchedHeating', false);
      setCheck('calcCheckNoPrediction', false);
      setCheck('calcCheckProhibited', false);
    } else {
      setVal('calcTeamExam', 40);
      setVal('calcHighExam', 50);
      setVal('calcStartTemp', 21.0);
      setVal('calcFinalTemp', 38.0);
      setVal('calcHighTG', 25.0);
      setVal('calcPredTemp', 36.5);
      setVal('calcHighPE', 1.0);
      setVal('calcCompViolations', 0);
      setVal('calcConstrViolations', 0);
      setCheck('calcCheckWaterTouch', false);
      setCheck('calcCheckTouchedHeating', false);
      setCheck('calcCheckNoPrediction', false);
      setCheck('calcCheckProhibited', false);
    }

    this.calculate();
  }

  calculate() {
    const getNum = (id, def = 0) => {
      const el = document.getElementById(id);
      return el ? parseFloat(el.value) || def : def;
    };
    const getBool = (id) => {
      const el = document.getElementById(id);
      return el ? el.checked : false;
    };

    const teamExam = getNum('calcTeamExam', 40);
    const highExam = Math.max(1, getNum('calcHighExam', 50));
    const startTemp = getNum('calcStartTemp', 21.0);
    const finalTemp = getNum('calcFinalTemp', 40.0);
    const highTG = Math.max(0.1, getNum('calcHighTG', 25.0));
    const predTemp = getNum('calcPredTemp', 39.0);
    const highPE = Math.max(0.01, getNum('calcHighPE', 1.0));

    const compViolations = getNum('calcCompViolations', 0);
    const constrViolations = getNum('calcConstrViolations', 0);

    const waterTouched = getBool('calcCheckWaterTouch');
    const touchedHeating = getBool('calcCheckTouchedHeating');
    const noPrediction = getBool('calcCheckNoPrediction');
    const prohibitedMat = getBool('calcCheckProhibited');

    const touchedOrProhibited = waterTouched || touchedHeating || prohibitedMat;

    // Run scoring algorithm
    const scores = calculateOfficialScores({
      part1Score: teamExam,
      highPart1: highExam,
      startTemp: startTemp,
      finalTemp: finalTemp,
      highTG: highTG,
      predTemp: predTemp,
      highPE: highPE,
      compViolations: compViolations,
      constrViolations: constrViolations,
      touchedDuringHeating: touchedOrProhibited,
      prohibitedMaterials: prohibitedMat,
      missingPrediction: noPrediction
    });

    // Update Output displays
    const elFS = document.getElementById('calcOutputFS');
    const elES = document.getElementById('calcOutputES');
    const elTS = document.getElementById('calcOutputTS');
    const elPS = document.getElementById('calcOutputPS');
    const elTG = document.getElementById('calcOutputTG');
    const elPE = document.getElementById('calcOutputPE');
    const elPenaltyNote = document.getElementById('calcPenaltyNote');

    if (elFS) elFS.textContent = `${scores.finalScore.toFixed(2)}`;
    if (elES) elES.textContent = `${scores.examScore.toFixed(2)} / 50`;
    if (elTS) elTS.textContent = `${scores.tempScore.toFixed(2)} / 30`;
    if (elPS) elPS.textContent = `${scores.predictionScore.toFixed(2)} / 20`;
    if (elTG) elTG.textContent = `+${scores.tempGain.toFixed(2)}°C`;
    if (elPE) elPE.textContent = scores.predictionEstimate.toFixed(4);

    if (elPenaltyNote) {
      if (touchedOrProhibited) {
        elPenaltyNote.textContent = '❌ DISQUALIFICATION: Device touched water, was touched during run, or used prohibited materials. TS & PS zeroed!';
        elPenaltyNote.style.color = 'var(--danger)';
      } else if (scores.penalized) {
        elPenaltyNote.textContent = `⚠️ Penalties applied: Multiplier ${(scores.penaltyMultiplier * 100).toFixed(0)}% (${compViolations} comp, ${constrViolations} constr)`;
        elPenaltyNote.style.color = 'var(--warning)';
      } else {
        elPenaltyNote.textContent = '✅ Full compliance: No rule or construction penalties applied.';
        elPenaltyNote.style.color = 'var(--success)';
      }
    }

    this.renderTournamentStandings(scores);
  }

  renderTournamentStandings(userScore) {
    const container = document.getElementById('tournamentStandingsTable');
    if (!container) return;

    // Compute scores for mock competitors relative to the high benchmarks
    const highExam = 50;
    const highTG = 26.5;
    const highPE = 1.0;

    const list = [
      {
        name: '⭐ Your Team',
        fs: userScore.finalScore,
        es: userScore.examScore,
        ts: userScore.tempScore,
        ps: userScore.predictionScore,
        isUser: true
      }
    ];

    this.mockCompetitors.forEach(comp => {
      const cScore = calculateOfficialScores({
        part1Score: comp.exam,
        highPart1: highExam,
        startTemp: comp.startT,
        finalTemp: comp.finalT,
        highTG: highTG,
        predTemp: comp.predT,
        highPE: highPE
      });
      list.push({
        name: comp.name,
        fs: cScore.finalScore,
        es: cScore.examScore,
        ts: cScore.tempScore,
        ps: cScore.predictionScore,
        isUser: false
      });
    });

    // Sort according to Rule 6.e:
    // Highest FS, then Tiebreaker 1 (ES), then Tiebreaker 3 (PS), then Tiebreaker 4 (TS)
    list.sort((a, b) => {
      if (b.fs !== a.fs) return b.fs - a.fs;
      if (b.es !== a.es) return b.es - a.es;
      if (b.ps !== a.ps) return b.ps - a.ps;
      return b.ts - a.ts;
    });

    let html = `
      <table class="reference-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team</th>
            <th>Exam (ES / 50)</th>
            <th>Temp (TS / 30)</th>
            <th>Pred (PS / 20)</th>
            <th>Final Score (FS)</th>
          </tr>
        </thead>
        <tbody>
    `;

    const medals = ['🥇 1st Place', '🥈 2nd Place', '🥉 3rd Place', '4th Place'];

    list.forEach((item, idx) => {
      const rowStyle = item.isUser ? 'style="background: rgba(255, 87, 34, 0.15); font-weight: bold;"' : '';
      html += `
        <tr ${rowStyle}>
          <td><span class="mono">${medals[idx] || `${idx + 1}th`}</span></td>
          <td>${item.name}</td>
          <td class="mono">${item.es.toFixed(1)}</td>
          <td class="mono">${item.ts.toFixed(1)}</td>
          <td class="mono">${item.ps.toFixed(1)}</td>
          <td class="mono" style="color: ${item.isUser ? 'var(--thermal-primary)' : 'var(--cryo-cyan)'};">${item.fs.toFixed(2)}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    container.innerHTML = html;
  }
}
