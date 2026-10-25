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
    this.T_sleeve = 21.0;
    this.T_probe = 21.0;
    this.condensation = 0.0;
    this.probeDepth = 'mid'; // 'surface' | 'mid' | 'bottom'
    this.draftVelocity = 0.15; // m/s
    this.viewMode = 'visible'; // 'visible' | 'thermal'
    this.lastHeat = null;

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
    this.history = [{ time: 0, temp: 21.0, waterTemp: 21.0, sleeveTemp: 21.0 }];

    // Specular ray optical tracing
    this.opticalRays = [];
    this.initOpticalRays();

    // Photon animation particles (classic mode fallback)
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

  initOpticalRays() {
    this.opticalRays = [];
    const count = 38;
    for (let i = 0; i < count; i++) {
      const frac = (i / (count - 1)) - 0.5; // -0.5 to +0.5
      const angle = frac * (Math.PI * 0.32); // -28.8 deg to +28.8 deg
      this.opticalRays.push({
        angle,
        pulseOffset: Math.random(),
        speed: 0.28 + Math.random() * 0.22,
        color: i % 3 === 0 ? 'rgba(255, 235, 59, 0.85)' : 'rgba(255, 145, 0, 0.75)'
      });
    }
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

  getThermalColor(tempC, alpha = 1.0) {
    const t = Math.max(18, Math.min(80, tempC));
    const norm = (t - 18) / (75 - 18);
    let r, g, b;

    if (norm < 0.20) {
      const f = norm / 0.20;
      r = Math.round(15 + f * 35);
      g = Math.round(8 + f * 7);
      b = Math.round(45 + f * 65);
    } else if (norm < 0.45) {
      const f = (norm - 0.20) / 0.25;
      r = Math.round(50 + f * 120);
      g = Math.round(15 + f * 5);
      b = Math.round(110 + f * 20);
    } else if (norm < 0.70) {
      const f = (norm - 0.45) / 0.25;
      r = Math.round(170 + f * 65);
      g = Math.round(20 + f * 70);
      b = Math.round(130 - f * 110);
    } else if (norm < 0.90) {
      const f = (norm - 0.70) / 0.20;
      r = Math.round(235 + f * 20);
      g = Math.round(90 + f * 115);
      b = Math.round(20 + f * 10);
    } else {
      const f = (norm - 0.90) / 0.10;
      r = 255;
      g = Math.round(205 + f * 50);
      b = Math.round(30 + f * 200);
    }

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  drawCalloutBadge(ctx, text, badgeX, badgeY, targetX, targetY, options = {}) {
    ctx.save();
    const scale = options.scale || 1.0;
    const fontSize = options.fontSize || Math.round(10.5 * scale);
    ctx.font = `600 ${fontSize}px Fira Code, Outfit, monospace`;

    const metrics = ctx.measureText(text);
    const textW = metrics.width;
    const padX = Math.round(7 * scale);
    const padY = Math.round(3.5 * scale);
    const badgeH = Math.round(fontSize + padY * 2);
    const badgeW = Math.round(textW + padX * 2);
    const radius = Math.round(4 * scale);

    let rx = badgeX;
    if (options.align === 'right') {
      rx = badgeX - badgeW;
    } else if (options.align === 'center') {
      rx = badgeX - (badgeW / 2);
    }
    const ry = Math.round(badgeY - (badgeH / 2));

    // Draw leader line if target point provided
    if (targetX !== undefined && targetY !== undefined) {
      ctx.strokeStyle = options.leaderColor || options.borderColor || 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = options.lineWidth || 1.2;
      ctx.setLineDash(options.lineDash !== undefined ? options.lineDash : [3, 3]);

      // Connect target to nearest edge of badge
      let anchorX = rx;
      if (targetX > rx + badgeW) {
        anchorX = rx + badgeW;
      } else if (targetX < rx) {
        anchorX = rx;
      } else {
        anchorX = rx + badgeW / 2;
      }
      const anchorY = badgeY;

      ctx.beginPath();
      ctx.moveTo(targetX, targetY);

      if (Math.abs(targetX - anchorX) > 12 * scale) {
        const midX = (targetX + anchorX) / 2;
        ctx.lineTo(midX, targetY);
        ctx.lineTo(midX, anchorY);
      }
      ctx.lineTo(anchorX, anchorY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Target anchor dot
      if (options.dot !== false) {
        ctx.fillStyle = options.dotColor || options.borderColor || '#38bdf8';
        ctx.beginPath();
        ctx.arc(targetX, targetY, Math.max(2, Math.round(2.5 * scale)), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Badge pill container
    ctx.fillStyle = options.bg || 'rgba(10, 16, 30, 0.92)';
    ctx.strokeStyle = options.borderColor || 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = options.borderWidth || 1.2;

    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(rx, ry, badgeW, badgeH, radius);
    } else {
      ctx.rect(rx, ry, badgeW, badgeH);
    }
    ctx.fill();
    ctx.stroke();

    // Badge text
    ctx.fillStyle = options.textColor || '#e2e8f0';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(text, rx + padX, badgeY);

    ctx.restore();
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height || 650;
  }

  bindEvents() {
    // Viewport Size Toggle (Expand / Fullscreen)
    const btnToggleSize = document.getElementById('btnToggleCollectorSize');
    const viewport = document.getElementById('collectorViewport');
    const lblSize = document.getElementById('lblCollectorSize');
    const iconSize = document.getElementById('iconCollectorSize');

    if (btnToggleSize && viewport) {
      btnToggleSize.addEventListener('click', () => {
        const isExpanded = viewport.classList.toggle('expanded');
        if (lblSize) lblSize.textContent = isExpanded ? 'Exit Full Screen' : 'Full Screen';
        if (iconSize) iconSize.textContent = isExpanded ? '✕' : '⛶';
        setTimeout(() => this.resizeCanvas(), 60);
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && viewport.classList.contains('expanded')) {
          viewport.classList.remove('expanded');
          if (lblSize) lblSize.textContent = 'Full Screen';
          if (iconSize) iconSize.textContent = '⛶';
          setTimeout(() => this.resizeCanvas(), 60);
        }
      });
    }

    // View Mode Toggle (Visible Light vs FLIR Infrared)
    const btnToggleView = document.getElementById('btnToggleCollectorViewMode');
    const iconView = document.getElementById('iconCollectorViewMode');
    const lblView = document.getElementById('lblCollectorViewMode');
    if (btnToggleView) {
      btnToggleView.addEventListener('click', () => {
        this.viewMode = this.viewMode === 'visible' ? 'thermal' : 'visible';
        if (lblView) lblView.textContent = this.viewMode === 'visible' ? 'FLIR Infrared' : 'Visible Light';
        if (iconView) iconView.textContent = this.viewMode === 'visible' ? '🌡️' : '👁️';
        if (window.showToast) {
          window.showToast(
            this.viewMode === 'thermal' 
              ? 'FLIR Infrared Thermography Active: Visualizing thermal gradients & surface radiation.' 
              : 'Visible Light Mode Active: Natural spectrum view.',
            'info'
          );
        }
      });
    }

    // Probe Immersion Depth Select (Rule 5.b)
    const probeDepthSelect = document.getElementById('labProbeDepthSelect');
    if (probeDepthSelect) {
      probeDepthSelect.addEventListener('change', (e) => {
        this.probeDepth = e.target.value;
        if (window.showToast) {
          const depthLabel = e.target.options[e.target.selectedIndex].text;
          window.showToast(`Thermometer positioned at: ${depthLabel}`, 'info');
        }
      });
    }

    // Air Draft Slider
    const draftSlider = document.getElementById('labDraftSlider');
    const draftVal = document.getElementById('labDraftValue');
    if (draftSlider && draftVal) {
      draftSlider.addEventListener('input', (e) => {
        this.draftVelocity = parseFloat(e.target.value);
        draftVal.textContent = `${this.draftVelocity.toFixed(2)} m/s`;
      });
    }

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
    this.T_sleeve = this.T_start;
    this.T_probe = this.T_start;
    this.condensation = 0.0;
    this.lastHeat = null;
    this.history = [{ time: 0, temp: this.T_start, waterTemp: this.T_start, sleeveTemp: this.T_start }];
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

    // Advance simulation with multi-body thermal mass, wall conduction, evaporative loss, and sensor lag
    const result = stepSimulation(
      {
        T_water: this.T_water,
        T_sleeve: this.T_sleeve,
        T_probe: this.T_probe,
        condensation: this.condensation
      },
      this.config,
      this.heightCm,
      this.wattage,
      this.T_amb,
      simDt,
      this.timeElapsed,
      {
        probeDepth: this.probeDepth,
        draftVelocity: this.draftVelocity
      }
    );

    this.T_water = result.T_water;
    this.T_sleeve = result.T_sleeve;
    this.T_probe = result.T_probe;
    this.condensation = result.condensation;
    this.lastHeat = result.heat;

    // Record telemetry periodically (every 5s or at end)
    const lastRecord = this.history[this.history.length - 1];
    if (this.timeElapsed - lastRecord.time >= 5 || this.timeElapsed >= this.targetDuration) {
      this.history.push({ 
        time: this.timeElapsed, 
        temp: this.T_probe,
        waterTemp: this.T_water,
        sleeveTemp: this.T_sleeve
      });
    }

    this.updateTelemetry(result.heat.netPower);

    // Stop at heating duration
    if (this.timeElapsed >= this.targetDuration) {
      this.isRunning = false;
      const btn = document.getElementById('labBtnStart');
      if (btn) btn.innerHTML = '<span class="icon">✅</span> Heating Complete';

      // Log progress to student profile using probed temperature
      authManager.recordLabResult({
        tempGain: this.T_probe - this.T_start,
        finalTemp: this.T_probe,
        heightCm: this.heightCm,
        wattage: this.wattage
      });

      if (window.showToast) {
        window.showToast(`Heating finished! Probed Temp: ${this.T_probe.toFixed(1)}°C (Gain: +${(this.T_probe - this.T_start).toFixed(1)}°C)`);
      }
    }
  }

  updateTelemetry(netWatts) {
    const tg = Math.max(0, this.T_probe - this.T_start);
    const tsScores = calculateOfficialScores({
      finalTemp: this.T_probe,
      startTemp: this.T_start,
      highTG: 25.0
    });

    const elTemp = document.getElementById('labCurrentTemp');
    const elGain = document.getElementById('labTempGain');
    const elScore = document.getElementById('labScoreTS');
    const elPower = document.getElementById('labNetPower');
    const elTimer = document.getElementById('labTimer');
    const elProbeOverlay = document.getElementById('labProbeTempOverlay');
    const elSleeveTemp = document.getElementById('labSleeveTemp');
    const elEvapLoss = document.getElementById('labEvapLoss');

    if (elTemp) elTemp.textContent = `${this.T_probe.toFixed(1)}°C`;
    if (elProbeOverlay) elProbeOverlay.textContent = `${this.T_probe.toFixed(1)}°C`;
    if (elGain) elGain.textContent = `+${tg.toFixed(1)}°C`;
    if (elScore) elScore.textContent = `${tsScores.tempScore.toFixed(1)} / 30`;
    if (elPower) elPower.textContent = `${netWatts > 0 ? '+' : ''}${netWatts.toFixed(1)} W`;
    if (elSleeveTemp) elSleeveTemp.textContent = `${this.T_sleeve.toFixed(1)}°C`;
    if (elEvapLoss && this.lastHeat) elEvapLoss.textContent = `${this.lastHeat.evaporationLoss.toFixed(1)} W`;

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
    const isThermal = this.viewMode === 'thermal';

    // Responsive scaling based on canvas height (baseline 480px, up to 1.8x)
    const scale = Math.max(1.0, Math.min(1.8, h / 480));

    // Clear canvas
    if (isThermal) {
      ctx.fillStyle = '#050714';
      ctx.fillRect(0, 0, w, h);

      // Subtle FLIR thermal background grid
      ctx.strokeStyle = 'rgba(76, 29, 149, 0.18)';
      ctx.lineWidth = 1;
      const gridSize = Math.round(36 * scale);
      for (let gx = 0; gx < w; gx += gridSize) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }
    } else {
      ctx.clearRect(0, 0, w, h);
    }

    // 1. Draw Testing Surface (Table)
    const tableH = Math.round(70 * scale);
    const tableY = h - tableH;
    ctx.fillStyle = isThermal ? this.getThermalColor(this.T_amb, 0.85) : '#0f172a';
    ctx.fillRect(0, tableY, w, tableH);
    ctx.strokeStyle = isThermal ? 'rgba(147, 51, 234, 0.4)' : '#334155';
    ctx.lineWidth = Math.round(2.5 * scale);
    ctx.beginPath();
    ctx.moveTo(0, tableY);
    ctx.lineTo(w, tableY);
    ctx.stroke();

    // 2. Center position of test rig
    const centerX = Math.min(w * 0.36, 440 * scale);

    // 3. Testing Dimensions & Scale Setup
    const pxPerCm = 4.2 * scale;
    const boxSizePx = 30 * pxPerCm;
    const boxLeft = centerX - (boxSizePx / 2);
    const boxTop = tableY - boxSizePx;

    // Draw 30x30 cm Bounding Box (Rule 3.a)
    ctx.strokeStyle = isThermal ? 'rgba(168, 85, 247, 0.35)' : 'rgba(0, 229, 255, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(boxLeft, boxTop, boxSizePx, boxSizePx);
    ctx.setLineDash([]);

    // 4. Draw Lamp Rig at Height h
    const lampHeightPx = this.heightCm * pxPerCm;
    const lampY = Math.max(Math.round(36 * scale), tableY - lampHeightPx);
    const standX = centerX - (135 * scale);

    // Retort Stand (Base + Rod + Clamp Arm)
    ctx.strokeStyle = isThermal ? this.getThermalColor(this.T_amb + 1, 0.75) : '#475569';
    ctx.lineWidth = Math.round(5.5 * scale);
    ctx.beginPath();
    // Heavy Stand Base Plate
    ctx.moveTo(standX - (20 * scale), tableY);
    ctx.lineTo(standX + (20 * scale), tableY);
    // Vertical Rod
    ctx.moveTo(standX, tableY);
    ctx.lineTo(standX, lampY - (12 * scale));
    // Horizontal Arm
    ctx.lineTo(centerX, lampY - (12 * scale));
    ctx.stroke();

    // Lamp Reflector Dome
    ctx.fillStyle = isThermal ? this.getThermalColor(this.isRunning ? 72 : this.T_amb, 0.95) : '#64748b';
    ctx.beginPath();
    ctx.ellipse(centerX, lampY - (10 * scale), 58 * scale, 25 * scale, 0, Math.PI, 0, true);
    ctx.fill();

    // Bulb
    ctx.fillStyle = isThermal 
      ? (this.isRunning ? this.getThermalColor(80, 1.0) : this.getThermalColor(this.T_amb, 0.8))
      : (this.isRunning ? '#ff9100' : '#475569');
    ctx.beginPath();
    ctx.arc(centerX, lampY + (8 * scale), 16 * scale, 0, Math.PI * 2);
    ctx.fill();

    if (this.isRunning) {
      // Bulb Intense Radial Glow
      const glowGrad = ctx.createRadialGradient(
        centerX, lampY + (8 * scale), 5 * scale,
        centerX, lampY + (8 * scale), 75 * scale
      );
      if (isThermal) {
        glowGrad.addColorStop(0, 'rgba(255, 255, 240, 0.95)');
        glowGrad.addColorStop(0.35, 'rgba(249, 115, 22, 0.55)');
        glowGrad.addColorStop(1, 'transparent');
      } else {
        glowGrad.addColorStop(0, 'rgba(255, 235, 59, 0.95)');
        glowGrad.addColorStop(0.35, 'rgba(255, 87, 34, 0.6)');
        glowGrad.addColorStop(1, 'transparent');
      }
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(centerX, lampY + (8 * scale), 75 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Geometry of Thermal Enclosure & Apparatus
    const baseH = Math.round(22 * scale);
    const chamberW = Math.round(116 * scale);
    const insulWallW = Math.round(22 * scale);
    const chamberLeft = centerX - (chamberW / 2);
    const chamberRight = centerX + (chamberW / 2);
    const chamberBaseY = tableY - baseH;
    const cavityLeft = chamberLeft + insulWallW;
    const cavityRight = chamberRight - insulWallW;

    const cupH = Math.round(84 * scale);
    const cupW = Math.round(58 * scale);
    const cupX = centerX - (cupW / 2);
    const cupY = chamberBaseY - cupH;

    const hasCone = this.config.concentrator !== 'none';
    const topConeW = (this.config.concentrator === 'mylar_cone' ? 148 : 122) * scale;
    const topConeY = cupY - (40 * scale);

    // Specular Ray Optics & Photons radiating from lamp
    if (this.isRunning) {
      ctx.save();
      const filamentY = lampY + (8 * scale);

      for (const ray of this.opticalRays) {
        ray.pulseOffset = (ray.pulseOffset + ray.speed * 0.03) % 1.0;

        const maxDist = tableY - filamentY;
        const targetX = centerX + Math.tan(ray.angle) * maxDist;

        // Check if ray intercepts cone left or right wall
        let hitPoint = null;
        let reflectedTarget = null;

        if (hasCone && topConeY > filamentY) {
          const leftXAtConeTop = centerX - (topConeW / 2);
          if (ray.angle < 0) {
            const rayXAtConeTop = centerX + Math.tan(ray.angle) * (topConeY - filamentY);
            if (rayXAtConeTop <= leftXAtConeTop + 15 * scale) {
              hitPoint = { x: leftXAtConeTop + (5 * scale), y: topConeY + (14 * scale) };
              reflectedTarget = { x: centerX - (cupW * 0.25), y: cupY + (cupH * 0.3) };
            }
          } else if (ray.angle > 0) {
            const rightXAtConeTop = centerX + (topConeW / 2);
            const rayXAtConeTop = centerX + Math.tan(ray.angle) * (topConeY - filamentY);
            if (rayXAtConeTop >= rightXAtConeTop - 15 * scale) {
              hitPoint = { x: rightXAtConeTop - (5 * scale), y: topConeY + (14 * scale) };
              reflectedTarget = { x: centerX + (cupW * 0.25), y: cupY + (cupH * 0.3) };
            }
          }
        }

        // Draw Ray Line
        ctx.strokeStyle = isThermal 
          ? 'rgba(251, 146, 60, 0.16)' 
          : 'rgba(255, 145, 0, 0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX, filamentY);

        if (hitPoint && reflectedTarget) {
          ctx.lineTo(hitPoint.x, hitPoint.y);
          ctx.lineTo(reflectedTarget.x, reflectedTarget.y);
          ctx.stroke();

          // Traveling photon pulse along specular reflection path
          const p = ray.pulseOffset;
          let px, py;
          if (p < 0.5) {
            const t = p / 0.5;
            px = centerX + (hitPoint.x - centerX) * t;
            py = filamentY + (hitPoint.y - filamentY) * t;
          } else {
            const t = (p - 0.5) / 0.5;
            px = hitPoint.x + (reflectedTarget.x - hitPoint.x) * t;
            py = hitPoint.y + (reflectedTarget.y - hitPoint.y) * t;
          }
          ctx.fillStyle = isThermal ? 'rgba(254, 240, 138, 0.85)' : ray.color;
          ctx.beginPath();
          ctx.arc(px, py, 2.5 * scale, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Direct ray
          const endY = Math.min(tableY, cupY + 10 * scale);
          const endX = centerX + Math.tan(ray.angle) * (endY - filamentY);
          ctx.lineTo(endX, endY);
          ctx.stroke();

          const px = centerX + (endX - centerX) * ray.pulseOffset;
          const py = filamentY + (endY - filamentY) * ray.pulseOffset;
          ctx.fillStyle = isThermal ? 'rgba(254, 240, 138, 0.85)' : ray.color;
          ctx.beginPath();
          ctx.arc(px, py, 2.2 * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // 6. Draw Complete Thermal Insulation Chamber (Base Slab + Enclosing Left/Right Side Walls)
    let insulName = 'Silica Aerogel';
    let insulR = 'R-1.20';
    let insulFill = 'rgba(56, 189, 248, 0.42)';
    let insulBorder = '#0ea5e9';
    let insulBadgeBorder = 'rgba(56, 189, 248, 0.85)';

    if (this.config.insulation === 'xps_foam') {
      insulName = 'XPS Rigid Foam';
      insulR = 'R-0.85';
      insulFill = '#f472b6';
      insulBorder = '#db2777';
      insulBadgeBorder = 'rgba(244, 114, 182, 0.85)';
    } else if (this.config.insulation === 'bubble_wrap') {
      insulName = 'Foil Bubble Wrap';
      insulR = 'R-0.35';
      insulFill = '#64748b';
      insulBorder = '#94a3b8';
      insulBadgeBorder = 'rgba(148, 163, 184, 0.85)';
    } else if (this.config.insulation === 'wood') {
      insulName = 'Wood Platform';
      insulR = 'R-0.08';
      insulFill = '#b45309';
      insulBorder = '#78350f';
      insulBadgeBorder = 'rgba(217, 119, 6, 0.85)';
    }

    ctx.save();
    // Continuous U-shaped insulation jacket path
    ctx.beginPath();
    ctx.moveTo(chamberLeft, cupY);
    ctx.lineTo(chamberLeft, tableY);
    ctx.lineTo(chamberRight, tableY);
    ctx.lineTo(chamberRight, cupY);
    ctx.lineTo(cavityRight, cupY);
    ctx.lineTo(cavityRight, chamberBaseY);
    ctx.lineTo(cavityLeft, chamberBaseY);
    ctx.lineTo(cavityLeft, cupY);
    ctx.closePath();

    if (isThermal) {
      // In thermal mode, show Fourier conduction temperature drop across wall thickness
      const tInner = this.isRunning ? this.T_sleeve : this.T_amb;
      const tOuter = this.T_amb + 1.2;
      const uGrad = ctx.createLinearGradient(chamberLeft, cupY, chamberRight, cupY);
      uGrad.addColorStop(0, this.getThermalColor(tOuter, 0.88));
      uGrad.addColorStop(0.20, this.getThermalColor(tInner, 0.95));
      uGrad.addColorStop(0.50, this.getThermalColor(tInner, 0.95));
      uGrad.addColorStop(0.80, this.getThermalColor(tInner, 0.95));
      uGrad.addColorStop(1, this.getThermalColor(tOuter, 0.88));
      ctx.fillStyle = uGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = insulFill;
      ctx.fill();
      ctx.strokeStyle = insulBorder;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Render physical material textures inside insulation chamber
      ctx.save();
      ctx.clip();

      if (this.config.insulation === 'aerogel') {
        // Subtle translucent nanopore stippling
        ctx.fillStyle = 'rgba(224, 242, 254, 0.6)';
        for (let di = 0; di < 36; di++) {
          const px = chamberLeft + ((di * 37) % chamberW);
          const py = cupY + ((di * 23) % (cupH + baseH));
          ctx.beginPath();
          ctx.arc(px, py, 1.2 * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (this.config.insulation === 'xps_foam') {
        // 45° cross-hatch lines
        ctx.strokeStyle = 'rgba(219, 39, 119, 0.35)';
        ctx.lineWidth = 1;
        const spacing = Math.round(8 * scale);
        for (let x = chamberLeft - (cupH + baseH); x < chamberRight + (cupH + baseH); x += spacing) {
          ctx.beginPath();
          ctx.moveTo(x, cupY);
          ctx.lineTo(x + cupH + baseH, cupY + cupH + baseH);
          ctx.stroke();
        }
      } else if (this.config.insulation === 'bubble_wrap') {
        // Circular bubble cells
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
        ctx.lineWidth = 1;
        const bRad = 3.2 * scale;
        const bStep = 8.5 * scale;
        for (let bx = chamberLeft + bStep / 2; bx < chamberRight; bx += bStep) {
          for (let by = cupY + bStep / 2; by < tableY; by += bStep) {
            ctx.beginPath();
            ctx.arc(bx, by, bRad, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      } else if (this.config.insulation === 'wood') {
        // Wood grain lines
        ctx.strokeStyle = 'rgba(120, 53, 15, 0.4)';
        ctx.lineWidth = 1.2;
        const gStep = 7 * scale;
        for (let gy = cupY + gStep; gy < tableY; gy += gStep) {
          ctx.beginPath();
          ctx.moveTo(chamberLeft, gy);
          ctx.bezierCurveTo(
            chamberLeft + chamberW * 0.3, gy - 2 * scale,
            chamberLeft + chamberW * 0.7, gy + 2 * scale,
            chamberRight, gy
          );
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    ctx.restore();

    // 7. Draw Absorber Sleeve around Cup (inside central cavity)
    if (this.config.absorber !== 'none') {
      const sleeveW = cupW + (6 * scale);
      const sleeveH = cupH + (2 * scale);
      const sleeveX = centerX - (sleeveW / 2);
      const sleeveY = cupY - (1 * scale);

      let sleeveColor = '#18181b';
      if (this.config.absorber === 'dark_plastic') sleeveColor = '#27272a';
      else if (this.config.absorber === 'matte_black_foil') sleeveColor = '#1e293b';

      ctx.fillStyle = isThermal ? this.getThermalColor(this.T_sleeve, 1.0) : sleeveColor;
      ctx.fillRect(sleeveX, sleeveY, sleeveW, sleeveH);
      ctx.strokeStyle = isThermal ? '#ffffff' : '#ff5722';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sleeveX, sleeveY, sleeveW, sleeveH);
    }

    // 8. Draw 9 oz Plastic Cup (Tapered) & 100 mL Water
    const cupTopW = cupW;
    const cupBotW = cupW - (12 * scale);
    const cupTopLeft = centerX - (cupTopW / 2);
    const cupTopRight = centerX + (cupTopW / 2);
    const cupBotLeft = centerX - (cupBotW / 2);
    const cupBotRight = centerX + (cupBotW / 2);

    // Frosted Cup Body
    ctx.fillStyle = isThermal ? this.getThermalColor(this.T_water, 0.3) : 'rgba(255, 255, 255, 0.15)';
    ctx.strokeStyle = isThermal ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cupTopLeft, cupY);
    ctx.lineTo(cupTopRight, cupY);
    ctx.lineTo(cupBotRight, chamberBaseY);
    ctx.lineTo(cupBotLeft, chamberBaseY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 100 mL Water in Cup with dynamic stratification gradient
    const waterH = cupH * 0.72;
    const waterY = cupY + (cupH - waterH);
    const waterTopW = cupTopW - ((cupTopW - cupBotW) * ((cupH - waterH) / cupH)) - (4 * scale);
    const waterTopLeft = centerX - (waterTopW / 2);
    const waterTopRight = centerX + (waterTopW / 2);
    const waterBotW = cupBotW - (4 * scale);
    const waterBotLeft = centerX - (waterBotW / 2);
    const waterBotRight = centerX + (waterBotW / 2);

    const waterGrad = ctx.createLinearGradient(centerX, waterY, centerX, chamberBaseY);
    if (isThermal) {
      const topStratT = this.T_water + Math.max(0, this.T_water - this.T_amb) * 0.06;
      const botStratT = Math.max(this.T_amb, this.T_water - Math.max(0, this.T_water - this.T_amb) * 0.05);
      waterGrad.addColorStop(0, this.getThermalColor(topStratT, 0.95));
      waterGrad.addColorStop(0.5, this.getThermalColor(this.T_water, 0.9));
      waterGrad.addColorStop(1, this.getThermalColor(botStratT, 0.85));
    } else {
      const normTemp = Math.min(1, Math.max(0, (this.T_water - 20) / 40));
      const topHue = Math.floor(195 - (normTemp * 195));
      const botHue = Math.floor(205 - (normTemp * 185));
      waterGrad.addColorStop(0, `hsla(${topHue}, 90%, 52%, 0.88)`);
      waterGrad.addColorStop(1, `hsla(${botHue}, 85%, 45%, 0.82)`);
    }

    ctx.fillStyle = waterGrad;
    ctx.beginPath();
    ctx.moveTo(waterTopLeft, waterY);
    ctx.lineTo(waterTopRight, waterY);
    ctx.lineTo(waterBotRight, chamberBaseY - (2 * scale));
    ctx.lineTo(waterBotLeft, chamberBaseY - (2 * scale));
    ctx.closePath();
    ctx.fill();

    // Water level top ellipse (meniscus)
    ctx.beginPath();
    ctx.ellipse(centerX, waterY, waterTopW / 2, 4 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Clean 100 mL graduation mark
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(waterTopLeft - 2 * scale, waterY);
    ctx.lineTo(waterTopLeft + 6 * scale, waterY);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = `500 ${Math.round(8.5 * scale)}px Fira Code`;
    ctx.fillText('100 mL', waterTopLeft + 8 * scale, waterY + 3 * scale);

    // 9. Draw Concentrator Cone (if active)
    if (hasCone) {
      ctx.fillStyle = isThermal
        ? this.getThermalColor(this.T_amb + 6, 0.55)
        : (this.config.concentrator === 'mylar_cone' ? 'rgba(224, 242, 254, 0.45)' : 'rgba(148, 163, 184, 0.35)');
      ctx.strokeStyle = isThermal ? '#c084fc' : '#38bdf8';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(centerX - (topConeW / 2), topConeY);
      ctx.lineTo(centerX + (topConeW / 2), topConeY);
      ctx.lineTo(cavityRight, cupY);
      ctx.lineTo(cavityLeft, cupY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 10. Draw Greenhouse Window Top & Dew Condensation
    if (this.config.greenhouseTop !== 'none') {
      const lidLeft = cavityLeft - (3 * scale);
      const lidRight = cavityRight + (3 * scale);
      const lidY = cupY - (2 * scale);

      ctx.strokeStyle = isThermal ? '#38bdf8' : 'rgba(0, 229, 255, 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(lidLeft, lidY);
      ctx.lineTo(lidRight, lidY);
      ctx.stroke();

      // Condensation micro-droplet dew under lid
      if (this.condensation > 0.02) {
        ctx.save();
        const mistAlpha = Math.min(0.65, this.condensation * 0.8);
        ctx.fillStyle = `rgba(255, 255, 255, ${mistAlpha})`;
        ctx.fillRect(lidLeft + 2 * scale, lidY, lidRight - lidLeft - 4 * scale, 4 * scale);

        // Small glistening dew droplets
        const dropCount = Math.round(12 + this.condensation * 14);
        for (let di = 0; di < dropCount; di++) {
          const dx = lidLeft + 4 * scale + (di / dropCount) * (lidRight - lidLeft - 8 * scale);
          const dy = lidY + 2 + (di % 3) * 1.5;
          ctx.fillStyle = `rgba(255, 255, 255, ${mistAlpha + 0.25})`;
          ctx.beginPath();
          ctx.arc(dx, dy, 1.2 * scale, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // 11. Draw Thermometer Probe & Depth Immersion (Rule 5.b)
    const probeX = centerX + (10 * scale);
    let probeTipY = waterY + (waterH * 0.5); // mid default
    if (this.probeDepth === 'surface') probeTipY = waterY + (7 * scale);
    else if (this.probeDepth === 'bottom') probeTipY = chamberBaseY - (8 * scale);

    // Stem shaft
    ctx.strokeStyle = isThermal ? '#e2e8f0' : '#94a3b8';
    ctx.lineWidth = Math.round(2.5 * scale);
    ctx.beginPath();
    ctx.moveTo(probeX + (16 * scale), cupY - (42 * scale));
    ctx.lineTo(probeX, cupY - (8 * scale));
    ctx.lineTo(probeX, probeTipY);
    ctx.stroke();

    // Probe sensor bead
    ctx.fillStyle = isThermal ? this.getThermalColor(this.T_probe, 1.0) : '#ef4444';
    ctx.beginPath();
    ctx.arc(probeX, probeTipY, 3.8 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Glowing center
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(probeX - 0.8 * scale, probeTipY - 0.8 * scale, 1.2 * scale, 0, Math.PI * 2);
    ctx.fill();

    // 12. Draw Height Dimension Bracket (h = 45 cm, Rule 4.b)
    const dimX = centerX - (105 * scale);
    ctx.strokeStyle = isThermal ? '#a855f7' : '#94a3b8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(dimX, lampY + (8 * scale));
    ctx.lineTo(dimX, tableY);
    // Top and bottom tick caps
    ctx.moveTo(dimX - 5 * scale, lampY + (8 * scale));
    ctx.lineTo(dimX + 5 * scale, lampY + (8 * scale));
    ctx.moveTo(dimX - 5 * scale, tableY);
    ctx.lineTo(dimX + 5 * scale, tableY);
    ctx.stroke();

    // Dimension Arrowheads
    ctx.fillStyle = isThermal ? '#a855f7' : '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(dimX, lampY + (8 * scale));
    ctx.lineTo(dimX - 3.5 * scale, lampY + (16 * scale));
    ctx.lineTo(dimX + 3.5 * scale, lampY + (16 * scale));
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(dimX, tableY);
    ctx.lineTo(dimX - 3.5 * scale, tableY - (8 * scale));
    ctx.lineTo(dimX + 3.5 * scale, tableY - (8 * scale));
    ctx.closePath();
    ctx.fill();

    this.drawCalloutBadge(
      ctx,
      `↕ h = ${this.heightCm}.0 cm (Rule 4.b)`,
      dimX,
      (lampY + tableY) / 2,
      undefined,
      undefined,
      {
        align: 'center',
        scale,
        bg: isThermal ? 'rgba(20, 8, 38, 0.92)' : 'rgba(10, 16, 30, 0.92)',
        borderColor: isThermal ? '#c084fc' : '#94a3b8',
        textColor: isThermal ? '#f1f5f9' : '#cbd5e1'
      }
    );

    // 13. Draw High-Clarity Callout Badges (Properly Spaced, Zero Overlap)
    const badgeColLeft = centerX - (78 * scale);
    const badgeColRight = chamberRight + (22 * scale);

    // [Top]: 30x30 cm Boundary Badge
    this.drawCalloutBadge(
      ctx,
      '📐 Rule 3.a Limit: 30.0 × 30.0 cm Cube',
      centerX,
      boxTop - (12 * scale),
      undefined,
      undefined,
      {
        align: 'center',
        scale,
        bg: isThermal ? 'rgba(24, 10, 44, 0.92)' : 'rgba(10, 16, 30, 0.92)',
        borderColor: isThermal ? 'rgba(192, 132, 252, 0.7)' : 'rgba(0, 229, 255, 0.65)',
        textColor: isThermal ? '#c084fc' : '#38bdf8'
      }
    );

    // [Left 1]: Heat Lamp
    this.drawCalloutBadge(
      ctx,
      '💡 115W Heat Lamp (Rule 4.a)',
      badgeColLeft,
      lampY - (14 * scale),
      centerX - (35 * scale),
      lampY,
      {
        align: 'right',
        scale,
        bg: isThermal ? 'rgba(24, 10, 44, 0.92)' : 'rgba(10, 16, 30, 0.92)',
        borderColor: isThermal ? '#fb923c' : '#f59e0b',
        textColor: '#f8fafc'
      }
    );

    // [Left 2]: Concentrator Funnel (if active)
    if (hasCone) {
      let coneName = '☀️ Mylar Cone (88% Refl.)';
      if (this.config.concentrator === 'al_funnel') coneName = '☀️ Al Funnel (76% Refl.)';
      else if (this.config.concentrator === 'flat_mirrors') coneName = '☀️ Mirror Box (62% Refl.)';

      this.drawCalloutBadge(
        ctx,
        coneName,
        badgeColLeft,
        topConeY + (8 * scale),
        centerX - (topConeW / 2),
        topConeY + (10 * scale),
        {
          align: 'right',
          scale,
          bg: isThermal ? 'rgba(24, 10, 44, 0.92)' : 'rgba(10, 16, 30, 0.92)',
          borderColor: isThermal ? '#c084fc' : '#38bdf8',
          textColor: '#e0f2fe'
        }
      );
    }

    // [Left 3]: Greenhouse Trap Lid (if active)
    if (this.config.greenhouseTop !== 'none') {
      let lidName = '🪟 Trap Lid: Clear Acrylic';
      if (this.config.greenhouseTop === 'glass') lidName = '🪟 Trap Lid: Optical Glass';
      else if (this.config.greenhouseTop === 'perforated') lidName = '🪟 Trap Lid: Vented Glazing';

      if (this.condensation > 0.05) {
        lidName += ` (Dew ${(this.condensation * 100).toFixed(0)}%)`;
      }

      this.drawCalloutBadge(
        ctx,
        lidName,
        badgeColLeft,
        cupY - (14 * scale),
        cavityLeft - (2 * scale),
        cupY - (2 * scale),
        {
          align: 'right',
          scale,
          bg: isThermal ? 'rgba(24, 10, 44, 0.92)' : 'rgba(10, 16, 30, 0.92)',
          borderColor: isThermal ? '#38bdf8' : '#00e5ff',
          textColor: '#e0f2fe'
        }
      );
    }

    // [Left 4]: Thermal Insulation Chamber
    this.drawCalloutBadge(
      ctx,
      `🛡️ Insulation: ${insulName} (${insulR})`,
      badgeColLeft,
      cupY + (cupH * 0.55),
      chamberLeft,
      cupY + (cupH * 0.5),
      {
        align: 'right',
        scale,
        bg: isThermal ? 'rgba(24, 10, 44, 0.92)' : 'rgba(10, 16, 30, 0.92)',
        borderColor: insulBadgeBorder,
        textColor: '#f8fafc'
      }
    );

    // [Right 1]: Thermometer Probe (Rule 5.b)
    const depthTag = this.probeDepth === 'surface' ? 'SURF' : (this.probeDepth === 'bottom' ? 'BOT' : 'RULE 5.b');
    this.drawCalloutBadge(
      ctx,
      `🌡️ Rule 5.b Probe: ${this.T_probe.toFixed(1)}°C (${depthTag})`,
      badgeColRight,
      probeTipY - (6 * scale),
      probeX,
      probeTipY,
      {
        align: 'left',
        scale,
        bg: isThermal ? 'rgba(24, 10, 44, 0.92)' : 'rgba(10, 16, 30, 0.92)',
        borderColor: isThermal ? '#f43f5e' : '#38bdf8',
        textColor: '#ffffff',
        dotColor: '#ef4444'
      }
    );

    // [Right 2]: Absorber Sleeve (if active)
    if (this.config.absorber !== 'none') {
      let sleeveName = 'Matte Black Cu (α = 0.95)';
      if (this.config.absorber === 'matte_black_foil') sleeveName = 'Al Foil (α = 0.88)';
      else if (this.config.absorber === 'dark_plastic') sleeveName = 'Dark Plastic (α = 0.70)';

      this.drawCalloutBadge(
        ctx,
        `⬛ Absorber: ${sleeveName}`,
        badgeColRight,
        cupY + (16 * scale),
        centerX + (cupW / 2) + (3 * scale),
        cupY + (16 * scale),
        {
          align: 'left',
          scale,
          bg: isThermal ? 'rgba(24, 10, 44, 0.92)' : 'rgba(10, 16, 30, 0.92)',
          borderColor: isThermal ? '#ffffff' : '#ff5722',
          textColor: '#f8fafc',
          dotColor: '#ff5722'
        }
      );
    }

    // 14. FLIR Thermal Palette Colorbar & Scale Legend
    if (isThermal) {
      const legX = Math.round(18 * scale);
      const legY = h - Math.round(38 * scale);
      const legW = Math.round(170 * scale);
      const legH = Math.round(12 * scale);

      ctx.save();
      // Legend background
      ctx.fillStyle = 'rgba(6, 9, 20, 0.85)';
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
      ctx.lineWidth = 1;
      ctx.fillRect(legX - 6, legY - 18, legW + 12, legH + 28);
      ctx.strokeRect(legX - 6, legY - 18, legW + 12, legH + 28);

      // Label
      ctx.fillStyle = '#c084fc';
      ctx.font = `600 ${Math.round(9 * scale)}px Outfit`;
      ctx.fillText('FLIR IRONBOW THERMOGRAPHY (°C)', legX, legY - 6);

      // Colorbar gradient
      const barGrad = ctx.createLinearGradient(legX, 0, legX + legW, 0);
      barGrad.addColorStop(0, this.getThermalColor(18));
      barGrad.addColorStop(0.25, this.getThermalColor(28));
      barGrad.addColorStop(0.50, this.getThermalColor(40));
      barGrad.addColorStop(0.75, this.getThermalColor(55));
      barGrad.addColorStop(1, this.getThermalColor(75));

      ctx.fillStyle = barGrad;
      ctx.fillRect(legX, legY, legW, legH);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(legX, legY, legW, legH);

      // Tick labels
      ctx.fillStyle = '#cbd5e1';
      ctx.font = `${Math.round(8 * scale)}px Fira Code`;
      ctx.fillText('18°', legX, legY + legH + 8);
      ctx.fillText('35°', legX + (legW * 0.35), legY + legH + 8);
      ctx.fillText('50°', legX + (legW * 0.65), legY + legH + 8);
      ctx.fillText('75°+', legX + legW - 14, legY + legH + 8);

      // HUD Active Indicator
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(w - Math.round(230 * scale), Math.round(24 * scale), 4 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f87171';
      ctx.font = `bold ${Math.round(10 * scale)}px Outfit`;
      ctx.fillText('IR THERMAL SENSOR LIVE', w - Math.round(220 * scale), Math.round(28 * scale));

      ctx.restore();
    }

    // 15. Draw Live Mini Graph (Right Panel with generous spacing)
    const graphX = Math.max(centerX + (210 * scale), w * 0.54);
    const graphY = Math.round(28 * scale);
    const graphW = Math.max(260, w - graphX - Math.round(18 * scale));
    const graphH = h - Math.round(82 * scale);
    this.renderMiniGraph(ctx, graphX, graphY, graphW, graphH, scale, isThermal);
  }

  renderMiniGraph(ctx, gx, gy, gw, gh, scale = 1.0, isThermal = false) {
    ctx.save();
    // Background panel
    ctx.fillStyle = isThermal ? 'rgba(6, 9, 24, 0.92)' : 'rgba(10, 16, 30, 0.88)';
    ctx.strokeStyle = isThermal ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeRect(gx, gy, gw, gh);

    // Title
    ctx.fillStyle = isThermal ? '#c084fc' : '#94a3b8';
    ctx.font = `600 ${Math.round(12 * scale)}px Outfit`;
    ctx.fillText('LIVE WATER HEATING CURVE (°C vs Min)', gx + Math.round(14 * scale), gy + Math.round(24 * scale));

    const pad = Math.round(44 * scale);
    const plotX = gx + pad;
    const plotY = gy + Math.round(42 * scale);
    const plotW = Math.max(120, gw - pad - Math.round(20 * scale));
    const plotH = Math.max(100, gh - Math.round(65 * scale));

    // Grid lines & labels
    ctx.strokeStyle = isThermal ? 'rgba(147, 51, 234, 0.12)' : 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = plotY + (plotH * (i / 4));
      ctx.beginPath();
      ctx.moveTo(plotX, y);
      ctx.lineTo(plotX + plotW, y);
      ctx.stroke();

      const tempVal = Math.round(50 - (i * 7.5));
      ctx.fillStyle = isThermal ? '#a855f7' : '#64748b';
      ctx.font = `${Math.round(10 * scale)}px Fira Code`;
      ctx.fillText(`${tempVal}°`, plotX - Math.round(30 * scale), y + 4);
    }

    // Axes
    ctx.strokeStyle = isThermal ? '#7e22ce' : '#475569';
    ctx.lineWidth = 1.5;
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

      // 1. Plot Sleeve Temperature (Dashed Amber Curve showing thermal mass lead)
      ctx.strokeStyle = isThermal ? 'rgba(251, 146, 60, 0.65)' : 'rgba(245, 158, 11, 0.65)';
      ctx.lineWidth = Math.round(1.8 * scale);
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let i = 0; i < this.history.length; i++) {
        const pt = this.history[i];
        const sTemp = pt.sleeveTemp !== undefined ? pt.sleeveTemp : pt.temp;
        const px = plotX + (pt.time / maxTime) * plotW;
        const normY = Math.min(1, Math.max(0, (sTemp - minTemp) / (maxTemp - minTemp)));
        const py = plotY + plotH - (normY * plotH);

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Plot Probed Water Temperature (Solid Curve)
      ctx.strokeStyle = isThermal ? '#f43f5e' : '#ff5722';
      ctx.lineWidth = Math.round(3 * scale);
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

      // Current point dot & label
      const latest = this.history[this.history.length - 1];
      const curX = plotX + (latest.time / maxTime) * plotW;
      const curNormY = Math.min(1, Math.max(0, (latest.temp - minTemp) / (maxTemp - minTemp)));
      const curY = plotY + plotH - (curNormY * plotH);

      ctx.fillStyle = isThermal ? '#f43f5e' : '#ff9100';
      ctx.beginPath();
      ctx.arc(curX, curY, Math.round(5 * scale), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(11 * scale)}px Fira Code`;
      ctx.fillText(`${latest.temp.toFixed(1)}°C`, curX + Math.round(8 * scale), curY - Math.round(6 * scale));

      // Legend labels
      ctx.font = `${Math.round(9 * scale)}px Outfit`;
      ctx.fillStyle = isThermal ? '#f43f5e' : '#ff5722';
      ctx.fillText('— Probe Temp', plotX + 10, plotY + 14);
      ctx.fillStyle = isThermal ? '#fb923c' : '#f59e0b';
      ctx.fillText('-- Sleeve Temp', plotX + 85 * scale, plotY + 14);
    }

    ctx.restore();
  }
}
