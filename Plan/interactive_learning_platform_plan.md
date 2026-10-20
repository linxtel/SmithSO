# Interactive Educational Platform Plan: ThermoOlyMaster (2027 Division B Edition)
*Fully aligned with the official Science Olympiad 2027 Division B Rules Manual ([`Plan/Science_Olympiad_Div_B_Rules_2027_for_Web_Secured.pdf`](file:///home/najamrashid/work/SmithSO/Plan/Science_Olympiad_Div_B_Rules_2027_for_Web_Secured.pdf))*

---

## 1. System Vision & Architecture

**ThermoOlyMaster** is an interactive, browser-based web application tailored specifically for middle school competitors (Division B) preparing for the Science Olympiad **Thermodynamics** event.

It integrates the **three official competition scoring pillars**:
> **Final Score (FS) = ES (50 pts) + TS (30 pts) + PS (20 pts)** *(Max: 100 points)*

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ThermoOlyMaster Web Platform                                     │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │
    ┌────────────────────────┬───────────────────┼───────────────────┬────────────────────────┐
    ▼                        ▼                   ▼                   ▼                        ▼
┌──────────────────┐ ┌─────────────────┐ ┌───────────────┐ ┌──────────────────┐ ┌────────────────────┐
│ 1. Heat Trap Lab │ │ 2. Predictor    │ │ 3. Exam Arena │ │ 4. Physics Lab   │ │ 5. Binder Builder  │
│ (TS: Max 30 pts) │ │ (PS: Max 20 pts)│ │ (ES: 50 pts)  │ │ (PV Cycles, Rad) │ │ (Formula Tables)   │
└──────────────────┘ └─────────────────┘ └───────────────┘ └──────────────────┘ └────────────────────┘
```

---

## 2. Interactive Modules Aligned with Official Rules

### Module 1: Virtual Heat Collector & Lamp Simulator (TS Training)
* **Official Rule Context:** Teams build a device fitting within a **30.0 cm × 30.0 cm × 30.0 cm cube** to collect heat from a **100–125W overhead heat lamp** into 100 mL of room-temperature water held in a **9 oz clear plastic cup** (without device parts touching the water).
* **Interactive Capabilities:**
  - **Lamp Rig Controls:**
    - Bulb Wattage: 100W to 125W.
    - Bulb Height Slider: 40 cm to 50 cm (Regionals), up to 55 cm (States), up to 65 cm (Nationals).
    - Heating Timer: 10 min (Regionals) or 10–15 min (States/Nationals).
  - **Collector Construction Sandbox:**
    - **Aperture & Concentrator:** Parabolic mirror or conical reflective funnel (aluminized Mylar, polished aluminum) focusing downward light into the cup cavity.
    - **Greenhouse Top:** Clear acrylic or glass window trapping convective rising air while transmitting infrared and visible light.
    - **Absorption Sleeve:** Matte black coated metal sleeve surrounding the cup to convert radiant flux into conductive and radiative heat transfer to the cup walls.
    - **Base & Side Insulation:** Aerogel or XPS foam base to prevent downward conduction into the testing table.
  - **Real-Time Heat Flux & Water Temp Gauge:**
    - Displays incoming radiant flux, convective losses, and real-time Temperature Gain:
      > **Temperature Gain (TG) = Final Cup Water Temp − Starting Cup Water Temp**

### Module 2: The Prediction Arena (PS Training)
* **Official Rule Context:** Teams must finalize a prediction of the final temperature (in °C) before the heating timer runs out.
* **Official Scoring Formula Implemented:**
  > **Prediction Estimate (PE) = 1 − (|Final Temp − Predicted Temp| / Final Temp)** *(minimum: 0)*  
  > **Prediction Score (PS) = (Team PE / Highest PE of all teams) × 20**
* **Interactive Practice Workflow:**
  1. The app serves a randomized competition scenario:
     - Starting water temp (e.g., 21.2°C)
     - Bulb height (e.g., 45 cm)
     - Bulb wattage (e.g., 110 W)
     - Heating Time (e.g., 12 minutes)
  2. Student analyzes interactive calibration curves and enters their predicted temperature.
  3. Live run executes and provides instant calculation of |Final Temp − Predicted Temp|, PE, and awarded PS points.

### Module 3: Official Written Exam Arena (ES Training — 50 Points)
* **Official Rule Context:** Metric units, proper sig figs, standard arithmetic and algebra, **no calculus or trigonometry**.
* **Question Bank Structure (Exact 6 Official Rule Areas):**
  1. **Thermodynamic Systems & Scales:** Intensive/extensive properties, Zeroth Law, conversions between °C, °F, K, and Rankine (where T_R = (9/5) · T_K).
  2. **Phases & Gas Laws:** Phase diagrams (triple and critical points), latent heat (Q = m · L), sensible heat (Q = m · c · ΔT), and Ideal Gas Law (P · V = n · R · T).
  3. **Heat Transfer Mechanics:** Conduction (q = −k · A · ΔT / L), Convection, Specific Heat (c), Thermal Conductivity (k).
  4. **Thermodynamic Processes & Cycles:** Adiabatic, Isothermal, Isochoric, Isobaric, PV diagrams, 1st Law (ΔU = Q − W), 2nd Law, and Heat Engine Efficiency (η = 1 − T_C / T_H).
  5. **Historical Pioneers:** Kelvin, Joseph Black, Joule, Carnot, Planck, Clausius, Boltzmann, and Maxwell.
  6. **State/National Master Module:** Blackbody radiation, Stefan-Boltzmann Law (P = ε · σ · A · T⁴), and the Third Law of Thermodynamics.
* **Modes:**
  - **Quick Topic Drills (5–10 questions)** with instant explanations.
  - **Full 50-Minute Competition Simulation** with tiebreaker question tagging.

### Module 4: Interactive Physics Visualizers
* **Interactive PV Diagram Tool:**
  - Drag points on an indicator diagram; compute work done (W = P · ΔV) and cycle area visually.
  - Preset animations for Carnot and Otto cycles adapted for middle school intuition.
* **Stefan-Boltzmann Radiation Visualizer:**
  - Emissivity slider (0.0 to 1.0), temperature slider (20°C to 150°C), and radiant exitance graph (j* = σ · T⁴).
* **Calorimetry & Phase Change Stepper:**
  - Ice at −10°C to Steam at 110°C heating curve with plateaus for L_f (334 J/g) and L_v (2260 J/g).

### Module 5: Rule-Compliant Binder & Cheat-Sheet Builder
* **Official Rule Feature:** Unlimited paper notes, binders, lamination, and tabs are permitted.
* **Generator Features:**
  - High-density, printable **Calibration Matrix Templates** for student testing data.
  - High-contrast 2-page **Formula & Constants Master Sheet** (R, k_B, σ, c_water, L_f, L_v).
  - Tab labels and index guide formatted for a standard 3-ring binder.

---

## 3. UI/UX Aesthetic & Design System

* **Selectable Visual Themes (Instant Switcher in Topbar):**
  1. 🔥 **Thermal Obsidian (Default):** Fiery infrared flame accents (`#ff5722`), cryogenic cyan glow (`#00e5ff`), and deep obsidian panels (`#060913`). Matches the thermodynamics competition heat-trap aesthetic.
  2. 🧊 **Cryo Arctic (Cool & Calm):** Soothing glacier blues (`#38bdf8`, `#22d3ee`), deep navy panels (`#07111e`), and soft cyan glow. Dramatically reduces fiery contrast for relaxed visual focus.
  3. 🎓 **Academic Slate (Muted & Balanced):** Low eye-strain university study theme with muted indigo (`#6366f1`) and balanced slate surfaces (`#0f172a`, `#1e293b`).
  4. 🌿 **Emerald Lab (Restful Green):** Environmental physics theme featuring deep spruce (`#061412`), forest glass, and refreshing mint accents (`#10b981`).
  5. ☀️ **Daylight Classroom (Crisp Light Mode):** High-readability light theme designed for bright classrooms, school projectors, and students who prefer crisp white paper-like backgrounds (`#f8fafc`).
* **Typography:** Google Fonts `Outfit` (Headings), `Inter` (Data / Formulas), and `Fira Code` (Monospace calculations).
* **Responsive Layout:** Works smoothly on desktop, Chromebooks, and tablets with zero-flicker theme persistence in `localStorage`.

---

## 4. Multi-User Authentication, Role Management & Google Sheets Sync

* **Public Access & Security Architecture:**
  - **Email One-Time Password (OTP) Verification:**
    - Step 1: Users submit their school or team email address.
    - Step 2: A secure 6-digit cryptographic OTP is generated and dispatched via the Google Apps Script Webhook.
    - Public Safety: Coach emails are strictly whitelisted (`thermo_coach_emails_v1`). Verified coaches automatically receive Admin/Coach access, while all other public or student emails receive Student access.
    - Offline & Local Test Support: Universal demo bypass (`123456`) and in-app test code banner allow instant local testing without waiting for email delivery.
  - **Alternative Sign-In Methods:**
    - Official Google Identity Services (GIS) One-Tap OAuth with Client ID configuration.
    - Instant School Profile Mode for Chromebook classroom sessions.
    - 1-Click Classroom Roster Switcher for rapid multi-student device sharing.
* **Google Sheets Live Gradebook & Telemetry:**
  - Zero-maintenance serverless integration via Google Apps Script Webhook (`doPost`).
  - Automatically streams written exam scores (ES), heat collector gains (TS), temperature predictions (PS), and lesson completions into two synchronized tabs: "Team Gradebook" and "Score Log".
  - Automated 1-click Google Apps Script template generator built directly into the Coach Admin Dashboard.

---

## 5. Official Team Roster & Training Schedule
*Extracted from official team schedule ([`Plan/Students.jpeg`](file:///home/najamrashid/work/SmithSO/Plan/Students.jpeg))*

| # | Student Name | Username | Email | Focus Events & Schedule Alignment |
|---|---|---|---|---|
| 1 | **Sumin** | `sumin` | `sumin@students.school.org` | Thermodynamics (Tue 7:30–8:30pm) & Codebusters (Thu 7:30–8:30pm) |
| 2 | **Ashritha** | `ashritha` | `ashritha@students.school.org` | Thermodynamics (Tue 7:30–8:30pm), Meteorology (Mon) & Codebusters (Thu) |
| 3 | **Vrinda** | `vrinda` | `vrinda@students.school.org` | Meteorology (Mon/Wed), Codebusters (Thu 7:30–8:30pm) |
| 4 | **Aditya** | `aditya` | `aditya@students.school.org` | Thermodynamics (Tue 7:30–8:30pm), Meteorology (Mon) & Codebusters (Thu) |
| 5 | **Everett** | `everett` | `everett@students.school.org` | Codebusters (Thu 7:30–8:30pm) & STEM Event Prep |
| 6 | **Iba** | `iba` | `iba@students.school.org` | Thermodynamics (Tue 7:30–8:30pm), Meteorology (Mon) & Codebusters (Thu) |
| 7 | **Dhruthi** | `dhruthi` | `dhruthi@students.school.org` | Thermodynamics (Tue 7:30–8:30pm), Meteorology (Mon) & Codebusters (Thu) |
| 8 | **Rutvik Sai** | `rutvik_sai` | `rutvik.sai@students.school.org` | Codebusters (Thu 7:30–8:30pm), Meteorology (Mon/Wed) & STEM |
| 9 | **Rutvik G.** | `rutvik_g` | `rutvik.g@students.school.org` | Thermodynamics (Tue 7:30–8:30pm), Meteorology (Mon) & Codebusters (Thu) |
| 10 | **Coach Smith** | `admin` | `coach.smith@school.org` | Science Olympiad Coaching Staff (Admin Privileges) |

---

## 6. Interactive Curriculum & Illustrated History Lessons (8 Units)
*Fully aligned with the Science Olympiad 2027 Division B Syllabus and Area 5 Historical Mandates.*

### Core Units & Illustrated Learning Assets
1. **Unit 1: Thermodynamic Systems, Temperature Scales & Thermal Expansion** (Area 1)
   - Augmentation: Kelvin Absolute Scale benchmark illustration (`assets/images/kelvin_absolute_scale.jpg`) comparing Absolute Zero, freezing/boiling points, molecular motion, and conversion formulas across Kelvin, Celsius, Fahrenheit, and Rankine.
2. **Unit 2: Calorimetry, Specific Heat Capacity & Phase Transitions** (Area 2)
   - Sensible heat calculations ($Q = m \cdot c \cdot \Delta T$), latent heat of fusion & vaporization ($Q = m \cdot L$), water equivalent, and Joseph Black's ice calorimeter foundations.
3. **Unit 3: Modes of Heat Transfer & Thermal Conductivity** (Area 3)
   - Conduction ($q = -k \cdot A \cdot \frac{\Delta T}{L}$), convection, radiation, Stefan-Boltzmann law ($P = \varepsilon \cdot \sigma \cdot A \cdot T^4$), and insulated container optimization.
4. **Unit 4: Thermodynamic Processes, Work & Indicator Diagrams** (Area 4)
   - Isobaric, isochoric, isothermal, and adiabatic paths on $P$-$V$ diagrams; First Law ($\Delta U = Q - W$) sign conventions.
5. **Unit 5: The Second Law of Thermodynamics, Heat Engines & Carnot Efficiency** (Area 4 & 5)
   - Augmentation: Carnot Heat Engine schematic & 4-stage reversible cycle illustration (`assets/images/carnot_heat_engine.jpg`), entropy principles, and maximum theoretical efficiency ($\eta_{max} = 1 - \frac{T_C}{T_H}$).
6. **Unit 6: Competition Device Construction, Infrared Heat Trapping & Calibration** (Area 6)
   - Collector design, parabolic funnels, greenhouse effect, Newton's Law of Cooling, and competition prediction modeling.
7. **Unit 7: Pioneers of Thermodynamics: The Architects of Energy & Entropy** (Area 5 History Core)
   - **Historical Scope:** Chronological journey through the foundational scientists specified in the official Division B syllabus:
     - **Joseph Black (1728–1799):** Latent heat, specific heat, ice calorimeter.
     - **Benjamin Thompson / Count Rumford (1753–1814):** Cannon-boring experiments disproving caloric fluid theory.
     - **Nicolas Léonard Sadi Carnot (1796–1832):** *Reflections on the Motive Power of Fire*, the ideal reversible engine, theoretical limit of motive power.
     - **James Prescott Joule (1818–1889):** Mechanical equivalent of heat ($4.184\text{ J/cal}$), paddle-wheel experiment.
     - **William Thomson / Lord Kelvin (1824–1907):** Absolute thermodynamic temperature scale, absolute zero ($-273.15^\circ\text{C}$), Second Law Kelvin-Planck statement.
     - **Rudolf Clausius (1822–1888):** Coining and formalizing *Entropy* ($S$), mathematical formulation of 1st and 2nd Laws.
     - **Ludwig Boltzmann (1844–1906):** Statistical thermodynamics, microscopic entropy equation ($S = k_B \ln \Omega$).
     - **James Clerk Maxwell (1831–1879):** Maxwell-Boltzmann velocity distribution, kinetic theory, Maxwell's Demon thought experiment.
     - **Max Planck (1858–1947):** Blackbody radiation distribution, energy quantization ($E = h\nu$), Third Law formulations.
   - Augmentations: Full 8-pioneer portrait gallery (`assets/images/thermo_pioneers_gallery.jpg`), Kelvin Absolute Scale diagram (`assets/images/kelvin_absolute_scale.jpg`), and Joule's paddle-wheel apparatus (`assets/images/joule_paddle_wheel.jpg`).
8. **Unit 8: Historic Apparatuses & Landmark Experiments in Thermodynamics** (Area 5 Experiments)
   - **Experimental Mechanics & Derivations:**
     - **Joule's Falling-Weight Paddle-Wheel (1845):** Complete gravitational potential to thermal energy derivation ($2 \cdot m \cdot g \cdot h \cdot N = (m_w c_w + C_{cal}) \cdot \Delta T$).
     - **Carnot's 4-Stage Reversible Cycle (1824):** Isothermal expansion, adiabatic expansion, isothermal compression, adiabatic compression.
     - **Constant-Volume Gas Thermometer:** Historical extrapolation to absolute zero ($P \to 0$ as $T \to 0\text{ K}$).
     - **Black's Ice Calorimeter:** Measuring latent heat by melted ice mass ($m_{ice} \cdot L_f$).
   - Augmentations: Cutaway diagram of Joule's apparatus (`assets/images/joule_paddle_wheel.jpg`) and Carnot Engine cycle diagram (`assets/images/carnot_heat_engine.jpg`).



