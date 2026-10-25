# ThermoOlyMaster: Security & Content Improvement Tracker

**Lead Maintainer:** Najam Rashid  
**Benefactor:** Saleeka Foundation  
**Target Syllabus:** Science Olympiad Division B (2027 Season)  
**Document Created:** October 2026  
**Status:** In Progress (Active Implementation)

---

## 🎯 Executive Summary & Objectives

Following our comprehensive critical analysis of the ThermoOlyMaster codebase, this tracker defines the remediation plan, security architecture hardening, competition curriculum improvements, and verification procedures. 

Items are organized by priority tiers (**P0: Critical Security**, **P1: High Security**, **P2: Medium Security & Architecture**, **P3: Curriculum & Content Enhancements**).

---

## 🛡️ Phase 1: Security Hardening (P0 & P1)

### P0 — Critical Vulnerabilities (Immediate Remediation)

- [ ] **SEC-01: Static File Disclosure & System Path Traversal Protection**
  - **Location:** `server.js` (static file handler)
  - **Threat Model:** Any external visitor or web scraper can fetch `/.git/config`, `/data/coaches.json`, `/data/access-requests.json`, `/package.json`, or `/render.yaml` directly over HTTP 200.
  - **Fix Specification:**
    - Restrict static serving strictly to approved public directories (`/css/`, `/js/`, `/assets/`, root `index.html`, `favicon.ico`, `manifest.json`, `sw.js`).
    - Explicitly block any path containing dot-directories/files (`.git`, `.env`, `.agents`, etc.), `data/`, `Plan/`, `node_modules`, `server.js`, `Dockerfile`, `render.yaml`.
    - Ensure strict path confinement with `path.resolve(filePath).startsWith(path.resolve(ROOT_DIR))`.

- [ ] **SEC-02: Enforce Admin Authorization on Privileged Endpoints**
  - **Location:** `server.js` (`handleAuthApi`)
  - **Threat Model:** Endpoints `/api/auth/coaches/add`, `/api/auth/coaches/remove`, `/api/auth/access-requests`, and `/api/auth/access-requests/action` had zero authorization checks, allowing anonymous users to add coaches, delete coaches, or approve themselves as admins.
  - **Fix Specification:**
    - Implement `verifyAdminToken(req)` helper validating `Authorization: Bearer <token>` against `adminTokens`.
    - Return `401 Unauthorized` / `403 Forbidden` if the token is missing or invalid.

- [ ] **SEC-03: Strip Secrets & OTP Tokens from API Responses**
  - **Location:** `server.js` (`POST /api/auth/coach-request`)
  - **Threat Model:** The response returned `{ success: true, code, token, expiresAt }`, allowing any attacker who knows a coach's email to immediately obtain the login code without access to the inbox.
  - **Fix Specification:**
    - Remove `code` and `token` from the JSON response.
    - Log OTP safely to standard output only in local non-production environment.
    - Remove hardcoded `'123456'` bypass code in `POST /api/auth/coach-verify`.

---

### P1 — High-Priority Security & Integrity

- [ ] **SEC-04: Kahoot Tournament Room Host Secret Protection**
  - **Location:** `server.js` (`handleKahootApi` - `/api/kahoot/action`)
  - **Threat Model:** Any connected player knowing the 6-digit game PIN could dispatch `start_game`, `start_question`, `next_question`, or `end_game`, disrupting live classroom matches.
  - **Fix Specification:**
    - Generate a cryptographically random `hostSecret` when the room is created.
    - Return `hostSecret` only to the creating host client.
    - Validate `data.hostSecret === room.hostSecret` before executing any tournament flow mutations (`start_game`, `start_question`, `end_game`, etc.).

- [ ] **SEC-05: Timing-Safe Admin Password Verification & Enforced Environment Variable**
  - **Location:** `server.js` (`POST /api/auth/admin-verify`)
  - **Threat Model:** String equality (`===`) is susceptible to timing side-channel attacks. Default fallback `$Good4Now$` in public code represents an insecure credential.
  - **Fix Specification:**
    - Use `crypto.timingSafeEqual()` with SHA-256 digested buffers for constant-time comparison.
    - If `ADMIN_PASSWORD` is not configured in production, generate a secure random one-time startup password and print it to stderr.

- [ ] **SEC-06: Global HTTP Defensive Headers & Controlled CORS**
  - **Location:** `server.js`
  - **Threat Model:** Clickjacking (`X-Frame-Options`), MIME-type confusion sniffing (`X-Content-Type-Options`), and overly broad CORS (`*`) on credentialed endpoints.
  - **Fix Specification:**
    - Set `X-Frame-Options: SAMEORIGIN`.
    - Set `X-Content-Type-Options: nosniff`.
    - Set `Referrer-Policy: strict-origin-when-cross-origin`.
    - Restrict CORS origin on sensitive authentication routes.

- [ ] **SEC-07: In-Memory Sliding-Window Rate Limiter**
  - **Location:** `server.js`
  - **Threat Model:** Brute force credential stuffing on `/api/auth/admin-verify` and denial-of-service spam on `/api/auth/signup-request`.
  - **Fix Specification:**
    - Implement an IP-keyed rate limiter (e.g., maximum 5 failed attempts per minute, 30 total auth requests per minute per IP).

---

## 🚀 Phase 2: Architecture & Reliability (P2)

- [ ] **ARC-01: Offline Tournament-Ready Service Worker (PWA Caching)**
  - **Location:** `sw.js`, `manifest.json`, `index.html`
  - **Objective:** Science Olympiad invitationals frequently take place in school gyms or university arenas with blocked ports, weak Wi-Fi, or no cell service.
  - **Specification:**
    - Cache core application shell (`index.html`, `css/`, `js/`, `assets/`, fonts).
    - Allow Collector Simulation, Exam Arena, Binder Hub, and Score Calculator to work 100% offline.

- [ ] **ARC-02: Atomic File Persistence for Data Store**
  - **Location:** `server.js` (`saveCoaches`, `saveAccessRequests`)
  - **Objective:** Prevent data corruption in `coaches.json` or `access-requests.json` if the server process is restarted during a file write.
  - **Specification:**
    - Write to temporary file (`.tmp`) and atomically rename using `fs.renameSync()`.

---

## 📚 Phase 3: Curriculum & Content Enhancements (P2 & P3)

- [ ] **CON-01: Test Scanner (OMR) Perspective & Tilt Robustness**
  - **Location:** `js/test-scanner.js`
  - **Objective:** Enable reliable bubble sheet grading from smartphone camera photos taken at slight angles or tilts.
  - **Specification:**
    - Add detection for the 4 black square corner fiducial markers.
    - Compute homography/affine transformation to deskew the page prior to bubble darkness analysis.
    - Add double-bubble / ambiguous erase warnings.

- [ ] **CON-02: Heat Collector Simulation Refinements (2027 Rule 5/6)**
  - **Location:** `js/physics.js`, `js/collector-lab.js`
  - **Objective:** Align closer with real-world physical apparatus constraints.
  - **Specification:**
    - Add incandescent heat lamp 60-second warm-up transient curve.
    - Add water temperature stratification probe immersion indicator.
    - Add 30×30×30 cm dimension compliance indicator.

- [ ] **CON-03: Binder Hub Historical Pioneers Quick-Reference**
  - **Location:** `js/binder-hub.js`, `index.html`
  - **Objective:** High-yield reference sheets for history of thermodynamics (Carnot, Rumford, Joule, Clausius, Kelvin, Black).
  - **Specification:**
    - Add dedicated printable table of historical experiments and pioneers.
    - Add pre-competition Rule Compliance Binder checklist.

- [ ] **CON-04: Exam Arena Dynamic Parameter Generation**
  - **Location:** `js/exam-arena.js`
  - **Objective:** Prevent answer memorization for numerical questions.
  - **Specification:**
    - Add dynamic algorithmic variants for temperature scale conversions, calorimetry ($q=mc\Delta T$), and Carnot cycle efficiency.

---

## 🔬 Phase 4: Advanced Heat Collector Physical Simulation & Visual Realism (SIM)

- [x] **SIM-01: Coupled Multi-Body Thermal Mass & Wall Conduction**
  - **Location:** `js/physics.js` (`computeCollectorHeatFlow`, `stepSimulation`)
  - **Objective:** Eliminate premature linear heating; model transient startup lag where sleeve ($C_{\text{sleeve}}$) and plastic cup ($C_{\text{cup}}$) heat first before conducting across the plastic wall into the 100 mL water.
  - **Physics Model:**
    - Sleeve heat capacity: Copper ($c=385\text{ J/kg}\cdot\text{K}, m=0.045\text{ kg} \to C\approx 17.3\text{ J/K}$), Foil ($c=900\text{ J/kg}\cdot\text{K}, m=0.009\text{ kg} \to C\approx 8.1\text{ J/K}$).
    - Polystyrene cup thermal capacity: $C\approx 14.5\text{ J/K}$.
    - Radial Fourier conduction between sleeve and water: $\dot{Q}_{\text{wall}} = (T_{\text{sleeve}} - T_{\text{water}}) / R_{\text{wall}}$.

- [x] **SIM-02: Latent Evaporative Mass Loss & Cooling Model**
  - **Location:** `js/physics.js`, `js/collector-lab.js`
  - **Objective:** Accurately model evaporative cooling ($L_v = 2.26\times 10^6\text{ J/kg}$) causing open cups to plateau earlier, and render condensation fogging under greenhouse lids.
  - **Physics Model:**
    - Tetens saturation vapor pressure: $P_{\text{sat}}(T) = 0.61078 \exp(17.27 \cdot T / (T + 237.3))\text{ kPa}$.
    - Latent heat loss $\dot{Q}_{\text{evap}} = \dot{m}_{\text{evap}} L_v$, suppressed by 90% when using acrylic or glass greenhouse covers.
    - Lid condensation: micro-droplet dew accumulates under transparent lids as humidity reaches 100%, causing a 6% solar transmittance drop.

- [x] **SIM-03: Thermometer Immersion Depth Stratification & Sensor Inertia**
  - **Location:** `js/physics.js`, `js/collector-lab.js`, `index.html`
  - **Objective:** Model vertical thermal stratification (Rule 5.b) with draggable probe depth (Surface, Mid-Depth, Bottom) and sensor response lag ($\tau \approx 6\text{ s}$).

- [x] **SIM-04: False-Color Infrared (FLIR / Thermal Camera) Canvas View**
  - **Location:** `js/collector-lab.js`, `index.html`, `css/styles.css`
  - **Objective:** Provide a real-time scientific thermal imaging camera view (Ironbow / Magma false-color palette) with live thermal colorbar legend.

- [x] **SIM-05: Non-Imaging Specular Optical Ray Tracing**
  - **Location:** `js/collector-lab.js`
  - **Objective:** Replace random falling particles with directional ray vectors that reflect off the conical Mylar / aluminum funnel surfaces according to optical reflection angles.

- [x] **SIM-06: Complete Thermal Insulation Chamber & Collision-Free Apparatus Badging**
  - **Location:** `js/collector-lab.js`
  - **Objective:** Fix overlapping canvas labels and clearly visualize apparatus insulation.
  - **Visual & Structural Upgrades:**
    - Replaced the simple bottom slab with a complete U-shaped thermal insulation chamber (base plate + left and right side walls) enclosing the 9 oz cup and absorber sleeve.
    - Added authentic physical textures (aerogel Rayleigh nanopores, XPS foam 45° diagonal cross-hatching, foil bubble-cell grid, wood grain streaks, and FLIR thermal conduction drop across wall thickness).
    - Designed `drawCalloutBadge` with clean leader lines, dedicated pill badges, and non-overlapping slots:
      - Rule 3.a 30x30 cm limit badge elevated above the bounding box (`boxTop - 12*scale`).
      - Rule 5.b thermometer probe tag moved outside the cup to open space (`chamberRight + 22*scale`).
      - Height dimension line (`h = 45 cm`) spaced with dimension brackets and arrowheads.
      - Component callouts for Lamp, Funnel, Trap Lid, Insulation, and Sleeve organized in dedicated columns.

---

## 📊 Implementation Progress Tracker

| Task ID | Component | Priority | Status | Verification / Commit |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Static File Disclosure Protection | P0 | ✅ Completed | Blocked `.git`, `data/`, `Plan/`, `node_modules/`, sensitive files (HTTP 403) |
| **SEC-02** | Privileged Admin Endpoint Auth | P0 | ✅ Completed | Enforced Bearer tokens on coach & access-request mutations (HTTP 401/200) |
| **SEC-03** | Strip OTP from HTTP Response | P0 | ✅ Completed | Omitted code & token in response; deleted `'123456'` bypass |
| **SEC-04** | Kahoot Host Secret Protection | P1 | ✅ Completed | Host-only tournament actions require valid `hostSecret` (HTTP 403/200) |
| **SEC-05** | Timing-Safe Passwords & Secret Handling | P1 | ✅ Completed | `crypto.timingSafeEqual()` on SHA-256 digested buffers |
| **SEC-06** | Global Defensive HTTP Headers | P1 | ✅ Completed | Applied `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` |
| **SEC-07** | In-Memory Sliding-Window Rate Limiter | P1 | ✅ Completed | IP-based request throttler enforcing 429 Too Many Requests |
| **ARC-01** | Service Worker Offline Caching | P2 | ✅ Completed | `sw.js` and `manifest.json` registered for PWA offline tournament mode |
| **ARC-02** | Atomic Data File Writes | P2 | ✅ Completed | `.tmp` file writing with `fs.renameSync()` preventing file corruption |
| **CON-01** | Test Scanner OMR Deskew & Warning | P2 | ✅ Completed | Corner fiducial centroid rotation deskew & double-bubble detection |
| **CON-02** | Collector Simulation 30cm Box & Warmup | P2 | ✅ Completed | Exponential lamp warmup curve, 30cm dimension check, probe stratification |
| **CON-03** | Binder Hub Historical Pioneers Sheet | P3 | ✅ Completed | Dedicated Pioneers & Landmark Experiments master reference table |
| **CON-04** | Exam Dynamic Variable Generation | P3 | In Backlog | Planned for subsequent PR |
| **SIM-01** | Multi-Body Thermal Mass & Conduction | P1 | ✅ Completed | Coupled sleeve + cup wall resistance $R_{\text{wall}} + C_{\text{water+cup}}$ |
| **SIM-02** | Latent Evaporative Cooling & Condensation | P1 | ✅ Completed | Tetens vapor pressure, open-cup plateau, lid micro-droplet fogging |
| **SIM-03** | Probe Depth Stratification & Sensor Lag | P1 | ✅ Completed | Rule 5.b depth selector (Surface/Mid/Bottom) + $\tau = 6\text{s}$ sensor lag |
| **SIM-04** | FLIR Infrared Thermal Camera Mode | P2 | ✅ Completed | Ironbow colormap view + live scale legend + HUD crosshair |
| **SIM-05** | Specular Ray-Tracing Optics | P2 | ✅ Completed | Conical funnel specular ray reflection vectors with animated pulses |
| **SIM-06** | Insulation Chamber & Visual Badging | P1 | ✅ Completed | Complete U-chamber enclosure + non-overlapping callout badges |

---

*Document maintained under Linxtel & Saleeka Foundation collaboration.*

---

*Document maintained under Linxtel & Saleeka Foundation collaboration.*

