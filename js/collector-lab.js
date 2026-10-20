/**
 * ThermoOlyMaster - Module 1: Virtual Heat Collector Lab
 * Simulates and visualizes heat collection under the official 100-125W heat lamp.
 */

import { stepSimulation, calculateOfficialScores } from './physics.js';
import { authManager } from './auth-manager.js';

export class CollectorLab {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    
    // Simulation state
    this.isRunning = false;
    this.timeElapsed = 0; // seconds
    this.simSpeed = 5; // 5x speed default
    this.targetDuration = 600; // 10 minutes default (600s)
    
    // Ambient & Initial Conditions
    this.T_amb = 21.0;
    this.T_start = 21.0;
    this.T_water = 21.0;

    // Rig controls
    this.wattage = 115;
    this.heightCm = 45;

    // Device layer config
    this.config = {
      concentrator: 'mylar_cone',
      greenhouseTop: 'acrylic',
      absorber: 'matte_black_copper',
      insulation: 'aerogel'
    };

    // Telemetry history for real-time charting
    this.history = [{ time: 0, temp: 21.0 }];

    // Photon animation particles
    this.photons = [];
    this.initPhotons();

    this.rafId = null;
    this.lastTimestamp = null;
  }

  init() {
    this.bindEvents();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    this.startRenderLoop();
  }

  initPhotons() {
    this.photons = [];
    for (let i = 0; i < 45; i++) {
      this.photons.push({
        x: Math.random(),
        y: Math.random(),
        speed: 0.008 + Math.random() * 0.012,
        opacity: 0.3 + Math.random() * 0.7,
        size: 2 + Math.random() * 3
      });
    }
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height || 480;
  }

  bindEvents() {
    // Sliders
    const heightSlider = document.getElementById('labHeightSlider');
    const heightVal = document.getElementById('labHeightValue');
    if (heightSlider && heightVal) {
      heightSlider.addEventListener('input', (e) => {
        this.heightCm = parseFloat(e.target.value);
        heightVal.textContent = `${this.heightCm} cm`;
      });
    }

    const wattSelect = document.getElementById('labWattSelect');
    if (wattSelect) {
      wattSelect.addEventListener('change', (e) => {
        this.wattage = parseFloat(e.target.value);
      });
    }

    const durationSelect = document.getElementById('labDurationSelect');
    if (durationSelect) {
      durationSelect.addEventListener('change', (e) => {
        this.targetDuration = parseFloat(e.target.value) * 60;
      });
    }

    // Config selects
    const concentratorSelect = document.getElementById('labConcentratorSelect');
    if (concentratorSelect) {
      concentratorSelect.addEventListener('change', (e) => {
        this.config.concentrator = e.target.value;
      });
    }

    const topSelect = document.getElementById('labTopSelect');
    if (topSelect) {
      topSelect.addEventListener('change', (e) => {
        this.config.greenhouseTop = e.target.value;
      });
    }

    const absorberSelect = document.getElementById('labAbsorberSelect');
    if (absorberSelect) {
      absorberSelect.addEventListener('change', (e) => {
        this.config.absorber = e.target.value;
      });
    }

    const insulationSelect = document.getElementById('labInsulationSelect');
    if (insulationSelect) {
      insulationSelect.addEventListener('change', (e) => {
        this.config.insulation = e.target.value;
      });
    }

    // Playback buttons
    const btnStart = document.getElementById('labBtnStart');
    const btnReset = document.getElementById('labBtnReset');
    const btnSpeed = document.getElementById('labBtnSpeed');

    if (btnStart) {
      btnStart.addEventListener('click', () => this.toggleRun());
    }
    if (btnReset) {
      btnReset.addEventListener('click', () => this.resetSim());
    }
    if (btnSpeed) {
      btnSpeed.addEventListener('click', () => {
        if (this.simSpeed === 1) this.simSpeed = 5;
        else if (this.simSpeed === 5) this.simSpeed = 15;
        else if (this.simSpeed === 15) this.simSpeed = 30;
        else this.simSpeed = 1;
        btnSpeed.textContent = `${this.simSpeed}× Speed`;
      });
    }
  }

  toggleRun() {
    this.isRunning = !this.isRunning;
    const btn = document.getElementById('labBtnStart');
    if (btn) {
      btn.innerHTML = this.isRunning 
        ? '<span class="icon">⏸</span> Pause Heating' 
        : '<span class="icon">🔥</span> Start Heat Lamp';
      btn.classList.toggle('btn-primary', !this.isRunning);
      btn.classList.toggle('btn-secondary', this.isRunning);
    }
  }

  resetSim() {
    this.isRunning = false;
    this.timeElapsed = 0;
    this.T_water = this.T_start;
    this.history = [{ time: 0, temp: this.T_water }];
    const btn = document.getElementById('labBtnStart');
    if (btn) {
      btn.innerHTML = '<span class="icon">🔥</span> Start Heat Lamp';
      btn.classList.add('btn-primary');
      btn.classList.remove('btn-secondary');
    }
    this.updateTelemetry(0);
  }

  updatePhysics(dt) {
    if (!this.isRunning) return;

    const simDt = dt * this.simSpeed;
    this.timeElapsed += simDt;

    // Advance simulation
    const result = stepSimulation(this.T_water, this.config, this.heightCm, this.wattage, this.T_amb, simDt);
    this.T_water = result.temperature;

    // Record telemetry periodically
    const lastRecord = this.history[this.history.length - 1];
    if (this.timeElapsed - lastRecord.time >= 5 || this.timeElapsed >= this.targetDuration) {
      this.history.push({ time: this.timeElapsed, temp: this.T_water });
    }

    this.updateTelemetry(result.heat.netPower);

    // Stop at heating duration
    if (this.timeElapsed >= this.targetDuration) {
      this.isRunning = false;
      const btn = document.getElementById('labBtnStart');
      if (btn) btn.innerHTML = '<span class="icon">✅</span> Heating Complete';

      // Log progress to student profile
      authManager.recordLabResult({
        tempGain: this.T_water - this.T_start,
        finalTemp: this.T_water,
        heightCm: this.heightCm,
        wattage: this.wattage
      });

      if (window.showToast) {
        window.showToast(`Heating finished! Final Water Temp: ${this.T_water.toFixed(1)}°C (Gain: +${(this.T_water - this.T_start).toFixed(1)}°C)`);
      }
    }
  }

  updateTelemetry(netWatts) {
    const tg = Math.max(0, this.T_water - this.T_start);
    const tsScores = calculateOfficialScores({
      finalTemp: this.T_water,
      startTemp: this.T_start,
      highTG: 25.0
    });

    const elTemp = document.getElementById('labCurrentTemp');
    const elGain = document.getElementById('labTempGain');
    const elScore = document.getElementById('labScoreTS');
    const elPower = document.getElementById('labNetPower');
    const elTimer = document.getElementById('labTimer');

    if (elTemp) elTemp.textContent = `${this.T_water.toFixed(1)}°C`;
    if (elGain) elGain.textContent = `+${tg.toFixed(1)}°C`;
    if (elScore) elScore.textContent = `${tsScores.tempScore.toFixed(1)} / 30`;
    if (elPower) elPower.textContent = `${netWatts > 0 ? '+' : ''}${netWatts.toFixed(1)} W`;
    
    if (elTimer) {
      const mins = Math.floor(this.timeElapsed / 60);
      const secs = Math.floor(this.timeElapsed % 60);
      elTimer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }

  startRenderLoop() {
    const loop = (timestamp) => {
      if (!this.lastTimestamp) this.lastTimestamp = timestamp;
      const dt = Math.min(0.1, (timestamp - this.lastTimestamp) / 1000);
      this.lastTimestamp = timestamp;

      this.updatePhysics(dt);
      this.render();

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Draw Testing Surface (Table)
    const tableY = h - 65;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, tableY, w, 65);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, tableY);
    ctx.lineTo(w, tableY);
    ctx.stroke();

    // 2. Center position of test rig
    const centerX = w * 0.42;

    // 3. Draw 30x30 cm Bounding Box (Scale: 1 cm = ~4.5px)
    const pxPerCm = 4.2;
    const boxSizePx = 30 * pxPerCm;
    const boxLeft = centerX - (boxSizePx / 2);
    const boxTop = tableY - boxSizePx;

    ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(boxLeft, boxTop, boxSizePx, boxSizePx);
    ctx.setLineDash([]);

    // Bounding Box Label
    ctx.fillStyle = 'rgba(0, 229, 255, 0.6)';
    ctx.font = '10px Fira Code';
    ctx.fillText('30.0 × 30.0 cm Cube Boundary', boxLeft + 6, boxTop + 14);

    // 4. Draw Lamp Rig at Height h
    const lampHeightPx = this.heightCm * pxPerCm;
    const lampY = Math.max(35, tableY - lampHeightPx);

    // Stand rod
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(centerX - 120, tableY);
    ctx.lineTo(centerX - 120, lampY - 10);
    ctx.lineTo(centerX, lampY - 10);
    ctx.stroke();

    // Lamp Reflector Dome
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.ellipse(centerX, lampY - 8, 48, 22, 0, Math.PI, 0, true);
    ctx.fill();

    // Bulb
    const bulbGlow = this.isRunning ? 1 : 0.2;
    ctx.fillStyle = this.isRunning ? '#ff9100' : '#475569';
    ctx.beginPath();
    ctx.arc(centerX, lampY + 6, 14, 0, Math.PI * 2);
    ctx.fill();

    if (this.isRunning) {
      // Bulb Intense Glow Radial
      const glowGrad = ctx.createRadialGradient(centerX, lampY + 6, 4, centerX, lampY + 6, 55);
      glowGrad.addColorStop(0, 'rgba(255, 235, 59, 0.9)');
      glowGrad.addColorStop(0.4, 'rgba(255, 87, 34, 0.5)');
      glowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(centerX, lampY + 6, 55, 0, Math.PI * 2);
      ctx.fill();
    }

    // Height annotation line
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX + 85, lampY + 6);
    ctx.lineTo(centerX + 85, tableY);
    ctx.stroke();
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '11px Fira Code';
    ctx.fillText(`h = ${this.heightCm} cm`, centerX + 92, (lampY + tableY) / 2);

    // 5. Draw Photons radiating from lamp
    if (this.isRunning) {
      ctx.save();
      for (const p of this.photons) {
        p.y += p.speed * (this.simSpeed > 5 ? 2 : 1);
        if (p.y > 1) p.y = 0;

        const py = lampY + 15 + p.y * (tableY - lampY - 15);
        const spread = (p.y * 70) * (p.x - 0.5);
        const px = centerX + spread;

        ctx.fillStyle = `rgba(255, 145, 0, ${p.opacity * bulbGlow})`;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 6. Draw Device Base & Insulation
    const cupW = 48;
    const cupH = 68;
    const cupX = centerX - (cupW / 2);
    const cupY = tableY - cupH - 12; // elevated by base insulation

    // Base Insulation block
    let baseColor = '#cbd5e1';
    if (this.config.insulation === 'aerogel') baseColor = '#38bdf8';
    else if (this.config.insulation === 'xps_foam') baseColor = '#f472b6'; // pink board
    else if (this.config.insulation === 'bubble_wrap') baseColor = '#94a3b8';
    else if (this.config.insulation === 'wood') baseColor = '#b45309';

    ctx.fillStyle = baseColor;
    ctx.fillRect(centerX - 55, tableY - 12, 110, 12);
    ctx.strokeStyle = '#0f172a';
    ctx.strokeRect(centerX - 55, tableY - 12, 110, 12);

    // 7. Draw Concentrator Cone (if active)
    if (this.config.concentrator !== 'none') {
      const topConeW = this.config.concentrator === 'mylar_cone' ? 120 : 95;
      const topConeY = cupY - 32;

      ctx.fillStyle = this.config.concentrator === 'mylar_cone' 
        ? 'rgba(224, 242, 254, 0.45)' 
        : 'rgba(148, 163, 184, 0.35)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(centerX - (topConeW / 2), topConeY);
      ctx.lineTo(centerX + (topConeW / 2), topConeY);
      ctx.lineTo(centerX + (cupW / 2) + 6, cupY);
      ctx.lineTo(centerX - (cupW / 2) - 6, cupY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 8. Draw Absorber Sleeve around Cup
    if (this.config.absorber !== 'none') {
      let sleeveColor = '#0f172a';
      if (this.config.absorber === 'matte_black_copper') sleeveColor = '#18181b';
      else if (this.config.absorber === 'dark_plastic') sleeveColor = '#27272a';
      
      ctx.fillStyle = sleeveColor;
      ctx.fillRect(cupX - 4, cupY - 2, cupW + 8, cupH + 4);
      ctx.strokeStyle = '#ff5722';
      ctx.lineWidth = 1;
      ctx.strokeRect(cupX - 4, cupY - 2, cupW + 8, cupH + 4);
    }

    // 9. Draw 9 oz Plastic Cup (Tapered)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cupX, cupY);
    ctx.lineTo(cupX + cupW, cupY);
    ctx.lineTo(cupX + cupW - 6, cupY + cupH);
    ctx.lineTo(cupX + 6, cupY + cupH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 10. Draw Water in Cup with dynamic thermal color
    // Calculate thermal hue: 20°C (cool blue ~ 195) to 60°C (hot red ~ 0)
    const normTemp = Math.min(1, Math.max(0, (this.T_water - 20) / 40));
    const hue = Math.floor(195 - (normTemp * 195));
    const waterColor = `hsla(${hue}, 90%, 50%, 0.75)`;

    const waterH = cupH * 0.75; // 100 mL filling ~75% of cup
    const waterY = cupY + (cupH - waterH);

    ctx.fillStyle = waterColor;
    ctx.beginPath();
    ctx.moveTo(cupX + 4, waterY);
    ctx.lineTo(cupX + cupW - 4, waterY);
    ctx.lineTo(cupX + cupW - 6, cupY + cupH);
    ctx.lineTo(cupX + 6, cupY + cupH);
    ctx.closePath();
    ctx.fill();

    // Water level top ellipse
    ctx.beginPath();
    ctx.ellipse(centerX, waterY, (cupW - 8) / 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 11. Draw Greenhouse Window Top (if active)
    if (this.config.greenhouseTop !== 'none') {
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.8)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cupX - 6, cupY - 2);
      ctx.lineTo(cupX + cupW + 6, cupY - 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(0, 229, 255, 0.7)';
      ctx.font = '9px Fira Code';
      ctx.fillText('Trap Lid', cupX - 4, cupY - 6);
    }

    // 12. Draw Live Mini Graph (Right Panel)
    this.renderMiniGraph(ctx, w * 0.65, 40, w * 0.32, h - 120);
  }

  renderMiniGraph(ctx, gx, gy, gw, gh) {
    ctx.save();
    // Background panel
    ctx.fillStyle = 'rgba(10, 16, 30, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeRect(gx, gy, gw, gh);

    // Title
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 11px Outfit';
    ctx.fillText('LIVE WATER HEATING CURVE (°C vs Min)', gx + 12, gy + 22);

    const pad = 35;
    const plotX = gx + pad;
    const plotY = gy + 35;
    const plotW = gw - pad - 15;
    const plotH = gh - 55;

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = plotY + (plotH * (i / 4));
      ctx.beginPath();
      ctx.moveTo(plotX, y);
      ctx.lineTo(plotX + plotW, y);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(plotX, plotY);
    ctx.lineTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.stroke();

    // Data points plot
    if (this.history.length > 1) {
      const maxTime = Math.max(600, this.targetDuration);
      const minTemp = 20;
      const maxTemp = 50;

      ctx.strokeStyle = '#ff5722';
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      for (let i = 0; i < this.history.length; i++) {
        const pt = this.history[i];
        const px = plotX + (pt.time / maxTime) * plotW;
        const normY = Math.min(1, Math.max(0, (pt.temp - minTemp) / (maxTemp - minTemp)));
        const py = plotY + plotH - (normY * plotH);

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Current point dot
      const latest = this.history[this.history.length - 1];
      const curX = plotX + (latest.time / maxTime) * plotW;
      const curNormY = Math.min(1, Math.max(0, (latest.temp - minTemp) / (maxTemp - minTemp)));
      const curY = plotY + plotH - (curNormY * plotH);

      ctx.fillStyle = '#ff9100';
      ctx.beginPath();
      ctx.arc(curX, curY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
