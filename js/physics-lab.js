/**
 * ThermoOlyMaster - Module 4: Interactive Physics Visualizers
 * Includes:
 * 1. PV Diagram Cycle Engine (Carnot, Otto, Isobaric/Isochoric)
 * 2. Stefan-Boltzmann Radiation Visualizer (j* = ε · σ · T⁴, glowing emitter, Wien's peak)
 * 3. Calorimetry & Phase Change Stepper (-20°C to 120°C with Lf & Lv latent plateaus)
 */

import { CONSTANTS, computeCycleDynamics, computeStefanBoltzmann } from './physics.js';

export class PhysicsLab {
  constructor() {
    // 1. PV Diagram state
    this.pvCanvas = null;
    this.pvCtx = null;
    this.cycleType = 'carnot';
    this.carnotTh = 480; // K
    this.carnotTc = 300; // K
    this.ottoRatio = 8.0;
    this.cycleAnimProgress = 0; // 0 to 1 along the cycle loop
    this.pvRaf = null;

    // 2. Stefan-Boltzmann state
    this.radCanvas = null;
    this.radCtx = null;
    this.emissivity = 0.95;
    this.radTempC = 65; // °C
    this.radAreaM2 = 0.024; // 9 oz cup area

    // 3. Calorimetry state
    this.calCanvas = null;
    this.calCtx = null;
    this.heatAddedKJ = 50; // default 50 kJ added to 100g of ice/water
    this.waterMassKg = 0.100; // 100g official competition mass

    // Bind anim loop
    this.lastTime = null;
  }

  init() {
    this.pvCanvas = document.getElementById('pvCanvas');
    this.pvCtx = this.pvCanvas ? this.pvCanvas.getContext('2d') : null;

    this.radCanvas = document.getElementById('radCanvas');
    this.radCtx = this.radCanvas ? this.radCanvas.getContext('2d') : null;

    this.calCanvas = document.getElementById('calorimetryCanvas');
    this.calCtx = this.calCanvas ? this.calCanvas.getContext('2d') : null;

    this.bindEvents();
    this.resizeCanvases();
    window.addEventListener('resize', () => this.resizeCanvases());

    this.startAnimationLoop();
    this.updateStefanBoltzmann();
    this.updateCalorimetry();
  }

  resizeCanvases() {
    [
      { c: this.pvCanvas, defH: 340 },
      { c: this.radCanvas, defH: 280 },
      { c: this.calCanvas, defH: 280 }
    ].forEach(({ c, defH }) => {
      if (!c) return;
      const rect = c.parentElement.getBoundingClientRect();
      c.width = rect.width || 500;
      c.height = defH;
    });
    this.renderAll();
  }

  bindEvents() {
    // --- PV Controls ---
    const selCycle = document.getElementById('pvCycleSelect');
    if (selCycle) {
      selCycle.addEventListener('change', (e) => {
        this.cycleType = e.target.value;
        const carnotControls = document.getElementById('pvCarnotControls');
        const ottoControls = document.getElementById('pvOttoControls');
        if (carnotControls && ottoControls) {
          carnotControls.style.display = this.cycleType === 'carnot' ? 'block' : 'none';
          ottoControls.style.display = this.cycleType === 'otto' ? 'block' : 'none';
        }
        this.updatePVDynamics();
      });
    }

    const sliderTh = document.getElementById('pvThSlider');
    const valTh = document.getElementById('pvThValue');
    if (sliderTh && valTh) {
      sliderTh.addEventListener('input', (e) => {
        this.carnotTh = parseFloat(e.target.value);
        valTh.textContent = `${this.carnotTh} K (${(this.carnotTh - 273.15).toFixed(0)}°C)`;
        this.updatePVDynamics();
      });
    }

    const sliderTc = document.getElementById('pvTcSlider');
    const valTc = document.getElementById('pvTcValue');
    if (sliderTc && valTc) {
      sliderTc.addEventListener('input', (e) => {
        this.carnotTc = parseFloat(e.target.value);
        valTc.textContent = `${this.carnotTc} K (${(this.carnotTc - 273.15).toFixed(0)}°C)`;
        this.updatePVDynamics();
      });
    }

    const sliderOttoR = document.getElementById('pvOttoRSlider');
    const valOttoR = document.getElementById('pvOttoRValue');
    if (sliderOttoR && valOttoR) {
      sliderOttoR.addEventListener('input', (e) => {
        this.ottoRatio = parseFloat(e.target.value);
        valOttoR.textContent = `${this.ottoRatio.toFixed(1)}:1`;
        this.updatePVDynamics();
      });
    }

    // --- Stefan-Boltzmann Controls ---
    const sliderEps = document.getElementById('radEpsSlider');
    const valEps = document.getElementById('radEpsValue');
    if (sliderEps && valEps) {
      sliderEps.addEventListener('input', (e) => {
        this.emissivity = parseFloat(e.target.value);
        valEps.textContent = this.emissivity.toFixed(2);
        this.updateStefanBoltzmann();
      });
    }

    const sliderTemp = document.getElementById('radTempSlider');
    const valTemp = document.getElementById('radTempValue');
    if (sliderTemp && valTemp) {
      sliderTemp.addEventListener('input', (e) => {
        this.radTempC = parseFloat(e.target.value);
        valTemp.textContent = `${this.radTempC}°C (${(this.radTempC + 273.15).toFixed(1)} K)`;
        this.updateStefanBoltzmann();
      });
    }

    // Preset buttons for radiation materials
    document.querySelectorAll('[data-rad-preset]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const eps = parseFloat(e.target.getAttribute('data-rad-preset'));
        this.emissivity = eps;
        if (sliderEps) sliderEps.value = eps;
        if (valEps) valEps.textContent = eps.toFixed(2);
        this.updateStefanBoltzmann();
      });
    });

    // --- Calorimetry Controls ---
    const sliderHeat = document.getElementById('calHeatSlider');
    const valHeat = document.getElementById('calHeatValue');
    if (sliderHeat && valHeat) {
      sliderHeat.addEventListener('input', (e) => {
        this.heatAddedKJ = parseFloat(e.target.value);
        valHeat.textContent = `${this.heatAddedKJ.toFixed(1)} kJ`;
        this.updateCalorimetry();
      });
    }

    const btnCalPresetIce = document.getElementById('calBtnIce');
    const btnCalPresetWater = document.getElementById('calBtnWater');
    const btnCalPresetBoil = document.getElementById('calBtnBoil');
    const btnCalPresetSteam = document.getElementById('calBtnSteam');

    if (btnCalPresetIce && sliderHeat) {
      btnCalPresetIce.addEventListener('click', () => {
        sliderHeat.value = 2;
        this.heatAddedKJ = 2;
        if (valHeat) valHeat.textContent = '2.0 kJ';
        this.updateCalorimetry();
      });
    }
    if (btnCalPresetWater && sliderHeat) {
      btnCalPresetWater.addEventListener('click', () => {
        sliderHeat.value = 55;
        this.heatAddedKJ = 55;
        if (valHeat) valHeat.textContent = '55.0 kJ';
        this.updateCalorimetry();
      });
    }
    if (btnCalPresetBoil && sliderHeat) {
      btnCalPresetBoil.addEventListener('click', () => {
        sliderHeat.value = 180;
        this.heatAddedKJ = 180;
        if (valHeat) valHeat.textContent = '180.0 kJ';
        this.updateCalorimetry();
      });
    }
    if (btnCalPresetSteam && sliderHeat) {
      btnCalPresetSteam.addEventListener('click', () => {
        sliderHeat.value = 315;
        this.heatAddedKJ = 315;
        if (valHeat) valHeat.textContent = '315.0 kJ';
        this.updateCalorimetry();
      });
    }
  }

  // =========================================================================
  // 1. PV DIAGRAM ENGINE
  // =========================================================================

  updatePVDynamics() {
    let dynamics;
    if (this.cycleType === 'carnot') {
      dynamics = computeCycleDynamics('carnot', { Th: this.carnotTh, Tc: this.carnotTc });
    } else {
      dynamics = computeCycleDynamics('otto', { compressionRatio: this.ottoRatio });
    }

    const elEff = document.getElementById('pvEfficiency');
    const elWork = document.getElementById('pvNetWork');
    const elSummary = document.getElementById('pvSummaryDesc');

    if (elEff) elEff.textContent = `${dynamics.efficiencyPercent}%`;
    if (elWork) {
      elWork.textContent = dynamics.workNet ? `${dynamics.workNet.toFixed(1)} J` : 'W = ∮ P dV';
    }
    if (elSummary) elSummary.textContent = dynamics.description;

    this.renderPV();
  }

  renderPV() {
    if (!this.pvCtx || !this.pvCanvas) return;
    const ctx = this.pvCtx;
    const w = this.pvCanvas.width;
    const h = this.pvCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Margins
    const padL = 60;
    const padR = 30;
    const padT = 30;
    const padB = 45;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    // Grid lines & Axes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padT + (plotH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();

      const x = padL + (plotW / 5) * i;
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();
    }

    // Axis lines
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(w - padR, padT + plotH);
    ctx.stroke();

    // Axis Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "Fira Code", monospace';
    ctx.fillText('P (Pressure, kPa)', padL - 10, padT - 12);
    ctx.fillText('V (Volume, liters) ➔', w - padR - 120, padT + plotH + 34);

    // Generate cycle curve points
    let points = [];
    if (this.cycleType === 'carnot') {
      // 4 states:
      // 1 (High P, Low V) -> 2 (Isothermal Exp, Th) -> 3 (Adiabatic Exp, Tc) -> 4 (Isothermal Comp, Tc) -> 1
      const V1 = padL + plotW * 0.20;
      const P1 = padT + plotH * 0.15;
      const V2 = padL + plotW * 0.50;
      const P2 = padT + plotH * 0.35;
      const V3 = padL + plotW * 0.85;
      const P3 = padT + plotH * 0.75;
      const V4 = padL + plotW * 0.40;
      const P4 = padT + plotH * 0.85;

      points = [
        { x: V1, y: P1, label: '1 (Th)' },
        { x: V2, y: P2, label: '2 (Th)' },
        { x: V3, y: P3, label: '3 (Tc)' },
        { x: V4, y: P4, label: '4 (Tc)' }
      ];
    } else {
      // Otto cycle: 1 -> 2 (Isentropic Comp) -> 3 (Isochoric Qin) -> 4 (Isentropic Exp) -> 1 (Isochoric Qout)
      const V_comp = padL + plotW * 0.25;
      const V_exp = padL + plotW * 0.80;
      const P_top = padT + plotH * 0.15;
      const P_mid1 = padT + plotH * 0.45;
      const P_mid2 = padT + plotH * 0.65;
      const P_bot = padT + plotH * 0.85;

      points = [
        { x: V_exp, y: P_bot, label: '1' },
        { x: V_comp, y: P_mid1, label: '2' },
        { x: V_comp, y: P_top, label: '3 (Q_in)' },
        { x: V_exp, y: P_mid2, label: '4 (Q_out)' }
      ];
    }

    // Draw enclosed cycle polygon with glowing fill
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      // Curve smoothing for PV isotherms/adiabats
      const prev = points[i - 1];
      const curr = points[i];
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2 + (curr.y > prev.y ? -12 : 12);
      ctx.quadraticCurveTo(midX, midY, curr.x, curr.y);
    }
    // Close back to 0
    const last = points[points.length - 1];
    const first = points[0];
    const midX = (last.x + first.x) / 2;
    const midY = (last.y + first.y) / 2 + (first.y > last.y ? -10 : 10);
    ctx.quadraticCurveTo(midX, midY, first.x, first.y);
    ctx.closePath();

    // Shaded interior Work area: W = ∮ P dV
    const grad = ctx.createLinearGradient(padL, padT, padL + plotW, padT + plotH);
    grad.addColorStop(0, 'rgba(255, 87, 34, 0.35)');
    grad.addColorStop(1, 'rgba(0, 229, 255, 0.25)');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = '#ff7043';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(255, 87, 34, 0.6)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0; // reset

    // Draw state corner nodes & labels
    points.forEach((pt, idx) => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff3d00';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#00e5ff';
      ctx.font = 'bold 12px "Inter", sans-serif';
      ctx.fillText(pt.label, pt.x + 8, pt.y - 6);
    });

    // Center text indicating Work Done
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 13px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Net Work Area: W = ∮ P dV', padL + plotW * 0.52, padT + plotH * 0.52);
    ctx.textAlign = 'left';

    // Animated particle traversing the cycle loop
    const segs = points.length;
    const segIdx = Math.floor(this.cycleAnimProgress * segs);
    const segT = (this.cycleAnimProgress * segs) % 1;
    const pA = points[segIdx];
    const pB = points[(segIdx + 1) % segs];

    const curX = pA.x + (pB.x - pA.x) * segT;
    const curY = pA.y + (pB.y - pA.y) * segT;

    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(curX, curY, 7, 0, Math.PI * 2);
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // =========================================================================
  // 2. STEFAN-BOLTZMANN RADIATION VISUALIZER
  // =========================================================================

  updateStefanBoltzmann() {
    const sb = computeStefanBoltzmann(this.radTempC, this.emissivity, this.radAreaM2);
    
    // Wien's Law: lambda_peak = 2898 / T_kelvin in micrometers
    const wienPeakMicrons = 2897.8 / sb.T_kelvin;

    const elExitance = document.getElementById('radExitance');
    const elPower = document.getElementById('radTotalPower');
    const elWien = document.getElementById('radWienPeak');
    const elRatio = document.getElementById('radT4Scaling');

    if (elExitance) elExitance.textContent = `${sb.exitance.toLocaleString()} W/m²`;
    if (elPower) elPower.textContent = `${sb.totalPower} Watts`;
    if (elWien) elWien.textContent = `${wienPeakMicrons.toFixed(2)} µm (IR band)`;
    
    if (elRatio) {
      // Comparison to room temperature (294K)
      const T_base = 294.15;
      const ratio = Math.pow(sb.T_kelvin / T_base, 4);
      elRatio.textContent = `${ratio.toFixed(2)}× vs 21°C Room Temp`;
    }

    this.renderRadiation();
  }

  renderRadiation() {
    if (!this.radCtx || !this.radCanvas) return;
    const ctx = this.radCtx;
    const w = this.radCanvas.width;
    const h = this.radCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Left half: Glowing Emitter Orb Visualizer
    // Right half: Stefan-Boltzmann T^4 Exitance Curve
    const splitX = Math.min(220, w * 0.38);

    // 1. Draw glowing emitter orb
    const orbCenterX = splitX / 2;
    const orbCenterY = h / 2;
    const orbRadius = 55;

    // Heat color mapping based on radTempC (20°C to 180°C)
    const normT = Math.min(1.0, Math.max(0, (this.radTempC - 20) / 160));
    const glowAlpha = 0.2 + normT * 0.7;
    const rVal = Math.round(180 + normT * 75);
    const gVal = Math.round(50 + normT * 150);
    const bVal = Math.round(20 + normT * 30);

    const radGlow = ctx.createRadialGradient(orbCenterX, orbCenterY, 5, orbCenterX, orbCenterY, orbRadius * 1.6);
    radGlow.addColorStop(0, `rgba(${rVal}, ${gVal}, ${bVal}, ${glowAlpha})`);
    radGlow.addColorStop(0.6, `rgba(${rVal}, ${Math.round(gVal * 0.6)}, 0, ${glowAlpha * 0.4})`);
    radGlow.addColorStop(1, 'transparent');

    ctx.fillStyle = radGlow;
    ctx.beginPath();
    ctx.arc(orbCenterX, orbCenterY, orbRadius * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Body sphere
    const orbBody = ctx.createRadialGradient(orbCenterX - 15, orbCenterY - 15, 5, orbCenterX, orbCenterY, orbRadius);
    orbBody.addColorStop(0, `rgb(${rVal}, ${gVal}, ${bVal})`);
    orbBody.addColorStop(0.8, '#1e1b2e');
    orbBody.addColorStop(1, '#090812');
    ctx.fillStyle = orbBody;
    ctx.beginPath();
    ctx.arc(orbCenterX, orbCenterY, orbRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(${rVal}, ${gVal}, ${bVal}, 0.8)`;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.radTempC}°C`, orbCenterX, orbCenterY - 4);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "Inter", sans-serif';
    ctx.fillText(`ε = ${this.emissivity.toFixed(2)}`, orbCenterX, orbCenterY + 12);
    ctx.textAlign = 'left';

    // 2. Draw Stefan-Boltzmann Exitance Curve (Right side)
    const padL = splitX + 35;
    const padR = 25;
    const padT = 25;
    const padB = 35;
    const graphW = w - padL - padR;
    const graphH = h - padT - padB;

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT + graphH);
    ctx.lineTo(w - padR, padT + graphH);
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + graphH);
    ctx.stroke();

    // Curve: T from 20 to 180 °C
    const minT = 20;
    const maxT = 180;
    const maxExitance = 1.0 * CONSTANTS.STEFAN_BOLTZMANN * Math.pow(maxT + 273.15, 4); // ~2400 W/m²

    // Draw ideal blackbody curve (dashed ε=1)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let t = minT; t <= maxT; t += 2) {
      const exit = 1.0 * CONSTANTS.STEFAN_BOLTZMANN * Math.pow(t + 273.15, 4);
      const x = padL + ((t - minT) / (maxT - minT)) * graphW;
      const y = padT + graphH - (exit / maxExitance) * graphH;
      if (t === minT) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]); // reset

    // Draw actual material curve (ε * σ * T^4)
    ctx.strokeStyle = '#ff5722';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let t = minT; t <= maxT; t += 2) {
      const exit = this.emissivity * CONSTANTS.STEFAN_BOLTZMANN * Math.pow(t + 273.15, 4);
      const x = padL + ((t - minT) / (maxT - minT)) * graphW;
      const y = padT + graphH - (exit / maxExitance) * graphH;
      if (t === minT) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Mark current operating point
    const currExit = this.emissivity * CONSTANTS.STEFAN_BOLTZMANN * Math.pow(this.radTempC + 273.15, 4);
    const curX = padL + ((this.radTempC - minT) / (maxT - minT)) * graphW;
    const curY = padT + graphH - (currExit / maxExitance) * graphH;

    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(curX, curY, 6, 0, Math.PI * 2);
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Axis Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "Fira Code", monospace';
    ctx.fillText('j* (W/m²)', padL - 10, padT - 8);
    ctx.fillText('T (°C) ➔', w - padR - 50, padT + graphH + 20);
    ctx.fillText('20°C', padL, padT + graphH + 16);
    ctx.fillText('180°C', w - padR - 30, padT + graphH + 16);
  }

  // =========================================================================
  // 3. CALORIMETRY & PHASE CHANGE STEPPER
  // =========================================================================

  calculatePhaseState(qKJ) {
    const m = this.waterMassKg; // 0.100 kg
    const c_ice = CONSTANTS.ICE_SPECIFIC_HEAT;     // 2090 J/(kg C)
    const L_f = CONSTANTS.LATENT_HEAT_FUSION;       // 334,000 J/kg
    const c_water = CONSTANTS.WATER_SPECIFIC_HEAT; // 4184 J/(kg C)
    const L_v = CONSTANTS.LATENT_HEAT_VAPOR;        // 2,260,000 J/kg
    const c_steam = CONSTANTS.STEAM_SPECIFIC_HEAT; // 2010 J/(kg C)

    const qJoules = qKJ * 1000;

    // Energy thresholds starting at -20°C
    const Q1 = m * c_ice * 20;            // 0.1 * 2090 * 20 = 4,180 J (4.18 kJ) -> reaches 0°C
    const Q2 = Q1 + (m * L_f);            // + 33,400 J = 37,580 J (37.58 kJ) -> melts all ice
    const Q3 = Q2 + (m * c_water * 100);  // + 41,840 J = 79,420 J (79.42 kJ) -> reaches 100°C
    const Q4 = Q3 + (m * L_v);            // + 226,000 J = 305,420 J (305.42 kJ) -> boils to steam
    // Q5: Superheating above 100°C

    let temp = -20;
    let phaseName = '';
    let formula = '';

    if (qJoules <= Q1) {
      temp = -20 + (qJoules / (m * c_ice));
      phaseName = 'Solid Ice (Warming)';
      formula = 'Q = m · c_ice · ΔT';
    } else if (qJoules <= Q2) {
      temp = 0.0;
      const meltFraction = ((qJoules - Q1) / (m * L_f)) * 100;
      phaseName = `Phase Change: Melting Ice (${meltFraction.toFixed(0)}% Water)`;
      formula = 'Q = m · L_fusion (No ΔT plateau)';
    } else if (qJoules <= Q3) {
      temp = (qJoules - Q2) / (m * c_water);
      phaseName = 'Liquid Water (Sensible Heating)';
      formula = 'Q = m · c_water · ΔT';
    } else if (qJoules <= Q4) {
      temp = 100.0;
      const boilFraction = ((qJoules - Q3) / (m * L_v)) * 100;
      phaseName = `Phase Change: Boiling / Vaporization (${boilFraction.toFixed(0)}% Steam)`;
      formula = 'Q = m · L_vaporization (No ΔT plateau)';
    } else {
      temp = 100.0 + ((qJoules - Q4) / (m * c_steam));
      phaseName = 'Superheated Steam';
      formula = 'Q = m · c_steam · ΔT';
    }

    return {
      temp: parseFloat(temp.toFixed(1)),
      phaseName,
      formula,
      Q1_kJ: Q1 / 1000,
      Q2_kJ: Q2 / 1000,
      Q3_kJ: Q3 / 1000,
      Q4_kJ: Q4 / 1000
    };
  }

  updateCalorimetry() {
    const state = this.calculatePhaseState(this.heatAddedKJ);

    const elTemp = document.getElementById('calTemp');
    const elPhase = document.getElementById('calPhaseName');
    const elFormula = document.getElementById('calFormula');

    if (elTemp) elTemp.textContent = `${state.temp}°C`;
    if (elPhase) elPhase.textContent = state.phaseName;
    if (elFormula) elFormula.textContent = state.formula;

    this.renderCalorimetry();
  }

  renderCalorimetry() {
    if (!this.calCtx || !this.calCanvas) return;
    const ctx = this.calCtx;
    const w = this.calCanvas.width;
    const h = this.calCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const padL = 50;
    const padR = 25;
    const padT = 25;
    const padB = 40;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    // Grid & Axes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT + plotH);
    ctx.lineTo(w - padR, padT + plotH);
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.stroke();

    // Map heatAdded (0 to 320 kJ) to X, temp (-20 to 120°C) to Y
    const maxQ = 320;
    const minT = -20;
    const maxT = 120;

    const mapX = (q) => padL + (q / maxQ) * plotW;
    const mapY = (t) => padT + plotH - ((t - minT) / (maxT - minT)) * plotH;

    // Key transition coordinates
    const p0 = { x: mapX(0), y: mapY(-20) };
    const p1 = { x: mapX(4.18), y: mapY(0) };     // 0°C reached
    const p2 = { x: mapX(37.58), y: mapY(0) };    // 0°C melted
    const p3 = { x: mapX(79.42), y: mapY(100) };  // 100°C reached
    const p4 = { x: mapX(305.42), y: mapY(100) }; // 100°C vaporized
    const p5 = { x: mapX(320), y: mapY(107.3) };  // Steam

    // Draw reference full curve
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.lineTo(p5.x, p5.y);
    ctx.stroke();

    // Plateau labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "Inter", sans-serif';
    ctx.fillText('Melting Plateau (Lf = 334 kJ/kg)', p1.x + 5, p1.y - 8);
    ctx.fillText('Boiling Plateau (Lv = 2260 kJ/kg)', p3.x + 15, p3.y - 8);

    // Current Heat Progress Point
    const state = this.calculatePhaseState(this.heatAddedKJ);
    const curX = mapX(this.heatAddedKJ);
    const curY = mapY(state.temp);

    // Highlight area under curve
    ctx.fillStyle = 'rgba(0, 229, 255, 0.15)';
    ctx.beginPath();
    ctx.moveTo(p0.x, padT + plotH);
    ctx.lineTo(p0.x, p0.y);
    
    if (this.heatAddedKJ <= 4.18) {
      ctx.lineTo(curX, curY);
    } else if (this.heatAddedKJ <= 37.58) {
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(curX, curY);
    } else if (this.heatAddedKJ <= 79.42) {
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(curX, curY);
    } else if (this.heatAddedKJ <= 305.42) {
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(curX, curY);
    } else {
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.lineTo(curX, curY);
    }
    ctx.lineTo(curX, padT + plotH);
    ctx.closePath();
    ctx.fill();

    // Draw glowing current point
    ctx.fillStyle = '#ff5722';
    ctx.beginPath();
    ctx.arc(curX, curY, 6, 0, Math.PI * 2);
    ctx.shadowColor = '#ff5722';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Axis Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "Fira Code", monospace';
    ctx.fillText('T (°C)', padL - 10, padT - 8);
    ctx.fillText('Heat Added Q (kJ) ➔', w - padR - 110, padT + plotH + 28);
    ctx.fillText('0 kJ', padL, padT + plotH + 16);
    ctx.fillText('320 kJ', w - padR - 35, padT + plotH + 16);
  }

  // =========================================================================
  // ANIMATION LOOP
  // =========================================================================

  startAnimationLoop() {
    const loop = (timestamp) => {
      if (!this.lastTime) this.lastTime = timestamp;
      const dt = (timestamp - this.lastTime) / 1000;
      this.lastTime = timestamp;

      // Advance PV cycle animation (one full loop in ~6 seconds)
      this.cycleAnimProgress = (this.cycleAnimProgress + dt * 0.16) % 1.0;
      this.renderPV();

      this.pvRaf = requestAnimationFrame(loop);
    };
    this.pvRaf = requestAnimationFrame(loop);
  }

  renderAll() {
    this.updatePVDynamics();
    this.updateStefanBoltzmann();
    this.updateCalorimetry();
  }
}
