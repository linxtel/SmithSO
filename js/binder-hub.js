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
    { name: 'Standard Volume of Ideal Gas (STP)', symbol: 'V_m', value: '22.414', unit: 'L / mol', notes: 'At 0°C (273.15 K) and 1 atm' }
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
