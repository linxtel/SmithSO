/**
 * ThermoOlyMaster - Module 3: Official Written Exam Arena (ES Mode)
 * Comprehensive 50-Question Master Competition Bank
 * Curated from past Science Olympiad Invitational, Regional, State, and National exams.
 * Adheres strictly to Rule 5.d: Arithmetic and simple algebra only; NO trig or calculus.
 */

import { authManager } from './auth-manager.js';

export const EXAM_QUESTIONS = [
  // =========================================================================
  // Area 1: Systems, Scales & Units (Questions 1 - 8)
  // =========================================================================
  {
    id: 1,
    area: 'Area 1: Foundations & Scales',
    level: 'Regional',
    text: 'Which of the following is an INTENSIVE thermodynamic property of a system?',
    options: [
      'Total internal energy (U)',
      'Total volume (V)',
      'Density (ρ)',
      'Heat capacity (C)'
    ],
    correct: 2,
    explanation: 'An intensive property does not depend on the amount of matter in the system (e.g., temperature, pressure, density). Volume, total internal energy, and total heat capacity are extensive properties because their values scale directly with system size.'
  },
  {
    id: 2,
    area: 'Area 1: Foundations & Scales',
    level: 'Regional',
    text: 'A beaker of water has a temperature of 25.0°C. What is this temperature on the absolute Rankine (°R) scale? (Formula: T_R = (9/5) × T_K, where T_K = T_C + 273.15)',
    options: [
      '298.15 °R',
      '536.67 °R',
      '491.67 °R',
      '459.67 °R'
    ],
    correct: 1,
    explanation: 'Step 1: Convert °C to Kelvin: T_K = 25.0 + 273.15 = 298.15 K. Step 2: Convert Kelvin to Rankine: T_R = (9/5) × 298.15 = 536.67 °R. (Alternatively: T_F = (9/5) × 25 + 32 = 77°F; T_R = 77 + 459.67 = 536.67 °R).'
  },
  {
    id: 3,
    area: 'Area 1: Foundations & Scales',
    level: 'Regional',
    text: 'The Zeroth Law of Thermodynamics establishes the physical foundation for which fundamental concept?',
    options: [
      'The conservation of energy',
      'The definition and measurement of temperature using a thermometer',
      'The absolute minimum temperature at absolute zero',
      'The non-spontaneous decrease of entropy'
    ],
    correct: 1,
    explanation: 'The Zeroth Law states: "If system A is in thermal equilibrium with system B, and B is in thermal equilibrium with C, then A is in thermal equilibrium with C." This transitive property allows thermometers to serve as calibrated universal references for temperature.'
  },
  {
    id: 4,
    area: 'Area 1: Foundations & Scales',
    level: 'Regional',
    text: 'One scientific calorie (cal) is officially defined as the amount of heat energy required to:',
    options: [
      'Raise the temperature of 1 kilogram of water by 1°C',
      'Raise the temperature of 1 gram of water from 14.5°C to 15.5°C',
      'Melt exactly 1 gram of pure ice at 0°C',
      'Perform 1 Joule of mechanical work on a fluid'
    ],
    correct: 1,
    explanation: 'One calorie is defined as the heat required to raise 1 gram of water by 1°C (specifically from 14.5°C to 15.5°C at 1 atm), equal to approximately 4.184 Joules. Note: dietary food Calories (kcal) equal 1,000 scientific calories.'
  },
  {
    id: 5,
    area: 'Area 1: Foundations & Scales',
    level: 'State',
    text: 'A tightly sealed thermos flask with vacuum insulation contains hot soup. Over 10 minutes, no matter enters or leaves, and negligible heat or work crosses the boundary. This system is classified as:',
    options: [
      'An open system',
      'A closed system',
      'An isolated system',
      'A steady-state flow system'
    ],
    correct: 2,
    explanation: 'An open system exchanges both mass and energy. A closed system exchanges energy but not mass. An isolated system exchanges NEITHER mass nor energy with its surroundings across its boundary.'
  },
  {
    id: 6,
    area: 'Area 1: Foundations & Scales',
    level: 'State',
    text: 'At what exact numerical temperature do the Celsius and Fahrenheit temperature scales read the exact same numerical value?',
    options: [
      '+40.0°',
      '0.0°',
      '-40.0°',
      '-273.15°'
    ],
    correct: 2,
    explanation: 'Set T_F = T_C = x: x = (9/5)x + 32  =>  -(4/5)x = 32  =>  x = -40°. Thus, -40°C is equal to -40°F.'
  },
  {
    id: 7,
    area: 'Area 1: Foundations & Scales',
    level: 'State',
    text: 'A steel washer has an outer diameter of 4.0 cm and a central hole of 1.5 cm. When the washer is heated uniformly from 20°C to 250°C, what happens to the diameter of the central hole?',
    options: [
      'It shrinks because the expanding metal moves inward',
      'It expands at the exact same fractional rate as the outer diameter',
      'It stays perfectly unchanged because internal forces cancel',
      'It expands initially, then contracts once heated'
    ],
    correct: 1,
    explanation: 'Thermal expansion is an isotropic photographic enlargement. Every linear dimension expands proportionally: ΔL = α · L₀ · ΔT. The empty hole expands exactly as if it were filled with solid steel.'
  },
  {
    id: 8,
    area: 'Area 1: Foundations & Scales',
    level: 'National',
    text: '[TIEBREAKER] A nutrition label lists an energy content of 250 Food Calories (kcal). How many Joules of energy does this represent?',
    options: [
      '250 J',
      '1,046 J',
      '250,000 J',
      '1,046,000 J (1.046 MJ)'
    ],
    correct: 3,
    explanation: '1 Food Calorie (capital C) = 1 kcal = 1,000 scientific calories. E = 250 kcal × (1,000 cal / 1 kcal) × (4.184 J / 1 cal) = 1,046,000 J = 1.046 × 10⁶ J.'
  },

  // =========================================================================
  // Area 2: Phases, Calorimetry & Ideal Gas Law (Questions 9 - 18)
  // =========================================================================
  {
    id: 9,
    area: 'Area 2: Phases & Gas Laws',
    level: 'Regional',
    text: 'How much thermal energy (in Joules) is required to completely melt 50.0 grams of ice at 0.0°C into liquid water at 0.0°C? (Latent heat of fusion for water: L_f = 334 J/g)',
    options: [
      '16,700 J',
      '83,500 J',
      '209,200 J',
      '4,184 J'
    ],
    correct: 0,
    explanation: 'During a phase change with no change in temperature, use Q = m × L_f. Q = (50.0 g) × (334 J/g) = 16,700 Joules.'
  },
  {
    id: 10,
    area: 'Area 2: Phases & Gas Laws',
    level: 'Regional',
    text: 'An ideal gas in a sealed rigid container has a pressure of 120 kPa at 300 K. If the gas is heated to 450 K while volume remains strictly constant, what is the new pressure?',
    options: [
      '80 kPa',
      '150 kPa',
      '180 kPa',
      '240 kPa'
    ],
    correct: 2,
    explanation: 'According to Gay-Lussac\'s Law for constant volume (V = const): P_1 / T_1 = P_2 / T_2. Rearranging: P_2 = P_1 × (T_2 / T_1) = 120 kPa × (450 K / 300 K) = 120 × 1.5 = 180 kPa.'
  },
  {
    id: 11,
    area: 'Area 2: Phases & Gas Laws',
    level: 'Regional',
    text: 'On a standard substance pressure-temperature (P-T) phase diagram, the unique condition where solid, liquid, and gas phases coexist in thermodynamic equilibrium is called the:',
    options: [
      'Critical point',
      'Sublimation plateau',
      'Triple point',
      'Equipartition state'
    ],
    correct: 2,
    explanation: 'The triple point is the specific single combination of temperature and pressure at which three phases (solid, liquid, and gas) coexist simultaneously in thermodynamic equilibrium (for pure water: 0.01°C at 611.65 Pa).'
  },
  {
    id: 12,
    area: 'Area 2: Phases & Gas Laws',
    level: 'Regional',
    text: 'If 100 mL (100 g) of water absorbs 8,368 Joules of heat from a heat lamp, what is its temperature increase (ΔT)? (Specific heat of water c = 4.184 J/(g·°C))',
    options: [
      '5.0°C',
      '10.0°C',
      '20.0°C',
      '40.0°C'
    ],
    correct: 2,
    explanation: 'Use the sensible heat formula: Q = m × c × ΔT. Rearrange for ΔT: ΔT = Q / (m × c) = 8368 J / (100 g × 4.184 J/g°C) = 8368 / 418.4 = 20.0°C.'
  },
  {
    id: 13,
    area: 'Area 2: Phases & Gas Laws',
    level: 'State',
    text: 'A 75.0 g piece of an unknown metal heated to 100.0°C is dropped into 150.0 g of water at 20.0°C. The mixture reaches thermal equilibrium at 23.5°C. Neglecting container losses, what is the specific heat of the metal? (c_water = 4.184 J/(g·°C))',
    options: [
      '0.185 J/(g·°C)',
      '0.383 J/(g·°C)',
      '0.450 J/(g·°C)',
      '0.897 J/(g·°C)'
    ],
    correct: 1,
    explanation: 'Q_gained_by_water = 150.0 × 4.184 × (23.5 - 20.0) = 2,196.6 J. Heat lost by metal: Q_metal = -2,196.6 J = 75.0 × c_m × (23.5 - 100.0) = -5,737.5 · c_m. Therefore, c_m = 2,196.6 / 5,737.5 = 0.383 J/(g·°C) (characteristic of brass).'
  },
  {
    id: 14,
    area: 'Area 2: Phases & Gas Laws',
    level: 'State',
    text: 'Liquid water exhibits a density anomaly compared to most liquids, reaching its MAXIMUM density at approximately:',
    options: [
      '-4.0°C',
      '0.0°C',
      '+3.98°C (~4°C)',
      '+10.0°C'
    ],
    correct: 2,
    explanation: 'Water reaches peak density at 3.98°C. Below 4°C, water molecules assemble into open hexagonal hydrogen-bonded frameworks, expanding volume and lowering density, which causes ice to float on water.'
  },
  {
    id: 15,
    area: 'Area 2: Phases & Gas Laws',
    level: 'State',
    text: 'An insulated container holds 200.0 g of water at 40.0°C. A student adds 40.0 g of pure ice at 0.0°C. What is the final equilibrium temperature? (L_f = 334 J/g, c_water = 4.184 J/(g·°C))',
    options: [
      '18.6°C',
      '20.0°C',
      '22.4°C',
      '25.8°C'
    ],
    correct: 1,
    explanation: 'Heat to melt ice: 40.0 × 334 = 13,360 J. Energy balance: 13,360 + 40.0 × 4.184 × T_f = 200.0 × 4.184 × (40.0 - T_f). 13,360 + 167.36 T_f = 33,472 - 836.8 T_f  =>  1004.16 T_f = 20,112  =>  T_f = 20.0°C.'
  },
  {
    id: 16,
    area: 'Area 2: Phases & Gas Laws',
    level: 'National',
    text: '[TIEBREAKER] A weather balloon holds 12.5 L of helium at ground level (27.0°C). It ascends to an altitude where temperature drops to -33.0°C at constant pressure. What is the new volume? (Remember to convert to Kelvin!)',
    options: [
      '10.0 L',
      '11.5 L',
      '8.5 L',
      '-15.3 L'
    ],
    correct: 0,
    explanation: 'T₁ = 27.0 + 273.15 = 300.15 K; T₂ = -33.0 + 273.15 = 240.15 K. Charles\'s Law (V₁/T₁ = V₂/T₂): V₂ = 12.5 L × (240.15 / 300.15) = 12.5 × 0.800 = 10.0 L.'
  },
  {
    id: 17,
    area: 'Area 2: Phases & Gas Laws',
    level: 'National',
    text: '[TIEBREAKER] Why does 1.0 g of steam at 100.0°C cause significantly more severe thermal damage to human skin than 1.0 g of liquid boiling water at 100.0°C?',
    options: [
      'Steam is at a much higher temperature than boiling water',
      'Steam has a higher specific heat capacity than liquid water',
      'Steam releases its massive latent heat of condensation (2,260 J/g) upon contacting cooler skin',
      'Steam molecules move fast enough to penetrate epidermis pores'
    ],
    correct: 2,
    explanation: 'Liquid water at 100°C only releases sensible heat (~264 J cooling to body temperature). Steam at 100°C must first release 2,260 J of latent heat during condensation before releasing sensible heat, imparting nearly 10× more energy!'
  },
  {
    id: 18,
    area: 'Area 2: Phases & Gas Laws',
    level: 'State',
    text: 'A cylinder with a movable piston contains 0.400 m³ of air at 100 kPa. If compressed slowly at constant temperature until volume is 0.080 m³, what is the final pressure?',
    options: [
      '20 kPa',
      '250 kPa',
      '500 kPa',
      '800 kPa'
    ],
    correct: 2,
    explanation: 'Boyle\'s Law for isothermal conditions: P₁V₁ = P₂V₂. P₂ = (100 kPa × 0.400 m³) / 0.080 m³ = 500 kPa.'
  },

  // =========================================================================
  // Area 3: Heat Transfer Mechanics (Questions 19 - 27)
  // =========================================================================
  {
    id: 19,
    area: 'Area 3: Heat Transfer Mechanics',
    level: 'Regional',
    text: 'A heat collector uses a copper base plate and a glass window. By which primary mechanism does heat travel through the solid copper plate?',
    options: [
      'Thermal radiation',
      'Thermal conduction',
      'Natural convection',
      'Forced advection'
    ],
    correct: 1,
    explanation: 'Thermal conduction is the transfer of internal thermal energy through solid matter via direct physical molecular collisions and free electron movement without any bulk movement of the material itself.'
  },
  {
    id: 20,
    area: 'Area 3: Heat Transfer Mechanics',
    level: 'Regional',
    text: 'According to Fourier\'s Law of thermal conduction, if you double the thickness (L) of an insulating foam wall while keeping area and temperature difference constant, the rate of heat flow (q):',
    options: [
      'Quadruples (increases 4×)',
      'Doubles (increases 2×)',
      'Is halved (decreases to 1/2)',
      'Remains unchanged'
    ],
    correct: 2,
    explanation: 'Fourier\'s Law states q = k · A · (ΔT / L). Heat transfer rate is inversely proportional to wall thickness L. Therefore, doubling thickness halves the heat loss rate.'
  },
  {
    id: 21,
    area: 'Area 3: Heat Transfer Mechanics',
    level: 'Regional',
    text: 'Which material exhibits the LOWEST thermal conductivity (k), making it the most effective thermal insulator?',
    options: [
      'Aluminum (k ≈ 205 W/m·K)',
      'Window glass (k ≈ 0.8 W/m·K)',
      'Silica aerogel (k ≈ 0.015 W/m·K)',
      'Water (k ≈ 0.6 W/m·K)'
    ],
    correct: 2,
    explanation: 'Silica aerogel has an extraordinarily low thermal conductivity (k ≈ 0.015 W/m·K) due to its nanoporous silica network, which traps air molecules in pores smaller than their mean free path, virtually eliminating conduction and convection.'
  },
  {
    id: 22,
    area: 'Area 3: Heat Transfer Mechanics',
    level: 'Regional',
    text: 'Which mechanism of heat transfer can transport thermal energy across a complete vacuum (such as the void of outer space between the Sun and Earth)?',
    options: [
      'Conduction',
      'Convection',
      'Thermal radiation',
      'Evaporation'
    ],
    correct: 2,
    explanation: 'Conduction and convection both require material atoms or molecules as carriers. Thermal radiation is carried by electromagnetic waves (photons) and travels freely across a vacuum.'
  },
  {
    id: 23,
    area: 'Area 3: Heat Transfer Mechanics',
    level: 'State',
    text: 'A flat plate of XPS foam insulation has area 0.50 m², thickness 0.025 m (2.5 cm), and conductivity k = 0.030 W/(m·K). If one face is at 45.0°C and the other at 20.0°C, what is the conductive heat flow rate?',
    options: [
      '6.0 W',
      '15.0 W',
      '30.0 W',
      '60.0 W'
    ],
    correct: 1,
    explanation: 'q = k · A · ΔT / L = (0.030 × 0.50 × 25.0) / 0.025 = 0.375 / 0.025 = 15.0 Watts.'
  },
  {
    id: 24,
    area: 'Area 3: Heat Transfer Mechanics',
    level: 'State',
    text: 'In insulation design, thermal resistance is defined as R = L/k. When heat flows through two layered insulating materials in series (Layer 1: R₁ = 0.50 m²·K/W; Layer 2: R₂ = 1.50 m²·K/W), the total equivalent R-value is:',
    options: [
      '0.375 m²·K/W',
      '1.00 m²·K/W',
      '2.00 m²·K/W',
      '3.00 m²·K/W'
    ],
    correct: 2,
    explanation: 'Thermal resistances in series add directly, analogous to electrical resistors: R_total = R₁ + R₂ = 0.50 + 1.50 = 2.00 m²·K/W.'
  },
  {
    id: 25,
    area: 'Area 3: Heat Transfer Mechanics',
    level: 'State',
    text: 'Kirchhoff\'s Law of Thermal Radiation dictates that for any body in thermodynamic equilibrium at a given wavelength and temperature:',
    options: [
      'Emissivity equals thermal conductivity (ε = k)',
      'Emissivity equals absorptivity (ε = α)',
      'Reflectivity equals zero (ρ = 0)',
      'Emissivity is directly proportional to mass'
    ],
    correct: 1,
    explanation: 'Kirchhoff\'s Law states that a good absorber is inherently an equally good emitter at thermal equilibrium (ε = α). Polished aluminum foil (α ≈ 0.05) is both a poor absorber and an extremely weak emitter (ε ≈ 0.05).'
  },
  {
    id: 26,
    area: 'Area 3: Heat Transfer Mechanics',
    level: 'State',
    text: 'Why does an acrylic or glass greenhouse top effectively trap heat inside the 2027 Science Olympiad heat collector?',
    options: [
      'It creates an exothermic chemical reaction with air',
      'It transmits shortwave visible and near-IR lamp radiation, but blocks rising air convection and absorbs/re-radiates longwave thermal IR emitted by the cup',
      'It amplifies lamp wattage via optical resonance',
      'It eliminates conductive contact with the testing table'
    ],
    correct: 1,
    explanation: 'The greenhouse effect functions by suppressing buoyant convective air escape while transmitting incoming shortwave lamp photons and blocking longwave thermal infrared emitted by the warmed water.'
  },
  {
    id: 27,
    area: 'Area 3: Heat Transfer Mechanics',
    level: 'National',
    text: '[TIEBREAKER] An omnidirectional heat source radiates power uniformly. If distance from the lamp is doubled (e.g. from 40 cm to 80 cm), radiant flux density (W/m²) on the collector aperture decreases to:',
    options: [
      '1/2 (50%)',
      '1/4 (25%)',
      '1/8 (12.5%)',
      '1/16 (6.25%)'
    ],
    correct: 1,
    explanation: 'The Inverse-Square Law states I ∝ 1/r². Doubling distance spreads radiant energy over 4× greater spherical area (A = 4πr²), reducing flux to (1/2)² = 1/4 (25%).'
  },

  // =========================================================================
  // Area 4: Processes, Cycles & 1st/2nd Laws (Questions 28 - 36)
  // =========================================================================
  {
    id: 28,
    area: 'Area 4: Processes & Cycles',
    level: 'Regional',
    text: 'In an ADIABATIC thermodynamic process, which parameter is strictly zero?',
    options: [
      'Change in temperature (ΔT = 0)',
      'Mechanical work performed (W = 0)',
      'Heat exchange with the surroundings (Q = 0)',
      'Change in pressure (ΔP = 0)'
    ],
    correct: 2,
    explanation: 'An adiabatic process is one in which NO heat enters or leaves the system (Q = 0). By the First Law (ΔU = Q − W), for an adiabatic process, ΔU = −W.'
  },
  {
    id: 29,
    area: 'Area 4: Processes & Cycles',
    level: 'Regional',
    text: 'A heat engine operates between a hot reservoir at 600 K and a cold reservoir at 300 K. What is the maximum theoretical (Carnot) efficiency of this engine?',
    options: [
      '25%',
      '50%',
      '75%',
      '100%'
    ],
    correct: 1,
    explanation: 'Carnot efficiency: η = 1 − (T_C / T_H) = 1 − (300 / 600) = 1 − 0.50 = 0.50 or 50%.'
  },
  {
    id: 30,
    area: 'Area 4: Processes & Cycles',
    level: 'Regional',
    text: 'A gas expands in a cylinder against a constant external pressure of 200 kPa, increasing its volume by 0.003 m³. How much work (W = P · ΔV) is done by the gas?',
    options: [
      '60 J',
      '600 J',
      '6,000 J',
      '60,000 J'
    ],
    correct: 1,
    explanation: 'For an isobaric (constant pressure) expansion: W = P · ΔV = (200,000 Pa) × (0.003 m³) = 600 Joules.'
  },
  {
    id: 31,
    area: 'Area 4: Processes & Cycles',
    level: 'Regional',
    text: 'According to the Second Law of Thermodynamics (Clausius statement), heat will NEVER spontaneously:',
    options: [
      'Flow from a colder body to a hotter body without external work',
      'Convert completely into sound or friction',
      'Expand an ideal gas through a nozzle',
      'Radiate across a vacuum'
    ],
    correct: 0,
    explanation: 'The Clausius statement of the Second Law dictates that it is impossible for heat to flow spontaneously from a body of lower temperature to a body of higher temperature without external work being input (as done by a refrigerator compressor).'
  },
  {
    id: 32,
    area: 'Area 4: Processes & Cycles',
    level: 'State',
    text: 'A gas undergoes a cyclic process forming a clockwise rectangle on a P-V diagram between pressures 100 kPa and 400 kPa, and volumes 0.002 m³ and 0.006 m³. What is the net work produced per cycle?',
    options: [
      '300 J',
      '600 J',
      '1,200 J',
      '2,400 J'
    ],
    correct: 2,
    explanation: 'Net work equals the enclosed area: W_net = ΔP × ΔV = (400,000 - 100,000 Pa) × (0.006 - 0.002 m³) = 300,000 Pa × 0.004 m³ = 1,200 Joules.'
  },
  {
    id: 33,
    area: 'Area 4: Processes & Cycles',
    level: 'State',
    text: 'A heat engine absorbs 2,000 J of heat from its combustion chamber and exhausts 1,400 J of waste heat to the atmosphere. What is its actual thermal efficiency?',
    options: [
      '30.0%',
      '42.8%',
      '70.0%',
      '142.8%'
    ],
    correct: 0,
    explanation: 'Work produced: W = Q_H - Q_C = 2000 - 1400 = 600 J. Efficiency: η = W / Q_H = 600 / 2000 = 0.30 or 30.0%.'
  },
  {
    id: 34,
    area: 'Area 4: Processes & Cycles',
    level: 'State',
    text: 'A refrigerator removes 4,500 J of heat from its freezer compartment (Q_C) while consuming 1,500 J of electrical work (W). What is its Coefficient of Performance (COP_R)?',
    options: [
      '0.33',
      '1.33',
      '3.00',
      '4.00'
    ],
    correct: 2,
    explanation: 'COP_R for a cooling cycle is the ratio of heat extracted to work input: COP_R = Q_C / W = 4500 J / 1500 J = 3.00.'
  },
  {
    id: 35,
    area: 'Area 4: Processes & Cycles',
    level: 'National',
    text: '[TIEBREAKER] Which sequential series of 4 reversible processes constitutes a standard Carnot Heat Engine Cycle?',
    options: [
      'Isochoric heating → Isobaric expansion → Isochoric cooling → Isobaric compression',
      'Isothermal expansion → Adiabatic expansion → Isothermal compression → Adiabatic compression',
      'Adiabatic expansion → Isobaric heating → Adiabatic compression → Isobaric cooling',
      'Isothermal expansion → Isochoric heating → Isothermal compression → Isochoric cooling'
    ],
    correct: 1,
    explanation: 'The Carnot cycle consists of: (1) Isothermal expansion at T_H, (2) Adiabatic expansion cooling to T_C, (3) Isothermal compression at T_C, and (4) Adiabatic compression back to T_H.'
  },
  {
    id: 36,
    area: 'Area 4: Processes & Cycles',
    level: 'National',
    text: '[TIEBREAKER] In an ideal Otto cycle with compression ratio r = 8.0 and γ = 1.4, the efficiency formula is η = 1 - 1/(r^(γ-1)). What is the theoretical efficiency?',
    options: [
      '25.0%',
      '40.5%',
      '56.5%',
      '70.0%'
    ],
    correct: 2,
    explanation: 'γ - 1 = 0.40. r^0.4 = 8.0^0.4 ≈ 2.2974. η = 1 - (1 / 2.2974) = 1 - 0.4353 = 0.5647 ≈ 56.5%.'
  },

  // =========================================================================
  // Area 5: History of Thermodynamics (Questions 37 - 44)
  // =========================================================================
  {
    id: 37,
    area: 'Area 5: History of Thermodynamics',
    level: 'Regional',
    text: 'Which scientist performed the famous paddle-wheel experiment in an insulated water bath, proving that mechanical work and thermal heat are equivalent forms of energy?',
    options: [
      'Sadi Carnot',
      'James Prescott Joule',
      'Joseph Black',
      'Lord Kelvin'
    ],
    correct: 1,
    explanation: 'James Prescott Joule used falling weights to turn a submerged paddle-wheel in water, precisely measuring how much mechanical work generated a specific temperature rise. This established the "mechanical equivalent of heat" (4.184 J = 1 cal).'
  },
  {
    id: 38,
    area: 'Area 5: History of Thermodynamics',
    level: 'Regional',
    text: 'Scottish chemist Joseph Black is credited with which revolutionary discoveries in 18th-century thermal physics?',
    options: [
      'The atomic nucleus and alpha radiation',
      'Specific heat capacity and latent heat of phase changes',
      'The speed of light in vacuum',
      'The electromagnetic wave equation'
    ],
    correct: 1,
    explanation: 'Joseph Black showed that different substances require different quantities of heat to achieve the same temperature rise (specific heat) and discovered that ice absorbs thermal energy during melting without changing temperature (latent heat).'
  },
  {
    id: 39,
    area: 'Area 5: History of Thermodynamics',
    level: 'Regional',
    text: 'Who published "Reflections on the Motive Power of Fire" in 1824, introducing the ideal reversible cycle that set the theoretical upper limit on heat engine efficiency?',
    options: [
      'Nicolas Léonard Sadi Carnot',
      'Rudolf Clausius',
      'Ludwig Boltzmann',
      'Max Planck'
    ],
    correct: 0,
    explanation: 'Sadi Carnot, known as the "Father of Thermodynamics," analyzed steam engines and proved that maximum efficiency depends solely on the temperature difference between the hot and cold reservoirs, establishing the Carnot Cycle.'
  },
  {
    id: 40,
    area: 'Area 5: History of Thermodynamics',
    level: 'State',
    text: 'In 1798, Benjamin Thompson (Count Rumford) observed continuous heat generation while boring brass cannons with a blunt tool. What major conclusion did he draw?',
    options: [
      'Heat is a weightless conserved material fluid called caloric',
      'Heat is not a conserved material substance, but a form of motion generated by mechanical work',
      'Brass loses measurable weight when heated',
      'Friction destroys chemical bonds'
    ],
    correct: 1,
    explanation: 'Rumford observed that heat was generated indefinitely from friction as long as the drill turned, disproving the caloric theory which claimed heat was a conserved material fluid stored inside metals.'
  },
  {
    id: 41,
    area: 'Area 5: History of Thermodynamics',
    level: 'State',
    text: 'Which German mathematical physicist introduced the concept and coined the word "entropy" (S) in 1865, from the Greek word for transformation?',
    options: [
      'Rudolf Clausius',
      'Ludwig Boltzmann',
      'Heinrich Hertz',
      'Wilhelm Wien'
    ],
    correct: 0,
    explanation: 'Rudolf Clausius coined "entropy" from the Greek "trope" (transformation), mathematically defining it via dS = dQ_rev / T and stating that the entropy of the universe tends to a maximum.'
  },
  {
    id: 42,
    area: 'Area 5: History of Thermodynamics',
    level: 'State',
    text: 'Lord Kelvin (William Thomson) proposed the absolute thermodynamic temperature scale in 1848 based on:',
    options: [
      'The freezing and boiling points of mercury',
      'Carnot\'s theory of heat engines, defining a scale independent of any specific substance\'s properties',
      'The density curve of liquid water',
      'The resistance of platinum wire'
    ],
    correct: 1,
    explanation: 'Kelvin recognized that Carnot efficiency provided an absolute definition of temperature independent of any material substance, with absolute zero being the point where zero heat can be transferred.'
  },
  {
    id: 43,
    area: 'Area 5: History of Thermodynamics',
    level: 'National',
    text: '[TIEBREAKER] In 1900, Max Planck solved the "ultraviolet catastrophe" of classical blackbody radiation by introducing which revolutionary hypothesis?',
    options: [
      'Light travels at infinite velocity in vacuum',
      'Thermal radiation does not exist at high frequencies',
      'Energy is emitted and absorbed only in discrete packets (quanta): E = h · ν',
      'Absolute zero is physically impossible to define'
    ],
    correct: 2,
    explanation: 'Classical physics predicted infinite radiation at UV wavelengths. Planck resolved this by postulating that atomic oscillators radiate energy only in discrete packets (quanta) of E = hν, initiating quantum mechanics.'
  },
  {
    id: 44,
    area: 'Area 5: History of Thermodynamics',
    level: 'National',
    text: '[TIEBREAKER] Ludwig Boltzmann\'s tombstone in Vienna features the formula S = k · log W. What does W (multiplicity) physically represent?',
    options: [
      'Mechanical work done by the system',
      'The total thermal energy in Joules',
      'The number of microscopic states (microstates) corresponding to the macroscopic state',
      'The molecular velocity of the gas'
    ],
    correct: 2,
    explanation: 'W (from German Wahrscheinlichkeit / multiplicity) is the number of distinct microscopic arrangements of positions and momenta that result in the same macroscopic thermodynamic state.'
  },

  // =========================================================================
  // Area 6: State & National Master Tier (Questions 45 - 50)
  // =========================================================================
  {
    id: 45,
    area: 'Area 6: Advanced Radiation & 3rd Law',
    level: 'State',
    text: 'According to the Stefan-Boltzmann Law (P = ε · σ · A · T⁴), if the absolute temperature (in Kelvin) of an ideal blackbody is DOUBLED, its total radiated power increases by a factor of:',
    options: [
      '2×',
      '4×',
      '8×',
      '16×'
    ],
    correct: 3,
    explanation: 'Radiated power is proportional to the fourth power of absolute temperature (T⁴). If temperature is doubled (2×), the new power is (2)⁴ = 16 times greater.'
  },
  {
    id: 46,
    area: 'Area 6: Advanced Radiation & 3rd Law',
    level: 'State',
    text: 'The Third Law of Thermodynamics states that as the temperature of a pure, perfectly crystalline substance approaches Absolute Zero (0 Kelvin):',
    options: [
      'Its pressure becomes infinite',
      'Its entropy approaches exactly zero',
      'Its volume becomes negative',
      'Its thermal conductivity becomes zero'
    ],
    correct: 1,
    explanation: 'The Nernst-Planck statement of the Third Law states that the entropy of a pure, perfect crystal in ground state is exactly zero at absolute zero temperature (S → 0 as T → 0 K) because there is only one microstate (W = 1, S = k · ln(1) = 0).'
  },
  {
    id: 47,
    area: 'Area 6: Advanced Radiation & 3rd Law',
    level: 'State',
    text: 'A blackbody radiator at 300 K emits radiant exitance of 459 W/m². If heated to 600 K, what is its new radiant exitance?',
    options: [
      '918 W/m²',
      '1,836 W/m²',
      '3,672 W/m²',
      '7,344 W/m²'
    ],
    correct: 3,
    explanation: 'T doubles from 300 K to 600 K. By Stefan-Boltzmann (j* ∝ T⁴): j* increases by 2⁴ = 16. New exitance = 16 × 459 W/m² = 7,344 W/m².'
  },
  {
    id: 48,
    area: 'Area 6: Advanced Radiation & 3rd Law',
    level: 'National',
    text: '[TIEBREAKER] Wien\'s Displacement Law states that peak emission wavelength is λ_peak = b / T (b = 2.898 × 10⁻³ m·K). For an incandescent heat lamp filament at 2200 K, what is λ_peak, and what spectral band does it occupy?',
    options: [
      '0.45 µm (visible blue)',
      '0.70 µm (visible red)',
      '1.32 µm (near-infrared)',
      '10.6 µm (far-infrared)'
    ],
    correct: 2,
    explanation: 'λ_peak = (2.898 × 10⁻³ m·K) / 2200 K = 1.317 × 10⁻⁶ m = 1.32 µm. Because visible light ends at ~0.70 µm, 1.32 µm lies in the near-infrared band, explaining why it acts as a heat lamp!'
  },
  {
    id: 49,
    area: 'Area 6: Advanced Radiation & 3rd Law',
    level: 'National',
    text: '[TIEBREAKER] A tungsten filament operates at 2500 K with area A = 5.0 × 10⁻⁵ m² and emissivity ε = 0.40. What is the total radiated power? (σ = 5.670 × 10⁻⁸ W/(m²·K⁴))',
    options: [
      '44.3 W',
      '88.6 W',
      '110.7 W',
      '221.5 W'
    ],
    correct: 0,
    explanation: 'P = ε · σ · A · T⁴ = 0.40 × (5.670 × 10⁻⁸) × (5.0 × 10⁻⁵) × (2500⁴) = 0.40 × (5.670 × 10⁻⁸) × (5.0 × 10⁻⁵) × (3.90625 × 10¹³) = 44.3 Watts.'
  },
  {
    id: 50,
    area: 'Area 6: Advanced Radiation & 3rd Law',
    level: 'National',
    text: '[TIEBREAKER] An athlete with skin surface area A = 1.80 m² and infrared emissivity ε = 0.98 has a skin temperature of 33.0°C (306.15 K). If the athlete stands in a room with wall temperature 18.0°C (291.15 K), what is their net rate of radiant heat loss? (σ = 5.670 × 10⁻⁸ W/(m²·K⁴))',
    options: [
      '45.2 W',
      '98.5 W',
      '159.9 W (~160 W)',
      '320.1 W'
    ],
    correct: 2,
    explanation: 'Net radiative transfer: P_net = ε · σ · A · (T_skin⁴ - T_room⁴). T_skin⁴ = (306.15)⁴ ≈ 8.785 × 10⁹ K⁴; T_room⁴ = (291.15)⁴ ≈ 7.186 × 10⁹ K⁴. Difference = 1.599 × 10⁹ K⁴. P_net = 0.98 × (5.670 × 10⁻⁸) × 1.80 × (1.599 × 10⁹) = 159.9 Watts.'
  },
  {
    id: 51,
    area: 'Area 2: Phases & Gas Laws',
    level: 'State',
    text: 'On a P-T phase diagram, the solid-liquid fusion boundary for pure water has a NEGATIVE slope (dP/dT < 0), whereas for CO₂ and almost all other substances it has a POSITIVE slope. What anomalous physical property of water causes this behavior?',
    options: [
      'Water has a higher latent heat of vaporization than other liquids',
      'Solid ice is less dense than liquid water due to open hexagonal hydrogen bonding',
      'Water vapor is lighter than atmospheric air',
      'Water reaches its boiling point at a lower temperature than other fluids'
    ],
    correct: 1,
    explanation: 'By the Clausius-Clapeyron equation (dP/dT = L / [T(v_liq - v_solid)]), the slope depends on change in specific volume. Because ice is less dense than liquid water (v_liq < v_solid), the denominator is negative, tilting the melting curve to the left (negative slope). Therefore, applying pressure lowers the melting point of ice (regelation).'
  },
  {
    id: 52,
    area: 'Area 5: History of Thermodynamics',
    level: 'National',
    text: '[TIEBREAKER] James Clerk Maxwell proposed his famous "Maxwell\'s Demon" thought experiment in 1867 to investigate whether an intelligent microscopic entity could:',
    options: [
      'Reach temperatures below Absolute Zero',
      'Violate the Second Law of Thermodynamics by sorting fast and slow molecules without doing work',
      'Convert water directly into steam without absorbing latent heat',
      'Calculate the exact position and momentum of all gas particles simultaneously'
    ],
    correct: 1,
    explanation: 'Maxwell envisioned a microscopic entity operating a door between two compartments to segregate hot (fast) from cold (slow) molecules without performing mechanical work, which appeared to violate the Second Law. Modern physics proved that acquiring and erasing information generates entropy, upholding the Second Law.'
  },
  {
    id: 53,
    area: 'Area 1: Foundations & Scales',
    level: 'Regional',
    text: '[Kenston 2018] A small energy snack bar is labeled as having 52 dietary Calories (kcal). If 100% of its stored chemical potential energy were converted directly into thermal heat without losses, by how much would it raise the temperature of 1.0 L (1.0 kg) of liquid water? (Specific heat of water c = 1.00 cal/(g·°C))',
    options: [
      '0.052 °C',
      '1.0 °C',
      '52.0 °C',
      '104.0 °C'
    ],
    correct: 2,
    explanation: '1 dietary Calorie (capital C) equals 1 kilocalorie (kcal) = 1,000 scientific calories (cal). Raising 1.0 g of water by 1 °C requires 1 cal. Therefore, raising 1.0 kg (1,000 g) of water by 1 °C requires 1,000 cal = 1 kcal. Since the snack bar provides 52 kcal, it contains enough thermal energy to raise 1.0 kg of water by exactly 52.0 °C (ΔT = Q / [m·c] = 52,000 cal / [1,000 g × 1 cal/(g·°C)] = 52.0 °C).'
  },
  {
    id: 54,
    area: 'Area 1: Foundations & Scales',
    level: 'Regional',
    text: '[Little Tiger 2018] By definition of standard SI base units and derived physical quantities, all of the following expressions are exactly equivalent to 1 Joule (1 J) EXCEPT:',
    options: [
      '1 kg·m² / s²',
      '1 N·m',
      '10⁻³ kJ',
      '1 N·kg / s'
    ],
    correct: 3,
    explanation: '1 Joule is defined mechanically as work done by 1 Newton over 1 meter: 1 J = 1 N·m. Since 1 N = 1 kg·m/s², 1 J = (1 kg·m/s²) × m = 1 kg·m²/s². Also 1 J = 0.001 kJ = 10⁻³ kJ. In contrast, 1 N·kg/s has units of (kg·m/s²)·kg/s = kg²·m/s³, which does not represent energy or work.'
  },
  {
    id: 55,
    area: 'Area 2: Phases & Gas Laws',
    level: 'State',
    text: '[WNY 2019] Carbon dioxide (CO₂) has a triple point at 5.11 atm and -56.6 °C. If gaseous CO₂ inside a sealed flexible container at standard sea-level atmospheric pressure (1.00 atm) is gradually cooled from 0 °C down to -100 °C, which phase change will be observed?',
    options: [
      'Condensation into a liquid, followed by freezing into a solid',
      'Direct deposition from gas to solid (Dry Ice) without ever forming a liquid phase',
      'Boiling into a supercritical fluid',
      'No phase change occurs because 1 atm is above critical pressure'
    ],
    correct: 1,
    explanation: 'Because the triple point pressure of CO₂ (5.11 atm) is well above standard atmospheric pressure (1.00 atm), liquid CO₂ cannot exist stably under open atmospheric conditions. Cooling gaseous CO₂ below its sublimation temperature (-78.5 °C at 1 atm) causes it to transition directly from gas to solid via deposition (forming Dry Ice).'
  },
  {
    id: 56,
    area: 'Area 2: Phases & Gas Laws',
    level: 'Regional',
    text: '[Little Tiger 2018] A chef at sea level is boiling rice in an open pot of water on a stove at 100 °C. If the chef turns the burner setting from Medium to High, what happens to the boiling temperature of the water, and how can the cooking time actually be shortened?',
    options: [
      'The temperature rises to 105 °C; turning up the burner cooks the rice faster',
      'The temperature remains strictly at 100 °C (the boiling point); to cook faster, a sealed pressure cooker must be used to raise the boiling temperature',
      'The temperature drops due to rapid evaporative cooling',
      'The water becomes supercritical, doubling the heat transfer coefficient'
    ],
    correct: 1,
    explanation: 'In an open pot at 1 atm, boiling water remains pinned at its phase transition temperature (100 °C); extra burner heat merely increases the rate of vaporization without raising temperature. To increase cooking temperature and cook faster, one must increase ambient pressure (e.g. using a pressure cooker), which elevates the boiling point above 100 °C.'
  },
  {
    id: 57,
    area: 'Area 3: Heat Transfer Mechanics',
    level: 'Regional',
    text: '[Kenston 2018] Under steady-state 1-dimensional heat conduction, if an insulating wall of uniform cross-sectional area and thermal conductivity is rebuilt with DOUBLE its original thickness, the rate of conductive heat loss (Q/t) across the same temperature difference (ΔT) will:',
    options: [
      'Become 1/2 of its original value',
      'Also double (2x)',
      'Become 1/4 of its original value',
      'Remain unchanged because temperature difference is constant'
    ],
    correct: 0,
    explanation: 'By Fourier\'s Law of Thermal Conduction, rate of heat transfer is Q/t = k·A·ΔT / L, where L is wall thickness. Heat transfer rate is inversely proportional to thickness L. Doubling thickness (L → 2L) halves the rate of heat loss (Q/t → 0.5 × [Q/t]_orig).'
  },
  {
    id: 58,
    area: 'Area 4: Processes & Cycles',
    level: 'Regional',
    text: '[Kenston 2018] An ideal gas contained within a frictionless piston-cylinder apparatus is compressed ISOBARICALLY to one-third (1/3) of its initial volume. The resulting final pressure of the gas will be:',
    options: [
      '3 times as large as the initial value',
      'Equal to the initial value',
      '1/3 of the initial value',
      '9 times as large as the initial value'
    ],
    correct: 1,
    explanation: 'By fundamental definition, an ISOBARIC process occurs at CONSTANT PRESSURE (ΔP = 0). While an isothermal compression (PV = const) would triple the pressure, an isobaric compression maintains pressure exactly equal to its initial value by allowing heat to leave the system as temperature decreases (V₁/T₁ = V₂/T₂).'
  },
  {
    id: 59,
    area: 'Area 5: History of Thermodynamics',
    level: 'State',
    text: '[WNY 2019 / Kenston 2018] Around 1850, which pioneering physicist(s) first formulated the First and Second Laws of Thermodynamics, unifying Joule\'s mechanical equivalent of heat with Carnot\'s engine efficiency?',
    options: [
      'Rudolf Clausius and William Thomson (Lord Kelvin)',
      'J. Willard Gibbs and Enrico Fermi',
      'Daniel Bernoulli and Evangelista Torricelli',
      'Antoine Lavoisier and Count Rumford'
    ],
    correct: 0,
    explanation: 'In 1850, Rudolf Clausius published his landmark paper establishing the First Law (conservation of energy: dU = δQ - δW) and the Second Law (heat cannot spontaneously flow from cold to hot). Concurrently, William Thomson (Lord Kelvin) independently formulated the Kelvin-Planck statement of the Second Law.'
  },
  {
    id: 60,
    area: 'Area 5: History of Thermodynamics',
    level: 'National',
    text: '[WNY 2019] Which Austrian theoretical physicist discovered the fundamental statistical bridge connecting thermodynamic entropy (S) to microscopic molecular disorder (number of microstates W), famously commemorated by the equation S = k·ln(W)?',
    options: [
      'Sadi Carnot',
      'Ludwig Boltzmann',
      'James Clerk Maxwell',
      'Joseph Black'
    ],
    correct: 1,
    explanation: 'Ludwig Boltzmann revolutionized thermodynamics by providing the microscopic statistical mechanical foundation for entropy: S = k_B · ln(W), where k_B is Boltzmann\'s constant and W is the thermodynamic probability (number of accessible microstates corresponding to the macrostate). This formula is engraved on his headstone in Vienna.'
  }
];

export class ExamArena {
  constructor() {
    this.allQuestions = [...EXAM_QUESTIONS];
    this.questions = [...this.allQuestions];
    this.currentIndex = 0;
    this.userAnswers = new Array(this.questions.length).fill(null);
    this.isExamSubmitted = false;
    this.timerSeconds = 50 * 60; // 50 min official time
    this.timerInterval = null;
    this.selectedTopic = 'all';
    this.selectedLevel = 'all';
    this.selectedPreset = 'custom';
  }

  init() {
    this.updateFilterStatusBadge();
    this.renderQuestionPills();
    this.showQuestion(0);
    this.bindEvents();
    this.startTimer();
  }

  bindEvents() {
    const btnPrev = document.getElementById('examBtnPrev');
    const btnNext = document.getElementById('examBtnNext');
    const btnSubmit = document.getElementById('examBtnSubmit');
    const btnReset = document.getElementById('examBtnReset');

    if (btnPrev) btnPrev.addEventListener('click', () => this.prevQuestion());
    if (btnNext) btnNext.addEventListener('click', () => this.nextQuestion());
    if (btnSubmit) btnSubmit.addEventListener('click', () => this.submitExam());
    if (btnReset) btnReset.addEventListener('click', () => this.resetExam());

    // Topic filter dropdown
    const elTopic = document.getElementById('examTopicSelect');
    const elLevel = document.getElementById('examLevelSelect');
    const elPreset = document.getElementById('examPresetSelect');

    if (elTopic) {
      elTopic.addEventListener('change', (e) => {
        this.selectedTopic = e.target.value;
        // If a fixed whole-test preset was selected, revert preset to custom or keep ladder
        if (this.selectedPreset.startsWith('ruleCompliant') || this.selectedPreset === 'mock20') {
          this.selectedPreset = 'custom';
          if (elPreset) elPreset.value = 'custom';
        }
        this.applyFilters();
      });
    }

    // Difficulty level filter dropdown
    if (elLevel) {
      elLevel.addEventListener('change', (e) => {
        this.selectedLevel = e.target.value;
        if (this.selectedPreset.startsWith('ruleCompliant') || this.selectedPreset === 'mock20') {
          this.selectedPreset = 'custom';
          if (elPreset) elPreset.value = 'custom';
        }
        this.applyFilters();
      });
    }

    // Preset / Practice Mode dropdown
    if (elPreset) {
      elPreset.addEventListener('change', (e) => {
        this.selectedPreset = e.target.value;
        // For whole-test presets, sync topic and level to 'all' for clear visual feedback
        if (this.selectedPreset.startsWith('ruleCompliant') || this.selectedPreset === 'mock20') {
          this.selectedTopic = 'all';
          this.selectedLevel = 'all';
          if (elTopic) elTopic.value = 'all';
          if (elLevel) elLevel.value = 'all';
        }
        this.applyFilters();
      });
    }

    // Clear / Reset filter link
    const btnClearFilter = document.getElementById('examBtnClearFilter');
    if (btnClearFilter) {
      btnClearFilter.addEventListener('click', () => {
        this.resetFilters();
      });
    }

    // 1-Click Launch Kahoot Competition from active filtered test
    const btnLaunchKahoot = document.getElementById('examBtnLaunchKahoot');
    if (btnLaunchKahoot) {
      btnLaunchKahoot.addEventListener('click', () => {
        const filterTitle = this.getActiveFilterTitle();
        window.dispatchEvent(new CustomEvent('launch_kahoot_from_exam', {
          detail: {
            questions: [...this.questions],
            filterLabel: filterTitle
          }
        }));
      });
    }
  }

  getActiveFilterTitle() {
    const preset = this.selectedPreset;
    const topic = this.selectedTopic;
    const level = this.selectedLevel;

    if (preset === 'ruleCompliant18') return 'Rule-Compliant Test (18 Qs: ≥3 per Area i–vi)';
    if (preset === 'ruleCompliant24') return 'Rule-Compliant Test (24 Qs: 4 per Area i–vi)';
    if (preset === 'ruleCompliant30') return 'Rule-Compliant Test (30 Qs: 5 per Area i–vi)';
    if (preset === 'mock20') return 'Randomized 20-Question Mock Competition';

    const topicLabels = {
      'all': 'All Topics',
      'Foundations': 'Area 1: Systems & Scales',
      'Phases': 'Area 2: Phases & Gas Laws',
      'Transfer': 'Area 3: Heat Transfer Mechanics',
      'Processes': 'Area 4: Thermodynamic Cycles & Engines',
      'History': 'Area 5: Historical Pioneers',
      'Radiation': 'Area 6: Advanced Radiation & 3rd Law'
    };

    const levelLabels = {
      'all': 'All Difficulty Tiers',
      'Regional': '🟢 Regional (Foundational)',
      'State': '🟡 State (Intermediate)',
      'National': '🔴 National (Championship / Tiebreaker)'
    };

    const topicText = topicLabels[topic] || topic;
    const levelText = levelLabels[level] || level;

    if (preset === 'ladder') {
      return `${topicText} • 🪜 Progressive Ladder (${levelText})`;
    }

    if (topic === 'all' && level === 'all') {
      return 'All Topics (Full 60-Q Master Bank)';
    }

    return `${topicText} • ${levelText}`;
  }

  updateFilterStatusBadge() {
    const elBadge = document.getElementById('examFilterStatusBadge');
    const elText = document.getElementById('examFilterStatusText');
    if (!elText) return;

    const totalBank = this.allQuestions.length;
    const count = this.questions.length;
    const title = this.getActiveFilterTitle();

    elText.innerHTML = `<strong>Showing ${count} of ${totalBank} Qs</strong> • ${title}`;

    const isFiltered = (this.selectedTopic !== 'all' || this.selectedLevel !== 'all' || this.selectedPreset !== 'custom');
    if (elBadge) {
      if (isFiltered) {
        elBadge.style.borderColor = 'var(--cryo-cyan)';
        elBadge.style.background = 'rgba(0, 229, 255, 0.12)';
      } else {
        elBadge.style.borderColor = 'rgba(0, 229, 255, 0.25)';
        elBadge.style.background = 'rgba(0, 229, 255, 0.08)';
      }
    }
  }

  applyFilters() {
    const topic = this.selectedTopic;
    const level = this.selectedLevel;
    const preset = this.selectedPreset;

    let filtered = [...this.allQuestions];

    // Check whole-exam presets
    if (preset === 'ruleCompliant18') {
      filtered = this.getRuleCompliantTest(18, true);
    } else if (preset === 'ruleCompliant24') {
      filtered = this.getRuleCompliantTest(24, true);
    } else if (preset === 'ruleCompliant30') {
      filtered = this.getRuleCompliantTest(30, true);
    } else if (preset === 'mock20') {
      filtered = this.getRuleCompliantTest(20, true);
    } else {
      // Filter by Topic
      if (topic !== 'all') {
        filtered = filtered.filter(q => q.area.toLowerCase().includes(topic.toLowerCase()));
      }
      // Filter by Level
      if (level !== 'all') {
        filtered = filtered.filter(q => q.level.toLowerCase().includes(level.toLowerCase()));
      }

      // Rule boundary check: Area 6 is State & National only per SO rules
      if (filtered.length === 0 && topic === 'Radiation' && level === 'Regional') {
        if (window.showToast) {
          window.showToast('ℹ️ Area 6 (Radiation & 3rd Law) is State/National only per Science Olympiad rules. Showing State & National questions.', 'info');
        }
        filtered = this.allQuestions.filter(q => q.area.toLowerCase().includes('radiation'));
      }

      // Ladder preset: order progressively by difficulty (Regional ➔ State ➔ National)
      if (preset === 'ladder') {
        const levelOrder = { 'regional': 1, 'state': 2, 'national': 3 };
        filtered = [...filtered].sort((a, b) => {
          const orderA = levelOrder[a.level.toLowerCase()] || 2;
          const orderB = levelOrder[b.level.toLowerCase()] || 2;
          if (orderA !== orderB) return orderA - orderB;
          return a.id - b.id;
        });
      }
    }

    if (filtered.length === 0) {
      filtered = [...this.allQuestions];
    }

    this.questions = filtered;
    this.currentIndex = 0;
    this.userAnswers = new Array(this.questions.length).fill(null);
    this.isExamSubmitted = false;

    const elCard = document.getElementById('examScoreCard');
    if (elCard) elCard.style.display = 'none';

    this.updateFilterStatusBadge();
    this.renderQuestionPills();
    this.showQuestion(0);

    if (window.showToast) {
      const title = this.getActiveFilterTitle();
      window.showToast(`Loaded: ${title} (${this.questions.length} Questions)`, 'info');
    }
  }

  resetFilters() {
    this.selectedTopic = 'all';
    this.selectedLevel = 'all';
    this.selectedPreset = 'custom';

    const elTopic = document.getElementById('examTopicSelect');
    const elLevel = document.getElementById('examLevelSelect');
    const elPreset = document.getElementById('examPresetSelect');

    if (elTopic) elTopic.value = 'all';
    if (elLevel) elLevel.value = 'all';
    if (elPreset) elPreset.value = 'custom';

    this.applyFilters();
  }

  // Backwards compatibility helper
  filterQuestions(category) {
    if (category === 'all') {
      this.resetFilters();
    } else if (category.startsWith('ruleCompliant') || category === 'mock20') {
      this.selectedPreset = category;
      const elPreset = document.getElementById('examPresetSelect');
      if (elPreset) elPreset.value = category;
      this.applyFilters();
    } else if (category === 'Regional' || category === 'State' || category === 'National') {
      this.selectedLevel = category;
      const elLevel = document.getElementById('examLevelSelect');
      if (elLevel) elLevel.value = category;
      this.applyFilters();
    } else {
      this.selectedTopic = category;
      const elTopic = document.getElementById('examTopicSelect');
      if (elTopic) elTopic.value = category;
      this.applyFilters();
    }
  }

  startTimer() {
    clearInterval(this.timerInterval);
    const elTimer = document.getElementById('examTimer');
    this.timerInterval = setInterval(() => {
      if (this.isExamSubmitted) return;
      if (this.timerSeconds > 0) {
        this.timerSeconds--;
        if (elTimer) {
          const m = Math.floor(this.timerSeconds / 60);
          const s = this.timerSeconds % 60;
          elTimer.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
      } else {
        clearInterval(this.timerInterval);
        this.submitExam();
        if (window.showToast) window.showToast('Time expired! Exam automatically submitted.', 'warning');
      }
    }, 1000);
  }

  renderQuestionPills() {
    const container = document.getElementById('examQuestionPills');
    if (!container) return;
    container.innerHTML = '';

    this.questions.forEach((q, idx) => {
      const pill = document.createElement('button');
      pill.className = `q-pill ${idx === this.currentIndex ? 'active' : ''}`;
      pill.textContent = idx + 1;
      pill.id = `qPill-${idx}`;

      if (this.userAnswers[idx] !== null) {
        if (!this.isExamSubmitted) {
          pill.classList.add('answered');
        } else {
          pill.classList.add(this.userAnswers[idx] === q.correct ? 'correct' : 'incorrect');
        }
      }

      pill.addEventListener('click', () => this.showQuestion(idx));
      container.appendChild(pill);
    });
  }

  showQuestion(idx) {
    if (idx < 0 || idx >= this.questions.length) return;
    this.currentIndex = idx;
    const q = this.questions[idx];

    // Meta details
    const elCategory = document.getElementById('qCategory');
    const elNumber = document.getElementById('qNumber');
    const elLevel = document.getElementById('qLevel');
    const elText = document.getElementById('qText');
    const elOptions = document.getElementById('qOptions');
    const elExplanation = document.getElementById('qExplanation');

    if (elCategory) elCategory.textContent = q.area;
    if (elNumber) elNumber.textContent = `Question ${idx + 1} of ${this.questions.length}`;
    if (elLevel) {
      elLevel.classList.remove('level-badge-regional', 'level-badge-state', 'level-badge-national');
      const lvl = (q.level || '').toLowerCase();
      if (lvl.includes('regional')) {
        elLevel.classList.add('level-badge-regional');
        elLevel.innerHTML = '🟢 Regional (Foundational)';
      } else if (lvl.includes('state')) {
        elLevel.classList.add('level-badge-state');
        elLevel.innerHTML = '🟡 State (Intermediate)';
      } else if (lvl.includes('national')) {
        elLevel.classList.add('level-badge-national');
        elLevel.innerHTML = '🔴 National (Championship / Tiebreaker)';
      } else {
        elLevel.textContent = q.level;
      }
    }
    if (elText) elText.textContent = q.text;

    // Render options
    if (elOptions) {
      elOptions.innerHTML = '';
      const letters = ['A', 'B', 'C', 'D'];
      q.options.forEach((opt, optIdx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        if (this.userAnswers[idx] === optIdx) btn.classList.add('selected');

        if (this.isExamSubmitted) {
          if (optIdx === q.correct) btn.classList.add('correct');
          else if (this.userAnswers[idx] === optIdx) btn.classList.add('wrong');
        }

        btn.innerHTML = `
          <span class="option-letter">${letters[optIdx]}</span>
          <span>${opt}</span>
        `;

        if (!this.isExamSubmitted) {
          btn.addEventListener('click', () => this.selectAnswer(idx, optIdx));
        }

        elOptions.appendChild(btn);
      });
    }

    // Explanation visibility
    if (elExplanation) {
      if (this.isExamSubmitted) {
        elExplanation.classList.add('show');
        elExplanation.innerHTML = `
          <strong style="color: var(--cryo-cyan);">Official Solution Breakdown:</strong><br>
          ${q.explanation}
        `;
      } else {
        elExplanation.classList.remove('show');
      }
    }

    // Update active pill styling
    document.querySelectorAll('.q-pill').forEach((p, pIdx) => {
      p.classList.toggle('active', pIdx === idx);
    });
  }

  selectAnswer(qIdx, optIdx) {
    this.userAnswers[qIdx] = optIdx;
    this.showQuestion(qIdx);
    this.renderQuestionPills();
  }

  prevQuestion() {
    if (this.currentIndex > 0) this.showQuestion(this.currentIndex - 1);
  }

  nextQuestion() {
    if (this.currentIndex < this.questions.length - 1) this.showQuestion(this.currentIndex + 1);
  }

  submitExam() {
    this.isExamSubmitted = true;
    let rawScore = 0;
    this.questions.forEach((q, idx) => {
      if (this.userAnswers[idx] === q.correct) rawScore++;
    });

    const percent = Math.round((rawScore / this.questions.length) * 100);
    // Official Exam Score out of 50 points (Rule 6.d)
    const examScore50 = parseFloat(((rawScore / this.questions.length) * 50).toFixed(1));

    const elCard = document.getElementById('examScoreCard');
    const elRaw = document.getElementById('examRawScore');
    const elES = document.getElementById('examESScore');
    const elPct = document.getElementById('examPercent');

    if (elCard) elCard.style.display = 'block';
    if (elRaw) elRaw.textContent = `${rawScore} / ${this.questions.length}`;
    if (elES) elES.textContent = `${examScore50} / 50 pts`;
    if (elPct) elPct.textContent = `${percent}%`;

    this.renderQuestionPills();
    this.showQuestion(this.currentIndex);

    // Record score to student profile in authManager
    authManager.recordExamResult({
      raw: rawScore,
      total: this.questions.length,
      es: examScore50,
      percent: percent,
      type: 'interactive'
    });

    if (window.showToast) {
      window.showToast(`Exam submitted! You scored ${rawScore}/${this.questions.length} (${examScore50} / 50 ES Points)`, 'success');
    }
  }

  resetExam() {
    this.isExamSubmitted = false;
    this.currentIndex = 0;
    this.userAnswers = new Array(this.questions.length).fill(null);
    this.timerSeconds = 50 * 60;
    const elCard = document.getElementById('examScoreCard');
    if (elCard) elCard.style.display = 'none';
    this.startTimer();
    this.renderQuestionPills();
    this.showQuestion(0);
  }

  getRuleCompliantTest(count = 18, isRandom = true) {
    const areaKeys = [
      'Area 1: Foundations & Scales',
      'Area 2: Phases & Gas Laws',
      'Area 3: Heat Transfer Mechanics',
      'Area 4: Processes & Cycles',
      'Area 5: History of Thermodynamics',
      'Area 6: Advanced Radiation & 3rd Law'
    ];

    const grouped = {};
    areaKeys.forEach(area => {
      let pool = this.allQuestions.filter(q => q.area === area);
      if (isRandom) {
        pool = [...pool].sort(() => 0.5 - Math.random());
      }
      grouped[area] = pool;
    });

    const perArea = Math.max(3, Math.floor(count / 6));
    let selected = [];

    areaKeys.forEach(area => {
      const pool = grouped[area];
      selected.push(...pool.slice(0, Math.min(perArea, pool.length)));
    });

    if (selected.length < count) {
      let remaining = this.allQuestions.filter(q => !selected.some(s => s.id === q.id));
      if (isRandom) {
        remaining = [...remaining].sort(() => 0.5 - Math.random());
      }
      selected.push(...remaining.slice(0, count - selected.length));
    }

    return selected.slice(0, count).sort((a, b) => a.id - b.id);
  }
}
