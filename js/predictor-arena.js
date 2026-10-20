/**
 * ThermoOlyMaster - Module 2: The Prediction Arena (PS Mode)
 * Simulates high-stakes competition temperature forecasting and scores
 * student predictions against actual physical heat collector results.
 */

import { computeCollectorHeatFlow, calculateOfficialScores } from './physics.js';
import { authManager } from './auth-manager.js';

export class PredictorArena {
  constructor() {
    this.scenario = null;
    this.deviceConfig = {
      concentrator: 'mylar_cone',
      greenhouseTop: 'acrylic',
      absorber: 'matte_black_copper',
      insulation: 'aerogel'
    };
    this.lastResult = null;
  }

  init() {
    this.bindEvents();
    this.generateNewScenario();
  }

  bindEvents() {
    const btnNew = document.getElementById('predBtnNewScenario');
    const btnRun = document.getElementById('predBtnRunTest');
    const predInput = document.getElementById('predInputTemp');

    if (btnNew) {
      btnNew.addEventListener('click', () => this.generateNewScenario());
    }

    if (btnRun) {
      btnRun.addEventListener('click', () => this.runPredictionTest());
    }

    if (predInput) {
      predInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.runPredictionTest();
      });
    }
  }

  generateNewScenario() {
    // Generate realistic competition parameters based on 2027 rules
    const heights = [40, 45, 50, 55, 60, 65];
    const wattages = [100, 110, 115, 120, 125];
    const durations = [10, 11, 12, 13, 14, 15]; // minutes

    const height = heights[Math.floor(Math.random() * heights.length)];
    const wattage = wattages[Math.floor(Math.random() * wattages.length)];
    const durationMin = durations[Math.floor(Math.random() * durations.length)];
    const roomTemp = parseFloat((19.5 + Math.random() * 3.5).toFixed(1));
    const startTemp = parseFloat((roomTemp + (Math.random() * 1.5 - 0.5)).toFixed(1));

    this.scenario = {
      heightCm: height,
      wattage: wattage,
      durationMinutes: durationMin,
      durationSec: durationMin * 60,
      roomTemp: roomTemp,
      startTemp: startTemp
    };

    // Update UI elements
    const elHeight = document.getElementById('scenHeight');
    const elWatt = document.getElementById('scenWattage');
    const elTime = document.getElementById('scenDuration');
    const elRoom = document.getElementById('scenRoomTemp');
    const elStart = document.getElementById('scenStartTemp');
    const elResultCard = document.getElementById('predResultCard');

    if (elHeight) elHeight.textContent = `${this.scenario.heightCm} cm`;
    if (elWatt) elWatt.textContent = `${this.scenario.wattage} W`;
    if (elTime) elTime.textContent = `${this.scenario.durationMinutes} min`;
    if (elRoom) elRoom.textContent = `${this.scenario.roomTemp.toFixed(1)}°C`;
    if (elStart) elStart.textContent = `${this.scenario.startTemp.toFixed(1)}°C`;
    if (elResultCard) elResultCard.style.display = 'none';

    const predInput = document.getElementById('predInputTemp');
    if (predInput) {
      predInput.value = '';
      predInput.focus();
    }
  }

  runPredictionTest() {
    const predInput = document.getElementById('predInputTemp');
    if (!predInput) return;

    const predicted = parseFloat(predInput.value);
    if (isNaN(predicted) || predicted < 15 || predicted > 95) {
      if (window.showToast) {
        window.showToast('Please enter a realistic predicted temperature between 15°C and 95°C', 'error');
      }
      return;
    }

    // Run numerical integration to find actual final temperature
    let currentTemp = this.scenario.startTemp;
    const dt = 1.0; // 1 second steps
    const steps = this.scenario.durationSec;
    const timePoints = [];

    for (let t = 0; t <= steps; t += dt) {
      const heat = computeCollectorHeatFlow(
        this.deviceConfig, 
        this.scenario.heightCm, 
        this.scenario.wattage, 
        currentTemp, 
        this.scenario.roomTemp
      );
      currentTemp += heat.rateOfTempChange * dt;
      if (t % 30 === 0 || t === steps) {
        timePoints.push({ time: t / 60, temp: currentTemp });
      }
    }

    const actualFinal = parseFloat(currentTemp.toFixed(1));
    const error = Math.abs(actualFinal - predicted);

    // Official scoring calculation
    const scores = calculateOfficialScores({
      finalTemp: actualFinal,
      startTemp: this.scenario.startTemp,
      highTG: 25.0,
      predTemp: predicted,
      highPE: 1.0,
      part1Score: 45,
      highPart1: 50
    });

    this.lastResult = {
      predicted,
      actualFinal,
      error,
      scores,
      timePoints
    };

    this.displayResults();
  }

  displayResults() {
    const res = this.lastResult;
    if (!res) return;

    const elResultCard = document.getElementById('predResultCard');
    const elActual = document.getElementById('resActualTemp');
    const elPred = document.getElementById('resPredictedTemp');
    const elError = document.getElementById('resError');
    const elPE = document.getElementById('resPE');
    const elPS = document.getElementById('resScorePS');
    const elBadge = document.getElementById('resBadge');
    const elAdvice = document.getElementById('resAdvice');

    if (elResultCard) elResultCard.style.display = 'block';
    if (elActual) elActual.textContent = `${res.actualFinal.toFixed(1)}°C`;
    if (elPred) elPred.textContent = `${res.predicted.toFixed(1)}°C`;
    if (elError) elError.textContent = `±${res.error.toFixed(2)}°C`;
    if (elPE) elPE.textContent = res.scores.predictionEstimate.toFixed(4);
    if (elPS) elPS.textContent = `${res.scores.predictionScore.toFixed(2)} / 20 pts`;

    // Badge allocation
    let badgeText = '';
    let badgeClass = '';
    let adviceText = '';

    if (res.error <= 0.3) {
      badgeText = '🥇 National Champion Forecaster';
      badgeClass = 'badge-gold';
      adviceText = 'Superb precision! Your model accounts almost perfectly for lamp inverse-square drop-off and greenhouse convective containment.';
    } else if (res.error <= 0.8) {
      badgeText = '🥈 State Medalist Accuracy';
      badgeClass = 'badge-silver';
      adviceText = 'Very solid prediction! In competition, this earns high PE points. Fine-tune your ambient temperature compensation.';
    } else if (res.error <= 1.5) {
      badgeText = '🥉 Regional Qualifier';
      badgeClass = 'badge-bronze';
      adviceText = 'Good estimate, but slight divergence. Remember that height follows an inverse-square relation: doubling height cuts radiant flux to 1/4!';
    } else {
      badgeText = '⚠️ Recalibration Required';
      badgeClass = 'badge-danger';
      adviceText = res.predicted > res.actualFinal
        ? 'Your prediction was too high. Notice that as water warms up, radiative and convective losses accelerate, causing the heating curve to level off!'
        : 'Your prediction was too low. Under a 100-125W heat lamp with a parabolic reflector, radiation flux is concentrated significantly into the 100 mL volume!';
    }

    if (elBadge) {
      elBadge.textContent = badgeText;
      elBadge.className = `badge-official ${badgeClass}`;
    }
    if (elAdvice) {
      elAdvice.textContent = adviceText;
    }

    // Record prediction result in authManager
    authManager.recordPredictionResult({
      error: res.error,
      pe: res.scores.predictionEstimate,
      ps: res.scores.predictionScore,
      badge: badgeText
    });

    // Scroll result into view
    elResultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
