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
 * Uses ASHRAE/Carrier empirical indoor water evaporation adjusted for a recessed
 * 100 mL water level inside a 9 oz cup (~3.5 cm freeboard).
 */
export function computeEvaporationLoss(T_water, T_amb, relativeHumidity = 0.45, airVelocity = 0.15, hasLid = false, isPerforated = false) {
  const topArea = Math.PI * Math.pow(0.075 / 2, 2); // ~0.00442 m^2
  const pSatWater = computeSaturationVaporPressure(T_water);
  const pAmbVapor = computeSaturationVaporPressure(T_amb) * Math.max(0.1, Math.min(1.0, relativeHumidity));
  const deltaP_kPa = Math.max(0, (pSatWater - pAmbVapor) / 1000);

  // ASHRAE/Carrier evaporation coefficient for recessed indoor cup: kg / (m^2 * s)
  const v = Math.max(0.05, airVelocity);
  let massRateKgS = (0.0022 + 0.0018 * v) * (deltaP_kPa / 101.325) * topArea;

  if (hasLid) {
    // Transparent lid keeps headspace saturated and impedes mass escape by ~92%
    massRateKgS *= 0.08;
  } else if (isPerforated) {
    // Perforated glazing partially traps humid headspace (~60% reduction)
    massRateKgS *= 0.40;
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
  // Incandescent BR40 heat lamp with metal reflector: approx 75% radiated in a directional cone
  const radiantPower = wattage * 0.75;
  // Reflector creates forward directional gain factor of approx 3.2
  const reflectorGain = 3.2;
  const solidAngleArea = 2 * Math.PI * (h * h);
  return (radiantPower * reflectorGain) / solidAngleArea;
}

/**
 * Returns the maximum Rule 3.a compliant cup elevation (cm) so the cup top rim
 * never exceeds the fixed reflective cone's upper edge (or the 30 cm cube limit).
 */
export function getMaxCupElevationCm(config) {
  if (!config || config.concentrator === 'bare_cup' || config.concentrator === 'none') {
    return 15.0; // bare cup (11.5 cm) + 15 cm riser = 26.5 cm <= 30.0 cm
  }
  if (config.concentrator === 'mylar_cone') return 8.5;
  if (config.concentrator === 'al_funnel') return 7.0;
  if (config.concentrator === 'flat_mirrors') return 6.0;
  return 8.5;
}

/**
 * Calculates instantaneous net heat flow into the 100 mL water cup and absorber sleeve.
 * Models cup elevation inside a stationary cone (inverse-square distance without breaking Rule 3.a),
 * cone depth (top-rim vs full-bottom side reflection), multi-body thermal mass, wall conduction resistance,
 * and latent evaporative loss.
 */
export function computeCollectorHeatFlow(config, heightCm, wattage, T_water, T_amb, elapsedSeconds = null, options = {}) {
  // Effective distance from heat lamp bulb to the cup opening (cup clamped to cone upper edge)
  const maxElevCm = getMaxCupElevationCm(config);
  const cupElevationCm = Math.max(0, Math.min(maxElevCm, Number(config.cupElevationCm) || 0));
  const effectiveHeightCm = Math.max(15, heightCm - cupElevationCm);

  let irradiance = computeLampIrradiance(wattage, effectiveHeightCm);

  // Lamp filament and shroud warm-up transient curve: reaches ~95% output after ~60 seconds
  if (elapsedSeconds !== null && elapsedSeconds !== undefined) {
    const warmUpFactor = Math.min(1.0, 1.0 - Math.exp(-Math.max(0, elapsedSeconds) / 22));
    irradiance *= warmUpFactor;
  }

  const hasCone = config.concentrator !== 'none' && config.concentrator !== 'bare_cup';
  const isFullDepthCone = hasCone && config.coneDepth === 'full_bottom';

  // 1. Aperture Collection Area (m^2)
  // Bare cup directly under lamp captures direct top aperture (7.5 cm) + illuminated upper cup walls (~9.5 cm effective)
  let apertureDiameterMeters = 0.095;
  if (hasCone) {
    let defaultDiamCm = 26.0;
    if (config.concentrator === 'al_funnel') defaultDiamCm = 22.0;
    else if (config.concentrator === 'flat_mirrors') defaultDiamCm = 20.0;
    const widthCm = config.coneTopWidthCm !== undefined && config.coneTopWidthCm !== null
      ? Math.max(9.5, Math.min(30.0, Number(config.coneTopWidthCm)))
      : defaultDiamCm;
    apertureDiameterMeters = widthCm / 100;
  }

  const apertureArea = Math.PI * Math.pow(apertureDiameterMeters / 2, 2);

  // Optical concentration and reflection efficiency
  // Direct incident light on a bare opening has no reflector bounce losses (~90% direct delivery)
  let opticalEfficiency = 0.90;
  if (config.concentrator === 'mylar_cone') opticalEfficiency = 0.88;
  else if (config.concentrator === 'al_funnel') opticalEfficiency = 0.76;
  else if (config.concentrator === 'flat_mirrors') opticalEfficiency = 0.62;

  // Off-axis beam intensity falloff & shallow-flare reflection loss near outer 30 cm rim
  const flareRatio = hasCone ? Math.max(0, (apertureDiameterMeters - 0.095) / 0.205) : 0;
  const beamUniformity = 1.0 - (0.14 * flareRatio * flareRatio);
  const effectiveOpticalEff = hasCone
    ? (0.90 * (1 - flareRatio) + opticalEfficiency * flareRatio) * beamUniformity
    : opticalEfficiency;

  // 2. Greenhouse Top Window Transmittance, Glazing Placement & Cavity Air Convection
  let windowTransmittance = 1.0;
  let convectionSuppression = 1.0; // 1 = full open-air convective loss
  const hasLid = config.greenhouseTop === 'acrylic' || config.greenhouseTop === 'glass';
  const isPerforated = config.greenhouseTop === 'perforated';
  const glazingPosition = (hasCone && (hasLid || isPerforated))
    ? (config.glazingPosition || 'cup_rim')
    : 'cup_rim';

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

  // Double glazing adds a second clear window (~8% extra reflection loss) but cuts convection further
  if (glazingPosition === 'double') {
    windowTransmittance *= 0.92;
    convectionSuppression *= 0.65;
  }

  // If condensation dew is present under lid, slightly reduce transmittance
  const condensationLevel = options.condensation || 0;
  if (hasLid && condensationLevel > 0) {
    windowTransmittance *= (1.0 - 0.06 * Math.min(1.0, condensationLevel));
  }

  // Compute enclosed cavity air volume (Liters) inside the reflective cone
  // Frustum volume V = (pi * h / 3) * (R_top^2 + R_top*R_bot + R_bot^2)
  let cavityAirLiters = 0.15; // minimal headspace inside bare cup
  if (hasCone) {
    const rTop = apertureDiameterMeters / 2;
    const rBot = 0.042;
    const hCone = isFullDepthCone ? 0.18 : 0.085;
    const frustumM3 = (Math.PI * hCone / 3) * (rTop * rTop + rTop * rBot + rBot * rBot);
    cavityAirLiters = Math.max(0.15, frustumM3 * 1000);
  }
  // Effective air thermal mass that must warm with the cavity (only significant when glazing is at cone_top)
  const cavityAirHeatCapacity = glazingPosition === 'cone_top'
    ? (cavityAirLiters * 0.0012 * 1005) // ~1.2 J/°C per liter of trapped air
    : (0.15 * 0.0012 * 1005);

  // 3. Absorber Sleeve Properties & Top/Side Radiation Split
  const sleeveKey = config.absorber || 'clear_cup';
  const sleeveProp = SLEEVE_PROPERTIES[sleeveKey] || SLEEVE_PROPERTIES.clear_cup;
  const absorptionAlpha = sleeveProp.alpha;

  const incidentAperturePower = irradiance * apertureArea; // Raw radiative watts entering collector opening

  // Primary top-entry absorbed power
  const topPowerIn = incidentAperturePower * effectiveOpticalEff * windowTransmittance * absorptionAlpha;

  // Side-wall reflected radiation when the reflective cone extends down to the cup bottom
  // Scales with flareRatio so a narrow cone (9.5 cm, flush with cup) has 0 annular side-reflection ring
  let sidePowerIn = 0;
  if (isFullDepthCone && flareRatio > 0.02) {
    // Annular reflected beam directed onto the cup's cylindrical side walls (up to ~0.022 m^2 at 30 cm rim)
    const sideCaptureArea = 0.022 * flareRatio;
    if (sleeveKey === 'clear_cup') {
      // Sleeve removed: reflected IR/visible radiation passes directly through clear cup walls into the water
      sidePowerIn = irradiance * sideCaptureArea * effectiveOpticalEff * windowTransmittance * 0.74;
    } else {
      // Opaque sleeve blocks direct side entry into water; reflected rays heat the exterior sleeve instead
      sidePowerIn = irradiance * sideCaptureArea * effectiveOpticalEff * windowTransmittance * absorptionAlpha * 0.42;
    }
  }

  // Total incoming absorbed radiative power (Watts = Joules/sec)
  const powerIn = topPowerIn + sidePowerIn;

  // Split absorbed power between exterior sleeve and direct water volume entry
  let sleevePowerIn;
  let directTopPowerIn;
  if (sleeveKey === 'clear_cup') {
    sleevePowerIn = topPowerIn * 0.35;
    directTopPowerIn = (topPowerIn - sleevePowerIn) + sidePowerIn;
  } else {
    sleevePowerIn = (topPowerIn * 0.85) + sidePowerIn;
    directTopPowerIn = topPowerIn * 0.15;
  }

  // 4. Sleeve Thermal Balance
  const isBarePlasticCup = sleeveKey === 'clear_cup';
  const T_sleeve = isBarePlasticCup ? T_water : (options.T_sleeve !== undefined ? options.T_sleeve : T_water);
  const sleeveCapacity = Math.max(8.0, sleeveProp.heatCapacity); // J/K

  // Insulation R-Value
  let insulationRValue = 0.08; // baseline table contact
  if (config.insulation === 'aerogel') insulationRValue = 1.20;
  else if (config.insulation === 'xps_foam') insulationRValue = 0.85;
  else if (config.insulation === 'bubble_wrap') insulationRValue = 0.35;
  else if (config.insulation === 'wood') insulationRValue = 0.20;

  // Radial wall conduction resistance R_wall between sleeve and inner water
  const R_wall = 0.38; // K / W
  // Heat loss outward from sleeve/cup sidewall through exterior insulation
  const sleeveExtLoss = (CONSTANTS.CUP_SURFACE_AREA * Math.max(0, T_sleeve - T_amb)) / insulationRValue;

  let sleeveToWaterConduction;
  let sleeveRateOfChange;
  let sleeveEqTemp = T_water;
  let sleeveTau = 3.0;

  if (isBarePlasticCup) {
    // No separate metal sleeve: absorbed power goes directly into water + cup body,
    // minus sidewall conduction loss out through the cup wall/insulation.
    sleeveToWaterConduction = sleevePowerIn - sleeveExtLoss;
    sleeveRateOfChange = 0;
  } else {
    sleeveToWaterConduction = (T_sleeve - T_water) / R_wall;
    const netSleevePower = sleevePowerIn - sleeveExtLoss - sleeveToWaterConduction;
    sleeveRateOfChange = netSleevePower / sleeveCapacity; // °C/s
    // Unconditionally stable analytical equilibrium & time constant for stepSimulation
    const G_wall = 1.0 / R_wall;
    const G_ext = CONSTANTS.CUP_SURFACE_AREA / insulationRValue;
    const G_total = G_wall + G_ext;
    sleeveEqTemp = (sleevePowerIn + G_wall * T_water + G_ext * T_amb) / G_total;
    sleeveTau = sleeveCapacity / G_total;
  }

  // 5. Water Losses: Convection, Radiation, Bottom Conduction, and Latent Evaporation
  const deltaT = Math.max(0, T_water - T_amb);

  // Convective loss from water top surface + Cavity Air Natural Convection Loop
  const draftVelocity = options.draftVelocity || 0.15; // m/s room draft
  const baseConvectionCoeff = 10.0 + (5.0 * draftVelocity); // W / (m^2 * C)
  const topArea = Math.PI * Math.pow(0.075 / 2, 2);
  // Open wide bowl exposes water surface slightly more to room air currents
  const openBowlFactor = (!hasLid && !isPerforated && hasCone) ? (1.0 + 0.25 * flareRatio) : 1.0;
  const directConvectionLoss = baseConvectionCoeff * topArea * deltaT * convectionSuppression * openBowlFactor;

  // When glazing is placed at the wide cone top (instead of tightly over the cup rim),
  // internal Rayleigh-Benard air convection circulates heat from the cup up to the large top window (up to 707 cm^2)
  let cavityConvectionLoss = 0;
  if (glazingPosition === 'cone_top' && hasCone && deltaT > 0) {
    const excessWindowArea = Math.max(0, apertureArea - topArea);
    // Internal cavity loop conductance (~2.6 W/(m^2*K) effective across the wide top glazing & cone walls)
    const h_cavity = 2.6 + (1.2 * Math.min(1.0, cavityAirLiters / 6.0));
    cavityConvectionLoss = h_cavity * excessWindowArea * deltaT * 0.45;
  }
  const convectionLoss = directConvectionLoss + cavityConvectionLoss;

  // Radiative loss from warm water surface
  const T_w_kelvin = T_water + 273.15;
  const T_a_kelvin = T_amb + 273.15;
  const radiationLoss = 0.95 * CONSTANTS.STEFAN_BOLTZMANN * topArea * (Math.pow(T_w_kelvin, 4) - Math.pow(T_a_kelvin, 4));

  // Latent evaporative loss from water surface (wide cone-top glazing allows more headspace condensation than a tight cup-rim lid)
  const evap = computeEvaporationLoss(T_water, T_amb, options.relativeHumidity || 0.45, draftVelocity, hasLid, isPerforated);
  const evaporationLoss = (glazingPosition === 'cone_top' && hasLid)
    ? evap.powerLossWatts * 2.4
    : evap.powerLossWatts;

  // Bottom conduction loss into base insulation
  const bottomArea = Math.PI * Math.pow(0.060 / 2, 2);
  const bottomConductionLoss = (bottomArea * deltaT) / insulationRValue;

  // Net power into water vessel (water + polystyrene cup vessel + trapped cavity air)
  const waterPowerIn = sleeveToWaterConduction + directTopPowerIn;
  const waterPowerLoss = convectionLoss + radiationLoss + evaporationLoss + bottomConductionLoss;
  const netPower = waterPowerIn - waterPowerLoss;

  // Total vessel thermal mass: 100 mL water (418.4 J/K) + cup (14.5 J/K) + trapped cavity air
  const totalWaterThermalMass = (CONSTANTS.WATER_MASS_100ML * CONSTANTS.WATER_SPECIFIC_HEAT) + CONSTANTS.CUP_THERMAL_CAPACITY + cavityAirHeatCapacity;
  const rateOfTempChange = netPower / totalWaterThermalMass; // °C per second

  // Efficiency metrics (using total system net thermal gain = P_in - total losses, accurate both before & during sleeve warm-up)
  const systemNetPower = powerIn - waterPowerLoss - sleeveExtLoss;
  const apertureEfficiency = incidentAperturePower > 0 ? Math.max(0, systemNetPower / incidentAperturePower) : 0;
  const thermalRetentionEfficiency = powerIn > 0 ? Math.max(0, systemNetPower / powerIn) : 0;
  const deviceEfficiencyFactor = wattage > 0 ? Math.max(0, systemNetPower / wattage) : 0;

  return {
    effectiveHeightCm,
    cupElevationCm,
    irradiance,
    apertureArea,
    apertureDiameterMeters,
    opticalEfficiency,
    windowTransmittance,
    absorptionAlpha,
    incidentAperturePower,
    topPowerIn,
    sidePowerIn,
    isFullDepthCone,
    glazingPosition,
    cavityAirLiters,
    cavityAirHeatCapacity,
    cavityConvectionLoss,
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
    totalWaterThermalMass,
    rateOfTempChange,
    apertureEfficiency,
    thermalRetentionEfficiency,
    deviceEfficiencyFactor,
    sleeveRateOfChange,
    sleeveEqTemp,
    sleeveTau,
    isBarePlasticCup,
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

  // Advance water temperature (clamped physically between ambient and boiling point)
  const newWater = Math.min(99.9, Math.max(T_amb, T_water + (heat.rateOfTempChange * dt)));

  // Advance sleeve temperature using unconditionally stable exponential relaxation
  const newSleeve = heat.isBarePlasticCup
    ? newWater
    : Math.min(140.0, Math.max(T_amb, heat.sleeveEqTemp + (T_sleeve - heat.sleeveEqTemp) * Math.exp(-dt / Math.max(0.1, heat.sleeveTau))));

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
  const maxElevCm = getMaxCupElevationCm(config);
  const cupElevationCm = Math.max(0, Math.min(maxElevCm, Number(config.cupElevationCm) || 0));
  const hasCone = config.concentrator !== 'bare_cup' && config.concentrator !== 'none';
  const isFullDepth = config.coneDepth === 'full_bottom' && hasCone;
  let widthCm = 8.0;
  let depthCm = 8.0;
  let fixedHeightCm = 11.5; // 9 oz cup (~9.5 cm) + base pad (~2 cm)

  if (config.concentrator === 'mylar_cone') {
    const w = config.coneTopWidthCm !== undefined ? Math.max(9.5, Math.min(30.0, Number(config.coneTopWidthCm))) : 26.0;
    widthCm = w;
    depthCm = w;
    fixedHeightCm = 26.0; // Stationary cone stays anchored inside 30 cm cube
  } else if (config.concentrator === 'al_funnel') {
    const w = config.coneTopWidthCm !== undefined ? Math.max(9.5, Math.min(30.0, Number(config.coneTopWidthCm))) : 22.0;
    widthCm = w;
    depthCm = w;
    fixedHeightCm = 24.5;
  } else if (config.concentrator === 'flat_mirrors') {
    const w = config.coneTopWidthCm !== undefined ? Math.max(9.5, Math.min(30.0, Number(config.coneTopWidthCm))) : 20.0;
    widthCm = w;
    depthCm = w;
    fixedHeightCm = 23.5;
  }

  // Because the cup only rises inside the stationary cone (up to its upper edge),
  // total device height never exceeds the fixed cone height (always <= 30.0 cm Rule 3.a compliant).
  const heightCm = hasCone
    ? fixedHeightCm
    : Number((fixedHeightCm + cupElevationCm).toFixed(1));
  const isCompliant = widthCm <= 30.0 && depthCm <= 30.0 && heightCm <= 30.0;
  return {
    widthCm,
    depthCm,
    heightCm,
    maxLimitCm: 30.0,
    isCompliant,
    statusText: isCompliant
      ? `Rule 3.a Compliant (${widthCm.toFixed(0)}×${heightCm.toFixed(1)} cm ≤ 30 cm)`
      : `Violation: Height ${heightCm.toFixed(1)} cm > 30.0 cm cube!`
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
