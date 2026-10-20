/**
 * ThermoOlyMaster - Module 7: Interactive Curriculum & Lessons Hub
 * Provides comprehensive, syllabus-aligned lessons for Science Olympiad Division B (2027 Season).
 * Features:
 * 1. Student Lesson Access: structured guides, formulas, competition traps, and interactive quiz checkpoints.
 * 2. Teacher Presentation Mode: coaching notes, discussion prompts, classroom demonstrations, and misconception alerts.
 * 3. Coach Custom Lesson Builder: admin creation, editing, and deletion of custom lessons.
 * 4. Automatic Progress Tracking: integrated with authManager to track student completions.
 * 5. Full Mathematical & Variable Substitution: renders all symbols, equations, superscripts, and tables flawlessly.
 */

import { authManager } from './auth-manager.js';

/**
 * Robust mathematical symbol, Greek letter, and LaTeX variable substitution engine.
 * Converts raw LaTeX notation into clean Unicode mathematical typography.
 */
export function formatMathAndVariables(text) {
  if (!text) return '';
  let str = String(text);

  // 1. Greek letters & mathematical operators
  str = str.replace(/\\Delta\s*/g, 'Δ')
           .replace(/\\rho\b/g, 'ρ')
           .replace(/\\sigma\b/g, 'σ')
           .replace(/\\varepsilon\b/g, 'ε')
           .replace(/\\epsilon\b/g, 'ε')
           .replace(/\\eta\b/g, 'η')
           .replace(/\\Omega\b/g, 'Ω')
           .replace(/\\lambda\b/g, 'λ')
           .replace(/\\gamma\b/g, 'γ')
           .replace(/\\alpha\b/g, 'α')
           .replace(/\\pi\b/g, 'π')
           .replace(/\\infty\b/g, '∞')
           .replace(/\\oint\b/g, '∮')
           .replace(/\\approx\b/g, '≈')
           .replace(/\\propto\b/g, '∝')
           .replace(/\\cdot\b/g, ' · ')
           .replace(/\\times\b/g, ' × ')
           .replace(/\\le\b/g, '≤')
           .replace(/\\ge\b/g, '≥')
           .replace(/\\ne\b/g, '≠')
           .replace(/\\pm\s*/g, '±')
           .replace(/\\to\b/g, ' ➔ ')
           .replace(/\\leftrightarrow\b/g, ' ↔ ')
           .replace(/\\implies\b/g, ' ⟹ ');

  // 2. Degree notations
  str = str.replace(/\^\\circ\\text\{C\}/g, '°C')
           .replace(/\^\\circ\\text\{F\}/g, '°F')
           .replace(/\^\\circ\\text\{R\}/g, '°R')
           .replace(/\^\\circ\s*C\b/g, '°C')
           .replace(/\^\\circ\s*F\b/g, '°F')
           .replace(/\^\\circ\s*R\b/g, '°R')
           .replace(/\^\\circ/g, '°');

  // 3. LaTeX \frac{A}{B} replacements (supporting up to 2 nested levels)
  str = str.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1 / $2)');
  str = str.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1 / $2)');

  // 4. LaTeX formatting tags & sizing
  str = str.replace(/\\text\{([^{}]+)\}/g, '$1')
           .replace(/\\mathrm\{([^{}]+)\}/g, '$1')
           .replace(/\\mathbf\{([^{}]+)\}/g, '$1')
           .replace(/\\left\(/g, '(')
           .replace(/\\right\)/g, ')')
           .replace(/\\left\[/g, '[')
           .replace(/\\right\]/g, ']')
           .replace(/\\left\|/g, '|')
           .replace(/\\right\|/g, '|')
           .replace(/\\quad/g, ' ')
           .replace(/\\,/g, ' ')
           .replace(/\\;/g, ' ');

  // 5. Superscripts & powers
  str = str.replace(/\b([A-Za-z0-9_]+)\^4\b/g, '$1⁴')
           .replace(/\b([A-Za-z0-9_]+)\^3\b/g, '$1³')
           .replace(/\b([A-Za-z0-9_]+)\^2\b/g, '$1²')
           .replace(/10\^\{-8\}/g, '10⁻⁸')
           .replace(/10\^\{-23\}/g, '10⁻²³')
           .replace(/10\^\{-3\}/g, '10⁻³')
           .replace(/10\^5\b/g, '10⁵')
           .replace(/10\^6\b/g, '10⁶')
           .replace(/2\^4\b/g, '16')
           .replace(/2\^2\b/g, '4');

  // 6. Subscript cleanup: T_{final} -> T_final, T_{start} -> T_start
  str = str.replace(/_\{([^{}]+)\}/g, '_$1');

  // Remove stray double backslashes
  str = str.replace(/\\\\/g, '\\');

  return str.trim();
}

/**
 * Converts markdown text into structured, accessible HTML with math formatting,
 * responsive tables, bullet lists, bold text, and formula callout cards.
 */
export function renderMarkdownAndMath(markdown) {
  if (!markdown) return '';
  let text = String(markdown);

  // 1. Extract and process display math blocks $$ ... $$
  const displayMathBlocks = [];
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    const cleaned = formatMathAndVariables(formula.trim()).replace(/\$/g, '');
    displayMathBlocks.push(cleaned);
    return `___DISPLAY_MATH_${displayMathBlocks.length - 1}___`;
  });

  // 2. Extract and process inline math $ ... $
  text = text.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
    const cleaned = formatMathAndVariables(formula.trim()).replace(/\\/g, '');
    return `<span class="math-var">${cleaned}</span>`;
  });

  // 2.5 Extract and process Markdown Images ![caption](url)
  text = text.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
    const cleanAlt = alt.trim();
    const cleanSrc = src.trim();
    return `<figure class="lesson-figure"><img src="${cleanSrc}" alt="${cleanAlt}" class="lesson-illustration">${cleanAlt ? `<figcaption>${cleanAlt}</figcaption>` : ''}</figure>`;
  });

  // 3. Process Markdown Tables
  const lines = text.split('\n');
  const processedLines = [];
  let inTable = false;
  let tableHeader = [];
  let tableRows = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      // Check if this is the markdown table alignment separator row
      if (cells.every(c => /^:?-+:?$/.test(c))) {
        continue;
      }
      if (!inTable) {
        inTable = true;
        tableHeader = cells;
        tableRows = [];
      } else {
        tableRows.push(cells);
      }
    } else {
      if (inTable) {
        // Flush active table
        let tableHtml = '<div class="reference-table-wrap" style="margin:1rem 0;"><table class="reference-table"><thead><tr>';
        tableHeader.forEach(h => {
          tableHtml += `<th>${formatMathAndVariables(h)}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';
        tableRows.forEach(row => {
          tableHtml += '<tr>';
          row.forEach(cell => {
            tableHtml += `<td>${formatMathAndVariables(cell)}</td>`;
          });
          tableHtml += '</tr>';
        });
        tableHtml += '</tbody></table></div>';
        processedLines.push(tableHtml);
        inTable = false;
        tableHeader = [];
        tableRows = [];
      }
      processedLines.push(lines[i]);
    }
  }

  if (inTable) {
    let tableHtml = '<div class="reference-table-wrap" style="margin:1rem 0;"><table class="reference-table"><thead><tr>';
    tableHeader.forEach(h => {
      tableHtml += `<th>${formatMathAndVariables(h)}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';
    tableRows.forEach(row => {
      tableHtml += '<tr>';
      row.forEach(cell => {
        tableHtml += `<td>${formatMathAndVariables(cell)}</td>`;
      });
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table></div>';
    processedLines.push(tableHtml);
  }

  text = processedLines.join('\n');

  // 4. Process Unordered Lists (* item or - item)
  const listProcessedLines = [];
  let inList = false;
  const rawLines = text.split('\n');

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const match = line.match(/^\s*[\*\-]\s+(.*)$/);
    if (match) {
      if (!inList) {
        listProcessedLines.push('<ul style="padding-left:1.5rem; margin:0.6rem 0 1rem 0;">');
        inList = true;
      }
      listProcessedLines.push(`<li style="margin-bottom:0.4rem;">${match[1]}</li>`);
    } else {
      if (inList) {
        listProcessedLines.push('</ul>');
        inList = false;
      }
      listProcessedLines.push(line);
    }
  }
  if (inList) {
    listProcessedLines.push('</ul>');
  }

  text = listProcessedLines.join('\n');

  // 5. Convert Bold & Italic
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
             .replace(/\*(.*?)\*/g, '<em>$1</em>');

  // 6. Restore Display Math Blocks as sleek formula cards
  text = text.replace(/___DISPLAY_MATH_(\d+)___/g, (match, idx) => {
    return `<div class="formula-callout"><span class="mono">${displayMathBlocks[Number(idx)]}</span></div>`;
  });

  // 7. Convert paragraphs (avoid wrapping block elements)
  const blocks = text.split(/\n\s*\n/);
  const formattedBlocks = blocks.map(block => {
    const trimmed = block.trim();
    if (trimmed.startsWith('<div') || trimmed.startsWith('<ul') || trimmed.startsWith('<table') || trimmed.startsWith('<ol') || trimmed.startsWith('<figure')) {
      return trimmed;
    }
    return `<p style="margin-bottom:0.85rem; line-height:1.65;">${trimmed.replace(/\n/g, '<br>')}</p>`;
  });

  let finalHtml = formattedBlocks.join('\n');

  // 8. Final substitution sweep for any remaining raw LaTeX symbols
  finalHtml = formatMathAndVariables(finalHtml);

  return finalHtml;
}

export const DEFAULT_LESSONS = [
  {
    id: 'lesson_1',
    area: 'Area 1: Foundations & Scales',
    level: 'Regional & Above',
    durationMin: 20,
    title: 'Thermodynamic Systems, Zeroth Law & Temperature Scales',
    summary: 'Master system boundaries, intensive vs extensive properties, Zeroth Law thermal equilibrium, and temperature scale conversions (°C, °F, K, °R).',
    sections: [
      {
        heading: '1. Thermodynamic Systems & Boundaries',
        content: `A thermodynamic system is the specific quantity of matter or region in space selected for analysis. Everything external is the **surroundings**, separated by a **boundary** (real or imaginary, fixed or movable).
* **Open System (Control Volume):** Both energy and matter can cross the boundary (e.g., boiling water in an open cup).
* **Closed System (Control Mass):** Energy crosses the boundary (heat/work), but **matter cannot** (e.g., sealed piston-cylinder, our greenhouse collector cup with a sealed glazing).
* **Isolated System:** Neither energy nor matter can cross the boundary (e.g., an ideal rigid calorimeter with infinite insulation).`
      },
      {
        heading: '2. Intensive vs. Extensive Properties',
        content: `* **Intensive Properties:** Independent of system size or mass. If you divide the system in half, intensive properties remain unchanged! Examples: Temperature ($T$), Pressure ($P$), Density ($\\rho$), Specific Heat ($c$), and Viscosity.
* **Extensive Properties:** Directly proportional to the extent or mass of the system. If you double the system size, extensive properties double! Examples: Total Volume ($V$), Total Mass ($m$), Total Internal Energy ($U$), Enthalpy ($H$), and Entropy ($S$).
* **Rule of Thumb:** Dividing any extensive property by mass yields an *intensive specific property* (e.g., Specific Volume $v = V/m$, Specific Energy $u = U/m$).`
      },
      {
        heading: '3. The Zeroth Law of Thermodynamics',
        content: `* **Formal Statement:** If System A is in thermal equilibrium with System B, and System B is in thermal equilibrium with System C, then System A is in thermal equilibrium with System C.
* **Physical Significance:** Thermal equilibrium means two bodies in thermal contact cease heat exchange because they have reached the **same temperature**. The Zeroth Law establishes temperature as a valid, objective, single-valued property and provides the physical basis for all thermometer calibration!`
      },
      {
        heading: '4. Master Temperature Scale Conversions',
        image: {
          src: 'assets/images/kelvin_absolute_scale.jpg',
          caption: 'Comparison of Thermodynamic Temperature Scales & Absolute Zero Benchmarks (Kelvin, Celsius, Fahrenheit, and Rankine)'
        },
        content: `Science Olympiad exams heavily test unit conversions across all 4 historical and SI scales:
* **Celsius to Kelvin:** $T_K = T_C + 273.15$
* **Celsius to Fahrenheit:** $T_F = (9/5 \\times T_C) + 32$
* **Fahrenheit to Celsius:** $T_C = (5/9) \\times (T_F - 32)$
* **Kelvin to Rankine:** $T_R = (9/5) \\times T_K$ (Rankine is the absolute scale based on Fahrenheit degree increments; Absolute Zero is $0^\\circ\\text{R} = -459.67^\\circ\\text{F}$).
* **Fahrenheit to Rankine:** $T_R = T_F + 459.67$
* **Equal Point:** $-40^\\circ\\text{C} = -40^\\circ\\text{F}$!`
      },
      {
        heading: '5. Units of Thermal Energy',
        content: `* **Joule (J):** Standard SI unit of energy ($1\\text{ J} = 1\\text{ N} \\cdot \\text{m} = 1\\text{ kg} \\cdot \\text{m}^2/\\text{s}^2$).
* **Calorie (cal):** Amount of heat required to raise $1\\text{ g}$ of water by $1^\\circ\\text{C}$ ($1\\text{ cal} = 4.184\\text{ J}$).
* **Kilocalorie / Food Calorie (kcal or Cal):** $1\\text{ kcal} = 1000\\text{ cal} = 4184\\text{ J}$.
* **British Thermal Unit (BTU):** Heat required to raise $1\\text{ lb}$ of water by $1^\\circ\\text{F}$ ($1\\text{ BTU} \\approx 1055.06\\text{ J} \\approx 252.16\\text{ cal}$).`
      }
    ],
    teacherNotes: {
      objective: 'Ensure middle school competitors clearly distinguish intensive from extensive properties and can effortlessly calculate Rankine and Kelvin temperatures without hesitation.',
      discussionPrompt: 'Ask the team: "If you pour 100 mL of 20°C water into another 100 mL of 20°C water, which properties double and which stay the same?" (Volume, mass, and internal energy double; temperature and density stay the same).',
      demoAction: 'Open Module 6 (Binder Hub) and have students test the Multi-Unit Temperature Converter with -40°C, 0°C, and 100°C.',
      commonTrap: 'Students often forget to convert temperatures to absolute Kelvin (or Rankine) before doing gas law or Carnot efficiency calculations!'
    },
    quiz: {
      question: 'A closed container holding 0.5 kg of neon gas at 300 K is connected to an identical empty container, and the valve is opened so the gas expands to twice its initial volume at constant temperature. Which of the following properties of the gas remains UNCHANGED?',
      options: [
        'Total volume (V)',
        'Density (ρ)',
        'Temperature (T)',
        'Total pressure (P)'
      ],
      correct: 2,
      explanation: 'Temperature is an intensive property and is held constant at 300 K. In contrast, volume doubles, density is cut in half (ρ = m / V), and pressure is halved by Boyle\'s Law (P1·V1 = P2·V2).'
    }
  },
  {
    id: 'lesson_2',
    area: 'Area 3: Heat Transfer Mechanics',
    level: 'Regional & Above',
    durationMin: 25,
    title: 'Heat Transfer Mechanisms & The 2027 Device Challenge',
    summary: 'Detailed physics of conduction, convection, and radiation, plus engineering optimization of the 30x30x30 cm heat collector device under Rule 3.',
    sections: [
      {
        heading: '1. Conduction & Fourier\'s Law of Heat Conduction',
        content: `Conduction is the transfer of thermal kinetic energy through direct molecular collisions without bulk motion of the material.
$$q = -k \\cdot A \\cdot (\\Delta T / L)$$
* $k$: Thermal conductivity $(\\text{W}/(\\text{m} \\cdot \\text{K}))$. High for copper ($390$) and aluminum ($205$); extremely low for air ($0.026$) and aerogel ($0.015$).
* $A$: Surface cross-sectional area $(\\text{m}^2)$.
* $\\Delta T$: Temperature gradient $(T_{hot} - T_{cold})$.
* $L$: Thickness of insulation layer $(\\text{m})$.`
      },
      {
        heading: '2. Convection & Thermal Boundary Layers',
        content: `Convection is energy transfer between a solid surface and a moving fluid (liquid or gas), combining conduction and fluid advection.
* **Natural (Free) Convection:** Fluid motion is driven solely by buoyancy forces due to density differences from temperature gradients (e.g., hot air rising above the warm collector cup).
$$Q_{conv} = h_{conv} \\cdot A \\cdot (T_{surface} - T_{room})$$
* **Competition Strategy:** Without a top window, hot air continuously escapes via natural buoyant plume convection. Sealing the top with clear acrylic creates a **greenhouse convective trap** that blocks warm air escape while admitting incoming radiant light!`
      },
      {
        heading: '3. Radiation & The Stefan-Boltzmann Law',
        content: `Thermal radiation is electromagnetic energy emitted by matter as a result of its finite temperature. Radiation requires **no physical medium** and travels at the speed of light!
$$P_{rad} = \\varepsilon \\cdot \\sigma \\cdot A \\cdot T^4$$
* $\\sigma = 5.670374 \\times 10^{-8} \\text{ W}/(\\text{m}^2 \\cdot \\text{K}^4)$ (Stefan-Boltzmann constant).
* $\\varepsilon$: Emissivity ($0 \\le \\varepsilon \\le 1$). Polished foil $\\approx 0.05$; Matte black paint $\\approx 0.95$.
* $T$: Absolute temperature in **Kelvin**!
* **Inverse-Square Law:** Radiation flux from the supervisor\'s heat lamp drops off with height:
$$I(h) \\propto P_{lamp} / h^2$$
Doubling bulb height from $40\\text{ cm}$ to $80\\text{ cm}$ slashes incident power to $1/4$ ($25\\%$)!`
      },
      {
        heading: '4. Science Olympiad Rule 3 & 4 Collector Blueprint',
        content: `* **30.0 × 30.0 × 30.0 cm Cube Limit:** The entire apparatus must fit inside the supervisor\'s inspection box.
* **100 mL Water & 9 oz Clear Plastic Cup:** Provided by the tournament.
* **CRITICAL RULE 3.b (Water Contact):** Parts may sit inside the cup, but **under no circumstances may any part of the device contact the water**! A single droplet touching your sleeve is an immediate construction violation ($0.7\\times$ multiplier) or disqualification.
* **Winning 3-Zone Architecture:**
  * **Optical Concentrator:** Parabolic or conical funnel of aluminized Mylar to collect lamp rays over a large aperture ($28\\text{ cm}$ diameter) and funnel them into the cup mouth.
  * **Greenhouse Window:** Transparent acrylic/glass top to trap rising convective thermal air.
  * **High-Absorptivity Receiver Sleeve:** Matte black anodized copper or aluminum snugly wrapped around the outside of the 9 oz cup to absorb light and conduct heat through the plastic cup wall into the water.`
      }
    ],
    teacherNotes: {
      objective: 'Help students connect heat transfer theory directly to the build event: Why copper sleeves work, why Mylar funnels work, and why insulation on the bottom is essential.',
      discussionPrompt: 'Ask students: "Why do we paint the inside sleeve matte black (high absorptivity) but use shiny silver Mylar for the top cone (high reflectivity)?"',
      demoAction: 'Jump to Module 1 (Heat Collector Lab), toggle the top glazing between "Open Top" and "Clear Acrylic", and watch the temperature graph flatten out when open due to convection loss.',
      commonTrap: 'Teams often insulate the top, blocking the heat lamp! The top must be transparent to radiation while impermeable to airflow.'
    },
    quiz: {
      question: 'Under Science Olympiad 2027 Rule 3.b, a team constructs a copper thermal conductive rod that extends from the lamp focal point down into the 100 mL water volume to speed up heat conduction. What is the official supervisor ruling?',
      options: [
        'Permitted, because copper is a non-hazardous commercial metal',
        'Violation: No part of the device may contact the water, resulting in severe penalties or zero device score',
        'Permitted, provided the rod does not exceed 30 cm in length',
        'Permitted, but incurs only a 5-point math deduction'
      ],
      correct: 1,
      explanation: 'Rule 3.b strictly states that no part of the device may contact the water! Immersing a copper rod into the water is a direct violation of the rules.'
    }
  },
  {
    id: 'lesson_3',
    area: 'Area 2: Phases & Calorimetry',
    level: 'Regional & Above',
    durationMin: 20,
    title: 'Heat Capacity, Calorimetry & Phase Transitions',
    summary: 'Sensible heat calculations (Q = mcΔT), latent heat of fusion and vaporization, and interpreting multi-phase heating curves.',
    sections: [
      {
        heading: '1. Sensible Heat & Heat Capacity',
        content: `Sensible heat is thermal energy transferred that results in a detectable change in temperature of a substance without a change in phase.
$$Q = m \\cdot c \\cdot \\Delta T = C \\cdot \\Delta T$$
* $m$: Mass in $\\text{kg}$ (or $\\text{g}$).
* $c$: Specific heat capacity $(\\text{J}/(\\text{kg} \\cdot ^\\circ\\text{C}))$. Intensive property!
* $C = m \\cdot c$: Total heat capacity $(\\text{J}/^\\circ\\text{C})$. Extensive property!
* **Specific Heat of Liquid Water:**
$$c_{water} \\approx 4184 \\text{ J}/(\\text{kg} \\cdot ^\\circ\\text{C}) = 1.00 \\text{ cal}/(\\text{g} \\cdot ^\\circ\\text{C})$$
Water has an unusually high specific heat capacity due to hydrogen bonding, making it an exceptional thermal reservoir.`
      },
      {
        heading: '2. Latent Heat & Phase Transitions',
        content: `During a phase transition (melting, boiling, freezing, condensation), heat added does **not** change the substance\'s temperature! Energy goes entirely into breaking or forming intermolecular bonds.
$$Q = m \\cdot L$$
* **Key Constants for Water ($H_2O$):**
  * **Latent Heat of Fusion ($L_f$):** $3.34 \\times 10^5 \\text{ J}/\\text{kg} = 334 \\text{ kJ}/\\text{kg} \\approx 79.7 \\text{ cal}/\\text{g}$ (Solid ↔ Liquid at $0^\\circ\\text{C}$).
  * **Latent Heat of Vaporization ($L_v$):** $2.26 \\times 10^6 \\text{ J}/\\text{kg} = 2260 \\text{ kJ}/\\text{kg} \\approx 540 \\text{ cal}/\\text{g}$ (Liquid ↔ Gas at $100^\\circ\\text{C}$).
  * Note: $L_v \\approx 6.8 \\times L_f$ because completely separating liquid molecules against atmospheric pressure requires far more energy than merely loosening crystal lattice bonds!`
      },
      {
        heading: '3. Multi-Phase Heating Curves',
        content: `A heating curve plots Temperature ($T$) vs. Heat Added ($Q$):
* **Solid Warming (Ice below 0°C):** Sloped line: $Q_1 = m \\cdot c_{ice} \\cdot \\Delta T$ ($c_{ice} \\approx 2090\\text{ J}/(\\text{kg} \\cdot \\text{K})$).
* **Melting Plateau (0°C):** Flat horizontal line: $Q_2 = m \\cdot L_f$. Temperature is constant!
* **Liquid Warming (Water 0°C to 100°C):** Sloped line: $Q_3 = m \\cdot c_{water} \\cdot \\Delta T$.
* **Boiling Plateau (100°C):** Long horizontal line: $Q_4 = m \\cdot L_v$.
* **Vapor Warming (Steam above 100°C):** Sloped line: $Q_5 = m \\cdot c_{steam} \\cdot \\Delta T$ ($c_{steam} \\approx 2010\\text{ J}/(\\text{kg} \\cdot \\text{K})$).`
      }
    ],
    teacherNotes: {
      objective: 'Ensure competitors can set up conservation of energy equations in calorimetry (Q_lost + Q_gained = 0) and recognize that temperature plateaus represent latent phase transitions.',
      discussionPrompt: 'Challenge the students: "Which causes a more severe thermal burn at 100°C: 1 gram of boiling liquid water or 1 gram of steam?" (Steam, because it releases 2260 J of latent heat during condensation before the liquid even begins cooling!).',
      demoAction: 'Open Module 4 (Physics Visualizer -> Calorimetry Stepper) and step through the 5 zones.',
      commonTrap: 'Students often use c_water for ice or steam calculations. Remember: c_ice ≈ 2090 and c_steam ≈ 2010, roughly half that of liquid water!'
    },
    quiz: {
      question: 'How much total thermal energy (in Joules) is required to convert 50 grams of ice at 0.0°C into liquid water at 20.0°C? (Lf = 334,000 J/kg; c_water = 4184 J/(kg·°C))',
      options: [
        '4,184 J',
        '16,700 J',
        '20,884 J',
        '33,400 J'
      ],
      correct: 2,
      explanation: 'Two-step process: (1) Melt ice: Q1 = m · Lf = 0.050 kg · 334,000 J/kg = 16,700 J. (2) Warm water to 20°C: Q2 = m · c · ΔT = 0.050 kg · 4184 J/(kg·°C) · 20.0°C = 4,184 J. Total Q = 16,700 + 4,184 = 20,884 J.'
    }
  },
  {
    id: 'lesson_4',
    area: 'Area 4: Processes & Cycles',
    level: 'State & National',
    durationMin: 25,
    title: 'Ideal Gas Laws & The Four Thermodynamic Processes',
    summary: 'The Ideal Gas Law, First Law of Thermodynamics, and calculating work done on PV diagrams for isobaric, isochoric, isothermal, and adiabatic paths.',
    sections: [
      {
        heading: '1. The Ideal Gas Law',
        content: `An ideal gas consists of point particles undergoing perfectly elastic collisions with zero intermolecular potential energy.
* **Macroscopic Form:**
$$P \\cdot V = n \\cdot R \\cdot T$$
  * $P$: Absolute pressure in Pascals $(\\text{Pa} = \\text{N}/\\text{m}^2)$.
  * $V$: Volume in $\\text{m}^3$ ($1\\text{ m}^3 = 1000\\text{ L}$).
  * $n$: Number of moles $(\\text{mol})$.
  * $R = 8.314462 \\text{ J}/(\\text{mol} \\cdot \\text{K})$ (Universal Gas Constant).
  * $T$: Absolute temperature in **Kelvin**!
* **Microscopic Form:**
$$P \\cdot V = N \\cdot k_B \\cdot T$$
  * $N$: Number of molecules.
  * $k_B = 1.380649 \\times 10^{-23} \\text{ J}/\\text{K}$ (Boltzmann constant).
  * $R = N_A \\cdot k_B$ where $N_A = 6.02214 \\times 10^{23} \\text{ mol}^{-1}$.`
      },
      {
        heading: '2. The First Law of Thermodynamics',
        content: `The First Law is the principle of conservation of energy applied to thermodynamic systems:
$$\\Delta U = Q - W$$
* $\\Delta U$: Change in internal energy of the system. For a monatomic ideal gas, $U = (3/2) \\cdot n \\cdot R \\cdot T$, so $\\Delta U$ depends **only on temperature change** $\\Delta T$!
* $Q$: Net heat added to the system ($Q > 0$ when heat enters; $Q < 0$ when heat leaves).
* $W$: Work done **by** the system on the surroundings ($W > 0$ during expansion; $W < 0$ during compression).`
      },
      {
        heading: '3. The 4 Cardinal Thermodynamic Processes',
        content: `* **1. Isobaric (Constant Pressure, $\\Delta P = 0$):**
  * Horizontal line on PV diagram.
  * Work done: $W = P \\cdot \\Delta V = P \\cdot (V_f - V_i)$.
  * Heat added: $Q = n \\cdot C_p \\cdot \\Delta T$.
* **2. Isochoric / Isometric (Constant Volume, $\\Delta V = 0$):**
  * Vertical line on PV diagram.
  * Work done: $W = 0$ (no boundary displacement!).
  * By First Law: $\\Delta U = Q = n \\cdot C_v \\cdot \\Delta T$.
* **3. Isothermal (Constant Temperature, $\\Delta T = 0$):**
  * Hyperbolic curve on PV diagram ($P \\propto 1/V$).
  * Since $\\Delta T = 0$, $\\Delta U = 0$!
  * By First Law: $Q = W$ (all heat added is converted completely to expansion work!).
* **4. Adiabatic (Zero Heat Transfer, $Q = 0$):**
  * Steeper hyperbolic curve ($P \\cdot V^\\gamma = \\text{const}$, where $\\gamma = C_p / C_v$).
  * Perfectly insulated or ultra-rapid process.
  * By First Law: $\\Delta U = -W$.
  * During adiabatic expansion ($W > 0$), $\\Delta U < 0$, so the gas **cools down**!`
      },
      {
        heading: '4. PV Diagram Geometric Work Calculation (Rule 5.d Compliant)',
        content: `Science Olympiad Rule 5.d strictly prohibits calculus. Work on PV diagrams is found geometrically:
* **Work = Area Under the PV Curve:**
  * Rectangle for isobaric step: $\\text{Area} = \\text{height} \\times \\text{width} = P \\cdot \\Delta V$.
  * Triangle for linear process: $\\text{Area} = (1/2) \\cdot (P_1 + P_2) \\cdot \\Delta V$ (trapezoid rule).
* **Net Work in a Closed Cycle:**
$$W_{net} = \\oint P dV = \\text{Enclosed Area inside the loop}$$
  * Clockwise loop ➔ $W_{net} > 0$ (Heat Engine producing useful work output).
  * Counter-clockwise loop ➔ $W_{net} < 0$ (Refrigerator or Heat Pump requiring work input).`
      }
    ],
    teacherNotes: {
      objective: 'Teach students to instantly evaluate the sign of Q, W, and ΔU for each of the four processes using a 4x3 matrix table.',
      discussionPrompt: 'Ask the team: "Why is an adiabatic curve steeper than an isothermal curve on a PV diagram?" (Because in an adiabatic expansion, both volume increases AND temperature drops, causing pressure to drop faster!).',
      demoAction: 'Open Module 4 (PV Diagram Visualizer), toggle Carnot vs Otto cycles, and show the enclosed work area.',
      commonTrap: 'Forgetting that during isochoric processes (rigid tank), work is strictly ZERO (W = 0) because ΔV = 0.'
    },
    quiz: {
      question: 'An ideal gas in a rigid, sealed 5.0 L container absorbs 1,200 J of heat from a flame. How much work is done by the gas, and what is the change in its internal energy (ΔU)?',
      options: [
        'W = 1,200 J, ΔU = 0 J',
        'W = 0 J, ΔU = 1,200 J',
        'W = 600 J, ΔU = 600 J',
        'W = -1,200 J, ΔU = 2,400 J'
      ],
      correct: 1,
      explanation: 'Because the container is rigid and sealed, the volume is constant (isochoric, ΔV = 0). Therefore, W = 0 J. By the First Law of Thermodynamics, ΔU = Q - W = 1,200 J - 0 = 1,200 J.'
    }
  },
  {
    id: 'lesson_5',
    area: 'Area 4 & 5: Engines & History',
    level: 'Regional & Above',
    durationMin: 25,
    title: 'Heat Engines, Thermal Efficiency & Pioneers of Thermodynamics',
    summary: 'The Second Law of Thermodynamics, Carnot efficiency limits, and historical milestones from Black, Joule, Carnot, Clausius, Boltzmann, and Maxwell.',
    sections: [
      {
        heading: '1. Heat Engines & The Second Law',
        content: `A heat engine is a continuously operating device that absorbs heat from a high-temperature reservoir ($T_H$), converts a fraction into useful mechanical work ($W_{net}$), and discharges waste heat to a low-temperature sink ($T_C$).
* **Kelvin-Planck Statement of 2nd Law:** It is impossible to construct a device operating in a cycle that produces no effect other than the extraction of heat from a reservoir and the performance of an equivalent amount of work. (No engine can be $100\\%$ efficient!).
* **Clausius Statement of 2nd Law:** Heat can never spontaneously flow from a colder body to a hotter body without external work input.`
      },
      {
        heading: '2. Thermal Efficiency (η)',
        content: `Thermal efficiency is the ratio of desired work output to costly energy input:
$$\\eta = W_{net} / Q_H = (Q_H - Q_C) / Q_H = 1 - (Q_C / Q_H)$$
* $Q_H$: Heat absorbed from the hot reservoir.
* $Q_C$: Waste heat rejected to the cold reservoir.
* $W_{net} = Q_H - Q_C$: Net mechanical work produced.`
      },
      {
        heading: '3. The Carnot Limit & Maximum Possible Efficiency',
        image: {
          src: 'assets/images/carnot_heat_engine.jpg',
          caption: 'Sadi Carnot’s Ideal Reversible Heat Engine Cycle & Pressure-Volume (PV) Indicator Diagram (1824)'
        },
        content: `In 1824, French engineer Nicolas Léonard Sadi Carnot proved that no heat engine operating between two thermal reservoirs can be more efficient than a reversible Carnot engine operating between the same reservoirs.
$$\\eta_{Carnot} = 1 - (T_C / T_H)$$
* **CRITICAL REQUIREMENT:** Temperatures $T_H$ and $T_C$ **MUST BE IN KELVIN**!
* **Example:** An engine operating between boiling water ($100^\\circ\\text{C} = 373.15\\text{ K}$) and ice water ($0^\\circ\\text{C} = 273.15\\text{ K}$):
$$\\eta_{Carnot} = 1 - (273.15 / 373.15) = 1 - 0.732 = 0.268 = 26.8\\%$$
Even with zero friction and zero heat leakage, the maximum theoretical efficiency is only $26.8\\%$!`
      },
      {
        heading: '4. Hall of Fame: Historical Pioneers',
        content: `Science Olympiad tests the historical development of thermodynamic theory:
* **Joseph Black (1728–1799):** Discovered latent heat and specific heat; pioneered modern calorimetry.
* **James Prescott Joule (1818–1889):** Proved the mechanical equivalence of heat ($1\\text{ cal} \\approx 4.184\\text{ J}$) via his famous falling-weight paddle-wheel experiment. The SI unit of energy is named in his honor.
* **Nicolas Léonard Sadi Carnot (1796–1832):** Father of thermodynamics; established the Carnot cycle and the theoretical efficiency limit.
* **Rudolf Clausius (1822–1888):** Formulated the Second Law and coined the concept and term **Entropy** ($S$).
* **Ludwig Boltzmann (1844–1906):** Developed statistical thermodynamics, relating macroscopic entropy to microscopic microstates: $S = k_B \\cdot \\ln \\Omega$.
* **James Clerk Maxwell (1831–1879):** Derived the Maxwell-Boltzmann distribution of molecular speeds and proposed the 'Maxwell\'s Demon' thought experiment.`
      }
    ],
    teacherNotes: {
      objective: 'Ensure competitors memorize the historical scientists and never commit the fatal error of putting Celsius temperatures into Carnot equations.',
      discussionPrompt: 'Ask the class: "If an inventor claims to have built an engine operating between 500 K and 300 K that takes in 1000 J of heat and outputs 500 J of work, should you invest in their company?" (No! Carnot max is 1 - 300/500 = 40% = 400 J max work. Claiming 500 J violates the Second Law!).',
      demoAction: 'Demonstrate Carnot efficiency calculation in Module 5 (Score Calculator) or Module 4 (PV Cycle Engine).',
      commonTrap: 'Entering Celsius instead of Kelvin into the Carnot formula. 1 - 20/100 = 80% is WRONG; 1 - 293/373 = 21.4% is CORRECT!'
    },
    quiz: {
      question: 'Which pioneer of thermodynamics experimentally demonstrated the mechanical equivalent of heat using a mechanical paddle-wheel driven by falling gravitational weights to heat water?',
      options: [
        'Joseph Black',
        'James Prescott Joule',
        'Rudolf Clausius',
        'Ludwig Boltzmann'
      ],
      correct: 1,
      explanation: 'James Prescott Joule conducted the classic paddle-wheel experiment in the 1840s, proving that gravitational potential energy converts directly into thermal internal energy, establishing the First Law.'
    }
  },
  {
    id: 'lesson_6',
    area: 'Area 6: Device & Prediction Science',
    level: 'Regional, State, National',
    durationMin: 20,
    title: 'High-Precision Temperature Forecasting & Look-Up Matrices',
    summary: 'Mastering Science Olympiad Rule 4 prediction science: PE formulas, building 2D calibration matrices, and compensating for ambient temperature shifts.',
    sections: [
      {
        heading: '1. The Prediction Challenge (Rule 4: 20 Points)',
        content: `In Science Olympiad Thermodynamics, **Prediction Score (PS)** accounts for 20 out of 100 total tournament points.
* At Regionals, States, and Nationals, teams are given a random lamp height ($h$) and heating duration ($t$).
* Teams must predict the final water temperature in $^\\circ\\text{C}$ to the nearest $0.1^\\circ\\text{C}$ before the heating interval expires.
$$PE = 1 - (|T_{final} - T_{pred}| / T_{final}) \\quad (\\text{minimum } PE = 0)$$
$$PS = (\\text{Team } PE / \\text{Highest } PE) \\times 20$$
* A prediction error of only $\\pm 0.5^\\circ\\text{C}$ yields $PE \\approx 0.989$, netting nearly full points ($19.8\\text{ pts}$)!`
      },
      {
        heading: '2. The Mathematical Thermal Model',
        content: `The rate of temperature rise of the 100 mL ($0.1\\text{ kg}$) water sample is governed by the net thermal power balance:
$$dT/dt = (P_{absorbed} - P_{loss}) / (m \\cdot c)$$
* **Power Absorbed ($P_{absorbed}$):** Follows the inverse-square law with lamp height $h$:
$$P_{absorbed} = \\alpha \\cdot (P_{lamp} / h^2) \\cdot A_{eff}$$
* **Thermal Losses ($P_{loss}$):** Convective and radiative heat loss to the ambient room:
$$P_{loss} = U \\cdot A \\cdot (T_{water} - T_{room})$$
* Notice that as the water warms up, $(T_{water} - T_{room})$ increases, so heat loss accelerates. This is why the heating curve is **exponentially decaying (flattening)**, not a straight line!`
      },
      {
        heading: '3. Constructing the 2D Calibration Look-Up Matrix',
        content: `Top teams never guess. Prior to competition day, test your physical collector under a 100–125W lamp across all height and time increments and record temperature gain ($\\Delta T$):
| Height (h) | 10 min | 11 min | 12 min | 13 min | 14 min | 15 min |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **40 cm** | +26.4°C | +28.1°C | +29.6°C | +31.0°C | +32.2°C | +33.3°C |
| **45 cm** | +22.8°C | +24.3°C | +25.6°C | +26.8°C | +27.9°C | +28.9°C |
| **50 cm** | +19.8°C | +21.1°C | +22.3°C | +23.4°C | +24.4°C | +25.3°C |
| **55 cm** | +17.3°C | +18.5°C | +19.6°C | +20.6°C | +21.5°C | +22.3°C |
| **60 cm** | +15.2°C | +16.3°C | +17.3°C | +18.2°C | +19.0°C | +19.8°C |`
      },
      {
        heading: '4. Competition Day Execution Formula',
        content: `When the supervisor announces the height and time and hands you the water with $T_{start}$:
* Look up the expected baseline gain $\\Delta T_{matrix}(h, t)$ from your printed binder chart.
* Apply ambient temperature compensation:
$$\\Delta T_{corr} = \\Delta T_{matrix} - k_{loss} \\cdot (T_{start} - T_{room})$$
(If starting water is warmer than the room, losses are higher, so net gain is slightly smaller).
* Compute and submit predicted final temperature:
$$T_{pred} = T_{start} + \\Delta T_{corr}$$
* Submit your prediction to the Event Supervisor before the heating countdown ends!`
      }
    ],
    teacherNotes: {
      objective: 'Empower students to understand that prediction is applied data science, not intuition. Having a binder matrix guarantees medal-winning PE scores.',
      discussionPrompt: 'Ask the team: "If the room is cold (18°C) but your starting water is 22°C, will your heat collector achieve a larger or smaller temperature gain than on a warm day?" (Smaller, because the cup immediately begins losing heat to the colder ambient air).',
      demoAction: 'Open Module 2 (Prediction Arena) and challenge students to submit predictions for three randomized scenarios.',
      commonTrap: 'Waiting until the last 30 seconds to calculate and write down the prediction. Always calculate the prediction in the first 2 minutes of heating!'
    },
    quiz: {
      question: 'During device testing, a team starts with water at 21.0°C. Their calibration matrix predicts a temperature gain of +24.0°C. If the supervisor measures a final temperature of 45.4°C, what is the team\'s Prediction Estimate (PE)?',
      options: [
        '0.9119',
        '0.9560',
        '0.9912',
        '1.0000'
      ],
      correct: 2,
      explanation: 'Predicted temp = 21.0 + 24.0 = 45.0°C. Actual final = 45.4°C. Prediction Error = |45.4 - 45.0| = 0.4°C. PE = 1 - (0.4 / 45.4) = 1 - 0.00881 = 0.9912 (99.12% accuracy!).'
    }
  },
  {
    id: 'lesson_7',
    area: 'Area 5: History & Pioneers',
    level: 'Regional to National',
    durationMin: 30,
    title: 'Pioneers of Thermodynamics: The Architects of Energy & Entropy',
    summary: 'A definitive historical journey through the discoveries of Black, Rumford, Carnot, Joule, Kelvin, Clausius, Boltzmann, Maxwell, and Planck.',
    sections: [
      {
        heading: '1. The Great Historical Gallery: Architects of Thermodynamics',
        image: {
          src: 'assets/images/thermo_pioneers_gallery.jpg',
          caption: 'Pioneers of Thermodynamics: The scientists who established the laws of energy, heat engines, absolute temperature, and statistical entropy.'
        },
        content: `The science of thermodynamics arose from the Industrial Revolution\'s quest to understand steam engines and replace the mythical fluid theory of heat with rigorous mechanical and statistical laws.
* **The Caloric Myth:** Throughout the 18th century, Antoine Lavoisier and leading natural philosophers believed heat was an invisible, weightless fluid called **Caloric** that flowed from hot bodies into cold bodies.
* **The Demise of Caloric:** In 1798, **Count Rumford (Benjamin Thompson)** observed the boring of brass cannons in Munich. He noted that blunt boring tools generated continuous, inexhaustible friction heat underwater without consuming any metal, proving heat is **mechanical motion**, not a conserved material fluid!`
      },
      {
        heading: '2. Joseph Black (1728–1799): Latent Heat & Specific Heat',
        content: `Scottish physician and chemist **Joseph Black** laid the foundational quantitative groundwork for thermal science:
* **Distinction between Heat and Temperature:** Black was the first scientist to realize that temperature measures the *intensity* of hotness, whereas heat is a distinct *quantity of thermal energy*.
* **Discovery of Latent Heat ($L$):** Black discovered that when ice melts at $0^\\circ\\text{C}$ or water boils at $100^\\circ\\text{C}$, massive quantities of heat are absorbed without increasing temperature. He called this *latent* (hidden) heat because thermometers could not detect it.
* **Discovery of Specific Heat ($c$):** Black discovered that equal masses of different substances require vastly different amounts of heat to raise their temperature by $1^\\circ\\text{C}$ ($Q = m \\cdot c \\cdot \\Delta T$).`
      },
      {
        heading: '3. Nicolas Léonard Sadi Carnot (1796–1832): The Father of Thermodynamics',
        content: `French military engineer **Sadi Carnot** published the landmark treatise *Reflections on the Motive Power of Fire* in 1824 at age 28:
* **The Motive Power of Heat:** Carnot showed that work from a heat engine is produced not by consuming caloric, but by the "fall" of heat from a hot body ($T_H$) to a cold body ($T_C$), analogous to falling water driving a waterwheel.
* **The Reversible Engine & Upper Limit:** He proved that no engine can be more efficient than an ideal reversible engine, establishing the theoretical maximum efficiency:
$$\\eta_{Carnot} = 1 - (T_C / T_H)$$
* Carnot\'s insights directly inspired Kelvin and Clausius to establish the First and Second Laws.`
      },
      {
        heading: '4. James Prescott Joule (1818–1889): The Mechanical Equivalent of Heat',
        image: {
          src: 'assets/images/joule_paddle_wheel.jpg',
          caption: 'James Prescott Joule’s 1845 falling-weight paddle-wheel apparatus proving the mechanical equivalence of energy ($W = J \\cdot Q$).'
        },
        content: `English physicist **James Prescott Joule** proved through painstaking experiments in the 1840s that mechanical work and thermal heat are mutually convertible forms of energy:
* **The Paddle-Wheel Experiment (1845):** Two falling lead weights suspended from cords drove a brass paddle wheel submerged in an insulated copper container of water.
* **Conservation of Energy (First Law):** Gravitational potential energy loss ($2 \\cdot m \\cdot g \\cdot h$) was completely converted into thermal internal energy in the water ($m_w \\cdot c_w \\cdot \\Delta T$).
* **The Mechanical Equivalent:** Joule determined that approximately $772\\text{ foot-pounds}$ of work produced $1\\text{ BTU}$ of heat, which modern standards refine to:
$$1\\text{ calorie} = 4.184\\text{ Joules}$$
* In his honor, the SI unit of all energy and work is named the **Joule (J)**.`
      },
      {
        heading: '5. William Thomson, Lord Kelvin (1824–1907): Absolute Zero & Scale',
        image: {
          src: 'assets/images/kelvin_absolute_scale.jpg',
          caption: 'The Absolute Thermodynamic Temperature Scale founded by Lord Kelvin, anchoring Absolute Zero at $0\\text{ K} = -273.15^\\circ\\text{C}$.'
        },
        content: `**Lord Kelvin** recognized that temperature could be defined purely thermodynamically through Carnot\'s ideal cycle, independent of any thermometric substance:
* **Absolute Zero ($0\\text{ K}$):** Kelvin extrapolated that at $-273.15^\\circ\\text{C}$ (or $-459.67^\\circ\\text{F}$), the pressure and volume of an ideal gas would extrapolate to zero, and all classical molecular thermal kinetic motion ceases.
* **Kelvin-Planck Statement (Second Law):** Co-authored the foundational statement that no heat engine can convert 100% of absorbed heat into work in a closed cycle.
* **Joule-Thomson Effect:** Together with Joule, discovered that real gases cool upon throttling expansion through a porous plug, which became the engineering foundation for modern liquefaction and refrigeration.`
      },
      {
        heading: '6. Clausius, Boltzmann & Maxwell: Entropy & The Statistical Revolution',
        content: `* **Rudolf Clausius (1822–1888):**
  - Formulated the Second Law: *"Heat cannot of itself pass from a colder to a hotter body."*
  - In 1865, introduced the state function **Entropy** ($S$, from Greek *trope* for transformation):
  $$dS = dQ_{rev} / T$$
  - Summarized the universe in two famous sentences:
    1. *The energy of the universe is constant.*
    2. *The entropy of the universe tends to a maximum.*
* **Ludwig Boltzmann (1844–1906):**
  - Bridged Newtonian mechanics and thermodynamics by founding **Statistical Mechanics**.
  - Showed that macroscopic entropy is proportional to the natural logarithm of microscopic accessible microstates (carved on his gravestone in Vienna):
  $$S = k_B \\cdot \\ln \\Omega$$
* **James Clerk Maxwell (1831–1879):**
  - Derived the statistical probability curve of molecular velocities in a gas (Maxwell-Boltzmann distribution).
  - Proposed the famous **"Maxwell\'s Demon"** thought experiment, challenging whether an intelligent microscopic entity could violate the Second Law by sorting fast and slow molecules.`
      },
      {
        heading: '7. Max Planck (1858–1947): Blackbody Radiation & The Third Law',
        content: `* **Blackbody Radiation (1900):** Planck resolved the "ultraviolet catastrophe" of classical thermal physics by showing that radiant thermal energy is emitted only in discrete quantized packets:
$$E = h \\cdot \\nu$$
where $h = 6.626 \\times 10^{-34}\\text{ J}\\cdot\\text{s}$ is Planck\'s constant.
* **The Third Law of Thermodynamics (Nernst-Planck Theorem):**
  - As the absolute temperature of a pure, perfectly crystalline substance approaches Absolute Zero ($T \\to 0\\text{ K}$), its entropy approaches zero ($S \\to 0$).
  - Physical consequence: It is impossible by any finite number of processes to cool any physical system down to exactly absolute zero ($T = 0\\text{ K}$).`
      }
    ],
    teacherNotes: {
      objective: 'Ensure competitors memorize the essential pioneer-to-concept pairings that appear in Science Olympiad Division B exams every single season.',
      discussionPrompt: 'Challenge the class: "Who is credited with discovering latent heat, who proved heat is not a fluid, and who gave entropy its name?" (Black = latent heat; Rumford/Joule = not a fluid; Clausius = entropy).',
      demoAction: 'Display the Pioneers Gallery illustration and conduct a 5-minute rapid-fire matching drill with students.',
      commonTrap: 'Confusing Joule\'s First Law contribution (mechanical equivalent) with Carnot\'s Second Law contribution (efficiency limit).'
    },
    quiz: {
      question: 'Which historical scientist coined the term "Entropy" and mathematically defined it as the ratio of reversible heat transfer to absolute temperature (dS = dQ / T)?',
      options: [
        'James Prescott Joule',
        'Rudolf Clausius',
        'Ludwig Boltzmann',
        'Joseph Black'
      ],
      correct: 1,
      explanation: 'Rudolf Clausius coined the term "entropy" in 1865 from the Greek word for transformation, establishing the mathematical formulation of the Second Law of Thermodynamics.'
    }
  },
  {
    id: 'lesson_8',
    area: 'Area 5: Historic Experiments',
    level: 'State & National Level',
    durationMin: 25,
    title: 'Historic Apparatuses & Landmark Experiments in Thermodynamics',
    summary: 'Master the iconic laboratory apparatuses and classic experimental designs tested on Science Olympiad written exams.',
    sections: [
      {
        heading: '1. Joule\'s Paddle-Wheel Calorimeter: The Mechanical Equivalent of Heat',
        image: {
          src: 'assets/images/joule_paddle_wheel.jpg',
          caption: 'The mechanical architecture of Joule’s 1845 falling-weight paddle-wheel calorimeter.'
        },
        content: `Science Olympiad exams frequently ask students to calculate the temperature rise produced in Joule\'s falling-weight calorimeter:
* **The Physical Apparatus:**
  - Two lead weights of mass $m$ fall through a vertical height $h$.
  - Connected by cords over frictionless pulleys to a central spindle wrapped around a drum.
  - The spindle drives eight sets of brass paddle wheels rotating between four sets of fixed vanes in an insulated copper vessel filled with water mass $m_w$.
* **The Energy Balance Equation:**
  - Gravitational potential energy released during $N$ drops:
  $$W_{in} = 2 \\cdot m \\cdot g \\cdot h \\cdot N$$
  - Thermal energy absorbed by the water and copper calorimeter:
  $$Q_{out} = (m_w \\cdot c_w + m_{cal} \\cdot c_{cu}) \\cdot \\Delta T$$
  - Equating work to heat yields the temperature increase:
  $$\\Delta T = \\frac{2 \\cdot m \\cdot g \\cdot h \\cdot N}{(m_w \\cdot c_w + m_{cal} \\cdot c_{cu})}$$`
      },
      {
        heading: '2. Sadi Carnot’s Ideal Engine: The 4-Stage Reversible Cycle',
        image: {
          src: 'assets/images/carnot_heat_engine.jpg',
          caption: 'The 4-stage Pressure-Volume (PV) cycle and energy flow diagram of Sadi Carnot’s ideal heat engine.'
        },
        content: `Carnot analyzed an ideal gas cylinder with frictionless piston and perfectly diathermal base placed sequentially on hot and cold reservoirs:
* **Stage 1 (1 ➔ 2): Isothermal Expansion at $T_H$**
  - Gas in contact with hot reservoir at $T_H$. Gas expands reversibly, absorbing heat $Q_H$. Since $\\Delta T = 0$, $\\Delta U = 0$ and $W_{1\\to 2} = Q_H = n R T_H \\ln(V_2/V_1)$.
* **Stage 2 (2 ➔ 3): Adiabatic Expansion from $T_H$ down to $T_C$**
  - Cylinder placed on an insulating stand ($Q = 0$). Gas expands doing work at the expense of its internal energy, cooling from $T_H$ down to $T_C$.
* **Stage 3 (3 ➔ 4): Isothermal Compression at $T_C$**
  - Cylinder placed on cold sink at $T_C$. External work compresses gas, rejecting waste heat $Q_C = n R T_C \\ln(V_3/V_4)$.
* **Stage 4 (4 ➔ 1): Adiabatic Compression from $T_C$ up to $T_H$**
  - Cylinder placed on insulating stand ($Q = 0$). Gas compressed, heating back up to $T_H$ to restore initial state.
* **Net Work Done:** Area enclosed inside the loop on the PV diagram ($W_{net} = Q_H - Q_C$).`
      },
      {
        heading: '3. Gas Thermometers & The Discovery of Absolute Zero',
        image: {
          src: 'assets/images/kelvin_absolute_scale.jpg',
          caption: 'Extrapolation of gas thermometer data to Absolute Zero ($P=0$ and $V=0$ at $-273.15^\\circ\\text{C}$).'
        },
        content: `Before modern electronic sensors, physicists calibrated temperature scales using **Constant-Volume Gas Thermometers**:
* **Gay-Lussac & Charles\'s Law:** When heating a fixed mass of gas at constant volume, its pressure increases linearly with temperature:
$$P(T) = P_0 \\cdot (1 + \\beta \\cdot T_C)$$
* **The Universal Extrapolation:** When physicists tested different gases (hydrogen, helium, nitrogen) at low density, the pressure-temperature lines all converged to the exact same x-intercept where pressure would reach zero:
$$T_{intercept} = -\\frac{1}{\\beta} \\approx -273.15^\\circ\\text{C}$$
* Lord Kelvin realized this was not a quirk of a particular gas, but the true universal zero point of temperature!`
      },
      {
        heading: '4. Science Olympiad Historical Milestone Reference Table',
        content: `| Year | Pioneer | Milestone Discovery | Key Equation or Constant |
| :--- | :--- | :--- | :--- |
| **1760** | Joseph Black | Latent Heat & Specific Heat | $Q = m \\cdot L$, $Q = m \\cdot c \\cdot \\Delta T$ |
| **1798** | Count Rumford | Frictional heat from cannon-boring disproves caloric | Heat = mechanical motion |
| **1824** | Sadi Carnot | Father of Thermodynamics, ideal engine cycle | $\\eta_{max} = 1 - T_C / T_H$ |
| **1845** | James Joule | Mechanical equivalent of heat via paddle-wheel | $1\\text{ cal} \\approx 4.184\\text{ J}$ |
| **1848** | Lord Kelvin | Absolute temperature scale & Absolute Zero | $0\\text{ K} = -273.15^\\circ\\text{C}$ |
| **1865** | Rudolf Clausius | Concept of Entropy, mathematical Second Law | $dS = dQ_{rev} / T$ |
| **1871** | James Maxwell | Velocity distribution & Maxwell’s Demon | $v_{rms} = \\sqrt{3k_BT/m}$ |
| **1877** | Ludwig Boltzmann | Statistical entropy & microscopic microstates | $S = k_B \\cdot \\ln \\Omega$ |
| **1900** | Max Planck | Quantized thermal radiation, Third Law of Thermo | $E = h\\nu$, $S \\to 0$ as $T \\to 0\\text{ K}$ |`
      }
    ],
    teacherNotes: {
      objective: 'Prepare students to ace historical apparatus calculation questions, particularly calculating work from falling weights in Joule’s experiment and identifying stages of the Carnot cycle.',
      discussionPrompt: 'Ask students: "During which two stages of the Carnot cycle is heat exchanged, and during which two stages is no heat exchanged?" (Stages 1 and 3 exchange heat isothermally; Stages 2 and 4 are adiabatic with Q = 0).',
      demoAction: 'Open Module 4 (Physics Lab) and step through the interactive PV diagram to show Carnot cycle area.',
      commonTrap: 'Believing that Joule’s paddle wheel worked by friction against the container walls. The paddles churned against fixed vanes inside the water; fluid viscous dissipation generated the heat!'
    },
    quiz: {
      question: 'In a recreation of Joule\'s paddle-wheel experiment, two 15.0 kg lead weights fall through a vertical height of 2.0 meters, 5 times. Assuming g = 9.8 m/s² and all mechanical work is converted to heat in 1.0 kg of water (c = 4184 J/kg·°C), what is the approximate temperature increase of the water?',
      options: [
        '0.35°C',
        '0.70°C',
        '1.40°C',
        '2.80°C'
      ],
      correct: 1,
      explanation: 'Work = 2 weights × 15 kg × 9.8 m/s² × 2.0 m × 5 drops = 2940 J. ΔT = W / (m · c) = 2940 J / (1.0 kg × 4184 J/kg·°C) ≈ 0.70°C.'
    }
  }
];

export class LessonsHub {
  constructor() {
    this.STORAGE_KEY_CUSTOM_LESSONS = 'thermo_custom_lessons_v1';
    this.activeFilter = 'all';
    this.selectedLessonId = null;
    this.isTeacherMode = false;
  }

  init() {
    this.isTeacherMode = authManager.isAdmin();
    this.bindEvents();
    this.render();

    window.addEventListener('thermo_auth_changed', () => {
      this.isTeacherMode = authManager.isAdmin();
      this.render();
    });

    window.addEventListener('thermo_progress_updated', () => {
      this.renderProgressHeader();
      if (!this.selectedLessonId) {
        this.renderGrid();
      } else {
        this.updateCompletionButtonState();
      }
    });
  }

  getCustomLessons() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_CUSTOM_LESSONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveCustomLessons(list) {
    localStorage.setItem(this.STORAGE_KEY_CUSTOM_LESSONS, JSON.stringify(list));
  }

  getAllLessons() {
    const custom = this.getCustomLessons();
    return [...DEFAULT_LESSONS, ...custom];
  }

  getLessonById(id) {
    return this.getAllLessons().find(l => l.id === id);
  }

  bindEvents() {
    // Teacher mode toggle
    const btnToggleTeacher = document.getElementById('btnToggleTeacherMode');
    if (btnToggleTeacher) {
      btnToggleTeacher.addEventListener('click', () => {
        if (!authManager.isAdmin()) {
          if (window.showToast) {
            window.showToast('Please sign in as Coach / Admin to access Teacher Presentation Mode.', 'warning');
          }
          const modal = document.getElementById('modalAuthLogin');
          if (modal) modal.style.display = 'flex';
          return;
        }
        this.isTeacherMode = !this.isTeacherMode;
        this.render();
        if (window.showToast) {
          window.showToast(this.isTeacherMode ? 'Teacher Presentation Mode activated!' : 'Student Study Mode activated.', 'info');
        }
      });
    }

    // Filter pills
    const filterBtns = document.querySelectorAll('.lesson-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.getAttribute('data-filter') || 'all';
        this.selectedLessonId = null; // back to grid
        this.render();
      });
    });

    // Back to grid button in reader
    const btnBack = document.getElementById('btnBackToLessonList');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        this.selectedLessonId = null;
        this.render();
      });
    }

    // Open Create Lesson Modal
    const btnOpenCreate = document.getElementById('btnOpenCreateLesson');
    const modalCreate = document.getElementById('modalCreateLesson');
    const btnCloseCreate = document.getElementById('modalCreateLessonClose');
    const btnCancelCreate = document.getElementById('modalCreateLessonCancel');
    const formCreate = document.getElementById('formCreateLesson');

    if (btnOpenCreate && modalCreate) {
      btnOpenCreate.addEventListener('click', () => {
        if (!authManager.isAdmin()) {
          if (window.showToast) window.showToast('Coach / Admin login required to create custom lessons.', 'warning');
          return;
        }
        modalCreate.style.display = 'flex';
      });
    }

    const closeCreateModal = () => {
      if (modalCreate) modalCreate.style.display = 'none';
      if (formCreate) formCreate.reset();
    };

    if (btnCloseCreate) btnCloseCreate.addEventListener('click', closeCreateModal);
    if (btnCancelCreate) btnCancelCreate.addEventListener('click', closeCreateModal);

    if (formCreate) {
      formCreate.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('newLessonTitle').value.trim();
        const area = document.getElementById('newLessonArea').value.trim();
        const level = document.getElementById('newLessonLevel').value.trim();
        const durationMin = parseInt(document.getElementById('newLessonDuration').value, 10) || 20;
        const summary = document.getElementById('newLessonSummary').value.trim();
        const content = document.getElementById('newLessonContent').value.trim();
        const teacherObjective = document.getElementById('newLessonTeacherObj').value.trim();
        const teacherPrompt = document.getElementById('newLessonTeacherPrompt').value.trim();

        // Checkpoint quiz fields
        const qText = document.getElementById('newLessonQuizQ').value.trim();
        const optA = document.getElementById('newLessonQuizOptA').value.trim();
        const optB = document.getElementById('newLessonQuizOptB').value.trim();
        const optC = document.getElementById('newLessonQuizOptC').value.trim();
        const optD = document.getElementById('newLessonQuizOptD').value.trim();
        const correct = parseInt(document.getElementById('newLessonQuizCorrect').value, 10);
        const expl = document.getElementById('newLessonQuizExpl').value.trim();

        const customId = 'custom_' + Date.now();
        const newLesson = {
          id: customId,
          area,
          level,
          durationMin,
          title,
          summary: formatMathAndVariables(summary),
          sections: [
            {
              heading: '1. Lesson Core Concepts',
              content: content
            }
          ],
          teacherNotes: {
            objective: teacherObjective || 'Teach foundational concept and reinforce Science Olympiad rules.',
            discussionPrompt: teacherPrompt || 'What is the primary scientific principle at play?',
            demoAction: 'Demonstrate with platform interactive simulators.',
            commonTrap: 'Pay attention to units and scientific definitions.'
          },
          quiz: {
            question: qText || 'Review checkpoint question.',
            options: [optA || 'Option A', optB || 'Option B', optC || 'Option C', optD || 'Option D'],
            correct: isNaN(correct) ? 0 : correct,
            explanation: expl || 'Step-by-step derivation based on lesson content.'
          },
          isCustom: true,
          createdAt: new Date().toLocaleDateString()
        };

        const customList = this.getCustomLessons();
        customList.push(newLesson);
        this.saveCustomLessons(customList);

        closeCreateModal();
        this.render();
        if (window.showToast) {
          window.showToast(`Lesson "${title}" successfully created!`, 'success');
        }
      });
    }
  }

  render() {
    this.renderProgressHeader();
    this.renderTeacherModeBadge();

    const gridContainer = document.getElementById('lessonsGridContainer');
    const readerContainer = document.getElementById('lessonReaderView');

    if (this.selectedLessonId) {
      if (gridContainer) gridContainer.style.display = 'none';
      if (readerContainer) {
        readerContainer.style.display = 'block';
        this.renderLessonReader(this.selectedLessonId);
      }
    } else {
      if (readerContainer) readerContainer.style.display = 'none';
      if (gridContainer) {
        gridContainer.style.display = 'grid';
        this.renderGrid();
      }
    }
  }

  renderProgressHeader() {
    const user = authManager.getCurrentUser();
    const all = this.getAllLessons();
    const completed = user ? authManager.getCompletedLessons(user.username) : [];
    
    // Count how many valid completed lessons
    const validCount = completed.filter(id => all.some(l => l.id === id)).length;
    const total = all.length;
    const pct = total > 0 ? Math.round((validCount / total) * 100) : 0;

    const elBar = document.getElementById('lessonsProgressBar');
    const elText = document.getElementById('lessonsProgressText');
    const elPct = document.getElementById('lessonsProgressPct');

    if (elBar) elBar.style.width = `${pct}%`;
    if (elText) elText.textContent = `${validCount} of ${total} Lessons Completed`;
    if (elPct) elPct.textContent = `${pct}% Mastered`;
  }

  renderTeacherModeBadge() {
    const btn = document.getElementById('btnToggleTeacherMode');
    const btnOpenCreate = document.getElementById('btnOpenCreateLesson');

    if (btn) {
      if (this.isTeacherMode) {
        btn.innerHTML = `<span>👨‍🏫</span> <strong>Teacher Mode ON</strong>`;
        btn.classList.add('active');
        btn.style.background = 'var(--thermal-gradient)';
        btn.style.color = '#ffffff';
      } else {
        btn.innerHTML = `<span>🎓</span> <span>Student Study Mode</span>`;
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-secondary)';
      }
    }

    if (btnOpenCreate) {
      btnOpenCreate.style.display = authManager.isAdmin() ? 'inline-flex' : 'none';
    }
  }

  renderGrid() {
    const container = document.getElementById('lessonsGridContainer');
    if (!container) return;

    const user = authManager.getCurrentUser();
    const completedList = user ? authManager.getCompletedLessons(user.username) : [];
    const all = this.getAllLessons();

    // Filter
    const filtered = all.filter(l => {
      const isDone = completedList.includes(l.id);
      if (this.activeFilter === 'all') return true;
      if (this.activeFilter === 'completed') return isDone;
      if (this.activeFilter === 'in_progress') return !isDone;
      return l.area.toLowerCase().includes(this.activeFilter.toLowerCase());
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding:3rem; color:var(--text-muted);">
          <div style="font-size:2.5rem; margin-bottom:0.75rem;">📖</div>
          <h3>No lessons found matching this filter</h3>
          <p style="font-size:0.85rem; margin-top:0.25rem;">Try selecting "All Lessons" or create a new lesson.</p>
        </div>
      `;
      return;
    }

    let html = '';
    filtered.forEach(lesson => {
      const isDone = completedList.includes(lesson.id);
      const statusBadge = isDone
        ? `<span class="badge-official" style="color:var(--success); border-color:var(--success); background:rgba(0,230,118,0.1);">✅ Completed</span>`
        : `<span class="badge-official" style="color:var(--cryo-cyan); border-color:var(--cryo-cyan);">📖 ${lesson.durationMin} min read</span>`;

      html += `
        <div class="card lesson-card ${isDone ? 'lesson-completed' : ''}" data-lesson-id="${lesson.id}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem; gap:0.5rem;">
            <span class="mono" style="font-size:0.72rem; color:var(--thermal-primary); font-weight:700;">${lesson.area}</span>
            ${statusBadge}
          </div>

          <h3 style="font-family:var(--font-display); font-size:1.15rem; font-weight:700; margin-bottom:0.6rem; color:var(--text-main); line-height:1.3;">
            ${formatMathAndVariables(lesson.title)}
          </h3>

          <p style="font-size:0.85rem; color:var(--text-secondary); line-height:1.5; margin-bottom:1.25rem; flex-grow:1;">
            ${formatMathAndVariables(lesson.summary)}
          </p>

          <div style="display:flex; align-items:center; justify-content:space-between; border-top:1px solid var(--border-subtle); padding-top:0.85rem; margin-top:auto;">
            <span class="badge-official" style="font-size:0.68rem;">${lesson.level}</span>
            <div style="display:flex; gap:0.4rem;">
              ${lesson.isCustom && authManager.isAdmin() ? `
                <button class="btn btn-secondary btn-sm" data-btn-del-lesson="${lesson.id}" title="Delete Custom Lesson" style="padding:0.3rem 0.6rem; color:var(--danger);">
                  🗑️
                </button>
              ` : ''}
              <button class="btn btn-primary btn-sm" data-btn-open-lesson="${lesson.id}" style="padding:0.35rem 0.85rem;">
                <span>Start Lesson</span> ➔
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Attach card open click handlers
    container.querySelectorAll('[data-btn-open-lesson]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-btn-open-lesson');
        this.openLesson(id);
      });
    });

    // Attach delete button handler for custom lessons
    container.querySelectorAll('[data-btn-del-lesson]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-btn-del-lesson');
        if (confirm('Delete this custom lesson?')) {
          let custom = this.getCustomLessons();
          custom = custom.filter(l => l.id !== id);
          this.saveCustomLessons(custom);
          this.render();
          if (window.showToast) window.showToast('Custom lesson removed.', 'info');
        }
      });
    });
  }

  openLesson(lessonId) {
    this.selectedLessonId = lessonId;
    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  renderLessonReader(lessonId) {
    const lesson = this.getLessonById(lessonId);
    if (!lesson) return;

    const user = authManager.getCurrentUser();

    // Header info
    const elArea = document.getElementById('readerLessonArea');
    const elTitle = document.getElementById('readerLessonTitle');
    const elMeta = document.getElementById('readerLessonMeta');
    const elContent = document.getElementById('readerLessonContent');
    const elTeacherBox = document.getElementById('readerTeacherBox');
    const elQuizBox = document.getElementById('readerQuizBox');

    if (elArea) elArea.textContent = lesson.area;
    if (elTitle) elTitle.textContent = formatMathAndVariables(lesson.title);
    if (elMeta) {
      elMeta.innerHTML = `
        <span>⏱️ ${lesson.durationMin} minutes</span> • 
        <span>🎯 ${lesson.level}</span> • 
        <span>${lesson.sections.length} Core Sections</span>
      `;
    }

    // Render formatted sections
    if (elContent) {
      let sectionsHtml = '';
      lesson.sections.forEach(sec => {
        const formattedHeading = formatMathAndVariables(sec.heading);
        const formattedBody = renderMarkdownAndMath(sec.content);

        let imageHtml = '';
        if (sec.image) {
          const imgSrc = typeof sec.image === 'string' ? sec.image : sec.image.src;
          const imgCaption = (typeof sec.image === 'object' && sec.image.caption) ? sec.image.caption : '';
          imageHtml = `
            <figure class="lesson-figure">
              <img src="${imgSrc}" alt="${imgCaption || formattedHeading}" class="lesson-illustration">
              ${imgCaption ? `<figcaption>${formatMathAndVariables(imgCaption)}</figcaption>` : ''}
            </figure>
          `;
        }

        sectionsHtml += `
          <div class="lesson-section-block" style="margin-bottom:2.25rem;">
            <h3 style="font-family:var(--font-display); font-size:1.25rem; font-weight:700; color:var(--text-main); margin-bottom:0.85rem; border-bottom:1px solid var(--border-subtle); padding-bottom:0.4rem;">
              ${formattedHeading}
            </h3>
            ${imageHtml}
            <div style="font-size:0.95rem; line-height:1.7; color:#e2e8f0;">
              ${formattedBody}
            </div>
          </div>
        `;
      });
      elContent.innerHTML = sectionsHtml;
    }

    // Render Teacher Mode Box (Visible if isTeacherMode)
    if (elTeacherBox) {
      if (this.isTeacherMode && lesson.teacherNotes) {
        elTeacherBox.style.display = 'block';
        elTeacherBox.innerHTML = `
          <div class="card card-glowing-thermal" style="border-color:var(--thermal-primary); margin-bottom:2rem; background:rgba(255,87,34,0.06);">
            <div class="card-title" style="color:var(--thermal-primary);">
              <span>👨‍🏫 Coach Guide & Presentation Notes</span>
              <span class="badge-official" style="color:var(--thermal-primary); border-color:var(--thermal-primary);">TEACHER ONLY</span>
            </div>
            
            <div style="margin-bottom:1rem;">
              <strong style="color:var(--gold-accent); display:block; font-size:0.85rem; text-transform:uppercase; margin-bottom:0.25rem;">Lesson Pedagogical Goal:</strong>
              <p style="font-size:0.9rem; color:var(--text-main);">${formatMathAndVariables(lesson.teacherNotes.objective)}</p>
            </div>

            <div style="margin-bottom:1rem;">
              <strong style="color:var(--cryo-cyan); display:block; font-size:0.85rem; text-transform:uppercase; margin-bottom:0.25rem;">Socratic Discussion Prompt:</strong>
              <p style="font-size:0.9rem; color:var(--text-main); font-style:italic;">"${formatMathAndVariables(lesson.teacherNotes.discussionPrompt)}"</p>
            </div>

            <div style="margin-bottom:1rem;">
              <strong style="color:var(--success); display:block; font-size:0.85rem; text-transform:uppercase; margin-bottom:0.25rem;">Interactive Classroom Demonstration:</strong>
              <p style="font-size:0.9rem; color:var(--text-main);">${formatMathAndVariables(lesson.teacherNotes.demoAction)}</p>
            </div>

            <div>
              <strong style="color:var(--danger); display:block; font-size:0.85rem; text-transform:uppercase; margin-bottom:0.25rem;">Common Student Pitfall:</strong>
              <p style="font-size:0.9rem; color:var(--text-main);">${formatMathAndVariables(lesson.teacherNotes.commonTrap)}</p>
            </div>
          </div>
        `;
      } else {
        elTeacherBox.style.display = 'none';
      }
    }

    // Render Checkpoint Quiz
    if (elQuizBox && lesson.quiz) {
      const q = lesson.quiz;
      const letters = ['A', 'B', 'C', 'D'];
      let optionsHtml = '';
      q.options.forEach((opt, idx) => {
        optionsHtml += `
          <button class="option-btn" data-quiz-opt="${idx}" style="margin-bottom:0.5rem; width:100%; text-align:left;">
            <span class="option-letter">${letters[idx]}</span>
            <span>${formatMathAndVariables(opt)}</span>
          </button>
        `;
      });

      elQuizBox.innerHTML = `
        <div class="card" style="border:1px solid rgba(0,229,255,0.3); background:rgba(10,15,29,0.9); margin-bottom:2rem;">
          <div class="card-title" style="color:var(--cryo-cyan);">
            <span>🧠 Check for Understanding (Checkpoint Quiz)</span>
            <span class="badge-official" style="font-size:0.65rem;">Rule 5 Question Format</span>
          </div>
          <p style="font-size:0.95rem; font-weight:600; color:var(--text-main); margin-bottom:1rem;">
            ${formatMathAndVariables(q.question)}
          </p>
          <div id="lessonQuizOptionsContainer" style="display:flex; flex-direction:column; gap:0.4rem;">
            ${optionsHtml}
          </div>
          <div class="lesson-quiz-feedback" style="display:none; margin-top:1rem; padding:0.85rem; border-radius:var(--radius-sm); font-size:0.88rem; line-height:1.5;"></div>
        </div>
      `;

      // Attach quiz option click handlers
      const optBtns = elQuizBox.querySelectorAll('[data-quiz-opt]');
      const feedbackEl = elQuizBox.querySelector('.lesson-quiz-feedback');

      optBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const chosen = parseInt(e.currentTarget.getAttribute('data-quiz-opt'), 10);
          optBtns.forEach((b, bIdx) => {
            b.classList.remove('selected', 'correct', 'wrong');
            if (bIdx === q.correct) {
              b.classList.add('correct');
            } else if (bIdx === chosen && chosen !== q.correct) {
              b.classList.add('wrong');
            }
          });

          if (feedbackEl) {
            feedbackEl.style.display = 'block';
            const formattedExplanation = formatMathAndVariables(q.explanation);
            if (chosen === q.correct) {
              feedbackEl.style.background = 'rgba(0, 230, 118, 0.12)';
              feedbackEl.style.border = '1px solid var(--success)';
              feedbackEl.style.color = '#ffffff';
              feedbackEl.innerHTML = `<strong>✅ Correct!</strong> ${formattedExplanation}`;
            } else {
              feedbackEl.style.background = 'rgba(255, 23, 68, 0.12)';
              feedbackEl.style.border = '1px solid var(--danger)';
              feedbackEl.style.color = '#ffffff';
              feedbackEl.innerHTML = `<strong>❌ Not quite.</strong> ${formattedExplanation}`;
            }
          }
        });
      });
    }

    this.updateCompletionButtonState();
  }

  updateCompletionButtonState() {
    const btn = document.getElementById('btnToggleLessonComplete');
    if (!btn || !this.selectedLessonId) return;

    const user = authManager.getCurrentUser();
    const isDone = user ? authManager.isLessonCompleted(user.username, this.selectedLessonId) : false;

    if (isDone) {
      btn.className = 'btn btn-secondary';
      btn.innerHTML = `<span>✅ Completed</span> • Click to Unmark`;
      btn.style.borderColor = 'var(--success)';
      btn.style.color = 'var(--success)';
    } else {
      btn.className = 'btn btn-primary';
      btn.innerHTML = `<span>Mark Lesson as Completed</span> ➔`;
      btn.style.borderColor = '';
      btn.style.color = '';
    }

    // Rebind click
    btn.onclick = () => {
      if (!user) {
        if (window.showToast) window.showToast('Please sign in or select your student name to record completion.', 'warning');
        const modal = document.getElementById('modalAuthLogin');
        if (modal) modal.style.display = 'flex';
        return;
      }

      const res = authManager.toggleLessonCompleted(this.selectedLessonId);
      this.updateCompletionButtonState();
      this.renderProgressHeader();

      if (window.showToast) {
        const msg = res.isCompleted
          ? 'Lesson marked as completed! Great progress.'
          : 'Lesson marked as in-progress.';
        window.showToast(msg, res.isCompleted ? 'success' : 'info');
      }
    };
  }
}

export const lessonsHub = new LessonsHub();
