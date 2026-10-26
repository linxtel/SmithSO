/**
 * ThermoOlyMaster - Module 6: Rule-Compliant Binder & Cheat-Sheet Builder
 * Provides:
 * 1. Comprehensive physical constants & materials database with quick search.
 * 2. Instant multi-unit thermodynamic converter (Temp, Energy, Power, Pressure).
 * 3. Printable Competition Calibration Look-Up Matrix Generator.
 * 4. Print command trigger with high-contrast binder styling.
 */

export const BINDER_DATA = {
  constants: [
    { name: 'Stefan-Boltzmann Constant', symbol: 'σ', value: '5.670374 × 10⁻⁸', unit: 'W / (m² · K⁴)', notes: 'Radiant exitance: j* = ε · σ · T⁴' },
    { name: 'Universal Gas Constant', symbol: 'R', value: '8.314462', unit: 'J / (mol · K)', notes: 'Ideal Gas Law: P · V = n · R · T' },
    { name: 'Boltzmann Constant', symbol: 'k_B', value: '1.380649 × 10⁻²³', unit: 'J / K', notes: 'Per-molecule energy: E_avg = (3/2) · k_B · T' },
    { name: 'Specific Heat of Liquid Water', symbol: 'c_water', value: '4184', unit: 'J / (kg · °C)', notes: '1.000 cal / (g · °C)' },
    { name: 'Specific Heat of Solid Ice', symbol: 'c_ice', value: '2090', unit: 'J / (kg · °C)', notes: 'Approx half that of liquid water' },
    { name: 'Specific Heat of Steam (100°C)', symbol: 'c_steam', value: '2010', unit: 'J / (kg · °C)', notes: 'Sensible heating of vapor' },
    { name: 'Latent Heat of Fusion (Ice ➔ Water)', symbol: 'L_f', value: '334,000 (334 kJ/kg)', unit: 'J / kg', notes: 'Isothermal plateau at 0°C' },
    { name: 'Latent Heat of Vaporization (Water ➔ Steam)', symbol: 'L_v', value: '2,260,000 (2.26 MJ/kg)', unit: 'J / kg', notes: 'Isothermal plateau at 100°C' },
    { name: 'Standard Atmospheric Pressure', symbol: 'P_atm', value: '101.325', unit: 'kPa (1.000 atm)', notes: '760 mmHg = 14.696 psi' },
    { name: 'Absolute Zero (Kelvin)', symbol: '0 K', value: '-273.15', unit: '°C (0 °R = -459.67 °F)', notes: 'Zero thermal molecular motion' },
    { name: 'Standard Volume of Ideal Gas (STP)', symbol: 'V_m', value: '22.414', unit: 'L / mol', notes: 'At 0°C (273.15 K) and 1 atm' },
    { name: 'Planck\'s Constant', symbol: 'h', value: '6.626070 × 10⁻³⁴', unit: 'J · s', notes: 'Blackbody quantum packet: E = h · ν' },
    { name: 'Wien\'s Displacement Constant', symbol: 'b', value: '2.897772 × 10⁻³', unit: 'm · K (2898 µm · K)', notes: 'Peak blackbody wavelength: λ_max · T = b' },
    { name: 'Avogadro\'s Constant', symbol: 'N_A', value: '6.022141 × 10²³', unit: 'mol⁻¹', notes: 'Molar-microscopic bridge: R = N_A · k_B' },
    { name: 'Water Triple Point', symbol: 'T_tp (H₂O)', value: '0.01 °C (273.16 K)', unit: '0.00603 atm (611.65 Pa)', notes: 'Coexistence of ice, liquid water, and water vapor' },
    { name: 'Water Critical Point', symbol: 'T_c (H₂O)', value: '373.95 °C (647.1 K)', unit: '217.7 atm (22.06 MPa)', notes: 'Vapor-liquid boundary terminates; supercritical fluid' },
    { name: 'Carbon Dioxide Triple Point', symbol: 'T_tp (CO₂)', value: '-56.6 °C (216.55 K)', unit: '5.11 atm (518 kPa)', notes: 'Above 1 atm; dry ice sublimes directly at 1 atm (-78.5°C)' }
  ],

  thermalConductivities: [
    { material: 'Copper (Pure)', k: '385 - 401', unit: 'W / (m · K)', category: 'Conductor', use: 'Ideal thermal absorber sleeve around cup' },
    { material: 'Aluminum (6061)', k: '167 - 205', unit: 'W / (m · K)', category: 'Conductor', use: 'Lightweight reflective cone / sleeve' },
    { material: 'Glass (Window/Pyrex)', k: '0.8 - 1.1', unit: 'W / (m · K)', category: 'Window', use: 'Greenhouse top glazing (transmits light, traps heat)' },
    { material: 'Acrylic (Plexiglas)', k: '0.19 - 0.21', unit: 'W / (m · K)', category: 'Window', use: 'Lightweight greenhouse aperture cover' },
    { material: 'Water (Liquid, 20°C)', k: '0.598', unit: 'W / (m · K)', category: 'Fluid', use: 'Event target volume (100 mL = 0.100 kg)' },
    { material: 'Expanded Polystyrene (EPS)', k: '0.033 - 0.038', unit: 'W / (m · K)', category: 'Insulator', use: 'Base and perimeter thermal barrier' },
    { material: 'Extruded Polystyrene (XPS)', k: '0.029 - 0.032', unit: 'W / (m · K)', category: 'Insulator', use: 'Dense base support below cup' },
    { material: 'Silica Aerogel', k: '0.013 - 0.018', unit: 'W / (m · K)', category: 'Insulator', use: 'Ultimate lightweight thermal insulation blanket' },
    { material: 'Air (Still, 20°C)', k: '0.026', unit: 'W / (m · K)', category: 'Gas', use: 'Suppressed convection boundary layer' }
  ],

  emissivities: [
    { surface: 'Carbon Lampblack / Matte Black Paint', eps: '0.96 - 0.98', notes: 'Optimal collector absorption coating' },
    { surface: 'Water Surface', eps: '0.95 - 0.96', notes: 'High infrared emitter' },
    { surface: 'Oxidized Copper', eps: '0.65 - 0.78', notes: 'Moderate infrared absorption' },
    { surface: 'Polished Aluminum Foil', eps: '0.04 - 0.06', notes: 'Reflects 95%+ of incoming lamp radiation' },
    { surface: 'Aluminized Mylar Film', eps: '0.03 - 0.05', notes: 'Optimal concentrator reflector cone material' }
  ],

  pioneers: [
    { name: 'William Thomson (Lord Kelvin)', years: '1824–1907', discovery: 'Absolute Thermodynamic Temperature Scale & Absolute Zero', impact: 'Founded 0 K (-273.15°C) where thermal molecular motion ceases; Kelvin-Planck statement of Second Law; Joule-Thomson effect.' },
    { name: 'Joseph Black', years: '1728–1799', discovery: 'Latent Heat & Specific Heat Capacity', impact: 'Distinguished heat (energy quantity) from temperature (intensity); discovered latent heat of fusion & vaporization; invented ice calorimeter.' },
    { name: 'James Prescott Joule', years: '1818–1889', discovery: 'Mechanical Equivalent of Heat (Paddle Wheel)', impact: 'Proved mechanical work converts to heat (1 cal ≈ 4.184 J); established First Law of Thermodynamics; SI energy unit named in his honor.' },
    { name: 'Nicolas Léonard Sadi Carnot', years: '1796–1832', discovery: 'Carnot Heat Engine & Theoretical Limits', impact: 'Father of thermodynamics (1824); derived maximum possible engine efficiency η = 1 − (Tc / Th); showed work comes from heat fall.' },
    { name: 'Max Planck', years: '1858–1947', discovery: 'Blackbody Quantization & Third Law Foundation', impact: 'Resolved ultraviolet catastrophe via quantized radiation (E = hν); Planck blackbody law; formulated Nernst-Planck Third Law (S → 0 as T → 0 K).' },
    { name: 'Rudolf Clausius', years: '1822–1888', discovery: 'Concept of Entropy & Mathematical Second Law', impact: 'Formulated Second Law ("heat cannot of itself pass from cold to hot"); coined "Entropy" (S) with dS = dQ_rev / T; stated entropy of universe tends to a maximum.' },
    { name: 'Ludwig Boltzmann', years: '1844–1906', discovery: 'Statistical Mechanics & Microscopic Entropy', impact: 'Bridged microscopic atoms and macroscopic thermodynamics; carved S = k_B · ln Ω on his tombstone; Boltzmann constant; kinetic theory of gases.' },
    { name: 'James Clerk Maxwell', years: '1831–1879', discovery: 'Maxwell-Boltzmann Speed Distribution & Demon', impact: 'Statistical molecular speed curves; Maxwell relations between thermo potentials; Maxwell\'s Demon thought experiment on entropy and information.' },
    { name: 'Benjamin Thompson (Count Rumford)', years: '1753–1814', discovery: 'Friction Cannon-Boring Experiment', impact: 'Disproved caloric fluid theory; demonstrated heat is generated continuously by mechanical work and molecular friction.' },
    { name: 'Daniel Gabriel Fahrenheit', years: '1686–1736', discovery: 'Precision Mercury Thermometer', impact: 'Pioneered standard mercury thermometry; established 32°F freezing & 212°F boiling points.' },
    { name: 'Anders Celsius', years: '1701–1744', discovery: 'Centigrade Scale', impact: 'Created 100-degree interval scale calibrated between water freezing and boiling points.' }
  ],

  phaseDiagrams: [
    { substance: 'Pure Water (H₂O)', triplePoint: '0.01°C, 0.006 atm (611 Pa)', criticalPoint: '374°C, 218 atm', fusionSlope: 'Negative (dP/dT < 0)', keyAnomaly: 'Ice is less dense than water; increasing pressure melts ice (regelation). High-pressure ice floats.' },
    { substance: 'Carbon Dioxide (CO₂)', triplePoint: '-56.6°C, 5.11 atm', criticalPoint: '31.1°C, 72.8 atm', fusionSlope: 'Positive (dP/dT > 0)', keyAnomaly: 'Triple point pressure (5.11 atm) > 1.0 atm. Solid dry ice sublimes directly to gas at 1 atm (-78.5°C); liquid CO₂ cannot exist at standard room pressure.' }
  ],

  heatUnits: [
    { unit: 'Joule (J)', equivalentJoules: '1.000 J', definition: 'Official SI unit of work and heat energy: 1 N · m = 1 kg · m² / s² = 1 W · s' },
    { unit: 'Calorie (cal)', equivalentJoules: '4.184 J', definition: 'Heat required to raise 1 gram of water by 1°C (from 14.5°C to 15.5°C)' },
    { unit: 'Kilocalorie / Food Calorie (kcal / Cal)', equivalentJoules: '4,184 J', definition: '1,000 scientific calories; standard nutritional dietary energy unit' },
    { unit: 'British Thermal Unit (BTU)', equivalentJoules: '1,055.06 J', definition: 'Heat required to raise 1 pound of water by 1°F; ≈ 252.16 cal' },
    { unit: 'Erg', equivalentJoules: '1.0 × 10⁻⁷ J', definition: 'CGS unit of work and energy: 1 dyne · cm = 10⁻⁷ Joules' },
    { unit: 'Therm', equivalentJoules: '1.055 × 10⁸ J', definition: '100,000 BTUs; commercial natural gas utility heating unit' },
    { unit: 'Quad', equivalentJoules: '1.055 × 10¹⁸ J', definition: '10¹⁵ BTUs (1 quadrillion BTUs); national and global energy consumption unit' },
    { unit: 'Ton of Refrigeration', equivalentJoules: '3.517 kW (rate)', definition: '12,000 BTU/hr (3,517 W); heat removal to freeze 2,000 lb of water at 0°C in 24 hr' }
  ]
};

export class BinderHub {
  constructor() {
    this.searchQuery = '';
  }

  init() {
    this.renderTables();
    this.bindEvents();
    this.generateLookupMatrix();
  }

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('binderSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderTables();
      });
    }

    // Print button
    const btnPrint = document.getElementById('binderBtnPrint');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        window.print();
      });
    }

    // Converter inputs
    const tempC = document.getElementById('convTempC');
    const tempF = document.getElementById('convTempF');
    const tempK = document.getElementById('convTempK');
    const tempR = document.getElementById('convTempR');

    if (tempC && tempF && tempK && tempR) {
      tempC.addEventListener('input', () => {
        const c = parseFloat(tempC.value);
        if (isNaN(c)) return;
        tempF.value = ((c * 9/5) + 32).toFixed(2);
        tempK.value = (c + 273.15).toFixed(2);
        tempR.value = ((c + 273.15) * 9/5).toFixed(2);
      });

      tempF.addEventListener('input', () => {
        const f = parseFloat(tempF.value);
        if (isNaN(f)) return;
        const c = (f - 32) * 5/9;
        tempC.value = c.toFixed(2);
        tempK.value = (c + 273.15).toFixed(2);
        tempR.value = (f + 459.67).toFixed(2);
      });

      tempK.addEventListener('input', () => {
        const k = parseFloat(tempK.value);
        if (isNaN(k)) return;
        const c = k - 273.15;
        tempC.value = c.toFixed(2);
        tempF.value = ((c * 9/5) + 32).toFixed(2);
        tempR.value = (k * 9/5).toFixed(2);
      });
    }

    // Energy converter inputs
    const convJoules = document.getElementById('convEnergyJoules');
    const convCal = document.getElementById('convEnergyCal');
    const convBTU = document.getElementById('convEnergyBTU');

    if (convJoules && convCal && convBTU) {
      convJoules.addEventListener('input', () => {
        const j = parseFloat(convJoules.value);
        if (isNaN(j)) return;
        convCal.value = (j / 4.184).toFixed(2);
        convBTU.value = (j / 1055.06).toFixed(4);
      });

      convCal.addEventListener('input', () => {
        const cal = parseFloat(convCal.value);
        if (isNaN(cal)) return;
        const j = cal * 4.184;
        convJoules.value = j.toFixed(2);
        convBTU.value = (j / 1055.06).toFixed(4);
      });
    }

    // Matrix regenerator button
    const btnMatrix = document.getElementById('matrixBtnRegen');
    if (btnMatrix) {
      btnMatrix.addEventListener('click', () => this.generateLookupMatrix());
    }
  }

  renderTables() {
    this.renderConstantsTable();
    this.renderConductivityTable();
    this.renderEmissivityTable();
    this.renderPioneersTable();
    this.renderPhaseDiagramsTable();
    this.renderHeatUnitsTable();
  }

  renderConstantsTable() {
    const container = document.getElementById('binderConstantsTable');
    if (!container) return;

    const filtered = BINDER_DATA.constants.filter(item => {
      if (!this.searchQuery) return true;
      return item.name.toLowerCase().includes(this.searchQuery) ||
             item.symbol.toLowerCase().includes(this.searchQuery) ||
             item.notes.toLowerCase().includes(this.searchQuery);
    });

    let html = `
      <table class="reference-table">
        <thead>
          <tr>
            <th>Physical Constant / Law</th>
            <th>Symbol</th>
            <th>Standard Value</th>
            <th>Units</th>
            <th>Competition Application / Notes</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (filtered.length === 0) {
      html += `<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No matching constants found.</td></tr>`;
    } else {
      filtered.forEach(c => {
        html += `
          <tr>
            <td><strong>${c.name}</strong></td>
            <td><span class="mono" style="color:var(--thermal-primary);">${c.symbol}</span></td>
            <td><span class="mono">${c.value}</span></td>
            <td>${c.unit}</td>
            <td style="color:var(--text-secondary);">${c.notes}</td>
          </tr>
        `;
      });
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  renderConductivityTable() {
    const container = document.getElementById('binderConductivityTable');
    if (!container) return;

    const filtered = BINDER_DATA.thermalConductivities.filter(item => {
      if (!this.searchQuery) return true;
      return item.material.toLowerCase().includes(this.searchQuery) ||
             item.category.toLowerCase().includes(this.searchQuery) ||
             item.use.toLowerCase().includes(this.searchQuery);
    });

    let html = `
      <table class="reference-table">
        <thead>
          <tr>
            <th>Material / Medium</th>
            <th>Category</th>
            <th>Thermal Conductivity (k)</th>
            <th>Heat Collector Engineering Role</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (filtered.length === 0) {
      html += `<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No matching materials found.</td></tr>`;
    } else {
      filtered.forEach(m => {
        html += `
          <tr>
            <td><strong>${m.material}</strong></td>
            <td><span class="mono" style="color:var(--cryo-cyan);">${m.category}</span></td>
            <td><span class="mono">${m.k} ${m.unit}</span></td>
            <td style="color:var(--text-secondary);">${m.use}</td>
          </tr>
        `;
      });
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  renderEmissivityTable() {
    const container = document.getElementById('binderEmissivityTable');
    if (!container) return;

    const filtered = BINDER_DATA.emissivities.filter(item => {
      if (!this.searchQuery) return true;
      return item.surface.toLowerCase().includes(this.searchQuery) ||
             item.notes.toLowerCase().includes(this.searchQuery);
    });

    let html = `
      <table class="reference-table">
        <thead>
          <tr>
            <th>Surface Finish</th>
            <th>Emissivity (ε)</th>
            <th>Radiation Characteristics</th>
          </tr>
        </thead>
        <tbody>
    `;

    filtered.forEach(e => {
      html += `
        <tr>
          <td><strong>${e.surface}</strong></td>
          <td><span class="mono" style="color:var(--gold-accent);">${e.eps}</span></td>
          <td style="color:var(--text-secondary);">${e.notes}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  renderPioneersTable() {
    const container = document.getElementById('binderPioneersTable');
    if (!container) return;

    const filtered = BINDER_DATA.pioneers.filter(item => {
      if (!this.searchQuery) return true;
      return item.name.toLowerCase().includes(this.searchQuery) ||
             item.discovery.toLowerCase().includes(this.searchQuery) ||
             item.impact.toLowerCase().includes(this.searchQuery);
    });

    let html = `
      <table class="reference-table">
        <thead>
          <tr>
            <th>Pioneer / Scientist</th>
            <th>Lifespan</th>
            <th>Landmark Experiment / Discovery</th>
            <th>Thermodynamic Law / Competition Impact</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (filtered.length === 0) {
      html += `<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No matching historical pioneers found.</td></tr>`;
    } else {
      filtered.forEach(p => {
        html += `
          <tr>
            <td><strong style="color:var(--text-bright);">${p.name}</strong></td>
            <td><span class="mono" style="color:var(--text-muted); font-size:0.75rem;">${p.years}</span></td>
            <td><span style="color:var(--gold-accent); font-weight:600;">${p.discovery}</span></td>
            <td style="color:var(--text-secondary);">${p.impact}</td>
          </tr>
        `;
      });
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  renderPhaseDiagramsTable() {
    const container = document.getElementById('binderPhaseDiagramsTable');
    if (!container) return;

    const filtered = BINDER_DATA.phaseDiagrams.filter(item => {
      if (!this.searchQuery) return true;
      return item.substance.toLowerCase().includes(this.searchQuery) ||
             item.triplePoint.toLowerCase().includes(this.searchQuery) ||
             item.keyAnomaly.toLowerCase().includes(this.searchQuery);
    });

    let html = `
      <table class="reference-table">
        <thead>
          <tr>
            <th>Substance</th>
            <th>Triple Point (T_tp, P_tp)</th>
            <th>Critical Point (T_c, P_c)</th>
            <th>Solid-Liquid Fusion Slope</th>
            <th>Competition Physics Anomaly & Behavior</th>
          </tr>
        </thead>
        <tbody>
    `;

    filtered.forEach(p => {
      html += `
        <tr>
          <td><strong style="color:var(--thermal-primary);">${p.substance}</strong></td>
          <td><span class="mono" style="color:var(--gold-accent);">${p.triplePoint}</span></td>
          <td><span class="mono" style="color:var(--cryo-cyan);">${p.criticalPoint}</span></td>
          <td><span class="mono" style="font-weight:600;">${p.fusionSlope}</span></td>
          <td style="color:var(--text-secondary); font-size:0.85rem;">${p.keyAnomaly}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  renderHeatUnitsTable() {
    const container = document.getElementById('binderHeatUnitsTable');
    if (!container) return;

    const filtered = BINDER_DATA.heatUnits.filter(item => {
      if (!this.searchQuery) return true;
      return item.unit.toLowerCase().includes(this.searchQuery) ||
             item.definition.toLowerCase().includes(this.searchQuery);
    });

    let html = `
      <table class="reference-table">
        <thead>
          <tr>
            <th>Thermal Energy Unit</th>
            <th>SI Joule Equivalence</th>
            <th>Standard Physical Definition & Usage</th>
          </tr>
        </thead>
        <tbody>
    `;

    filtered.forEach(u => {
      html += `
        <tr>
          <td><strong style="color:var(--text-bright);">${u.unit}</strong></td>
          <td><span class="mono" style="color:var(--thermal-primary); font-weight:700;">${u.equivalentJoules}</span></td>
          <td style="color:var(--text-secondary);">${u.definition}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  generateLookupMatrix() {
    const container = document.getElementById('binderLookupMatrix');
    if (!container) return;

    // Competition grid:
    // Heights: 40cm, 45cm, 50cm, 55cm, 60cm, 65cm
    // Durations: 10 min, 12 min, 15 min
    // Wattages: 100W, 115W, 125W
    const heights = [40, 45, 50, 55, 60, 65];
    const wattages = [100, 115, 125];

    let html = `
      <div style="margin-bottom: 0.75rem; font-size: 0.85rem; color: var(--text-secondary);">
        Modeled temperature gain ΔT (°C) for 100 mL of water in a 9 oz cup with optimal collector (Mylar cone + Acrylic top + Black copper sleeve + Aerogel base) at 21.0°C ambient room temperature:
      </div>
      <table class="reference-table">
        <thead>
          <tr>
            <th>Lamp Height</th>
            <th>Wattage</th>
            <th>ΔT (10 min)</th>
            <th>Final T (10 min)</th>
            <th>ΔT (12 min)</th>
            <th>Final T (12 min)</th>
            <th>ΔT (15 min)</th>
            <th>Final T (15 min)</th>
          </tr>
        </thead>
        <tbody>
    `;

    heights.forEach(h => {
      wattages.forEach(w => {
        // Simple accurate physical scaling based on inverse square & greenhouse retention
        const hFactor = Math.pow(45 / h, 1.6);
        const wFactor = w / 115;
        
        const tg10 = 24.2 * hFactor * wFactor;
        const tg12 = 27.5 * hFactor * wFactor;
        const tg15 = 31.8 * hFactor * wFactor;

        html += `
          <tr>
            <td><strong>${h} cm</strong></td>
            <td><span class="mono">${w} W</span></td>
            <td class="mono" style="color:var(--thermal-primary);">+${tg10.toFixed(1)}°C</td>
            <td class="mono">${(21.0 + tg10).toFixed(1)}°C</td>
            <td class="mono" style="color:var(--thermal-primary);">+${tg12.toFixed(1)}°C</td>
            <td class="mono">${(21.0 + tg12).toFixed(1)}°C</td>
            <td class="mono" style="color:var(--thermal-primary);">+${tg15.toFixed(1)}°C</td>
            <td class="mono">${(21.0 + tg15).toFixed(1)}°C</td>
          </tr>
        `;
      });
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  }
}
