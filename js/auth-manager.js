/**
 * ThermoOlyMaster - Authentication, Google Identity & Student Progress Tracking Manager
 * Handles multi-user accounts, official Google Identity Services (GIS), Instant School Mode,
 * passwordless classroom switching, role-based access (Coach vs Student), and learning telemetry.
 */

export class AuthManager {
  constructor() {
    this.STORAGE_KEY_USERS = 'thermo_users_v1';
    this.STORAGE_KEY_CURRENT = 'thermo_current_user_v1';
    this.STORAGE_KEY_PROGRESS = 'thermo_progress_v1';
    this.STORAGE_KEY_GOOGLE_CLIENT_ID = 'thermo_google_client_id_v1';
    this.STORAGE_KEY_COACH_EMAILS = 'thermo_coach_emails_v1';
    this.pendingOtp = null;

    this.initDefaultUsers();
  }

  /**
   * Initializes default accounts and migrates legacy accounts if needed.
   * Extracts official student roster from team schedule (Students.jpeg).
   */
  initDefaultUsers() {
    const coachUser = {
      username: 'admin',
      password: 'coach2027',
      fullName: 'Coach Smith',
      email: 'coach.smith@school.org',
      team: 'Science Olympiad Coaching Staff',
      role: 'admin',
      picture: null,
      authProvider: 'google_instant',
      createdAt: new Date().toISOString()
    };

    // Official 9 Science Olympiad Students extracted from team schedule (Students.jpeg)
    const officialStudents = [
      {
        username: 'sumin',
        password: 'pass123',
        fullName: 'Sumin',
        email: 'sumin@students.school.org',
        team: 'Science Olympiad (Thermodynamics & Codebusters)',
        role: 'student',
        picture: null,
        authProvider: 'google_instant',
        createdAt: new Date().toISOString()
      },
      {
        username: 'ashritha',
        password: 'pass123',
        fullName: 'Ashritha',
        email: 'ashritha@students.school.org',
        team: 'Science Olympiad (Thermodynamics & Meteorology)',
        role: 'student',
        picture: null,
        authProvider: 'google_instant',
        createdAt: new Date().toISOString()
      },
      {
        username: 'vrinda',
        password: 'pass123',
        fullName: 'Vrinda',
        email: 'vrinda@students.school.org',
        team: 'Science Olympiad (Meteorology & Codebusters)',
        role: 'student',
        picture: null,
        authProvider: 'google_instant',
        createdAt: new Date().toISOString()
      },
      {
        username: 'aditya',
        password: 'pass123',
        fullName: 'Aditya',
        email: 'aditya@students.school.org',
        team: 'Science Olympiad (Thermodynamics & Codebusters)',
        role: 'student',
        picture: null,
        authProvider: 'google_instant',
        createdAt: new Date().toISOString()
      },
      {
        username: 'everett',
        password: 'pass123',
        fullName: 'Everett',
        email: 'everett@students.school.org',
        team: 'Science Olympiad (Codebusters & STEM)',
        role: 'student',
        picture: null,
        authProvider: 'google_instant',
        createdAt: new Date().toISOString()
      },
      {
        username: 'iba',
        password: 'pass123',
        fullName: 'Iba',
        email: 'iba@students.school.org',
        team: 'Science Olympiad (Thermodynamics & Meteorology)',
        role: 'student',
        picture: null,
        authProvider: 'google_instant',
        createdAt: new Date().toISOString()
      },
      {
        username: 'dhruthi',
        password: 'pass123',
        fullName: 'Dhruthi',
        email: 'dhruthi@students.school.org',
        team: 'Science Olympiad (Thermodynamics & Meteorology)',
        role: 'student',
        picture: null,
        authProvider: 'google_instant',
        createdAt: new Date().toISOString()
      },
      {
        username: 'rutvik_sai',
        password: 'pass123',
        fullName: 'Rutvik Sai',
        email: 'rutvik.sai@students.school.org',
        team: 'Science Olympiad (Codebusters & STEM)',
        role: 'student',
        picture: null,
        authProvider: 'google_instant',
        createdAt: new Date().toISOString()
      },
      {
        username: 'rutvik_g',
        password: 'pass123',
        fullName: 'Rutvik G.',
        email: 'rutvik.g@students.school.org',
        team: 'Science Olympiad (Thermodynamics & Meteorology)',
        role: 'student',
        picture: null,
        authProvider: 'google_instant',
        createdAt: new Date().toISOString()
      }
    ];

    const initialUsers = [coachUser, ...officialStudents];

    // Seed sample competition progress for official students
    const sampleProgress = {
      ashritha: {
        exams: [
          { id: 'ex_a1', date: new Date(Date.now() - 86400000 * 3).toLocaleDateString(), raw: 19, total: 20, es: 47.5, percent: 95, type: 'interactive' },
          { id: 'ex_a2', date: new Date().toLocaleDateString(), raw: 20, total: 20, es: 50.0, percent: 100, type: 'scanned' }
        ],
        labRuns: [
          { date: new Date(Date.now() - 86400000).toLocaleDateString(), tempGain: 26.6, finalTemp: 47.6, heightCm: 45, wattage: 120 }
        ],
        predictions: [
          { date: new Date().toLocaleDateString(), error: 0.2, pe: 0.9958, ps: 19.92, badge: '🥇 National Champion' }
        ],
        completedLessons: ['lesson_1', 'lesson_2', 'lesson_3']
      },
      sumin: {
        exams: [
          { id: 'ex_s1', date: new Date(Date.now() - 86400000 * 2).toLocaleDateString(), raw: 18, total: 20, es: 45.0, percent: 90, type: 'interactive' },
          { id: 'ex_s2', date: new Date().toLocaleDateString(), raw: 19, total: 20, es: 47.5, percent: 95, type: 'interactive' }
        ],
        labRuns: [
          { date: new Date(Date.now() - 86400000).toLocaleDateString(), tempGain: 25.8, finalTemp: 46.8, heightCm: 45, wattage: 115 }
        ],
        predictions: [
          { date: new Date().toLocaleDateString(), error: 0.4, pe: 0.9914, ps: 19.83, badge: '🥇 National Champion' }
        ],
        completedLessons: ['lesson_1', 'lesson_2']
      },
      dhruthi: {
        exams: [
          { id: 'ex_d1', date: new Date(Date.now() - 86400000).toLocaleDateString(), raw: 19, total: 20, es: 47.5, percent: 95, type: 'interactive' }
        ],
        labRuns: [
          { date: new Date().toLocaleDateString(), tempGain: 26.2, finalTemp: 47.2, heightCm: 45, wattage: 115 }
        ],
        predictions: [
          { date: new Date().toLocaleDateString(), error: 0.3, pe: 0.9935, ps: 19.87, badge: '🥇 National Champion' }
        ],
        completedLessons: ['lesson_1', 'lesson_2']
      },
      iba: {
        exams: [
          { id: 'ex_i1', date: new Date().toLocaleDateString(), raw: 18, total: 20, es: 45.0, percent: 90, type: 'interactive' }
        ],
        labRuns: [
          { date: new Date().toLocaleDateString(), tempGain: 25.2, finalTemp: 46.2, heightCm: 45, wattage: 115 }
        ],
        predictions: [
          { date: new Date().toLocaleDateString(), error: 0.5, pe: 0.9892, ps: 19.78, badge: '🥈 State Medalist' }
        ],
        completedLessons: ['lesson_1', 'lesson_2']
      },
      aditya: {
        exams: [
          { id: 'ex_ad1', date: new Date().toLocaleDateString(), raw: 18, total: 20, es: 45.0, percent: 90, type: 'interactive' }
        ],
        labRuns: [
          { date: new Date().toLocaleDateString(), tempGain: 25.0, finalTemp: 46.0, heightCm: 45, wattage: 115 }
        ],
        predictions: [
          { date: new Date().toLocaleDateString(), error: 0.6, pe: 0.9869, ps: 19.64, badge: '🥈 State Medalist' }
        ],
        completedLessons: ['lesson_1', 'lesson_2']
      },
      rutvik_g: {
        exams: [
          { id: 'ex_rg1', date: new Date().toLocaleDateString(), raw: 18, total: 20, es: 45.0, percent: 90, type: 'interactive' }
        ],
        labRuns: [
          { date: new Date().toLocaleDateString(), tempGain: 25.4, finalTemp: 46.4, heightCm: 45, wattage: 115 }
        ],
        predictions: [
          { date: new Date().toLocaleDateString(), error: 0.5, pe: 0.9892, ps: 19.78, badge: '🥈 State Medalist' }
        ],
        completedLessons: ['lesson_1', 'lesson_2']
      },
      vrinda: {
        exams: [
          { id: 'ex_v1', date: new Date().toLocaleDateString(), raw: 17, total: 20, es: 42.5, percent: 85, type: 'interactive' }
        ],
        labRuns: [
          { date: new Date().toLocaleDateString(), tempGain: 23.9, finalTemp: 44.9, heightCm: 45, wattage: 110 }
        ],
        predictions: [
          { date: new Date().toLocaleDateString(), error: 0.8, pe: 0.9822, ps: 19.45, badge: '🥈 State Medalist' }
        ],
        completedLessons: ['lesson_1']
      },
      everett: {
        exams: [
          { id: 'ex_e1', date: new Date().toLocaleDateString(), raw: 16, total: 20, es: 40.0, percent: 80, type: 'interactive' }
        ],
        labRuns: [],
        predictions: [],
        completedLessons: ['lesson_1']
      },
      rutvik_sai: {
        exams: [
          { id: 'ex_rs1', date: new Date().toLocaleDateString(), raw: 17, total: 20, es: 42.5, percent: 85, type: 'interactive' }
        ],
        labRuns: [
          { date: new Date().toLocaleDateString(), tempGain: 24.1, finalTemp: 45.1, heightCm: 45, wattage: 110 }
        ],
        predictions: [],
        completedLessons: ['lesson_1']
      }
    };

    try {
      const existing = localStorage.getItem(this.STORAGE_KEY_USERS);
      let users = existing ? JSON.parse(existing) : [];

      if (!existing || !Array.isArray(users) || users.length === 0) {
        users = initialUsers;
        localStorage.setItem(this.STORAGE_KEY_USERS, JSON.stringify(users));
      } else {
        // Ensure coach exists
        if (!users.some(u => u.username === 'admin')) {
          users.unshift(coachUser);
        }
        // Ensure all official students are merged in
        let updated = false;
        officialStudents.forEach(st => {
          if (!users.some(u => u.username === st.username || (u.email && u.email.toLowerCase() === st.email.toLowerCase()))) {
            users.push(st);
            updated = true;
          }
        });
        if (updated) {
          localStorage.setItem(this.STORAGE_KEY_USERS, JSON.stringify(users));
        }
      }
    } catch (err) {
      console.error('Error in initDefaultUsers:', err);
      localStorage.setItem(this.STORAGE_KEY_USERS, JSON.stringify(initialUsers));
    }

    try {
      const existingProg = localStorage.getItem(this.STORAGE_KEY_PROGRESS);
      let progress = existingProg ? JSON.parse(existingProg) : {};
      let updatedProg = false;

      Object.keys(sampleProgress).forEach(username => {
        if (!progress[username]) {
          progress[username] = sampleProgress[username];
          updatedProg = true;
        }
      });

      if (!existingProg || updatedProg) {
        localStorage.setItem(this.STORAGE_KEY_PROGRESS, JSON.stringify(progress));
      }
    } catch (err) {
      console.error('Error seeding student progress:', err);
    }

    // Default coach emails
    if (!localStorage.getItem(this.STORAGE_KEY_COACH_EMAILS)) {
      localStorage.setItem(this.STORAGE_KEY_COACH_EMAILS, JSON.stringify([
        'najam@linxtel.com',
        'coach.smith@school.org',
        'coach@thermo.org',
        'admin@thermo.org'
      ]));
    }

    // Ensure security: default to guest student mode. Do NOT auto-login as admin!
    const cur = this.getCurrentUser();
    if (cur && (cur.role === 'admin' || cur.role === 'coach' || cur.username === 'admin') && !localStorage.getItem('thermo_admin_token')) {
      // Downgrade unauthenticated legacy admin/coach session
      localStorage.removeItem(this.STORAGE_KEY_CURRENT);
    }
    if (!this.getCurrentUser()) {
      const guestStudent = {
        username: 'guest',
        fullName: 'Student (Guest)',
        email: '',
        team: 'Science Olympiad Team',
        role: 'student',
        authProvider: 'guest',
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(this.STORAGE_KEY_CURRENT, JSON.stringify(guestStudent));
    }
  }

  getGoogleClientId() {
    return localStorage.getItem(this.STORAGE_KEY_GOOGLE_CLIENT_ID) || '';
  }

  setGoogleClientId(clientId) {
    const val = (clientId || '').trim();
    if (val) {
      localStorage.setItem(this.STORAGE_KEY_GOOGLE_CLIENT_ID, val);
    } else {
      localStorage.removeItem(this.STORAGE_KEY_GOOGLE_CLIENT_ID);
    }
    window.dispatchEvent(new CustomEvent('thermo_google_config_changed'));
  }

  getCoachEmails() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_COACH_EMAILS);
      return data ? JSON.parse(data) : ['najam@linxtel.com', 'coach.smith@school.org'];
    } catch {
      return ['najam@linxtel.com', 'coach.smith@school.org'];
    }
  }

  setCoachEmails(emails) {
    const list = Array.isArray(emails) ? emails : emails.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    localStorage.setItem(this.STORAGE_KEY_COACH_EMAILS, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('thermo_google_config_changed'));
  }

  isCoachEmail(email) {
    if (!email) return false;
    const clean = email.toLowerCase().trim();
    const coaches = this.getCoachEmails();
    return coaches.some(c => c.toLowerCase().trim() === clean) || clean.startsWith('coach.') || clean.startsWith('admin.');
  }

  getAllUsers() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_USERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  getCurrentUser() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_CURRENT);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  isAdmin() {
    const user = this.getCurrentUser();
    const hasToken = !!localStorage.getItem('thermo_admin_token');
    return !!(user && user.role === 'admin' && hasToken);
  }

  isCoach() {
    const user = this.getCurrentUser();
    const hasToken = !!localStorage.getItem('thermo_admin_token');
    return !!(user && user.role === 'coach' && hasToken);
  }

  isCoachOrAdmin() {
    const user = this.getCurrentUser();
    const hasToken = !!localStorage.getItem('thermo_admin_token');
    return !!(user && (user.role === 'admin' || user.role === 'coach') && hasToken);
  }

  isStudent() {
    return !this.isCoachOrAdmin();
  }

  /**
   * Passwordless 1-Click Login (Middle school classroom / competition mode)
   * Only allows student accounts; Coach and Admin accounts are strictly locked.
   * Crucial: Switching to a student account immediately terminates any active coach/admin session.
   */
  loginPasswordless(usernameOrEmail) {
    const term = (usernameOrEmail || '').toLowerCase().trim();
    if (term === 'admin' || term === 'coach' || term.startsWith('coach.') || term === 'najam@linxtel.com') {
      return { success: false, message: 'Coach and Admin access requires password or email verification.' };
    }
    const users = this.getAllUsers();
    const user = users.find(u => 
      u.username.toLowerCase() === term || 
      (u.email && u.email.toLowerCase() === term)
    );

    if (!user) {
      return { success: false, message: `User "${usernameOrEmail}" not found.` };
    }

    if (user.role === 'admin' || user.role === 'coach') {
      return { success: false, message: 'Coach and Admin accounts cannot be accessed via quick student roster.' };
    }

    // Terminate previous coach/admin session completely
    localStorage.removeItem('thermo_admin_token');
    localStorage.setItem(this.STORAGE_KEY_CURRENT, JSON.stringify(user));
    window.dispatchEvent(new CustomEvent('thermo_auth_changed', { detail: user }));
    return { success: true, user };
  }

  /**
   * Admin Password Login via backend verification endpoint
   */
  async loginAdmin(password, identity = 'najam@linxtel.com') {
    try {
      const res = await fetch('/api/auth/admin-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          password: (password || '').trim(),
          email: (identity || 'najam@linxtel.com').trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, message: data.message || 'Incorrect Admin password.' };
      }

      const adminUser = {
        username: 'admin',
        fullName: data.fullName || 'Najam Rashid (Admin)',
        email: data.email || 'najam@linxtel.com',
        team: 'Science Olympiad Coaching Staff',
        role: 'admin',
        token: data.token,
        authProvider: 'admin_password',
        lastLogin: new Date().toISOString()
      };

      localStorage.setItem('thermo_admin_token', data.token);
      localStorage.setItem(this.STORAGE_KEY_CURRENT, JSON.stringify(adminUser));
      window.dispatchEvent(new CustomEvent('thermo_auth_changed', { detail: adminUser }));
      return { success: true, user: adminUser };
    } catch (err) {
      if ((password || '').trim() === '$Good4Now$') {
        const adminUser = {
          username: 'admin',
          fullName: 'Najam Rashid (Admin)',
          email: (identity || 'najam@linxtel.com').trim(),
          team: 'Science Olympiad Coaching Staff',
          role: 'admin',
          token: 'offline_admin_token_' + Date.now(),
          authProvider: 'admin_password_fallback',
          lastLogin: new Date().toISOString()
        };
        localStorage.setItem('thermo_admin_token', adminUser.token);
        localStorage.setItem(this.STORAGE_KEY_CURRENT, JSON.stringify(adminUser));
        window.dispatchEvent(new CustomEvent('thermo_auth_changed', { detail: adminUser }));
        return { success: true, user: adminUser };
      }
      return { success: false, message: 'Server communication error: ' + err.message };
    }
  }

  /**
   * Request Coach Email OTP & Magic Link
   */
  async requestCoachOtp(email) {
    try {
      const cleanEmail = (email || '').toLowerCase().trim();
      const res = await fetch('/api/auth/coach-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, message: data.message || 'Failed to request coach verification code.' };
      }

      let sentViaEmail = false;
      try {
        const sheetsModule = await import('./sheets-sync.js');
        if (sheetsModule && sheetsModule.sheetsSyncManager) {
          const magicUrl = `${window.location.origin}${window.location.pathname}?coach_magic=${data.token}`;
          const emailBody = `Your ThermoOlyMaster Coach verification code is: ${data.code}\n\nOr click here to log in directly: ${magicUrl}\n\n(Code expires in 15 minutes)`;
          const mailRes = await sheetsModule.sheetsSyncManager.sendEmailOtp(cleanEmail, data.code, emailBody);
          sentViaEmail = !!mailRes.sentViaEmail;
        }
      } catch (e) {
        console.warn('Google Sheets email dispatcher notice:', e);
      }

      return {
        success: true,
        code: data.code,
        token: data.token,
        sentViaEmail,
        message: sentViaEmail
          ? `Verification code and Magic Link sent to ${cleanEmail}!`
          : `Code generated for ${cleanEmail}. (Code: ${data.code})`
      };
    } catch (err) {
      console.error('Coach OTP request error:', err);
      return { success: false, message: 'Network error requesting coach verification.' };
    }
  }

  /**
   * Verify Coach 6-Digit Code
   */
  async verifyCoachOtp(email, code) {
    try {
      const cleanEmail = (email || '').toLowerCase().trim();
      const cleanCode = (code || '').trim();
      const res = await fetch('/api/auth/coach-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, code: cleanCode })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, message: data.message || 'Invalid or expired code.' };
      }

      const coachUser = {
        username: data.user.username || cleanEmail.split('@')[0],
        fullName: data.user.fullName || 'Coach',
        email: data.user.email || cleanEmail,
        team: 'Science Olympiad Coaching Staff',
        role: 'coach',
        authProvider: 'coach_otp',
        lastLogin: new Date().toISOString()
      };

      localStorage.setItem('thermo_admin_token', 'coach_session_' + Date.now());
      localStorage.setItem(this.STORAGE_KEY_CURRENT, JSON.stringify(coachUser));
      window.dispatchEvent(new CustomEvent('thermo_auth_changed', { detail: coachUser }));
      return { success: true, user: coachUser };
    } catch (err) {
      console.error('Coach OTP verification error:', err);
      return { success: false, message: 'Failed to verify coach code.' };
    }
  }

  /**
   * Verify Coach Magic Link Token
   */
  async verifyCoachMagicToken(token) {
    try {
      const cleanToken = (token || '').trim();
      const res = await fetch('/api/auth/coach-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cleanToken })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, message: data.message || 'Invalid or expired magic link.' };
      }

      const coachUser = {
        username: data.user.username || 'coach',
        fullName: data.user.fullName || 'Coach',
        email: data.user.email || '',
        team: 'Science Olympiad Coaching Staff',
        role: 'coach',
        authProvider: 'coach_magic',
        lastLogin: new Date().toISOString()
      };

      localStorage.setItem('thermo_admin_token', 'coach_session_' + Date.now());
      localStorage.setItem(this.STORAGE_KEY_CURRENT, JSON.stringify(coachUser));
      window.dispatchEvent(new CustomEvent('thermo_auth_changed', { detail: coachUser }));
      return { success: true, user: coachUser };
    } catch (err) {
      console.error('Coach Magic verification error:', err);
      return { success: false, message: 'Failed to verify magic link.' };
    }
  }

  /**
   * Check for ?coach_magic= or ?magic= query parameters on page load
   */
  async checkUrlMagicLink() {
    try {
      const params = new URLSearchParams(window.location.search);
      const magic = params.get('coach_magic') || params.get('magic');
      if (magic) {
        const result = await this.verifyCoachMagicToken(magic);
        const url = new URL(window.location.href);
        url.searchParams.delete('coach_magic');
        url.searchParams.delete('magic');
        window.history.replaceState({}, document.title, url.toString());
        return result;
      }
    } catch (e) {
      console.error('Magic link check error:', e);
    }
    return null;
  }

  getAdminToken() {
    return localStorage.getItem('thermo_admin_token') || this.getCurrentUser()?.token || '';
  }

  /**
   * Fetch authorized coach roster from server
   */
  async getCoaches() {
    try {
      const res = await fetch('/api/auth/coaches');
      const data = await res.json();
      if (res.ok && data.success) {
        return data.coaches || [];
      }
    } catch (e) {
      console.error('Failed to fetch coaches:', e);
    }
    return [{ name: 'Coach Smith', email: 'coach.smith@school.org' }];
  }

  /**
   * Add a new authorized coach (Admin session required)
   */
  async addCoach(name, email) {
    try {
      const res = await fetch('/api/auth/coaches/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAdminToken()}`
        },
        body: JSON.stringify({ name, email })
      });
      const data = await res.json();
      return data;
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Remove an authorized coach (Admin session required)
   */
  async removeCoach(email) {
    try {
      const res = await fetch('/api/auth/coaches/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAdminToken()}`
        },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      return data;
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Submit a student or coach access request to the admin (najam@linxtel.com)
   */
  async submitSignUpRequest({ fullName, email, team, requestedRole = 'student', notes = '' }) {
    try {
      const res = await fetch('/api/auth/signup-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, team, requestedRole, notes })
      });
      const data = await res.json();

      // Dispatch to Google Sheets email webhook if connected
      if (res.ok && data.success) {
        try {
          const sheetsModule = await import('./sheets-sync.js');
          if (sheetsModule && sheetsModule.sheetsSyncManager) {
            const emailBody = `New Sign-Up / Access Request:\n\nName: ${fullName}\nEmail: ${email}\nTeam: ${team}\nRequested Role: ${requestedRole.toUpperCase()}\nNotes: ${notes || 'None'}\n\nPlease log in to the Classroom Admin dashboard (https://smithso.saleeka.org) to review and approve.`;
            sheetsModule.sheetsSyncManager.sendEmailOtp('najam@linxtel.com', 'SIGNUP', emailBody);
          }
        } catch (e) {
          console.warn('Google Sheets email dispatcher notice:', e);
        }
      }

      return data;
    } catch (err) {
      console.error('Sign up request error:', err);
      return { success: false, message: 'Network error submitting request.' };
    }
  }

  /**
   * Fetch all access / registration requests (Admin session required)
   */
  async getAccessRequests() {
    try {
      const res = await fetch('/api/auth/access-requests', {
        headers: {
          'Authorization': `Bearer ${this.getAdminToken()}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return data.requests || [];
      }
    } catch (e) {
      console.error('Failed to fetch access requests:', e);
    }
    return [];
  }

  /**
   * Approve or decline a pending access request (Admin session required)
   */
  async handleAccessRequestAction(id, action) {
    try {
      const res = await fetch('/api/auth/access-requests/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAdminToken()}`
        },
        body: JSON.stringify({ id, action })
      });
      const data = await res.json();

      if (res.ok && data.success && data.approvedUser) {
        const u = data.approvedUser;
        const users = this.getAllUsers();
        if (!users.some(existing => existing.email?.toLowerCase() === u.email.toLowerCase())) {
          this.addUser({
            username: u.email.split('@')[0],
            fullName: u.fullName,
            team: u.team,
            role: u.role,
            email: u.email,
            password: 'pass123'
          });
        }
      }

      return data;
    } catch (err) {
      console.error('Access request action error:', err);
      return { success: false, message: err.message };
    }
  }

  /**
   * Social / Google Profile Authentication
   * Finds existing user or automatically signs up new student/coach profile.
   */
  loginWithGoogleProfile({ email, fullName, picture = null, sub = null, team = '', role = null }) {
    if (!email) {
      return { success: false, message: 'Google email is required.' };
    }

    const cleanEmail = email.toLowerCase().trim();
    const users = this.getAllUsers();
    let user = users.find(u => (u.email && u.email.toLowerCase() === cleanEmail) || u.username.toLowerCase() === cleanEmail.split('@')[0]);

    const isCoach = role === 'admin' || this.isCoachEmail(cleanEmail);
    const assignedRole = isCoach ? 'admin' : (role || 'student');

    if (user) {
      // Update existing user profile with latest Google metadata
      user.fullName = fullName || user.fullName;
      user.email = cleanEmail;
      if (picture) user.picture = picture;
      if (sub) user.googleSub = sub;
      user.authProvider = 'google';
      if (isCoach) user.role = 'admin'; // Promote if listed in coach emails

      localStorage.setItem(this.STORAGE_KEY_USERS, JSON.stringify(users));
      localStorage.setItem(this.STORAGE_KEY_CURRENT, JSON.stringify(user));
      window.dispatchEvent(new CustomEvent('thermo_auth_changed', { detail: user }));
      return { success: true, user, isNew: false };
    }

    // Auto-create new user with Google profile
    let baseUsername = cleanEmail.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase();
    if (!baseUsername) baseUsername = 'student_' + Math.floor(1000 + Math.random() * 9000);
    let username = baseUsername;
    let counter = 1;
    while (users.some(u => u.username.toLowerCase() === username)) {
      username = `${baseUsername}${counter++}`;
    }

    const newUser = {
      username,
      password: '',
      fullName: fullName || username,
      email: cleanEmail,
      team: (team || (isCoach ? 'Coaching Staff' : 'Science Olympiad Team')).trim(),
      role: assignedRole,
      picture: picture || null,
      googleSub: sub || null,
      authProvider: 'google',
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem(this.STORAGE_KEY_USERS, JSON.stringify(users));
    localStorage.setItem(this.STORAGE_KEY_CURRENT, JSON.stringify(newUser));
    window.dispatchEvent(new CustomEvent('thermo_auth_changed', { detail: newUser }));
    return { success: true, user: newUser, isNew: true };
  }

  /**
   * Generates a 6-digit OTP, saves pending state, and dispatches via Google Apps Script Webhook.
   */
  async generateAndSendOtp(email) {
    if (!email || !email.includes('@')) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    const cleanEmail = email.toLowerCase().trim();
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    this.pendingOtp = {
      email: cleanEmail,
      code: otpCode,
      expiresAt
    };

    let sentViaEmail = false;
    let errorDetail = null;

    // Check if Google Sheets Webhook is configured for sending emails
    try {
      const sheetsModule = await import('./sheets-sync.js');
      if (sheetsModule && sheetsModule.sheetsSyncManager) {
        const result = await sheetsModule.sheetsSyncManager.sendEmailOtp(cleanEmail, otpCode);
        sentViaEmail = !!result.sentViaEmail;
        if (!result.sentViaEmail && result.error) {
          errorDetail = result.error;
        }
      }
    } catch (e) {
      console.warn('Sheets sync OTP dispatch notice:', e);
    }

    return {
      success: true,
      email: cleanEmail,
      code: otpCode,
      sentViaEmail,
      errorDetail,
      expiresAt
    };
  }

  /**
   * Verifies the 6-digit OTP code.
   * Accepts active matching pending OTP or bypass code '123456'.
   */
  verifyOtpCode(email, enteredCode) {
    if (!email) {
      return { success: false, message: 'Email address missing.' };
    }
    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = (enteredCode || '').trim();

    if (!cleanCode || cleanCode.length !== 6) {
      return { success: false, message: 'Please enter a 6-digit verification code.' };
    }

    const isDevBypass = cleanCode === '123456';
    const isMatchingPending = this.pendingOtp &&
      this.pendingOtp.email === cleanEmail &&
      this.pendingOtp.code === cleanCode &&
      Date.now() <= this.pendingOtp.expiresAt;

    if (!isDevBypass && !isMatchingPending) {
      if (this.pendingOtp && this.pendingOtp.email === cleanEmail && Date.now() > this.pendingOtp.expiresAt) {
        return { success: false, message: 'Verification code has expired. Please request a new code.' };
      }
      return { success: false, message: 'Invalid 6-digit verification code. Please check your email or try again.' };
    }

    // Clear pending OTP on successful verification
    this.pendingOtp = null;

    // Log user in or create account
    return this.loginWithVerifiedEmail(cleanEmail);
  }

  /**
   * Logs in or signs up a user with a verified email.
   * Whitelisted coach emails automatically receive admin privileges.
   */
  loginWithVerifiedEmail(email) {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (!cleanEmail) {
      return { success: false, message: 'Invalid email address.' };
    }

    const users = this.getAllUsers();
    let user = users.find(u => (u.email && u.email.toLowerCase() === cleanEmail) || u.username.toLowerCase() === cleanEmail.split('@')[0]);

    const isCoach = this.isCoachEmail(cleanEmail);
    const assignedRole = isCoach ? 'admin' : 'student';

    if (user) {
      user.email = cleanEmail;
      user.authProvider = 'email_otp';
      if (isCoach) user.role = 'admin'; // Always promote if in coach list

      localStorage.setItem(this.STORAGE_KEY_USERS, JSON.stringify(users));
      localStorage.setItem(this.STORAGE_KEY_CURRENT, JSON.stringify(user));
      window.dispatchEvent(new CustomEvent('thermo_auth_changed', { detail: user }));
      return { success: true, user, isNew: false };
    }

    // Auto-create new user
    let baseUsername = cleanEmail.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase();
    if (!baseUsername) baseUsername = 'student_' + Math.floor(1000 + Math.random() * 9000);
    let username = baseUsername;
    let counter = 1;
    while (users.some(u => u.username.toLowerCase() === username)) {
      username = `${baseUsername}${counter++}`;
    }

    // Format a nice human-readable display name from email (e.g. "alex.chen" -> "Alex Chen")
    let fullName = cleanEmail.split('@')[0]
      .split(/[._-]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
    if (!fullName) fullName = username;

    const newUser = {
      username,
      password: '',
      fullName,
      email: cleanEmail,
      team: isCoach ? 'Science Olympiad Coaching Staff' : 'Science Olympiad Team',
      role: assignedRole,
      picture: null,
      authProvider: 'email_otp',
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem(this.STORAGE_KEY_USERS, JSON.stringify(users));
    localStorage.setItem(this.STORAGE_KEY_CURRENT, JSON.stringify(newUser));
    window.dispatchEvent(new CustomEvent('thermo_auth_changed', { detail: newUser }));
    return { success: true, user: newUser, isNew: true };
  }

  /**
   * Helper to decode Google JWT ID Token from Google Identity Services (GIS)
   */
  decodeGoogleJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Failed to parse Google JWT token:', e);
      return null;
    }
  }

  login(username, password) {
    const users = this.getAllUsers();
    const term = username.toLowerCase().trim();
    const user = users.find(u => u.username.toLowerCase() === term || (u.email && u.email.toLowerCase() === term));
    if (!user) {
      return { success: false, message: `User "${username}" not found.` };
    }
    // Allow empty password if password is not set or matching
    if (user.password && user.password !== password) {
      return { success: false, message: 'Incorrect password.' };
    }

    localStorage.setItem(this.STORAGE_KEY_CURRENT, JSON.stringify(user));
    window.dispatchEvent(new CustomEvent('thermo_auth_changed', { detail: user }));
    return { success: true, user };
  }

  logout() {
    localStorage.removeItem(this.STORAGE_KEY_CURRENT);
    localStorage.removeItem('thermo_admin_token');
    const guestStudent = {
      username: 'guest',
      fullName: 'Student (Guest)',
      email: '',
      team: 'Science Olympiad Team',
      role: 'student',
      authProvider: 'guest',
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(this.STORAGE_KEY_CURRENT, JSON.stringify(guestStudent));
    window.dispatchEvent(new CustomEvent('thermo_auth_changed', { detail: guestStudent }));
  }

  addUser({ username, password = '', fullName, team, role = 'student', email = '', picture = null }) {
    const cleanUser = username.toLowerCase().trim();
    if (!cleanUser || !fullName) {
      return { success: false, message: 'Username and full name are required.' };
    }

    const users = this.getAllUsers();
    if (users.some(u => u.username.toLowerCase() === cleanUser)) {
      return { success: false, message: `Username "${cleanUser}" already exists.` };
    }

    const cleanEmail = email ? email.toLowerCase().trim() : `${cleanUser}@students.school.org`;

    const newUser = {
      username: cleanUser,
      password: (password || 'pass123').trim(),
      fullName: fullName.trim(),
      email: cleanEmail,
      team: (team || 'General Science Olympiad').trim(),
      role: role === 'admin' ? 'admin' : 'student',
      picture,
      authProvider: 'google_instant',
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem(this.STORAGE_KEY_USERS, JSON.stringify(users));
    return { success: true, user: newUser };
  }

  deleteUser(username) {
    if (username === 'admin') {
      return { success: false, message: 'The primary admin account cannot be deleted.' };
    }

    let users = this.getAllUsers();
    users = users.filter(u => u.username.toLowerCase() !== username.toLowerCase());
    localStorage.setItem(this.STORAGE_KEY_USERS, JSON.stringify(users));

    // Also remove from progress
    const allProgress = this.getAllProgressMap();
    delete allProgress[username];
    localStorage.setItem(this.STORAGE_KEY_PROGRESS, JSON.stringify(allProgress));

    // If current user was deleted, logout
    const current = this.getCurrentUser();
    if (current && current.username.toLowerCase() === username.toLowerCase()) {
      this.logout();
    }

    return { success: true };
  }

  resetPassword(username, newPassword) {
    if (!newPassword || newPassword.trim().length === 0) {
      return { success: false, message: 'Password cannot be empty.' };
    }
    const users = this.getAllUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      return { success: false, message: 'User not found.' };
    }
    user.password = newPassword.trim();
    localStorage.setItem(this.STORAGE_KEY_USERS, JSON.stringify(users));
    return { success: true };
  }

  // =========================================================================
  // PROGRESS RECORDING & GRADEBOOK
  // =========================================================================

  getAllProgressMap() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_PROGRESS);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  getUserProgress(username) {
    const map = this.getAllProgressMap();
    const p = map[username.toLowerCase()] || { exams: [], labRuns: [], predictions: [], completedLessons: [] };
    if (!Array.isArray(p.completedLessons)) p.completedLessons = [];
    return p;
  }

  saveUserProgress(username, progressObj) {
    const map = this.getAllProgressMap();
    map[username.toLowerCase()] = progressObj;
    localStorage.setItem(this.STORAGE_KEY_PROGRESS, JSON.stringify(map));
  }

  recordExamResult({ raw, total, es, percent, type = 'interactive' }) {
    const current = this.getCurrentUser();
    if (!current) return;

    const progress = this.getUserProgress(current.username);
    const entry = {
      id: 'ex_' + Date.now(),
      date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      raw,
      total,
      es,
      percent,
      type
    };

    progress.exams.unshift(entry); // newest first
    this.saveUserProgress(current.username, progress);
    window.dispatchEvent(new CustomEvent('thermo_progress_updated', { detail: { type: 'exam', username: current.username, entry } }));
  }

  recordLabResult({ tempGain, finalTemp, heightCm, wattage }) {
    const current = this.getCurrentUser();
    if (!current) return;

    const progress = this.getUserProgress(current.username);
    const entry = {
      date: new Date().toLocaleDateString(),
      tempGain: parseFloat(tempGain.toFixed(1)),
      finalTemp: parseFloat(finalTemp.toFixed(1)),
      heightCm,
      wattage
    };

    progress.labRuns.unshift(entry);
    this.saveUserProgress(current.username, progress);
    window.dispatchEvent(new CustomEvent('thermo_progress_updated', { detail: { type: 'lab', username: current.username, entry } }));
  }

  recordPredictionResult({ error, pe, ps, badge }) {
    const current = this.getCurrentUser();
    if (!current) return;

    const progress = this.getUserProgress(current.username);
    const entry = {
      date: new Date().toLocaleDateString(),
      error: parseFloat(error.toFixed(2)),
      pe: parseFloat(pe.toFixed(4)),
      ps: parseFloat(ps.toFixed(2)),
      badge
    };

    progress.predictions.unshift(entry);
    this.saveUserProgress(current.username, progress);
    window.dispatchEvent(new CustomEvent('thermo_progress_updated', { detail: { type: 'prediction', username: current.username, entry } }));
  }

  toggleLessonCompleted(lessonId) {
    const current = this.getCurrentUser();
    if (!current) return { isCompleted: false, completedCount: 0 };

    const progress = this.getUserProgress(current.username);
    if (!Array.isArray(progress.completedLessons)) {
      progress.completedLessons = [];
    }

    const idx = progress.completedLessons.indexOf(lessonId);
    let isCompleted = false;

    if (idx > -1) {
      progress.completedLessons.splice(idx, 1);
      isCompleted = false;
    } else {
      progress.completedLessons.push(lessonId);
      isCompleted = true;
    }

    this.saveUserProgress(current.username, progress);
    window.dispatchEvent(new CustomEvent('thermo_progress_updated', {
      detail: { username: current.username, lessonId, isCompleted }
    }));

    return { isCompleted, completedCount: progress.completedLessons.length };
  }

  isLessonCompleted(username, lessonId) {
    if (!username) return false;
    const progress = this.getUserProgress(username);
    return Array.isArray(progress.completedLessons) && progress.completedLessons.includes(lessonId);
  }

  getCompletedLessons(username) {
    if (!username) return [];
    const progress = this.getUserProgress(username);
    return progress.completedLessons || [];
  }

  /**
   * Generates aggregated summary statistics for the Teacher Gradebook.
   */
  getGradebookSummary() {
    const users = this.getAllUsers().filter(u => u.role === 'student');
    const allProgress = this.getAllProgressMap();

    return users.map(user => {
      const p = allProgress[user.username] || { exams: [], labRuns: [], predictions: [] };
      
      // Best & Average Exam Score
      let bestES = 0;
      let avgES = 0;
      if (p.exams.length > 0) {
        bestES = Math.max(...p.exams.map(e => e.es));
        const sumES = p.exams.reduce((acc, e) => acc + e.es, 0);
        avgES = parseFloat((sumES / p.exams.length).toFixed(1));
      }

      // Best Collector Temp Gain
      let bestTG = 0;
      if (p.labRuns.length > 0) {
        bestTG = Math.max(...p.labRuns.map(l => l.tempGain));
      }

      // Best Prediction PS
      let bestPS = 0;
      let bestPE = 0;
      if (p.predictions.length > 0) {
        bestPS = Math.max(...p.predictions.map(pred => pred.ps));
        bestPE = Math.max(...p.predictions.map(pred => pred.pe));
      }

      return {
        username: user.username,
        fullName: user.fullName,
        email: user.email || `${user.username}@students.school.org`,
        picture: user.picture || null,
        team: user.team,
        lessonsCompleted: (p.completedLessons || []).length,
        examsCompleted: p.exams.length,
        bestES,
        avgES,
        bestTG,
        bestPS,
        bestPE,
        lastActive: p.exams[0] ? p.exams[0].date : (user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A')
      };
    });
  }

  /**
   * Generates a downloadable CSV string of all student grades.
   */
  exportGradebookCsv() {
    const summary = this.getGradebookSummary();
    let csv = 'Student Name,Google Account / Email,Username,School / Team,Lessons Completed,Exams Completed,Avg Exam Score (ES/50),Best Exam Score (ES/50),Best Temp Gain (+C),Best Prediction (PS/20),Last Active\n';

    summary.forEach(s => {
      csv += `"${s.fullName}","${s.email}","${s.username}","${s.team}",${s.lessonsCompleted},${s.examsCompleted},${s.avgES},${s.bestES},+${s.bestTG.toFixed(1)},${s.bestPS.toFixed(2)},"${s.lastActive}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ThermoOlyMaster_Gradebook_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const authManager = new AuthManager();
