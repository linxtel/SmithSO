/**
 * ThermoOlyMaster - Core Physics & Competition Scoring Engine
 * Accurately models heat lamp radiative flux, thermal absorption,
 * convective/conductive losses, and official 2027 Division B scoring rules.
 */

export const CONSTANTS = {
  STEFAN_BOLTZMANN: 5.670374e-8, // W / (m^2 K^4)
  WATER_SPECIFIC_HEAT: 4184,     // J / (kg * C)
  WATER_MASS_100ML: 0.100,       // kg (100 mL of water)
  ICE_SPECIFIC_HEAT: 2090,       // J / (kg * C)
  STEAM_SPECIFIC_HEAT: 2010,     // J / (kg * C)
  LATENT_HEAT_FUSION: 334000,    // J / kg
  LATENT_HEAT_VAPOR: 2260000,    // J / kg
  GAS_CONSTANT_R: 8.314462,      // J / (mol * K)
  CUP_SURFACE_AREA: 0.024        // m^2 (approx for 9 oz cup)
};

/**
 * Computes radiative irradiance incident on the collector opening from the heat lamp.
 * @param {number} wattage - Lamp wattage (100 to 125 W)
 * @param {number} heightCm - Bulb height above surface (40 to 65 cm)
 * @returns {number} Irradiance in W / m^2
 */
export function computeLampIrradiance(wattage, heightCm) {
  const h = heightCm / 100; // convert to meters
  // Incandescent heat lamp with metal reflector: approx 75% radiated in a directional cone
  const radiantPower = wattage * 0.75;
  // Reflector creates forward directional gain factor of approx 2.5
  const reflectorGain = 2.5;
  const solidAngleArea = 2 * Math.PI * (h * h);
  return (radiantPower * reflectorGain) / solidAngleArea;
}

/**
 * Calculates instantaneous net heat flow into the 100 mL water cup.
 * @param {Object} config - Device design configuration
 * @param {number} heightCm - Lamp height (40 to 65 cm)
 * @param {number} wattage - Lamp wattage (100 to 125 W)
 * @param {number} T_water - Current water temperature (°C)
 * @param {number} T_amb - Ambient room temperature (°C)
 * @returns {Object} Heat flux components in Watts and net dT/dt (°C/s)
 */
export function computeCollectorHeatFlow(config, heightCm, wattage, T_water, T_amb, elapsedSeconds = null) {
  let irradiance = computeLampIrradiance(wattage, heightCm);

  // Lamp filament warm-up transient curve: reaches ~95% output after ~60 seconds
  if (elapsedSeconds !== null && elapsedSeconds !== undefined) {
    const warmUpFactor = Math.min(1.0, 1.0 - Math.exp(-Math.max(0, elapsedSeconds) / 22));
    irradiance *= warmUpFactor;
  }

  // 1. Aperture Collection Area (m^2)
  // 30x30 cm max cube limit
  let apertureDiameterMeters = 0.075; // bare cup mouth ~ 3.0 inches = 7.6 cm
  if (config.concentrator === 'mylar_cone') apertureDiameterMeters = 0.26;
  else if (config.concentrator === 'al_funnel') apertureDiameterMeters = 0.22;
  else if (config.concentrator === 'flat_mirrors') apertureDiameterMeters = 0.18;

  const apertureArea = Math.PI * Math.pow(apertureDiameterMeters / 2, 2);

  // Optical concentration and reflection efficiency
  let opticalEfficiency = 0.45; // baseline bare cup
  if (config.concentrator === 'mylar_cone') opticalEfficiency = 0.88;
  else if (config.concentrator === 'al_funnel') opticalEfficiency = 0.76;
  else if (config.concentrator === 'flat_mirrors') opticalEfficiency = 0.62;

  // 2. Greenhouse Top Window Transmittance & Convection Suppression
  let windowTransmittance = 1.0;
  let convectionSuppression = 1.0; // 1 = full open-air convective loss
  if (config.greenhouseTop === 'acrylic') {
    windowTransmittance = 0.90;
    convectionSuppression = 0.15; // blocks 85% of top convective escape
  } else if (config.greenhouseTop === 'glass') {
    windowTransmittance = 0.92;
    convectionSuppression = 0.12;
  } else if (config.greenhouseTop === 'perforated') {
    windowTransmittance = 0.95;
    convectionSuppression = 0.45;
  }

  // 3. Absorber Sleeve Efficiency
  let absorptionAlpha = 0.35; // clear cup baseline
  if (config.absorber === 'matte_black_copper') absorptionAlpha = 0.95;
  else if (config.absorber === 'matte_black_foil') absorptionAlpha = 0.88;
  else if (config.absorber === 'dark_plastic') absorptionAlpha = 0.70;

  // Total incoming absorbed radiative power (Watts = Joules/sec)
  const powerIn = irradiance * apertureArea * opticalEfficiency * windowTransmittance * absorptionAlpha;

  // 4. Heat Losses: Conduction through base & sides
  let insulationRValue = 0.08; // baseline table contact
  if (config.insulation === 'aerogel') insulationRValue = 1.20;
  else if (config.insulation === 'xps_foam') insulationRValue = 0.85;
  else if (config.insulation === 'bubble_wrap') insulationRValue = 0.35;
  else if (config.insulation === 'wood') insulationRValue = 0.20;

  const deltaT = T_water - T_amb;

  // Conduction loss
  const conductionLoss = (CONSTANTS.CUP_SURFACE_AREA * deltaT) / insulationRValue;

  // Convective loss from top
  const baseConvectionCoeff = 12.0; // W / (m^2 * C) natural convection
  const topArea = Math.PI * Math.pow(0.075 / 2, 2);
  const convectionLoss = baseConvectionCoeff * topArea * Math.max(0, deltaT) * convectionSuppression;

  // Radiative loss from warm water surface
  const T_w_kelvin = T_water + 273.15;
  const T_a_kelvin = T_amb + 273.15;
  const radiationLoss = 0.95 * CONSTANTS.STEFAN_BOLTZMANN * topArea * (Math.pow(T_w_kelvin, 4) - Math.pow(T_a_kelvin, 4));

  const totalLoss = Math.max(0, conductionLoss + convectionLoss + radiationLoss);
  const netPower = powerIn - totalLoss;

  // dT/dt = netPower / (mass * specific_heat)
  const thermalMass = CONSTANTS.WATER_MASS_100ML * CONSTANTS.WATER_SPECIFIC_HEAT; // 418.4 J / °C
  const rateOfTempChange = netPower / thermalMass; // °C per second

  return {
    powerIn,
    conductionLoss,
    convectionLoss,
    radiationLoss,
    totalLoss,
    netPower,
    rateOfTempChange
  };
}

/**
 * Steps the thermal simulation forward by dt seconds.
 */
export function stepSimulation(currentTemp, config, heightCm, wattage, T_amb, dt = 1.0, elapsedSeconds = null) {
  const heat = computeCollectorHeatFlow(config, heightCm, wattage, currentTemp, T_amb, elapsedSeconds);
  const newTemp = currentTemp + (heat.rateOfTempChange * dt);
  return {
    temperature: Math.max(T_amb, newTemp),
    heat
  };
}

/**
 * Evaluates whether the device geometry complies with the official 30x30x30 cm max cube limit (Rule 3.a).
 */
export function checkDeviceDimensions(config) {
  let widthCm = 8.0;
  let depthCm = 8.0;
  let heightCm = 11.0;

  if (config.concentrator === 'mylar_cone') {
    widthCm = 26.0;
    depthCm = 26.0;
    heightCm = 24.0;
  } else if (config.concentrator === 'al_funnel') {
    widthCm = 22.0;
    depthCm = 22.0;
    heightCm = 20.0;
  } else if (config.concentrator === 'flat_mirrors') {
    widthCm = 20.0;
    depthCm = 20.0;
    heightCm = 18.0;
  }

  const isCompliant = widthCm <= 30.0 && depthCm <= 30.0 && heightCm <= 30.0;
  return {
    widthCm,
    depthCm,
    heightCm,
    maxLimitCm: 30.0,
    isCompliant,
    statusText: isCompliant ? 'Rule 3.a Compliant (≤ 30.0 cm cube)' : 'Violation: Exceeds 30 cm dimension limit'
  };
}

/**
 * Computes water thermal stratification based on thermometer immersion depth (Rule 5.b).
 * @param {number} bulkTemp - Bulk average water temperature (°C)
 * @param {number} ambientTemp - Room temperature (°C)
 * @param {'surface'|'mid'|'bottom'} depth - Probe position
 */
export function getStratifiedTemperature(bulkTemp, ambientTemp, depth = 'mid') {
  const deltaT = Math.max(0, bulkTemp - ambientTemp);
  if (depth === 'surface') {
    return bulkTemp + (deltaT * 0.05);
  } else if (depth === 'bottom') {
    return Math.max(ambientTemp, bulkTemp - (deltaT * 0.04));
  }
  return bulkTemp;
}

/**
 * Computes official 2027 Division B Science Olympiad Scores.
 * FS = ES + TS + PS (Max: 100 points)
 */
export function calculateOfficialScores({
  part1Score = 0,
  highPart1 = 50,
  finalTemp = 20,
  startTemp = 20,
  highTG = 15,
  predTemp = 20,
  highPE = 1.0,
  compViolations = 0,
  constrViolations = 0,
  touchedDuringHeating = false,
  prohibitedMaterials = false,
  missingPrediction = false
}) {
  // 1. Exam Score (ES, Max 50 pts)
  const esRaw = highPart1 > 0 ? (part1Score / highPart1) * 50 : 0;
  const es = Math.min(50, Math.max(0, Number(esRaw.toFixed(2))));

  // 2. Temperature Score (TS, Max 30 pts)
  const tg = Math.max(0, finalTemp - startTemp);
  let tsRaw = highTG > 0 ? (tg / highTG) * 30 : 0;

  // 3. Prediction Score (PS, Max 20 pts)
  const pe = finalTemp > 0 ? Math.max(0, 1 - (Math.abs(finalTemp - predTemp) / finalTemp)) : 0;
  let psRaw = highPE > 0 ? (pe / highPE) * 20 : 0;

  // Penalties
  let penaltyMultiplier = 1.0;
  if (compViolations > 0) penaltyMultiplier *= Math.pow(0.9, compViolations);
  if (constrViolations > 0) penaltyMultiplier *= Math.pow(0.7, constrViolations);

  tsRaw *= penaltyMultiplier;
  psRaw *= penaltyMultiplier;

  // Immediate Zeros
  if (touchedDuringHeating || prohibitedMaterials) {
    tsRaw = 0;
    psRaw = 0;
  }
  if (missingPrediction) {
    psRaw = 0;
  }

  const ts = Math.min(30, Math.max(0, Number(tsRaw.toFixed(2))));
  const ps = Math.min(20, Math.max(0, Number(psRaw.toFixed(2))));
  const fs = Number((es + ts + ps).toFixed(2));

  return {
    examScore: es,
    tempGain: Number(tg.toFixed(2)),
    tempScore: ts,
    predictionEstimate: Number(pe.toFixed(4)),
    predictionScore: ps,
    finalScore: fs,
    penaltyMultiplier: Number(penaltyMultiplier.toFixed(3)),
    penalized: penaltyMultiplier < 1.0 || touchedDuringHeating || missingPrediction
  };
}

/**
 * Computes thermodynamic cycle states and efficiencies for PV diagrams.
 */
export function computeCycleDynamics(cycleType, params = {}) {
  const n = params.moles || 0.05; // ~0.05 moles of air
  const R = CONSTANTS.GAS_CONSTANT_R;
  const gamma = 1.4; // diatomic air

  if (cycleType === 'carnot') {
    const Th = params.Th || 450; // K
    const Tc = params.Tc || 300; // K
    const V1 = params.V1 || 0.001; // m^3
    const V2 = params.V2 || 0.002;
    // Carnot efficiency
    const eta = 1 - (Tc / Th);
    const Qh = n * R * Th * Math.log(V2 / V1);
    const W_net = eta * Qh;
    const Qc = Qh - W_net;
    return {
      name: 'Carnot Cycle',
      Th,
      Tc,
      efficiency: eta,
      efficiencyPercent: (eta * 100).toFixed(1),
      workNet: W_net,
      heatIn: Qh,
      heatOut: Qc,
      description: 'Maximum theoretical efficiency possible between two thermal reservoirs.'
    };
  }

  if (cycleType === 'otto') {
    const r = params.compressionRatio || 8.0;
    const eta = 1 - (1 / Math.pow(r, gamma - 1));
    return {
      name: 'Ideal Otto Cycle',
      compressionRatio: r,
      efficiency: eta,
      efficiencyPercent: (eta * 100).toFixed(1),
      description: 'Standard 4-stroke internal combustion engine model with isochoric heat addition.'
    };
  }

  return {
    name: 'General PV Cycle',
    efficiency: 0.25,
    efficiencyPercent: '25.0',
    description: 'Custom state diagram.'
  };
}

/**
 * Computes Stefan-Boltzmann radiant exitance and total emitted power.
 */
export function computeStefanBoltzmann(tempCelsius, emissivity = 0.95, areaM2 = 0.05) {
  const T_kelvin = tempCelsius + 273.15;
  const exitance = emissivity * CONSTANTS.STEFAN_BOLTZMANN * Math.pow(T_kelvin, 4); // W/m^2
  const totalPower = exitance * areaM2; // Watts
  return {
    T_kelvin,
    exitance: Number(exitance.toFixed(1)),
    totalPower: Number(totalPower.toFixed(2))
  };
}
