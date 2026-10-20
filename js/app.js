/**
 * ThermoOlyMaster - Main Application Orchestrator
 * Connects all modules, tab routing, notifications, authentication, and top-bar telemetry.
 */

import { CollectorLab } from './collector-lab.js';
import { PredictorArena } from './predictor-arena.js';
import { ExamArena } from './exam-arena.js';
import { PhysicsLab } from './physics-lab.js';
import { ScoreCalculator } from './score-calc.js';
import { BinderHub } from './binder-hub.js';
import { TestPrinter } from './test-printer.js';
import { TestScanner } from './test-scanner.js';
import { authManager } from './auth-manager.js';
import { AdminDashboard } from './admin-dashboard.js';
import { lessonsHub } from './lessons-hub.js';
import { sheetsSyncManager } from './sheets-sync.js';
import { themeManager } from './theme-manager.js';

class AppController {
  constructor() {
    this.currentTab = 'collector';
    this.collectorLab = null;
    this.predictorArena = null;
    this.examArena = null;
    this.physicsLab = null;
    this.scoreCalc = null;
    this.binderHub = null;
    this.testPrinter = null;
    this.testScanner = null;
    this.adminDashboard = null;
    this.lessonsHub = null;
    this.sheetsSync = null;
    this.themeManager = null;
  }

  init() {
    window.authManager = authManager;
    window.sheetsSyncManager = sheetsSyncManager;
    window.themeManager = themeManager;
    this.themeManager = themeManager;
    this.themeManager.init();

    this.setupToastSystem();
    this.initModules();
    this.setupTabNavigation();
    this.setupQuickStats();
    this.setupAuthUI();

    window.showToast('Welcome to ThermoOlyMaster! Science Olympiad 2027 Division B ready.', 'info');
  }

  setupToastSystem() {
    window.showToast = (message, type = 'info') => {
      const container = document.getElementById('toastContainer');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      
      let icon = 'ℹ️';
      if (type === 'success') icon = '✅';
      else if (type === 'warning') icon = '⚠️';
      else if (type === 'error') icon = '❌';

      toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
      container.appendChild(toast);

      setTimeout(() => {
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        setTimeout(() => toast.remove(), 300);
      }, 4000);
    };
  }

  initModules() {
    // 1. Collector Lab
    this.collectorLab = new CollectorLab('collectorCanvas');
    this.collectorLab.init();

    // 2. Predictor Arena
    this.predictorArena = new PredictorArena();
    this.predictorArena.init();

    // 3. Exam Arena
    this.examArena = new ExamArena();
    this.examArena.init();

    // 4. Physics Lab
    this.physicsLab = new PhysicsLab();
    this.physicsLab.init();

    // 5. Standalone Score Calculator
    this.scoreCalc = new ScoreCalculator();
    this.scoreCalc.init();

    // 6. Binder Hub
    this.binderHub = new BinderHub();
    this.binderHub.init();

    // 7. Test Printer
    this.testPrinter = new TestPrinter();
    this.setupPrintCenter();

    // 8. Test Scanner (OMR Grader)
    this.testScanner = new TestScanner();
    this.testScanner.init();

    // 9. Classroom Administration & Student Gradebook
    this.adminDashboard = new AdminDashboard();
    this.adminDashboard.init();

    // 10. Interactive Curriculum & Lessons Hub
    this.lessonsHub = lessonsHub;
    this.lessonsHub.init();

    // 11. Google Sheets Live Progress & Score Storage Engine
    this.sheetsSync = sheetsSyncManager;
    this.sheetsSync.init();

    // 12. Exam Sub-Navigation (Interactive vs Print vs Scan)
    this.setupExamSubNavigation();
  }

  setupPrintCenter() {
    const getCount = () => {
      const el = document.getElementById('printQCountSelect');
      return el ? parseInt(el.value, 10) : 20;
    };

    const btnPacket = document.getElementById('btnPrintFullPacket');
    const btnBubble = document.getElementById('btnPrintBubbleOnly');
    const btnBooklet = document.getElementById('btnPrintBookletOnly');
    const btnKey = document.getElementById('btnPrintKeyOnly');

    if (btnPacket) {
      btnPacket.addEventListener('click', () => {
        this.testPrinter.printFullCompetitionPacket(getCount());
      });
    }
    if (btnBubble) {
      btnBubble.addEventListener('click', () => {
        this.testPrinter.printBubbleSheetOnly(getCount());
      });
    }
    if (btnBooklet) {
      btnBooklet.addEventListener('click', () => {
        this.testPrinter.printTestBookletOnly(getCount());
      });
    }
    if (btnKey) {
      btnKey.addEventListener('click', () => {
        this.testPrinter.printAnswerKeyOnly(getCount());
      });
    }
  }

  setupExamSubNavigation() {
    const subButtons = [
      { btnId: 'subTabExamInteractive', viewId: 'examModeInteractive' },
      { btnId: 'subTabExamPrint', viewId: 'examModePrint' },
      { btnId: 'subTabExamScan', viewId: 'examModeScan' }
    ];

    subButtons.forEach(({ btnId, viewId }) => {
      const btn = document.getElementById(btnId);
      if (!btn) return;

      btn.addEventListener('click', () => {
        // Toggle active button
        subButtons.forEach(item => {
          const b = document.getElementById(item.btnId);
          const v = document.getElementById(item.viewId);
          if (b) b.classList.toggle('active', item.btnId === btnId);
          if (v) v.style.display = item.btnId === btnId ? 'block' : 'none';
        });
      });
    });
  }

  setupTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tab-btn');
    const sections = document.querySelectorAll('.view-section');
    const sidebar = document.getElementById('appSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const activeLabel = document.getElementById('topbarActiveViewLabel');

    const updateActiveLabel = (tab) => {
      if (!activeLabel || !tab) return;
      const icon = tab.querySelector('.nav-icon')?.textContent || '';
      const text = tab.querySelector('.nav-text')?.textContent || tab.textContent.trim();
      activeLabel.innerHTML = `<span>${icon}</span> <span>${text}</span>`;
    };

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetViewId = tab.getAttribute('data-target');
        if (!targetViewId) return;

        // If target is view-admin and user is not admin, open login dialog
        if (targetViewId === 'view-admin' && !authManager.isAdmin()) {
          if (window.showToast) {
            window.showToast('Please sign in as Coach / Admin to access Classroom Administration.', 'warning');
          }
          const modal = document.getElementById('modalAuthLogin');
          if (modal) modal.style.display = 'flex';
          return;
        }

        // Switch active tab button
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Switch active section view
        sections.forEach(sec => {
          if (sec.id === targetViewId) {
            sec.classList.add('active');
          } else {
            sec.classList.remove('active');
          }
        });

        // Update topbar breadcrumb label
        updateActiveLabel(tab);

        // Close mobile drawer if open
        if (sidebar && sidebar.classList.contains('sidebar-open')) {
          sidebar.classList.remove('sidebar-open');
        }
        if (backdrop && backdrop.classList.contains('active')) {
          backdrop.classList.remove('active');
        }

        // Trigger resize for canvases inside the active section
        if (targetViewId === 'view-collector' && this.collectorLab) {
          this.collectorLab.resizeCanvas();
        } else if (targetViewId === 'view-physics' && this.physicsLab) {
          this.physicsLab.resizeCanvases();
        }
      });
    });

    // Mobile Sidebar Drawer Toggle & Backdrop Click
    const btnToggle = document.getElementById('btnToggleMobileSidebar');
    const btnClose = document.getElementById('btnCloseMobileSidebar');

    if (btnToggle && sidebar) {
      btnToggle.addEventListener('click', () => {
        sidebar.classList.toggle('sidebar-open');
        if (backdrop) backdrop.classList.toggle('active', sidebar.classList.contains('sidebar-open'));
      });
    }

    if (btnClose && sidebar) {
      btnClose.addEventListener('click', () => {
        sidebar.classList.remove('sidebar-open');
        if (backdrop) backdrop.classList.remove('active');
      });
    }

    if (backdrop && sidebar) {
      backdrop.addEventListener('click', () => {
        sidebar.classList.remove('sidebar-open');
        backdrop.classList.remove('active');
      });
    }

    // Set initial breadcrumb label
    const initialActiveTab = document.querySelector('.nav-tab-btn.active');
    if (initialActiveTab) {
      updateActiveLabel(initialActiveTab);
    }
  }

  setupAuthUI() {
    const badgeBtn = document.getElementById('navbarUserBadge');
    const modalLogin = document.getElementById('modalAuthLogin');
    const btnCloseLogin = document.getElementById('modalAuthLoginClose');
    const formLogin = document.getElementById('formAuthLogin');
    const btnLogout = document.getElementById('btnDoLogout');
    const quickGrid = document.getElementById('quickSwitchRoster');
    const errorMsg = document.getElementById('loginErrorMsg');
    const statusText = document.getElementById('currentLoggedInStatus');

    // Google Instant Modal elements
    const btnGoogleInstant = document.getElementById('btnGoogleInstantLogin');
    const btnQuickAddGoogle = document.getElementById('btnQuickAddGoogleUser');
    const modalGoogleInstant = document.getElementById('modalGoogleInstant');
    const btnCloseGoogleInstant = document.getElementById('modalGoogleInstantClose');
    const btnCancelGoogleInstant = document.getElementById('modalGoogleInstantCancel');
    const formGoogleInstant = document.getElementById('formGoogleInstant');

    // Email OTP Elements
    const authStepEmail = document.getElementById('authStepEmail');
    const authStepOtp = document.getElementById('authStepOtp');
    const formSendOtp = document.getElementById('formSendOtp');
    const inputOtpEmail = document.getElementById('inputOtpEmail');
    const btnSendOtp = document.getElementById('btnSendOtp');
    const otpSentToEmail = document.getElementById('otpSentToEmail');
    const formVerifyOtp = document.getElementById('formVerifyOtp');
    const inputOtpCode = document.getElementById('inputOtpCode');
    const btnSubmitOtp = document.getElementById('btnSubmitOtp');
    const btnResendOtp = document.getElementById('btnResendOtp');
    const btnBackToEmailStep = document.getElementById('btnBackToEmailStep');
    const otpErrorMsg = document.getElementById('otpErrorMsg');
    const testModeOtpNotice = document.getElementById('testModeOtpNotice');
    const testModeOtpCode = document.getElementById('testModeOtpCode');

    let resendTimer = null;
    let resendSeconds = 0;
    let activeOtpEmail = '';

    const startResendCountdown = () => {
      if (resendTimer) clearInterval(resendTimer);
      resendSeconds = 30;
      if (btnResendOtp) {
        btnResendOtp.disabled = true;
        btnResendOtp.textContent = `Resend Code (${resendSeconds}s)`;
      }
      resendTimer = setInterval(() => {
        resendSeconds--;
        if (resendSeconds <= 0) {
          clearInterval(resendTimer);
          resendTimer = null;
          if (btnResendOtp) {
            btnResendOtp.disabled = false;
            btnResendOtp.textContent = 'Resend Code';
          }
        } else if (btnResendOtp) {
          btnResendOtp.textContent = `Resend Code (${resendSeconds}s)`;
        }
      }, 1000);
    };

    const showEmailStep = () => {
      if (authStepEmail) authStepEmail.style.display = 'block';
      if (authStepOtp) authStepOtp.style.display = 'none';
      if (otpErrorMsg) otpErrorMsg.style.display = 'none';
      if (inputOtpEmail) inputOtpEmail.focus();
    };

    const showOtpStep = (email, code, sentViaEmail) => {
      activeOtpEmail = email;
      if (authStepEmail) authStepEmail.style.display = 'none';
      if (authStepOtp) authStepOtp.style.display = 'block';
      if (otpSentToEmail) otpSentToEmail.textContent = email;
      if (inputOtpCode) {
        inputOtpCode.value = '';
        inputOtpCode.focus();
      }
      if (otpErrorMsg) otpErrorMsg.style.display = 'none';

      if (testModeOtpNotice && testModeOtpCode) {
        testModeOtpCode.textContent = code || '123456';
        testModeOtpNotice.style.display = 'block';
      }

      startResendCountdown();
    };

    if (formSendOtp) {
      formSendOtp.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = (inputOtpEmail?.value || '').trim();
        if (!email) return;

        if (btnSendOtp) {
          btnSendOtp.disabled = true;
          btnSendOtp.innerHTML = '<span>⏳</span> Sending Code...';
        }

        try {
          const res = await authManager.generateAndSendOtp(email);
          if (res.success) {
            showOtpStep(res.email, res.code, res.sentViaEmail);
            if (res.sentViaEmail) {
              if (window.showToast) window.showToast(`Verification code sent to ${res.email}! Check your inbox.`, 'success');
            } else {
              if (window.showToast) window.showToast(`Demo/Test code generated for ${res.email}!`, 'info');
            }
          } else {
            if (window.showToast) window.showToast(res.message, 'error');
          }
        } catch (err) {
          if (window.showToast) window.showToast('Failed to send verification code: ' + err.message, 'error');
        } finally {
          if (btnSendOtp) {
            btnSendOtp.disabled = false;
            btnSendOtp.innerHTML = '<span>📨</span> Send 6-Digit Verification Code';
          }
        }
      });
    }

    if (formVerifyOtp) {
      formVerifyOtp.addEventListener('submit', (e) => {
        e.preventDefault();
        const code = (inputOtpCode?.value || '').trim();
        if (!activeOtpEmail || !code) return;

        const res = authManager.verifyOtpCode(activeOtpEmail, code);
        if (res.success) {
          if (modalLogin) modalLogin.style.display = 'none';
          showEmailStep();
          if (window.showToast) {
            window.showToast(`Welcome, ${res.user.fullName}! Signed in as ${res.user.role === 'admin' ? 'Coach' : 'Student'} (${res.user.email}).`, 'success');
          }
        } else {
          if (otpErrorMsg) {
            otpErrorMsg.textContent = res.message;
            otpErrorMsg.style.display = 'block';
          }
        }
      });
    }

    if (btnBackToEmailStep) {
      btnBackToEmailStep.addEventListener('click', () => {
        showEmailStep();
      });
    }

    if (btnResendOtp) {
      btnResendOtp.addEventListener('click', async () => {
        if (!activeOtpEmail || btnResendOtp.disabled) return;
        btnResendOtp.disabled = true;
        btnResendOtp.textContent = 'Sending...';

        const res = await authManager.generateAndSendOtp(activeOtpEmail);
        if (res.success) {
          if (testModeOtpCode) testModeOtpCode.textContent = res.code;
          startResendCountdown();
          if (window.showToast) window.showToast(`New code sent to ${activeOtpEmail}!`, 'success');
        } else {
          btnResendOtp.disabled = false;
          btnResendOtp.textContent = 'Resend Code';
          if (window.showToast) window.showToast(res.message, 'error');
        }
      });
    }

    // 1. Google Identity Services (GIS) Official OAuth Setup
    const initGoogleGIS = () => {
      const clientId = authManager.getGoogleClientId();
      const btnDiv = document.getElementById('googleSignInButtonDiv');

      if (!clientId) {
        if (btnDiv) btnDiv.innerHTML = '';
        return;
      }

      if (window.google && window.google.accounts && window.google.accounts.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response) => {
              if (response && response.credential) {
                const payload = authManager.decodeGoogleJwt(response.credential);
                if (payload && payload.email) {
                  const res = authManager.loginWithGoogleProfile({
                    email: payload.email,
                    fullName: payload.name || payload.given_name || payload.email.split('@')[0],
                    picture: payload.picture || null,
                    sub: payload.sub
                  });

                  if (res.success) {
                    if (modalLogin) modalLogin.style.display = 'none';
                    if (window.showToast) {
                      window.showToast(`Welcome, ${res.user.fullName}! Signed in via Google (${res.user.email}).`, 'success');
                    }
                  }
                }
              }
            }
          });

          if (btnDiv) {
            btnDiv.innerHTML = '';
            window.google.accounts.id.renderButton(btnDiv, {
              theme: 'outline',
              size: 'large',
              type: 'standard',
              shape: 'pill',
              text: 'signin_with',
              width: 320
            });
          }
        } catch (err) {
          console.warn('Google Identity Services init warning:', err);
        }
      } else {
        // Retry shortly if GIS script is still loading
        setTimeout(initGoogleGIS, 800);
      }
    };

    initGoogleGIS();
    window.addEventListener('thermo_google_config_changed', () => initGoogleGIS());

    // 2. Instant Google School Mode Modal Handlers
    const openInstantModal = () => {
      if (modalGoogleInstant) {
        modalGoogleInstant.style.display = 'flex';
        const inputName = document.getElementById('googleInstantFullName');
        if (inputName) inputName.focus();
      }
    };

    const closeInstantModal = () => {
      if (modalGoogleInstant) modalGoogleInstant.style.display = 'none';
      if (formGoogleInstant) formGoogleInstant.reset();
    };

    if (btnGoogleInstant) btnGoogleInstant.addEventListener('click', openInstantModal);
    if (btnQuickAddGoogle) btnQuickAddGoogle.addEventListener('click', openInstantModal);
    if (btnCloseGoogleInstant) btnCloseGoogleInstant.addEventListener('click', closeInstantModal);
    if (btnCancelGoogleInstant) btnCancelGoogleInstant.addEventListener('click', closeInstantModal);

    if (formGoogleInstant) {
      formGoogleInstant.addEventListener('submit', (e) => {
        e.preventDefault();
        const fullName = document.getElementById('googleInstantFullName')?.value || '';
        const email = document.getElementById('googleInstantEmail')?.value || '';
        const team = document.getElementById('googleInstantTeam')?.value || '';
        const role = document.getElementById('googleInstantRole')?.value || 'student';

        const res = authManager.loginWithGoogleProfile({
          email,
          fullName,
          team,
          role
        });

        if (res.success) {
          closeInstantModal();
          if (modalLogin) modalLogin.style.display = 'none';
          if (window.showToast) {
            window.showToast(`Welcome, ${res.user.fullName}! Signed in as ${res.user.role === 'admin' ? 'Coach' : 'Student'} (${res.user.email}).`, 'success');
          }
        } else {
          if (window.showToast) window.showToast(res.message, 'error');
        }
      });
    }

    // 3. User Badge UI Updates
    const updateBadge = () => {
      const user = authManager.getCurrentUser();
      const elName = document.getElementById('navUserName');
      const elRole = document.getElementById('navUserRole');
      const elAvatar = document.getElementById('navUserAvatar');
      const tabAdmin = document.getElementById('navTabAdmin');

      if (user) {
        if (elName) elName.textContent = user.fullName;
        if (elRole) elRole.textContent = user.role === 'admin' ? 'Coach / Admin' : 'Student';
        if (statusText) statusText.textContent = `Signed in as: ${user.fullName} (${user.role === 'admin' ? 'Coach' : 'Student'})`;
        
        if (elAvatar) {
          if (user.picture) {
            elAvatar.innerHTML = `<img src="${user.picture}" class="nav-avatar-img" alt="${user.fullName}" />`;
          } else {
            elAvatar.textContent = user.role === 'admin' ? '👨‍🏫' : '🎓';
          }
        }
        
        if (tabAdmin) {
          tabAdmin.style.opacity = user.role === 'admin' ? '1' : '0.6';
          tabAdmin.title = user.role === 'admin' ? 'Classroom Administration' : 'Classroom Admin (Requires Coach)';
        }
      } else {
        if (elName) elName.textContent = 'Guest (Sign In)';
        if (elRole) elRole.textContent = 'Not Logged In';
        if (elAvatar) elAvatar.textContent = '👤';
        if (statusText) statusText.textContent = 'Not currently signed in.';
        if (tabAdmin) {
          tabAdmin.style.opacity = '0.6';
        }
      }
    };

    // 4. Quick Classroom Roster Switcher (1-Click Passwordless)
    const populateQuickSwitcher = () => {
      if (!quickGrid) return;
      const users = authManager.getAllUsers();
      const current = authManager.getCurrentUser();
      quickGrid.innerHTML = '';

      users.forEach(u => {
        const chip = document.createElement('div');
        chip.className = `user-switch-chip ${current && current.username === u.username ? 'active' : ''}`;
        
        const avatar = u.picture 
          ? `<img src="${u.picture}" class="user-avatar-img" alt="${u.fullName}" />`
          : `<span style="font-size:1.25rem;">${u.role === 'admin' ? '👨‍🏫' : '🎓'}</span>`;

        chip.innerHTML = `
          ${avatar}
          <div style="overflow:hidden; flex:1;">
            <span class="switch-chip-name" style="white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${u.fullName}</span>
            <span class="switch-chip-email">${u.email || u.username}</span>
            <span class="switch-chip-role">${u.role.toUpperCase()} • 1-Click</span>
          </div>
        `;

        chip.addEventListener('click', () => {
          const res = authManager.loginPasswordless(u.username);
          if (res.success) {
            if (modalLogin) modalLogin.style.display = 'none';
            if (errorMsg) errorMsg.style.display = 'none';
            if (window.showToast) {
              window.showToast(`Switched account to ${u.fullName} (${u.role === 'admin' ? 'Coach' : 'Student'})`, 'success');
            }
          }
        });

        quickGrid.appendChild(chip);
      });
    };

    if (badgeBtn) {
      badgeBtn.addEventListener('click', () => {
        showEmailStep();
        populateQuickSwitcher();
        if (modalLogin) {
          modalLogin.style.display = 'flex';
        }
      });
    }

    if (btnCloseLogin && modalLogin) {
      btnCloseLogin.addEventListener('click', () => {
        modalLogin.style.display = 'none';
        if (errorMsg) errorMsg.style.display = 'none';
        if (otpErrorMsg) otpErrorMsg.style.display = 'none';
      });
    }

    // 5. Fallback Manual Login Form
    if (formLogin) {
      formLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        const res = authManager.login(username, password);
        if (res.success) {
          if (modalLogin) modalLogin.style.display = 'none';
          if (errorMsg) errorMsg.style.display = 'none';
          formLogin.reset();
          if (window.showToast) {
            window.showToast(`Logged in as ${res.user.fullName} (${res.user.role === 'admin' ? 'Coach' : 'Student'})`, 'success');
          }
        } else {
          if (errorMsg) {
            errorMsg.textContent = res.message;
            errorMsg.style.display = 'block';
          }
        }
      });
    }

    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        authManager.logout();
        if (modalLogin) modalLogin.style.display = 'none';
        if (window.showToast) {
          window.showToast('Logged out of system.', 'info');
        }
      });
    }

    window.addEventListener('thermo_auth_changed', () => {
      updateBadge();
      populateQuickSwitcher();
    });

    updateBadge();
  }

  setupQuickStats() {
    // Update topbar quick stats on events or intervals
    const updateStats = () => {
      const topES = document.getElementById('topStatES');
      const topTS = document.getElementById('topStatTS');
      const topPS = document.getElementById('topStatPS');
      const topFS = document.getElementById('topStatFS');

      let es = 0;
      let ts = 0;
      let ps = 0;

      if (this.examArena && this.examArena.isExamSubmitted) {
        let raw = 0;
        this.examArena.questions.forEach((q, i) => {
          if (this.examArena.userAnswers[i] === q.correct) raw++;
        });
        es = parseFloat(((raw / this.examArena.questions.length) * 50).toFixed(1));
      } else {
        es = 42.5; // default preview benchmark
      }

      if (this.collectorLab) {
        const tg = Math.max(0, this.collectorLab.T_water - this.collectorLab.T_start);
        ts = parseFloat(Math.min(30, (tg / 25.0) * 30).toFixed(1));
      }

      if (this.predictorArena && this.predictorArena.lastResult) {
        ps = parseFloat(this.predictorArena.lastResult.scores.predictionScore.toFixed(1));
      } else {
        ps = 18.2; // default preview benchmark
      }

      const fs = (es + ts + ps).toFixed(1);

      if (topES) topES.textContent = `${es}/50`;
      if (topTS) topTS.textContent = `${ts}/30`;
      if (topPS) topPS.textContent = `${ps}/20`;
      if (topFS) topFS.textContent = `${fs}/100`;
    };

    setInterval(updateStats, 2000);
    updateStats();
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new AppController();
  app.init();
});
