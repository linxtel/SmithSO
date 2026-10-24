# ThermoOlyMaster (2027 Science Olympiad Division B Edition)

**ThermoOlyMaster** is an interactive, browser-based competition preparation platform engineered specifically for middle school competitors preparing for the **Science Olympiad Thermodynamics** event (Division B, 2027 competitive season).

It is fully aligned with the official rules located in [`Plan/Science_Olympiad_Div_B_Rules_2027_for_Web_Secured.pdf`](file:///home/najamrashid/work/SmithSO/Plan/Science_Olympiad_Div_B_Rules_2027_for_Web_Secured.pdf) and integrates the three official tournament scoring pillars:
$$\text{Final Score (FS)} = \text{ES (50 pts)} + \text{TS (30 pts)} + \text{PS (20 pts)} \quad (\text{Max: } 100 \text{ points})$$

---

## 🚀 Quick Start: Running the App

ThermoOlyMaster is powered by a lightweight, zero-dependency Node.js HTTP server.

You can run it with:

```bash
# Start Node.js server (runs on http://localhost:8080)
npm start
# or directly:
node server.js
```

Then open your browser to: **`http://localhost:8080`**

---

## 🌟 Interactive Modules & Features

### 1. ☀️ Virtual Heat Collector Lab (TS Mode — Max 30 pts)
* **Official Rules (3.a, 3.b, 3.c, 5.c):**
  - Teams build a device fitting within a **30.0 × 30.0 × 30.0 cm cube**.
  - Collects radiant energy from an overhead **100–125W heat lamp** into **100 mL of water** held in an official **9 oz clear plastic cup**.
  - **No device parts may touch the water!**
* **Interactive Controls:**
  - Lamp height slider ($40\text{ cm}$ to $65\text{ cm}$).
  - Lamp wattage ($100\text{ W}$ to $125\text{ W}$) and heating duration ($10$, $12$, or $15\text{ min}$).
  - Modular collector sandbox: Optical concentrator (aluminized Mylar cone, aluminum funnel), greenhouse glazing (clear acrylic, optical glass), absorber sleeve (matte black copper, foil), and base insulation (silica aerogel, XPS foam).
  - Canvas simulation with animated photon flux, thermal fluid coloration, and live temperature gain telemetry:
    $$TG = T_{final} - T_{start}$$

### 2. 🎯 The Prediction Arena (PS Mode — Max 20 pts)
* **Official Rules (4.a, 6.d):**
  - Teams must predict final water temperature before heating ends.
  - Official Prediction Estimate formula:
    $$PE = 1 - \frac{|T_{final} - T_{predicted}|}{T_{final}} \quad (\text{minimum: } 0)$$
    $$PS = \left(\frac{\text{Team } PE}{\text{Highest } PE}\right) \times 20$$
* **Interactive Drill:**
  - Generates randomized competition scenarios (height, wattage, duration, room temp, starting water temp).
  - Evaluates student forecasts, awarding gold, silver, bronze, or recalibration diagnostic feedback.

### 3. 📝 Written Exam Arena, Paper Test Printing & OMR Auto-Grader (ES Mode — Max 50 pts)
* **Official Rules (5.a, 5.d):**
  - Metric units, proper sig figs, standard arithmetic and algebra only; **no calculus or trigonometry**.
* **Three Flexible Testing Modes:**
  1. **Interactive Screen Exam:** 50-minute countdown timer, question navigator pills, 50-question master bank, and randomized 20-question mock tests.
  2. **Paper Test & OMR Bubble Sheet Generator (`js/test-printer.js`):**
     - Prints official formatted **Student Test Booklets** with competition headers and rules.
     - Prints standardized **OMR Bubble Answer Sheets** with 4 corner fiducial markers for auto-scanning alignment.
     - Prints **Event Supervisor Answer Keys & Rubrics** with complete step-by-step solutions.
  3. **Optical Sheet Scanner & Auto-Grader (`js/test-scanner.js`):**
     - **Scan via Camera or Upload:** Use a device webcam, smartphone camera, or flatbed scanner image (PNG/JPG).
     - **Instant Computer Vision OMR:** Evaluates pixel darkness inside bubble circles to identify student answers.
     - **Visual Graded Overlay:** Displays green circles for correct bubbles, red circles with key highlights for missed questions.
     - **One-Click Tournament Sync:** Click "Transfer ES Score" to send the student's exam score directly to the Tournament Score Calculator (Module 5)!

### 4. 🔬 Interactive Physics Visualizers
* **PV Diagram Indicator & Cycle Engine:**
  - Visualizes Carnot and Otto cycles with interactive $T_H$, $T_C$, and compression ratio sliders.
  - Shaded work area showing $W = \oint P dV$ and thermal efficiency $\eta = 1 - T_C/T_H$.
* **Stefan-Boltzmann Radiation Visualizer:**
  - Dynamic $T^4$ radiant exitance curve ($j^* = \epsilon \sigma T^4$) and Wien's displacement law peak.
  - Real-time glowing thermal emitter orb reflecting surface temperature and emissivity presets.
* **Calorimetry & Phase Change Stepper:**
  - Interactive heating curve from $-20^\circ\text{C}$ (ice) to $120^\circ\text{C}$ (superheated steam).
  - Highlights latent heat plateaus ($L_f = 334\text{ kJ/kg}$, $L_v = 2260\text{ kJ/kg}$) and sensible heat regions ($Q = mc\Delta T$).

### 5. 🏆 Official 100-Point Tournament Score Calculator
* Complete implementation of Rule 6 scoring and tiebreaker logic:
  - Higher Exam Score $\to$ Pre-identified questions $\to$ Higher Prediction Score $\to$ Higher Temperature Score.
  - Multi-tier violation checklist: 10% competition penalty, 30% construction penalty, and disqualification zeroing.
  - Real-time simulated tournament table ranking your team against mock competitors.

### 6. 📁 Rule-Compliant Binder & Constants Hub
* Rule 2.a compliant: Unlimited paper notes, binders, and conversion tables are permitted.
* Includes:
  - Searchable physical constants ($R$, $k_B$, $\sigma$, $c$, $L_f$, $L_v$).
  - Thermal conductivities ($k$) and emissivities ($\epsilon$) reference tables.
  - Synchronized multi-unit converter (°C, °F, K, °R, Joules, cal, BTU).
  - Printable Testing Day Calibration Look-Up Matrix formatted for standard 3-ring binders (`@media print` ready).

### 7. ⚙️ Classroom Administration, Multi-User Accounts & Gradebook Tracking
* **Multi-User Access & Role-Based Control:**
  - Designed specifically for team practices, Science Olympiad club meetings, and classroom lessons.
  - Accounts for **Coaches (Admins)** and **Students/Competitors**.
  - Includes a quick one-click account switcher dropdown in the navigation bar for easy classroom station sharing.
* **Simple Password Policy:**
  - Uses simple, memorable passwords (e.g. `pass123` for students, `coach2027` for coach) ideal for middle school students without complex authentication hurdles.
  - Coaches can view, add, or reset student passwords on the fly.
* **Automated Progress Recording:**
  - **Written Exams:** Automatically records all attempts (both on-screen interactive exams and camera/image-scanned paper tests) with raw score, percentage, and Rule 6 Exam Score (ES / 50 pts).
  - **Heat Collector Lab:** Records temperature gain ($\Delta T$) and device configuration parameters.
  - **Prediction Arena:** Logs prediction error ($\pm^\circ\text{C}$), Prediction Estimate ($PE$), and Prediction Score ($PS / 20\text{ pts}$).
* **Coach & Teacher Tools:**
  - **Live Class Analytics:** Instant metrics on enrolled students, total exams taken, class average ES, top heat collector gain, and top prediction score.
  - **Student Detail Drill-Down:** Click any student to review their complete history across all three competition pillars.
  - **One-Click CSV Export:** Download full class gradebooks formatted for spreadsheet analysis.
  - **Printable Class Rosters:** `@media print` formatted class rosters and progress reports.

### 8. 📚 Interactive Curriculum & Lessons Hub
* **Syllabus-Aligned Master Lessons:**
  - **Lesson 1:** Thermodynamic Systems, Zeroth Law & Temperature Scales ($^\circ\text{C}, ^\circ\text{F}, \text{K}, ^\circ\text{R}$).
  - **Lesson 2:** Heat Transfer Mechanics & The 2027 Device Challenge (Conduction, Convection, Radiation, Rule 3 specs).
  - **Lesson 3:** Heat Capacity, Calorimetry & Phase Transitions ($Q = mc\Delta T$, $Q = mL_f$, $Q = mL_v$).
  - **Lesson 4:** Ideal Gas Laws & The Four Thermodynamic Processes (Isobaric, Isochoric, Isothermal, Adiabatic, PV Work).
  - **Lesson 5:** Heat Engines, Thermal Efficiency & Pioneers of Thermodynamics ($\eta_{Carnot} = 1 - T_C/T_H$, Black, Joule, Carnot, Clausius, Boltzmann, Maxwell).
  - **Lesson 6:** High-Precision Temperature Forecasting & Look-Up Matrices (Rule 4 Prediction Science, $PE$, and ambient correction).
* **Dual Roles (Student vs Coach/Admin):**
  - **Student Study Mode:** Clean, readable format with math equations, competition strategies, and an embedded interactive **Check-for-Understanding Quiz** offering immediate feedback and step-by-step solutions. Students can mark lessons as completed with one click.
  - **Teacher Presentation Mode (`👨‍🏫 Teacher Mode ON`):** Toggled by Coaches. Unlocks pedagogical coaching notes, Socratic discussion prompts, classroom interactive demonstration steps, and warnings about common middle school student traps.
  - **Coach Custom Lesson Builder:** Coaches can publish new custom lessons or homework modules with structured sections and custom quiz checkpoints.
  - **Automatic Gradebook Integration:** Track each student's completed lessons count directly from the Classroom Admin Gradebook and CSV export.

---

## 📂 Project Structure

```text
SmithSO/
├── index.html                       # Single-page web application interface
├── css/
│   └── styles.css                   # Dark Thermal Cyber-Lab design system & print styles
├── js/
│   ├── app.js                       # Main application orchestrator & tab routing
│   ├── auth-manager.js              # Multi-user accounts, simple passwords & progress persistence
│   ├── admin-dashboard.js           # Classroom admin controller, gradebook & roster management
│   ├── lessons-hub.js               # Module 8: Interactive curriculum, teacher presentation mode & custom lessons
│   ├── physics.js                   # Physics modeling & official scoring math engine
│   ├── collector-lab.js             # Module 1: Heat Collector simulator & canvas animation
│   ├── predictor-arena.js           # Module 2: Prediction Arena & scenario generator
│   ├── exam-arena.js                # Module 3: 50-point written exam engine & question bank
│   ├── test-printer.js              # Module 3B: Paper test booklet & OMR bubble sheet printer
│   ├── test-scanner.js              # Module 3C: Optical Mark Recognition (OMR) camera/image auto-grader
│   ├── physics-lab.js               # Module 4: PV cycle, Stefan-Boltzmann & calorimetry visualizers
│   ├── score-calc.js                # Module 5: 100-pt tournament calculator & tiebreaker engine
│   └── binder-hub.js                # Module 6: Constants database, converter & binder generator
├── Plan/
│   ├── Science_Olympiad_Div_B_Rules_2027_for_Web_Secured.pdf   # Official source rules
│   ├── Thermodynamics_B_Rules_Summary_and_Strategy.md          # Scoring & build guide
│   ├── thermodynamics_competition_coaching_guide.md            # Comprehensive coaching curriculum
│   ├── thermodynamics_master_question_bank.md                  # 65-Question curated competition bank & solutions
│   └── interactive_learning_platform_plan.md                   # Full platform technical specs
└── README.md
```
