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

  // 1.5 Extract code blocks and ASCII diagrams ```...```
  const codeBlocks = [];
  text = text.replace(/```(?:ascii|diagram)?([\s\S]*?)```/g, (match, code) => {
    codeBlocks.push(code.trim());
    return `___CODE_BLOCK_${codeBlocks.length - 1}___`;
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

  // 2.8 Process Blockquotes (> ...) into Styled 7th Grader Callout Cards
  text = text.replace(/(?:^|\n)(> [^\n]+(?:\n> [^\n]+)*)/g, (match, quoteContent) => {
    const rawLines = quoteContent.split('\n').map(l => l.replace(/^>\s?/, '').trim());
    const fullText = rawLines.join(' ');
    
    let calloutClass = 'callout-mystery';
    if (fullText.includes('⚠️') || fullText.includes('🚨') || fullText.toLowerCase().includes('trap')) {
      calloutClass = 'callout-trap';
    } else if (fullText.includes('🔢') || fullText.includes('🧮') || fullText.toLowerCase().includes('numbers in action')) {
      calloutClass = 'callout-numbers';
    } else if (fullText.includes('🏆') || fullText.includes('🎯') || fullText.toLowerCase().includes('pro-tip')) {
      calloutClass = 'callout-protip';
    }

    return `\n<div class="callout-card ${calloutClass}">${fullText}</div>\n`;
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

  // 6.5 Restore Code Blocks and ASCII Diagrams
  text = text.replace(/___CODE_BLOCK_(\d+)___/g, (match, idx) => {
    return `<pre class="ascii-diagram-box"><code>${codeBlocks[Number(idx)]}</code></pre>`;
  });

  // 7. Convert paragraphs (avoid wrapping block elements)
  const blocks = text.split(/\n\s*\n/);
  const formattedBlocks = blocks.map(block => {
    const trimmed = block.trim();
    if (trimmed.startsWith('<div') || trimmed.startsWith('<ul') || trimmed.startsWith('<table') || trimmed.startsWith('<ol') || trimmed.startsWith('<figure') || trimmed.startsWith('<pre')) {
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
    summary: 'Master system boundaries with hot cocoa, intensive vs. extensive properties with pizza slices, Zeroth Law thermal balance, and fast conversions (°C, °F, K, °R).',
    sections: [
      {
        heading: '1. The Hot Cocoa Mystery: Thermodynamic Systems & Boundaries',
        image: {
          src: 'assets/images/thermo_systems_middle_school.jpg',
          caption: 'The 3 Thermodynamic Systems Compared: Open Mug (heat & steam escape), Closed Mug with Lid (heat escapes, steam trapped), and Isolated Thermos (heat & matter locked in tight!).'
        },
        content: `Imagine you pour a steaming hot mug of hot cocoa on a freezing winter morning. What happens next depends entirely on what kind of **thermodynamic system** you choose!
* A **system** is simply the object or stuff you are studying (our hot cocoa). Everything else in the entire universe—the kitchen table, the air in the room, the ceiling—is called the **surroundings**.
* The wall separating the system from the room is called the **boundary**!

Here are the 3 fundamental types of systems:
* **1. Open System (The Open Mug):** Both **energy (heat)** and **matter (steam/water molecules)** can escape into the room! If you leave it sitting, it gets cold AND loses liquid.
* **2. Closed System (The Mug with a Tight Lid):** Heat still escapes through the ceramic sides, but **matter cannot escape** because steam is trapped by the lid! (This is just like our Science Olympiad heat collector box with its clear acrylic lid).
* **3. Isolated System (The Vacuum Thermos Flask):** Double-walled stainless steel with a vacuum in between. **Neither heat nor matter can escape!** It stays piping hot for hours.

> 💡 **Real-World Mystery:** Why do coffee shops put a plastic lid on your cup if the cup is made of paper? The lid converts an **Open System** into a **Closed System**! It blocks evaporating steam, which stops the fastest cooling method (latent heat of vaporization) dead in its tracks!`
      },
      {
        heading: '2. The Pizza Slice Analogy: Intensive vs. Extensive Properties',
        content: `Science Olympiad test writers love to test whether a property is **Intensive** or **Extensive**. Here is the easiest mental test you will ever learn: **The Pizza Slice Test!**

Imagine a giant, fresh 16-inch pepperoni pizza pulled straight out of a 150°F oven. Now, cut the pizza in half!
* **Extensive Properties (Size-Dependent):** Did the property get cut in half? If YES, it is extensive!
  * **Mass ($m$):** Cut in half!
  * **Total Volume ($V$):** Cut in half!
  * **Total Calories / Internal Energy ($U$):** Cut in half!
* **Intensive Properties (Size-Independent):** Did the property stay exactly the same? If YES, it is intensive!
  * **Temperature ($T$):** The slice is STILL 150°F! Cutting a pizza does not cool it down.
  * **Density ($\\rho$):** The cheese and crust have the exact same density whether it is one bite or the whole pie!
  * **Specific Heat Capacity ($c$):** Water and cheese still require the same heat per gram to warm up.

> 🏆 **Science Olympiad Pro-Tip:** Divide ANY extensive property by mass, and you get an **intensive specific property**! For example: Volume ($V$, extensive) divided by Mass ($m$) gives Specific Volume ($v = V/m$, intensive!).`
      },
      {
        heading: '3. What Actually Is Temperature? (The Particle Dance & The Zeroth Law)',
        content: `Here is a huge surprise that trips up most 7th graders: **Temperature is NOT heat!**
* **Temperature** is a speedometer for atoms! It simply measures the **average kinetic energy (speed of jiggling)** of the molecules inside an object.
  * In an ice cube: Water molecules are locked in place, shivering and vibrating slowly.
  * In a cup of hot soup: Water molecules are zooming, spinning, and crashing into each other like hyperactive bumper cars!
* **Heat ($Q$)**, on the other hand, is the actual **energy in transit** that flows from a hotter object to a colder object because of that temperature difference.

### The Zeroth Law of Thermodynamics (The "Thermometer Rule")
Why do we call it the *Zeroth* Law? Because scientists realized this principle was so basic that it had to come BEFORE the First and Second Laws, but the 1st and 2nd Laws were already famous!

\`\`\`ascii
+----------------+      thermal equilibrium      +----------------+
|    Object A    |<=============================>|    Object B    |
| (Your Forehead)|                               |  (Thermometer) |
+----------------+                               +----------------+
         \\\\                                            //
          \\\\         thermal equilibrium              //
           \\\\<=======================================>//
                          +----------------+
                          |    Object C    |
                          | (Doctor's Skin)|
                          +----------------+
\`\`\`

* **The Rule:** If Object A is in thermal equilibrium with Object B, and Object B is in thermal equilibrium with Object C, then **Object A is in thermal equilibrium with Object C**!
* **Why You Should Care:** This law proves that temperature is a universal real property, and it justifies why digital and glass thermometers actually work! When the thermometer stops changing, it has reached the exact same temperature as your forehead.`
      },
      {
        heading: '4. Master Temperature Scale Conversions: The 4 Big Scales',
        image: {
          src: 'assets/images/kelvin_absolute_scale.jpg',
          caption: 'Visual Benchmark Comparison of Temperature Scales: Kelvin, Celsius, Fahrenheit, and Rankine from Absolute Zero to Boiling Water.'
        },
        content: `In Science Olympiad, test writers will give you temperatures in weird units like Rankine or Fahrenheit and expect you to convert them in 30 seconds.

| Benchmark Event | Celsius (°C) | Kelvin (K) | Fahrenheit (°F) | Rankine (°R) |
| :--- | :---: | :---: | :---: | :---: |
| **Absolute Zero (Motion Stops!)** | -273.15°C | **0 K** | -459.67°F | **0 °R** |
| **Water Freezes** | 0.00°C | 273.15 K | 32.00°F | 491.67 °R |
| **Comfortable Room Temp** | 20.00°C | 293.15 K | 68.00°F | 527.67 °R |
| **Normal Human Body** | 37.00°C | 310.15 K | 98.60°F | 558.27 °R |
| **Water Boils at Sea Level** | 100.00°C | 373.15 K | 212.00°F | 671.67 °R |
| **THE MAGIC EQUAL POINT** | **-40°C** | 233.15 K | **-40°F** | 419.67 °R |

### The Conversion Cheat-Code Formulas:
* **Celsius to Kelvin:** $T_K = T_C + 273.15$
* **Celsius to Fahrenheit:** $T_F = (1.8 \\times T_C) + 32$
* **Fahrenheit to Celsius:** $T_C = (T_F - 32) / 1.8$
* **Rankine to Kelvin:** $T_R = 1.8 \\times T_K$ (Rankine is just Kelvin measured in smaller Fahrenheit-sized degree steps!).

> 🔢 **Numbers in Action (7th Grade Math Walkthrough):**
> Say the tournament supervisor tells you the water is at 25°C.
> 1. In Kelvin: $25 + 273.15 = 298.15\\text{ K}$.
> 2. In Fahrenheit: $(1.8 \\times 25) + 32 = 45 + 32 = 77^\\circ\\text{F}$.
> 3. In Rankine: $77 + 459.67 = 536.67^\\circ\\text{R}$ (or $1.8 \\times 298.15 = 536.67^\\circ\\text{R}$). That took 15 seconds!`
      },
      {
        heading: '5. Heat Energy Units: The Food Calorie Trap!',
        content: `Energy comes in many packages. Science Olympiad exams constantly test whether you know the difference between a scientific calorie and a dietary food calorie!

* **Joule (J):** The official metric SI unit of work and energy. Lifting an apple ($100\\text{ g}$) up by $1\\text{ meter}$ takes about $1\\text{ Joule}$ of work!
* **Scientific calorie (small 'c', cal):** The heat needed to raise the temperature of **1 gram of water by 1°C**.
$$1\\text{ calorie} = 4.184\\text{ Joules}$$
* **Dietary Food Calorie (Capital 'C', Cal or kcal):** This is the unit on candy wrappers and cereal boxes!
$$1\\text{ Food Calorie (Cal)} = 1,000\\text{ scientific calories (cal)} = 4,184\\text{ Joules}$$
* **British Thermal Unit (BTU):** The heat needed to raise **1 pound of water by 1°F**. Used by air conditioners and home heaters ($1\\text{ BTU} \\approx 1,055\\text{ Joules} \\approx 252\\text{ calories}$).

> ⚠️ **Competition Trap Alert (Kenston 2018 Question):**
> A candy bar has "52 Calories" on the label. If 100% of its energy were turned into heat, by how much would it raise 1 Liter ($1,000\\text{ g}$) of water?
> * **Amateur Trap:** Dividing 52 by 1,000 to get 0.052°C. WRONG!
> * **Winner Answer:** 52 Food Calories = $52,000\\text{ scientific calories}$. Since 1 liter is $1,000\\text{ grams}$, $\\Delta T = 52,000 / 1,000 = 52^\\circ\\text{C}$! That candy bar could heat cold tap water all the way up to scalding hot!`
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
    summary: 'The 3 ways heat moves (Conduction, Convection, Radiation), why metal feels cold, and engineering a medal-winning 30x30x30 cm heat collector box under Rule 3.',
    sections: [
      {
        heading: '1. The 3 Ways Heat Travels: Conduction, Convection, Radiation',
        image: {
          src: 'assets/images/heat_transfer_methods.jpg',
          caption: 'The 3 Methods of Heat Transfer: 1. Conduction (direct particle contact), 2. Convection (hot fluid rising, cold fluid sinking), and 3. Radiation (electromagnetic infrared waves).'
        },
        content: `Think of heat like passing a basketball across a gym:
1. **Conduction (Hand-to-Hand Passing):** You stand in a tight line and pass the ball from person to person without anyone moving their feet. Thermal energy moves through direct atomic collisions!
   * *Real-world example:* A metal spoon left in a pot of hot soup becomes burning hot at the handle.
2. **Convection (Running the Ball Across the Floor):** You pick up the ball and physically run across the gym. Heat moves via bulk fluid currents (liquid or gas)!
   * *Real-world example:* Hot soup at the bottom of a pot expands, becomes less dense (lighter), floats up, cools down, and sinks in a continuous circular loop.
3. **Radiation (Throwing the Ball Through the Air):** You throw the ball across empty space. Heat travels as **electromagnetic infrared waves at the speed of light**! No atoms or air needed!
   * *Real-world example:* The warmth you feel on your face from a campfire across the grass, or sunlight traveling 93 million miles through the empty vacuum of space.

> 💡 **Real-World Mystery:** In your classroom, touch the metal leg of your desk with one hand, and the wooden tabletop with the other. Why does the metal feel freezing cold even though they have both been in the exact same 70°F room all weekend?
> **Answer:** Metal is a super-highway for conduction! Its thermal conductivity ($k$) is 500 times higher than wood, so it rapidly steals thermal energy out of your warm fingertips!`
      },
      {
        heading: '2. Conduction & Fourier\'s Law Made Simple',
        content: `How fast does heat conduct through a solid wall or insulation layer? French mathematician Joseph Fourier gave us the formula:
$$\\text{Rate of Heat Flow } (Q/t) = \\frac{k \\cdot A \\cdot \\Delta T}{L}$$

Let us break down what each letter means for a 7th grader:
* $k$ (Thermal Conductivity): How easily heat travels through the material.
  * **Super Conductors:** Copper ($390$) and Aluminum ($205$).
  * **Super Insulators:** Air ($0.026$), Styrofoam ($0.033$), Aerogel ($0.015$).
* $A$ (Surface Area): Bigger walls lose more heat.
* $\\Delta T$ (Temperature Difference): The bigger the temperature difference between inside and outside, the faster heat rushes out!
* $L$ (Thickness of Insulation): **The denominator!** If you double the thickness of insulation, heat loss is cut in half ($1/2$)!

> 🔢 **Numbers in Action (7th Grade Math Walkthrough):**
> If you have a foam insulation box with a 2 cm wall and it loses 10 Watts of heat, what happens if you add another layer of foam to make the wall 4 cm thick (double thickness)?
> Since thickness $L$ is on the bottom of the fraction, doubling $L$ cuts heat loss in half:
> $$10\\text{ Watts} \\times (1/2) = 5\\text{ Watts of heat loss!}$$`
      },
      {
        heading: '3. Convection & The Greenhouse Secret Trap',
        content: `Why do birds puff up their feathers when it is freezing outside? To trap tiny pockets of air so the air cannot move!
* When air is stationary, it is one of the best thermal insulators on Earth ($k = 0.026\\text{ W}/(\\text{m}\\cdot\\text{K})$).
* But the second air is allowed to move freely, **Natural Convection** takes over! Warm air expands, becomes buoyant, and floats upward like a hot-air balloon, dumping all its heat into the sky.

\`\`\`ascii
         [ 100W Heat Lamp ]
                 || (Radiation Waves)
                 VV
      +----------------------+   <-- Clear Acrylic Top Window:
      |   Hot Air Trapped    |       BLOCKS Convection!
      |   (Greenhouse Effect)|       (Warm air cannot escape!)
      |      +--------+      |
      |      | 100 mL |      |   <-- Matte Black Copper Sleeve:
      |      | Water  |      |       ABSORBS Radiation!
      |      +--------+      |       Conducts heat through cup wall.
      +----------------------+
\`\`\`

> 🏆 **Science Olympiad Pro-Tip:** A completely open cup loses up to 60% of its captured thermal energy through rising convective air currents! Sealing the top with a transparent acrylic lid creates a **greenhouse convective trap**: incoming radiant light passes through, but rising hot air is physically blocked inside!`
      },
      {
        heading: '4. Radiation & The 2027 Heat Collector Blueprint (Rule 3)',
        content: `Under Science Olympiad 2027 Rule 3, your team must build an apparatus to heat 100 mL of water inside a tournament-provided 9 oz clear plastic cup using a heat lamp placed at a mystery height (40 to 65 cm).

### The 4 Crucial Design Constraints:
* **1. 30.0 × 30.0 × 30.0 cm Cube Limit:** The entire device (including all funnels, legs, and stands) must fit inside the supervisor\'s inspection box.
* **2. ⚠️ CRITICAL RULE 3.b (Water Contact Penalty):** Parts may sit inside the cup, but **under no circumstances may any part of the device touch the water**! A single droplet touching your metal sleeve is an immediate construction penalty ($0.7\\times$ multiplier) or disqualification.
* **3. The Inverse-Square Law:** Radiation intensity drops with the square of the distance:
$$I \\propto \\frac{1}{h^2}$$
If the supervisor raises the lamp from $40\\text{ cm}$ to $80\\text{ cm}$ (double height), the heat hitting your cup drops to $(1/2)^2 = 1/4$ ($25\\%$)!
* **4. Winning Architecture:**
  * **Top Aperture:** Reflective Mylar cone to funnel light into the cup mouth.
  * **Top Glazing:** Clear acrylic sheet to trap rising convective air.
  * **Absorber Sleeve:** Matte black foil/copper wrapped tightly around the outside of the cup.`
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
    summary: 'The Beach Sand mystery, sensible heat ($Q = mc\\Delta T$), the flat plateau of hidden latent heat, and why steam burns are 5x deadlier than boiling water.',
    sections: [
      {
        heading: '1. The Hot Beach Sand Mystery: Sensible Heat & Specific Heat ($c$)',
        content: `Have you ever run across the beach on a blazing sunny day and burned the soles of your feet on the scorching sand, then jumped into the ocean water right next to it and found it refreshingly chilly?
Why? The sun poured the exact same amount of radiant thermal energy onto both the sand and the water!

The secret is **Specific Heat Capacity ($c$)**:
* Specific heat is how much heat energy 1 gram of a substance needs to absorb to warm up by 1°C!
* **Dry Sand ($c \\approx 0.84\\text{ J}/(\\text{g}\\cdot^\\circ\\text{C})$):** Warms up super fast with very little heat!
* **Liquid Water ($c = 4.184\\text{ J}/(\\text{g}\\cdot^\\circ\\text{C}) = 1.00\\text{ cal}/(\\text{g}\\cdot^\\circ\\text{C})$):** Has a massive specific heat! It takes **5 times more heat** to warm up water than sand!

### The Sensible Heat Formula:
$$Q = m \\cdot c \\cdot \\Delta T$$
* $Q$: Heat energy added or removed (Joules or calories).
* $m$: Mass of the substance (grams or kilograms).
* $c$: Specific heat capacity.
* $\\Delta T = T_{final} - T_{initial}$: Temperature change.

> 🔢 **Numbers in Action (7th Grade Math Walkthrough):**
> In our Science Olympiad collector, we have $100\\text{ mL}$ ($100\\text{ g}$) of water starting at 20°C. If our heat lamp adds $4,184\\text{ Joules}$ of heat to the water, how much does the temperature rise?
> $$\\Delta T = \\frac{Q}{m \\cdot c} = \\frac{4,184\\text{ J}}{100\\text{ g} \\times 4.184\\text{ J}/(\\text{g}\\cdot^\\circ\\text{C})} = \\frac{4,184}{418.4} = 10.0^\\circ\\text{C}!$$
> The final water temperature is $20.0 + 10.0 = 30.0^\\circ\\text{C}$.`
      },
      {
        heading: '2. The Mystery of the Flat Plateau: Latent (Hidden) Heat',
        image: {
          src: 'assets/images/heating_curve_water.jpg',
          caption: 'The Heating Curve of Water: Notice the two completely FLAT horizontal plateaus at 0°C (Melting) and 100°C (Boiling) where temperature stays constant while bonds break!'
        },
        content: `Put a pot of ice cubes on a hot stove and stick a thermometer in the slush. Turn the stove burner to HIGH.
* What happens to the thermometer as the ice melts? **NOTHING! It stays frozen at exactly 0.0°C!**
* Even though blazing flames are pouring thousands of Joules into the pot every second, the temperature refuses to climb until the very last grain of ice has melted!

Where did all that flame energy go?
* **Latent (Hidden) Heat!** The energy is not speeding up the molecules (which would raise temperature). Instead, it is being spent like a crowbar to **break the molecular hydrogen bonds** holding ice crystals together!

### The Two Latent Heat Formulas:
* **Latent Heat of Fusion ($L_f$): Melting & Freezing at 0°C:**
$$Q = m \\cdot L_f \\quad (L_f \\approx 334\\text{ J}/\\text{g} \\approx 80\\text{ cal}/\\text{g})$$
* **Latent Heat of Vaporization ($L_v$): Boiling & Condensing at 100°C:**
$$Q = m \\cdot L_v \\quad (L_v \\approx 2,260\\text{ J}/\\text{g} \\approx 540\\text{ cal}/\\text{g})$$

> 💡 **Real-World Mystery:** Why is getting burned by 100°C steam 5 times more severe than getting splashed by 100°C boiling water?
> * When 1 gram of 100°C liquid water hits your skin, it cools down and releases $4.184\\text{ Joules}$ per degree.
> * But when 1 gram of 100°C steam hits your skin, it must first **condense into liquid**, releasing a colossal **2,260 Joules of hidden latent heat** right onto your skin before it even begins cooling! Ouch!`
      },
      {
        heading: '3. Reading the 5-Stage Heating Curve',
        content: `Science Olympiad exams often give you a graph with 5 segments and ask you to calculate the total heat needed to go from frozen ice to scalding steam.

\`\`\`ascii
 Temp (°C)
   120 |                                        / (5. Steam Warming: Q = m·c_steam·ΔT)
   100 |                     ==================/ (4. BOILING PLATEAU: Q = m·Lv  [T is constant!])
    80 |                    /
    60 |                   / (3. Water Warming: Q = m·c_water·ΔT)
    40 |                  /
    20 |                 /
     0 |  ==============/ (2. MELTING PLATEAU: Q = m·Lf  [T is constant!])
   -20 | / (1. Ice Warming: Q = m·c_ice·ΔT)
       +---------------------------------------------> Heat Added (Q)
\`\`\`

> 🏆 **Science Olympiad Pro-Tip:** Specific heats are different for different phases of the same substance!
> * Liquid water: $c = 4.184\\text{ J}/(\\text{g}\\cdot^\\circ\\text{C})$
> * Solid ice: $c \\approx 2.09\\text{ J}/(\\text{g}\\cdot^\\circ\\text{C})$ (about half of liquid water!)
> * Steam vapor: $c \\approx 2.01\\text{ J}/(\\text{g}\\cdot^\\circ\\text{C})$`
      },
      {
        heading: '4. The Dry Ice Magic Trick & Phase Diagrams',
        content: `Why does Dry Ice (solid carbon dioxide, $CO_2$) smoke and vanish into thin air without ever making a wet puddle on your counter?
* A **phase diagram** maps whether a substance is solid, liquid, or gas at different temperatures and pressures.
* Every substance has a **Triple Point**—the magic temperature and pressure where solid, liquid, and gas can all coexist together in the same beaker!
  * For Water: The triple point pressure is super low ($0.006\\text{ atm}$), well below normal room pressure ($1.0\\text{ atm}$). So water happily melts into a liquid!
  * For $CO_2$: The triple point pressure is **$5.11\\text{ atmospheres}$**!
* At normal room pressure ($1.0\\text{ atm}$), you are far BELOW $5.11\\text{ atm}$. Liquid $CO_2$ **cannot physically exist** at normal room pressure! Solid $CO_2$ is forced to skip the liquid phase completely and sublime directly into gas at $-78.5^\\circ\\text{C}$!`
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
    summary: 'The Balloon in the Freezer, the Burning Bicycle Pump, PV diagrams, and the 4 cardinal gas paths (Isobaric, Isochoric, Isothermal, Adiabatic).',
    sections: [
      {
        heading: '1. The Ideal Gas Law: Pressure, Volume, and Temperature in Action',
        content: `What happens when you heat a gas? The molecules move faster, hit the container walls harder (higher **Pressure**), and try to push the walls outward (expanding **Volume**)!

$$P \\cdot V = n \\cdot R \\cdot T$$
* $P$: Pressure (Pascals or atm)
* $V$: Volume (Liters or $\\text{m}^3$)
* $n$: Number of moles of gas particles
* $R$: Universal Gas Constant ($8.314\\text{ J}/(\\text{mol}\\cdot\\text{K})$)
* $T$: Absolute temperature in **KELVIN**! (Never use Celsius here!).

> 💡 **Real-World Mystery (The Balloon in the Freezer):**
> Blow up a party balloon, tie it shut, and stick it in the freezer. 20 minutes later, it looks like a shriveled raisin! Take it out and warm it with a hair dryer, and it puffs right back up to full size!
> **Why?** Charles\'s Law ($V_1 / T_1 = V_2 / T_2$). Cooling the gas drops the molecules\' speed, so they hit the rubber with less force, letting atmospheric pressure squash the balloon!`
      },
      {
        heading: '2. The First Law of Thermodynamics: Energy Balance',
        content: `The First Law is just the famous **Conservation of Energy** written for heat engines:
$$\\Delta U = Q - W$$
* $\\Delta U$ (Change in Internal Energy): How much hotter or cooler the gas gets. For an ideal gas, $\\Delta U$ depends ONLY on temperature change $\\Delta T$!
* $Q$ (Heat Added): Heat coming in through the walls ($+$ if heated, $-$ if cooled).
* $W$ (Work Done by the Gas): When the gas expands and pushes a piston upward, it does positive work ($W > 0$)!

> 💡 **The Burning Bicycle Pump (Adiabatic Compression):**
> Have you ever pumped a flat bicycle tire rapidly with a hand pump and felt the bottom of the pump get burning hot? You didn't put it over a fire!
> When you shove the pump piston down quickly, you do mechanical work ON the gas ($W < 0$). Because it happens in a split second, zero heat has time to escape ($Q = 0$). By the First Law:
> $$\\Delta U = -W \\implies \\text{Internal energy spikes, and the air gets super hot!}$$`
      },
      {
        heading: '3. The Four Cardinal Gas Processes',
        image: {
          src: 'assets/images/four_gas_processes.jpg',
          caption: 'The 4 Thermodynamic Gas Processes: 1. Isobaric (Constant Pressure), 2. Isochoric (Constant Volume), 3. Isothermal (Constant Temperature), and 4. Adiabatic (Zero Heat In or Out).'
        },
        content: `Science Olympiad exams will present a graph of Pressure vs. Volume (PV diagram) and ask you about 4 specific processes:

### 1. Isobaric ("Same Pressure", $\\Delta P = 0$)
* A horizontal line on a PV graph.
* Like an open cylinder with a heavy metal weight resting on top. As heat enters, the gas expands smoothly, lifting the weight at constant atmospheric pressure.
* **Work Done:** $\\text{Area of Rectangle} = P \\cdot \\Delta V = P \\cdot (V_{final} - V_{initial})$.

### 2. Isochoric ("The Steel Prison", $\\Delta V = 0$)
* A vertical line on a PV graph.
* Like a rigid steel pressure cooker with locked bolts.
* **⚠️ Big Test Secret:** Because the container CANNOT move or expand ($\\Delta V = 0$), **WORK IS STRICTLY ZERO ($W = 0$)**! All heat added goes 100% into raising internal energy: $\\Delta U = Q$.

### 3. Isothermal ("Constant Temperature", $\\Delta T = 0$)
* A gentle curved slope on a PV graph.
* The gas cylinder sits in a large warm water bath. It expands so slowly that its temperature never changes!
* Since $\\Delta T = 0$, internal energy does not change ($\\Delta U = 0$). Every Joule of heat added is turned directly into push work: $Q = W$.

### 4. Adiabatic ("The Ninja Squeeze", $Q = 0$)
* A steep curved slope on a PV graph.
* The cylinder is wrapped in thick insulation or compressed so fast that **zero heat enters or leaves** ($Q = 0$)!
* Expanding adiabatically cools the gas down rapidly (like spraying an aerosol deodorant can; the can feels freezing cold!).`
      },
      {
        heading: '4. PV Diagram Geometric Work (Rule 5.d Calculus-Free)',
        content: `Science Olympiad Division B Rule 5.d strictly bans calculus! You will never need integrals. Instead, you calculate work using basic middle school geometry:
* **Work = Area Under the Curve on a PV diagram!**
  * Rectangle for Isobaric: $\\text{Area} = \\text{height} \\times \\text{width} = P \\times (V_2 - V_1)$.
  * Triangle for linear ramps: $\\text{Area} = \\frac{1}{2} \\times \\text{base} \\times \\text{height}$.
* **Closed Loop Engine Cycles:**
  * If the path loops **Clockwise**: The engine outputs useful work ($W_{net} > 0$)!
  * If the path loops **Counter-Clockwise**: It is a refrigerator that consumes electricity to pump heat ($W_{net} < 0$)!`
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
    summary: 'Why no engine can be 100% efficient, Carnot\'s maximum theoretical limit, and the memorable stories of Black, Joule, Carnot, Clausius, and Boltzmann.',
    sections: [
      {
        heading: '1. Why Can\'t an Engine Be 100% Efficient? (The Second Law)',
        content: `Could an engineer build a boat engine that sucks in ocean water, extracts all the heat from the water to drive a propeller, and dumps out cold ice cubes behind the boat without burning any fuel?
The First Law (energy conservation) says that energy would be conserved... but the **Second Law of Thermodynamics** says this is IMPOSSIBLE!

Think of a heat engine like a waterwheel at a mill:
* A waterwheel only spins if water falls from a **high elevation to a low elevation**. If all the water is at the same flat level, the wheel cannot turn!
* A heat engine only produces mechanical work if heat flows **from a hot reservoir ($T_H$) down to a cold reservoir ($T_C$)**!
* An engine MUST dump waste heat into the cold sink. You can never convert 100% of absorbed heat into useful work!`
      },
      {
        heading: '2. Sadi Carnot & The Maximum Theoretical Efficiency Formula',
        image: {
          src: 'assets/images/carnot_heat_engine.jpg',
          caption: 'Sadi Carnot’s Ideal Reversible Heat Engine: Absorbing heat Q_H from a hot source, producing mechanical work W, and discharging waste heat Q_C to a cold sink.'
        },
        content: `In 1824, a 28-year-old French military engineer named **Nicolas Léonard Sadi Carnot** proved mathematically that no engine on Earth can ever be more efficient than an ideal reversible engine:

$$\\eta_{Carnot} = 1 - \\frac{T_C}{T_H}$$

* $T_H$: Temperature of the hot heat source (**IN KELVIN!**)
* $T_C$: Temperature of the cold cooling sink (**IN KELVIN!**)

> ⚠️ **The #1 Science Olympiad Trap in the Entire Event:**
> If an engine runs between boiling water ($100^\\circ\\text{C}$) and ice water ($0^\\circ\\text{C}$), what is its Carnot efficiency?
> * **Amateur Mistake:** $1 - (0 / 100) = 1 - 0 = 100\\%$. WRONG! Zero points!
> * **Medal-Winner Method:** Convert to Kelvin first!
>   * $T_H = 100 + 273.15 = 373.15\\text{ K}$
>   * $T_C = 0 + 273.15 = 273.15\\text{ K}$
>   * $\\eta_{Carnot} = 1 - (273.15 / 373.15) = 1 - 0.732 = 0.268 = \\mathbf{26.8\\%}$!
> Even with zero friction and alien technology, the universe will not let this engine exceed 26.8% efficiency!`
      },
      {
        heading: '3. The Legends of Thermodynamics: Who Discovered What?',
        image: {
          src: 'assets/images/thermo_pioneers_gallery.jpg',
          caption: 'The Pioneers of Thermodynamics: Joseph Black, Count Rumford, Sadi Carnot, James Joule, Lord Kelvin, Rudolf Clausius, and Ludwig Boltzmann.'
        },
        content: `Science Olympiad exams always include direct historical questions about the 8 named pioneers in the rules:

* **1. Joseph Black (1728–1799):** The Scottish doctor who discovered **Latent Heat** and **Specific Heat**. He proved that heat and temperature are two totally different things!
* **2. Count Rumford / Benjamin Thompson (1753–1814):** He watched brass cannons being bored underwater in Munich and saw the water boil from friction alone without consuming any metal. This disproved the old myth that heat was an invisible fluid called *Caloric*!
* **3. Sadi Carnot (1796–1832):** The Father of Thermodynamics. Published the Carnot cycle and the efficiency limit at age 28!
* **4. James Prescott Joule (1818–1889):** Dropped heavy weights to spin paddle wheels in a bucket of water, proving mechanical work turns into heat ($1\\text{ cal} \\approx 4.184\\text{ J}$). The Joule is named after him!
* **5. Lord Kelvin / William Thomson (1824–1907):** Proposed Absolute Zero ($0\\text{ K} = -273.15^\\circ\\text{C}$) where particle motion halts.
* **6. Rudolf Clausius (1822–1888):** Stated the First and Second Laws and invented the concept and mathematical word **Entropy ($S$)**!
* **7. Ludwig Boltzmann (1844–1906):** Proved entropy is just counting microscopic atomic disorder: $S = k_B \\cdot \\ln(W)$, which is carved on his headstone in Vienna!
* **8. James Clerk Maxwell (1831–1879):** Created the molecular speed distribution curve and proposed the famous 'Maxwell\'s Demon' thought experiment.`
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
    summary: 'How to bag 20 free points under Rule 4: Building a 2D binder calibration matrix, reading intersections, and adjusting for chilly competition gyms.',
    sections: [
      {
        heading: '1. The Prediction Challenge: 20 Free Points Up for Grabs (Rule 4)',
        content: `In Science Olympiad Thermodynamics, **Prediction Score (PS)** is worth 20 points out of 100.
* At competition, the Event Supervisor assigns a mystery lamp height ($h$, between $40$ and $65\\text{ cm}$) and heating time ($t$, between $10$ and $15\\text{ minutes}$).
* Your team must calculate and write down the predicted final water temperature before the timer runs out!
$$PE = 1 - \\frac{|T_{final} - T_{pred}|}{T_{final}}$$
$$PS = \\left(\\frac{\\text{Team } PE}{\\text{Highest } PE}\\right) \\times 20$$
* If you guess within $\\pm 0.4^\\circ\\text{C}$, your $PE$ will be over $0.990$, earning you almost the full 20.0 points!

> 🏆 **Science Olympiad Pro-Tip:** Never "wing it" or guess by intuition. Champions test their physical collector 10 times at home under different lamp heights and times, print out a 2D table, and simply look up the answer!`
      },
      {
        heading: '2. Your 2D Binder Calibration Matrix',
        content: `Before competition day, test your collector at home and write down your temperature gains ($\\Delta T$) in a clean table inside your team binder:

| Lamp Height ($h$) | 10 min | 11 min | 12 min | 13 min | 14 min | 15 min |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **40 cm** | +26.4°C | +28.1°C | +29.6°C | +31.0°C | +32.2°C | +33.3°C |
| **45 cm** | +22.8°C | +24.3°C | +25.6°C | +26.8°C | +27.9°C | +28.9°C |
| **50 cm** | +19.8°C | +21.1°C | +22.3°C | +23.4°C | +24.4°C | +25.3°C |
| **55 cm** | +17.3°C | +18.5°C | +19.6°C | +20.6°C | +21.5°C | +22.3°C |
| **60 cm** | +15.2°C | +16.3°C | +17.3°C | +18.2°C | +19.0°C | +19.8°C |

Notice the pattern:
1. **As time increases:** The temperature gain goes up, but it starts slowing down (flattening curve) because hotter water loses heat faster to the room!
2. **As height increases:** The gain drops sharply due to the Inverse-Square Law ($1/h^2$).`
      },
      {
        heading: '3. Competition Day 3-Step Execution',
        content: `When you walk up to the supervisor's station:
1. **Step 1: Check Starting Temp ($T_{start}$):** The supervisor hands you 100 mL of water and you measure $T_{start} = 21.4^\\circ\\text{C}$.
2. **Step 2: Read the Matrix:** The supervisor announces: *"Lamp height is 50 cm, heating time is 12 minutes."* Look up row **50 cm** and column **12 min**: $\\Delta T = +22.3^\\circ\\text{C}$.
3. **Step 3: Calculate Final Prediction:**
$$T_{pred} = T_{start} + \\Delta T = 21.4 + 22.3 = 43.7^\\circ\\text{C}!$$
Write down $43.7^\\circ\\text{C}$ on your score sheet and submit it within the first 2 minutes of heating. Done!`
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
    summary: 'The thrilling story of how human beings figured out heat: from cannon drills in Munich to paddle wheels in Manchester and microstates in Vienna.',
    sections: [
      {
        heading: '1. The Great Historical Gallery: Busting the "Caloric" Ghost',
        image: {
          src: 'assets/images/thermo_pioneers_gallery.jpg',
          caption: 'Pioneers of Thermodynamics: The scientists who established the laws of energy, heat engines, absolute temperature, and statistical entropy.'
        },
        content: `For over a thousand years, people had no idea what heat really was.
* In the 1700s, top scientists like Antoine Lavoisier believed that heat was a mysterious, weightless, invisible liquid called **Caloric**. They thought when you burned wood, Caloric flowed out of the logs and into your hands like invisible water!
* But in 1798, an American-born scientist named **Count Rumford (Benjamin Thompson)** was supervising the boring of brass cannons for the army in Munich, Germany.
* He noticed that when dull drill bits ground against brass underwater, the water boiled vigorously **forever** as long as horses kept turning the drill! If Caloric was a fluid stored in metal, it should have run out. Rumford declared: **Heat is not a liquid; heat is microscopic motion!**`
      },
      {
        heading: '2. The 8 Hall of Fame Legends You Must Know for Competition',
        content: `| Pioneer | Years | Country | The Breakthrough Discovery | Famous Quote / Equation |
| :--- | :---: | :---: | :--- | :--- |
| **Joseph Black** | 1728–1799 | Scotland | Latent Heat & Specific Heat | Heat $\\neq$ Temperature! $Q = mL$ |
| **Count Rumford** | 1753–1814 | USA / UK | Cannon boring disproves Caloric fluid | Heat is mechanical motion |
| **Sadi Carnot** | 1796–1832 | France | Father of Thermodynamics, ideal engine cycle | $\\eta_{max} = 1 - T_C/T_H$ |
| **James Joule** | 1818–1889 | England | Mechanical equivalent of heat via paddle-wheel | $1\\text{ cal} \\approx 4.184\\text{ J}$ |
| **Lord Kelvin** | 1824–1907 | Scotland | Absolute Zero ($0\\text{ K}$) & Kelvin scale | Absolute temperature |
| **Rudolf Clausius** | 1822–1888 | Germany | Stated 1st & 2nd Laws, invented **Entropy** ($S$) | Heat cannot spontaneously flow cold to hot |
| **Ludwig Boltzmann** | 1844–1906 | Austria | Statistical mechanics & atomic microstates | $S = k_B \\cdot \\ln(W)$ |
| **James Clerk Maxwell** | 1831–1879 | Scotland | Molecular speed bell curve & Maxwell’s Demon | Kinetic theory of gases |`
      }
    ],
    teacherNotes: {
      objective: 'Ensure competitors memorize the historical scientists and never commit the fatal error of putting Celsius temperatures into Carnot equations.',
      discussionPrompt: 'Ask students: "Why was Rumford\'s cannon experiment so convincing?" (Because friction produced infinite heat without consuming any substance).',
      demoAction: 'Jump to Module 3 (Historical Timeline) to inspect portraits and laboratory notes.',
      commonTrap: 'Confusing Joule (paddle wheel) with Rumford (cannon boring).'
    },
    quiz: {
      question: 'Which scientist first proved that melting ice absorbs huge amounts of heat without changing temperature, coining the term "Latent Heat"?',
      options: [
        'Joseph Black',
        'Sadi Carnot',
        'Lord Kelvin',
        'Max Planck'
      ],
      correct: 0,
      explanation: 'Joseph Black discovered latent heat in the 1760s at the University of Glasgow, showing that heat goes into changing phase rather than changing temperature.'
    }
  },
  {
    id: 'lesson_8',
    area: 'Area 5: Landmark Apparatuses',
    level: 'Regional to National',
    durationMin: 25,
    title: 'Historic Apparatuses & Landmark Experiments in Thermodynamics',
    summary: 'Inside the real-life laboratory experiments: Joule\'s falling weight paddle wheel, Black\'s ice calorimeter, and the cannon-boring test.',
    sections: [
      {
        heading: '1. James Joule\'s Famous Paddle-Wheel Apparatus (1845)',
        image: {
          src: 'assets/images/joule_paddle_wheel.jpg',
          caption: 'James Prescott Joule’s 1845 falling-weight paddle-wheel apparatus proving the mechanical equivalence of energy ($W = J \\cdot Q$).'
        },
        content: `James Prescott Joule wanted to settle once and for all: **Can mechanical work turn directly into thermal heat?**
* **The Rig:** He took two heavy lead weights suspended from strings wrapped around a wooden axle.
* The axle was geared to brass paddle wheels submerged inside an insulated copper bucket of water.
* Fixed copper vanes inside the bucket prevented the water from just swirling in a whirlpool, forcing the water molecules to churn and rub together.
* As the heavy weights fell to the floor under gravity, they spun the paddles.
* Using a hyper-accurate thermometer sensitive to $1/200^\\circ\\text{F}$, Joule proved that the gravitational potential energy of falling weights ($W = mgh$) converted directly into thermal internal energy in the water!
* He found that approximately **$4.15\\text{ Joules}$** of work was required to raise $1\\text{ gram}$ of water by $1^\\circ\\text{C}$ (modern standard is $4.184\\text{ J}$).

> 🔢 **Numbers in Action (7th Grade Math Walkthrough):**
> If two 15 kg weights fall 2 meters, gravitational work is:
> $$W = 2 \\times (15\\text{ kg} \\times 9.8\\text{ m/s}^2 \\times 2.0\\text{ m}) = 588\\text{ Joules}$$
> That mechanical energy turns 100% into heat in the water!`
      }
    ],
    teacherNotes: {
      objective: 'Prepare students to ace historical apparatus calculation questions, particularly calculating work from falling weights in Joule’s experiment.',
      discussionPrompt: 'Ask students: "Where did the heat come from in Joule\'s experiment?" (From gravity pulling the weights down, which spun the paddles against water viscosity).',
      demoAction: 'Review Joule\'s original diagram in Module 3.',
      commonTrap: 'Thinking the paddles rubbed against the copper walls. The paddles churned through the liquid itself!'
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
  },
  {
    id: 'lesson_9',
    area: 'Area 6: Advanced Radiation & 3rd Law',
    level: 'State & National Level',
    durationMin: 30,
    title: 'State & National Masterclass: Radiant Exitance, Blackbody Radiation & The Third Law',
    summary: 'The ultimate physics for State & National tournaments: Stefan-Boltzmann fourth power law ($M = \\varepsilon\\sigma T^4$), Wien\'s peak wavelength rule, and the Third Law.',
    sections: [
      {
        heading: '1. The Superpower of the 4th Power: Stefan-Boltzmann Law',
        content: `At State and National tournaments, questions dive deep into thermal radiation:
$$P = \\varepsilon \\cdot \\sigma \\cdot A \\cdot T^4$$
* $\\sigma = 5.67 \\times 10^{-8} \\text{ W}/(\\text{m}^2 \\cdot \\text{K}^4)$ (Stefan-Boltzmann constant).
* $T$ **MUST BE IN KELVIN!**

### The 4th-Power Multiplier Trick:
Because temperature is raised to the **4th power ($T^4 = T \\times T \\times T \\times T$)**, a small increase in temperature creates an ENORMOUS explosion in radiant heat!
* If you **double** absolute temperature ($2\\times$):
  * $2^4 = 2 \\times 2 \\times 2 \\times 2 = \\mathbf{16\\times\\text{ more heat radiation!}}$
* If you **triple** absolute temperature ($3\\times$):
  * $3^4 = 3 \\times 3 \\times 3 \\times 3 = \\mathbf{81\\times\\text{ more heat radiation!}}$

> 🔢 **Numbers in Action (7th Grade Math Walkthrough):**
> If a heat lamp filament at 300 K puts out 50 Watts of radiant power, how much does it radiate if you crank the temperature to 600 K (double temp)?
> Temperature doubled ($2\\times$), so power increases by $2^4 = 16\\times$:
> $$50\\text{ W} \\times 16 = 800\\text{ Watts!}$$ That is why heat lamps get scorching hot so fast!`
      },
      {
        heading: '2. Wien\'s Law: Why Hot Objects Change Color',
        content: `Have you ever watched an electric stove burner heat up?
1. At room temp: It looks black.
2. Warm: It radiates invisible infrared waves that you feel on your hand.
3. Hot: It starts glowing dull cherry red!
4. Scorching hot: It turns bright orange-yellow!
5. The Sun (super hot, 5,800 K): Glows bright yellowish-white!

This is **Wien\'s Displacement Law**: Hotter objects radiate shorter, higher-energy wavelengths!
$$\\lambda_{max} \\cdot T = 2898 \\; \\mu\\text{m} \\cdot \\text{K}$$
* As $T$ goes UP, peak wavelength $\\lambda_{max}$ goes DOWN (shifting from infrared to red, to yellow, to blue!).`
      },
      {
        heading: '3. The Third Law of Thermodynamics: The Unreachable Zero',
        content: `* **The Third Law:** As the temperature of a pure perfect crystal approaches Absolute Zero ($0\\text{ K}$), its **Entropy approaches exactly ZERO ($S = 0$)**!
* At absolute zero, every single atom is frozen in its lowest possible energy state with zero disorder.
* **Why You Can Never Actually Reach 0 K:**
  * As you get closer and closer to $0\\text{ K}$, heat capacities drop to zero. Each step of cooling removes less and less heat. It would take an **infinite number of cooling cycles** to reach absolute zero!
  * Scientists have cooled atoms to a billionth of a degree above zero, but pure $0\\text{ K}$ remains the universe\'s ultimate speed bump!`
      }
    ],
    teacherNotes: {
      objective: 'Ensure competitors master the 4th-power scaling rule, understand why heat lamps emit near-infrared, and can cite the Nernst-Planck formulation of the Third Law.',
      discussionPrompt: 'Challenge the class: "If a star\'s surface temperature triples (3×), by what factor does its radiant exitance increase?" (3⁴ = 81 times!).',
      demoAction: 'Open Module 4 (Physics Lab -> Stefan-Boltzmann Visualizer) and drag temperature from 300 K to 600 K to witness the 16× power jump.',
      commonTrap: 'Forgetting to convert Celsius to Kelvin before raising temperature to the 4th power. 20⁴ / 10⁴ = 16 is completely FALSE; (293.15)⁴ / (283.15)⁴ = 1.15 is TRUE!'
    },
    quiz: {
      question: 'An ideal blackbody radiator at 300 K emits a radiant exitance of 459 W/m². If its temperature is increased to 600 K, what is its new radiant exitance?',
      options: [
        '918 W/m²',
        '1,836 W/m²',
        '3,672 W/m²',
        '7,344 W/m²'
      ],
      correct: 3,
      explanation: 'By the Stefan-Boltzmann Law (M = σT⁴), exitance is proportional to the 4th power of absolute temperature. Temperature doubles (600 K / 300 K = 2). The exitance increases by 2⁴ = 16×: 16 × 459 W/m² = 7,344 W/m².'
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

    // Setup Jump to Exam Arena button
    const btnJump = document.getElementById('btnLessonJumpToExam');
    if (btnJump) {
      const areaPrefix = lesson.area.split(':')[0] || 'Topic';
      btnJump.innerHTML = `<span>🎯 Practice ${areaPrefix} in Exam Arena</span> ➔`;
      btnJump.onclick = () => {
        // 1. Switch tab to exam
        const examTabBtn = document.querySelector('[data-tab="exam"]');
        if (examTabBtn) examTabBtn.click();

        // 2. Map area to topic filter value
        const areaMap = {
          'Area 1': 'Foundations',
          'Area 2': 'Phases',
          'Area 3': 'Transfer',
          'Area 4': 'Processes',
          'Area 5': 'History',
          'Area 6': 'Radiation'
        };

        for (const [key, val] of Object.entries(areaMap)) {
          if (lesson.area.includes(key)) {
            const elTopic = document.getElementById('examTopicSelect');
            if (elTopic) {
              elTopic.value = val;
              elTopic.dispatchEvent(new Event('change'));
            }
            break;
          }
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
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
