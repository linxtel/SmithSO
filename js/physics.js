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
  LATENT_HEAT_VAPOR: 2260000,    // J / kg (2.26 MJ/kg)
  GAS_CONSTANT_R: 8.314462,      // J / (mol * K)
  CUP_SURFACE_AREA: 0.024,       // m^2 (approx for 9 oz cup)
  CUP_THERMAL_CAPACITY: 14.5     // J / C (10g polystyrene vessel)
};

/**
 * Material thermophysical properties for cup absorber sleeves.
 */
export const SLEEVE_PROPERTIES = {
  matte_black_copper: {
    name: 'Matte Black Copper Sleeve',
    alpha: 0.95,
    thermalConductivity: 390, // W/(m*K)
    massKg: 0.045,            // 45g sleeve
    specificHeat: 385,        // J/(kg*K)
    heatCapacity: 17.3,       // J/K
    emissivity: 0.88
  },
  matte_black_foil: {
    name: 'Matte Black Aluminum Foil',
    alpha: 0.88,
    thermalConductivity: 205,
    massKg: 0.009,            // 9g foil wrap
    specificHeat: 900,
    heatCapacity: 8.1,        // J/K
    emissivity: 0.82
  },
  dark_plastic: {
    name: 'Dark Plastic Wrap',
    alpha: 0.70,
    thermalConductivity: 0.20,
    massKg: 0.006,
    specificHeat: 1600,
    heatCapacity: 9.6,        // J/K
    emissivity: 0.92
  },
  clear_cup: {
    name: 'Bare Clear 9 oz Plastic Cup',
    alpha: 0.35,
    thermalConductivity: 0.15,
    massKg: 0.0,
    specificHeat: 1450,
    heatCapacity: 0.0,
    emissivity: 0.90
  }
};

/**
 * Computes water saturation vapor pressure using Tetens formula.
 * @param {number} tempCelsius - Water temperature in Celsius
 * @returns {number} Saturation vapor pressure in Pascals (Pa)
 */
export function computeSaturationVaporPressure(tempCelsius) {
  return 610.78 * Math.exp((17.27 * tempCelsius) / (tempCelsius + 237.3));
}

/**
 * Computes evaporative mass loss and latent heat flux from the water surface.
 * Dalton's / Carrier's empirical relations for water surface evaporation.
 */
export function computeEvaporationLoss(T_water, T_amb, relativeHumidity = 0.45, airVelocity = 0.15, hasLid = false) {
  const topArea = Math.PI * Math.pow(0.075 / 2, 2); // ~0.00442 m^2
  const pSatWater = computeSaturationVaporPressure(T_water);
  const pAmbVapor = computeSaturationVaporPressure(T_amb) * Math.max(0.1, Math.min(1.0, relativeHumidity));
  const deltaP_kPa = Math.max(0, (pSatWater - pAmbVapor) / 1000);

  // Evaporation coefficient kg / (m^2 * s * kPa)
  const v = Math.max(0.05, airVelocity);
  let massRateKgS = (0.075 + 0.065 * v) * (deltaP_kPa / 101.325) * topArea;

  if (hasLid) {
    // Transparent lid keeps headspace saturated and impedes mass escape by ~92%
    massRateKgS *= 0.08;
  }

  const powerLossWatts = massRateKgS * CONSTANTS.LATENT_HEAT_VAPOR;
  const evapGramsMin = massRateKgS * 1000 * 60; // g / min

  return {
    powerLossWatts,
    massRateKgS,
    evapGramsMin
  };
}

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
 * Calculates instantaneous net heat flow into the 100 mL water cup and absorber sleeve.
 * Models multi-body thermal mass, wall conduction resistance, and latent evaporative loss.
 */
export function computeCollectorHeatFlow(config, heightCm, wattage, T_water, T_amb, elapsedSeconds = null, options = {}) {
  let irradiance = computeLampIrradiance(wattage, heightCm);

  // Lamp filament and shroud warm-up transient curve: reaches ~95% output after ~60 seconds
  if (elapsedSeconds !== null && elapsedSeconds !== undefined) {
    const warmUpFactor = Math.min(1.0, 1.0 - Math.exp(-Math.max(0, elapsedSeconds) / 22));
    irradiance *= warmUpFactor;
  }

  // 1. Aperture Collection Area (m^2)
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
  const hasLid = config.greenhouseTop === 'acrylic' || config.greenhouseTop === 'glass';

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

  // If condensation dew is present under lid, slightly reduce transmittance
  const condensationLevel = options.condensation || 0;
  if (hasLid && condensationLevel > 0) {
    windowTransmittance *= (1.0 - 0.06 * Math.min(1.0, condensationLevel));
  }

  // 3. Absorber Sleeve Properties
  const sleeveKey = config.absorber || 'clear_cup';
  const sleeveProp = SLEEVE_PROPERTIES[sleeveKey] || SLEEVE_PROPERTIES.clear_cup;
  const absorptionAlpha = sleeveProp.alpha;

  // Total incoming absorbed radiative power (Watts = Joules/sec)
  const powerIn = irradiance * apertureArea * opticalEfficiency * windowTransmittance * absorptionAlpha;

  // Split absorbed power: ~85% absorbed into sleeve circumference, ~15% direct into top aperture water
  const sleevePowerIn = sleeveKey === 'clear_cup' ? powerIn * 0.35 : powerIn * 0.85;
  const directTopPowerIn = powerIn - sleevePowerIn;

  // 4. Sleeve Thermal Balance
  const T_sleeve = options.T_sleeve !== undefined ? options.T_sleeve : T_water;
  const sleeveCapacity = Math.max(2.0, sleeveProp.heatCapacity); // J/K

  // Radial wall conduction resistance R_wall between sleeve and inner water
  // Cup thickness ~0.6mm, area 0.020 m^2, plastic k ~ 0.15 W/(m*K) + water boundary layer
  const R_wall = sleeveKey === 'clear_cup' ? 0.05 : 0.38; // K / W
  const sleeveToWaterConduction = (T_sleeve - T_water) / R_wall;

  // Insulation R-Value
  let insulationRValue = 0.08; // baseline table contact
  if (config.insulation === 'aerogel') insulationRValue = 1.20;
  else if (config.insulation === 'xps_foam') insulationRValue = 0.85;
  else if (config.insulation === 'bubble_wrap') insulationRValue = 0.35;
  else if (config.insulation === 'wood') insulationRValue = 0.20;

  // Heat loss outward from sleeve through exterior insulation
  const sleeveExtLoss = (CONSTANTS.CUP_SURFACE_AREA * Math.max(0, T_sleeve - T_amb)) / insulationRValue;

  // Net power into sleeve
  const netSleevePower = sleevePowerIn - sleeveExtLoss - sleeveToWaterConduction;
  const sleeveRateOfChange = netSleevePower / sleeveCapacity; // °C/s

  // 5. Water Losses: Convection, Radiation, Bottom Conduction, and Latent Evaporation
  const deltaT = Math.max(0, T_water - T_amb);

  // Convective loss from water top surface
  const draftVelocity = options.draftVelocity || 0.15; // m/s room draft
  const baseConvectionCoeff = 10.0 + (5.0 * draftVelocity); // W / (m^2 * C)
  const topArea = Math.PI * Math.pow(0.075 / 2, 2);
  const convectionLoss = baseConvectionCoeff * topArea * deltaT * convectionSuppression;

  // Radiative loss from warm water surface
  const T_w_kelvin = T_water + 273.15;
  const T_a_kelvin = T_amb + 273.15;
  const radiationLoss = 0.95 * CONSTANTS.STEFAN_BOLTZMANN * topArea * (Math.pow(T_w_kelvin, 4) - Math.pow(T_a_kelvin, 4));

  // Latent evaporative loss from water surface
  const evap = computeEvaporationLoss(T_water, T_amb, options.relativeHumidity || 0.45, draftVelocity, hasLid);
  const evaporationLoss = evap.powerLossWatts;

  // Bottom conduction loss into base insulation
  const bottomArea = Math.PI * Math.pow(0.060 / 2, 2);
  const bottomConductionLoss = (bottomArea * deltaT) / insulationRValue;

  // Net power into water vessel (water + polystyrene cup vessel)
  const waterPowerIn = sleeveToWaterConduction + directTopPowerIn;
  const waterPowerLoss = convectionLoss + radiationLoss + evaporationLoss + bottomConductionLoss;
  const netPower = waterPowerIn - waterPowerLoss;

  // Total vessel thermal mass: 100 mL water (418.4 J/K) + cup (14.5 J/K)
  const totalWaterThermalMass = (CONSTANTS.WATER_MASS_100ML * CONSTANTS.WATER_SPECIFIC_HEAT) + CONSTANTS.CUP_THERMAL_CAPACITY;
  const rateOfTempChange = netPower / totalWaterThermalMass; // °C per second

  return {
    powerIn,
    sleevePowerIn,
    directTopPowerIn,
    sleeveToWaterConduction,
    sleeveExtLoss,
    conductionLoss: bottomConductionLoss,
    convectionLoss,
    radiationLoss,
    evaporationLoss,
    evapRateGramsMin: evap.evapGramsMin,
    totalLoss: waterPowerLoss,
    netPower,
    rateOfTempChange,
    sleeveRateOfChange,
    T_sleeve
  };
}

/**
 * Steps the thermal simulation forward by dt seconds.
 * Supports coupled sleeve thermal mass, water temperature, probe lag, and lid condensation.
 */
export function stepSimulation(state, config, heightCm, wattage, T_amb, dt = 1.0, elapsedSeconds = null, options = {}) {
  let T_water = typeof state === 'number' ? state : (state.T_water || state.temperature || 21.0);
  let T_sleeve = (typeof state === 'object' && state.T_sleeve !== undefined) ? state.T_sleeve : T_water;
  let T_probe = (typeof state === 'object' && state.T_probe !== undefined) ? state.T_probe : T_water;
  let condensation = (typeof state === 'object' && state.condensation !== undefined) ? state.condensation : 0.0;
  const probeDepth = options.probeDepth || (typeof state === 'object' ? state.probeDepth : 'mid') || 'mid';
  const draftVelocity = options.draftVelocity || 0.15;
  const relativeHumidity = options.relativeHumidity || 0.45;

  const heat = computeCollectorHeatFlow(
    config, 
    heightCm, 
    wattage, 
    T_water, 
    T_amb, 
    elapsedSeconds, 
    { T_sleeve, probeDepth, draftVelocity, relativeHumidity, condensation }
  );

  // Advance sleeve temperature
  const newSleeve = Math.max(T_amb, T_sleeve + (heat.sleeveRateOfChange * dt));

  // Advance water temperature
  const newWater = Math.max(T_amb, T_water + (heat.rateOfTempChange * dt));

  // Advance probe reading with thermal time constant (tau = 6.0s sensor inertia)
  const stratifiedTarget = getStratifiedTemperature(newWater, T_amb, probeDepth);
  const probeLagFactor = 1.0 - Math.exp(-dt / 6.0);
  const newProbe = T_probe + (stratifiedTarget - T_probe) * probeLagFactor;

  // Advance condensation accumulation if greenhouse lid is present
  const hasLid = config.greenhouseTop === 'acrylic' || config.greenhouseTop === 'glass';
  let newCondensation = condensation;
  if (hasLid) {
    if (newWater > T_amb + 2.0) {
      const targetCond = Math.min(0.85, (newWater - (T_amb + 2.0)) / 22.0);
      newCondensation = condensation + (targetCond - condensation) * (1.0 - Math.exp(-dt / 60.0));
    }
  } else {
    // Open cup: condensation dissipates
    newCondensation = Math.max(0, condensation - (dt / 15.0));
  }

  return {
    temperature: newWater, // backward-compatible alias
    T_water: newWater,
    T_sleeve: newSleeve,
    T_probe: newProbe,
    condensation: newCondensation,
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
