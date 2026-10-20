# Science Olympiad 2027 Division B: Thermodynamics Official Coaching Guide
*Ground-truth reference based directly on the official rules in [`Plan/Science_Olympiad_Div_B_Rules_2027_for_Web_Secured.pdf`](file:///home/najamrashid/work/SmithSO/Plan/Science_Olympiad_Div_B_Rules_2027_for_Web_Secured.pdf)*

---

## 1. Event Overview & Official Parameters

In the 2027 Division B rotation, **Thermodynamics** is a hybrid event combining an active **Heat Collector Device** test with a **Written Theory Exam**:

* **Team Size:** Up to 2 competitors.
* **Total Time:** Approximately 50 minutes.
* **Impound Required:** Yes (pre-constructed device and spare parts must be at room temperature when impounded).
* **Calculators:** Up to two Class III calculators permitted.
* **Allowed Notes/Resources:** Unlimited notes/resources written or printed on paper of any size, in any form, from any source. Binders, books, notebooks, folders, sheet protectors, lamination, tabs, and labels are all permitted. Pages may be removed or separated during the event.

---

## 2. Official Scoring System (100 Points Total)

> **Final Score (FS) = ES + TS + PS** *(Maximum: 100 points)*

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   Official 100-Point Scoring Model                     │
├──────────────────────────────┬──────────────────────────┬──────────────┤
│ Exam Score (ES)              │ Temperature Score (TS)   │ Prediction   │
│ [████████████████████] 50%   │ [████████████] 30%       │ [████████]20%│
└──────────────────────────────┴──────────────────────────┴──────────────┘
```

### 1. Exam Score (ES) — Max 50 Points
> **ES = (Team Part I Score / Highest Part I Score of all teams) × 50**

### 2. Temperature Score (TS) — Max 30 Points
> **TS = (Team TG / Highest TG of all teams) × 30**  
> **Temperature Gain (TG) = Final Cup Water Temp − Starting Cup Water Temp** *(minimum TG = 0)*  
> *(Starting and final temperatures are measured by the Event Supervisor to the nearest 0.1°C.)*

### 3. Prediction Score (PS) — Max 20 Points
> **PS = (Team PE / Highest PE of all teams) × 20**  
> **Prediction Estimate (PE) = 1 − (|Final Temp − Predicted Temp| / Final Temp)** *(minimum PE = 0)*

### Penalties & Multipliers:
* **Competition Violations:** TS and PS multiplied by **0.9** per violation.
* **Construction Violations:** TS and PS multiplied by **0.7** per violation.
* **Disqualifying Materials (Hazardous / Active energy sources) or touching device during heating:** TS = 0, PS = 0.
* **Missing Prediction:** If no prediction is submitted before Heating Time ends, PS = 0.

### Official Tiebreakers:
1. **1st Tiebreaker:** Best TS (Temperature Score)
2. **2nd Tiebreaker:** Best ES (Exam Score)
3. **3rd Tiebreaker:** Pre-selected test questions

---

## 3. The 2027 Device Challenge: Heat Collector Engineering

Unlike previous cycles that focused on passive cooling retention (coolers), the 2027 Division B rule requires a device designed to **collect heat from an Event Supervisor heat lamp to maximize the temperature increase of 100 mL of water**.

### Physical & Testing Constraints:
* **Size Constraint:** Must fit completely within a **30.0 cm × 30.0 cm × 30.0 cm cube** when set up for testing.
* **Water Container:** The supervisor provides one **disposable, clear plastic 9 oz party cup** (approx. 3.9–4.0 inches tall, mouth 2.9–3.0 inches wide) filled with **100 mL of room-temperature water**.
* **Water Contact Rule:** Parts of the device may sit inside the cup, but **no part of the device may contact the water**. Nothing may be added to the water.
* **Prohibited Materials:**
  - Hazardous: Asbestos, mineral wool, fiberglass (immediate DQ from device testing).
  - Commercial units: Thermometers, probes, commercial thermoses, coolers, or vacuum-sealed units.
  - Active energy: Batteries, electrical components, chemical heat packs.
* **Testing Setup:**
  - **Heat Lamp:** Clamp lamp with metal reflector and **100–125 watt non-tinted heat lamp bulb** (no LED, halogen, or ceramic).
  - **Bulb Height above Testing Surface:**
    - **Regionals:** 40 – 50 cm, in 5 cm increments.
    - **States:** 40 – 55 cm, in 5 cm increments.
    - **Nationals:** 40 – 65 cm, in 1 cm increments.
  - **Heating Time:**
    - **Regionals:** Exactly 10 minutes.
    - **States/Nationals:** 10 – 15 minutes, in 1-minute increments.

```text
┌────────────────────────────────────────────────────────────────────────┐
│               100–125W Overhead Heat Lamp (40–65 cm Height)            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Radiative Heat Flux (Inverse-Square)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│     Inverted Conical / Parabolic Concentrator (Reflective Mylar)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Focused Radiation
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│     Clear Greenhouse Top (Transmits Radiation, Traps Rising Air)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│   Matte Black Heat Receiver Sleeve (Surrounds Cup; No Water Contact)   │
│   ───────────► High-Absorptivity Heat Transfer into Cup Walls ◄───────  │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │        9 oz Clear Plastic Cup (100 mL Water Volume)            │   │
│   └────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│       Insulated Outer Base & Walls (Aerogel Blanket / XPS Foam)        │
│       ─────────────────► Blocks Conduction to Table ◄─────────────────  │
└────────────────────────────────────────────────────────────────────────┘
```

### Engineering Strategy to Maximize Temperature Gain (TG):
1. **Greenhouse Effect / Transmittance Trap:**
   - Place a clear, high-transmittance top window (thin acrylic or glass) above the cup opening (without touching water) to allow shortwave infrared/visible light to enter while blocking convective hot air from escaping.
2. **Radiation Concentration & Absorption:**
   - Use reflective foil or polished sheet (aluminized Mylar or mirror foil) configured as an inverted truncated cone (funnel/concentrator) within the 30 × 30 × 30 cm cube to focus lamp energy directly onto the cup.
   - Surround the cup (without touching water) with a high-absorptivity, ultra-low albedo receiver (matte black aluminum/copper sleeve).
3. **Bottom & Side Thermal Insulation:**
   - The sides and bottom of the cup must be well-insulated with XPS foam or aerogel blanket to ensure heat absorbed is directed into the water and not lost into the tabletop surface.

---

## 4. The 2027 Prediction Science: Modeling Heat Gain

Teams are given:
- **3 minutes Device Setup Time:** Adjust device, inspect lamp height, begin prediction calculations.
- **1 minute Water Setup Time:** Receive 100 mL water, note supervisor-measured starting temp (T_start), insert cup into device.
- **Heating Time (10–15 min):** Finalize and submit predicted final temp (T_pred) in °C before the timer expires.

### Mathematical Thermal Absorption Model:
> **dT/dt = (P_absorbed − P_loss) / (m · c)**  
> **dT/dt = [α · I(h) · A_eff − U · A_surface · (T − T_room)] / (m · c)**

Where:
- m = 100 g = 0.1 kg, c = 4184 J / (kg · °C).
- I(h) ∝ P_bulb / h²: Incident radiation intensity as an inverse-square function of supervisor-announced bulb height h (40 to 65 cm).
- t: Announced heating time (10 to 15 min).

Top teams build a **2D Look-Up Matrix** before tournament day:
> **ΔT(h, t) ≈ K₀ · (t / h²) − K₁ · (T_start − T_room)**

By measuring laboratory temperature gain (ΔT) across heights (40, 45, 50, 55, 60 cm) and times (10, 11, 12, 13, 14, 15 min), competitors can achieve **PE ≥ 0.985** (less than 0.5°C prediction error).

---

## 5. Official Written Test Curriculum (Part I: 50 Points)

The written exam requires **at least three questions** from each required area:

| Core Area | Official Syllabus Topics | Competition Level |
| :--- | :--- | :--- |
| **Area 1: Foundations & Scales** | Thermodynamic systems, intensive vs extensive properties, definition of temperature, **Zeroth Law**, temperature scales and conversions (Celsius, Fahrenheit, Kelvin, Rankine where T_R = (9/5) · T_K), definitions of heat-related units (Joules, calories, BTUs). | Regional, State, National |
| **Area 2: Phases & Ideal Gases** | Phases of matter, phase transitions, phase diagrams (triple point, critical point), latent and sensible heat (Q = m · c · ΔT, Q = m · L), **Ideal Gas Law** (P · V = n · R · T). | Regional, State, National |
| **Area 3: Heat Transfer Mechanics** | Kinds of heat transfer (conduction, convection, radiation), thermal conductivity (k), heat capacity, specific heat (c). | Regional, State, National |
| **Area 4: Processes & Cycles** | Thermodynamic processes (adiabatic, isothermal, isochoric, isobaric), thermodynamic cycles, engines, efficiency (η), **First and Second Laws of Thermodynamics** (ΔU = Q − W). | Regional, State, National |
| **Area 5: History of Thermodynamics** | Contributions of **Lord Kelvin**, **Joseph Black** (latent heat and specific heat), **James Joule** (mechanical equivalent of heat), **Sadi Carnot** (Carnot engine and limit), **Max Planck** (blackbody quanta), **Rudolf Clausius** (entropy and 2nd law), **Ludwig Boltzmann** (statistical entropy S = k · ln W), and **James Clerk Maxwell** (Maxwell-Boltzmann distribution). | Regional, State, National |
| **Area 6: Advanced Radiation & 3rd Law** | Radiant exitance, blackbody radiation, **Stefan-Boltzmann Law** (P = ε · σ · A · T⁴), and the **Third Law of Thermodynamics** (entropy at absolute zero). | **State & National Tournaments Only** |

### Mathematical Boundaries (Rule 5.d):
* **Permitted:** Standard arithmetic (ratios, exponents, absolute values), simple one-variable algebra, simple geometric calculations (areas, volumes).
* **Strictly Prohibited:** No questions requiring **trigonometry or calculus**.
