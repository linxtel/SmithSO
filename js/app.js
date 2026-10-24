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
import { kahootManager } from './kahoot-manager.js';

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
    this.kahootManager = null;
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
    this.updateRoleBoundaries();

    authManager.checkUrlMagicLink().then(res => {
      if (res && res.success) {
        this.updateRoleBoundaries();
        if (window.showToast) {
          window.showToast(`Welcome, Coach ${res.user.fullName}! Signed in via Magic Link.`, 'success');
        }
      }
    });

    window.showToast('Welcome to ThermoOlyMaster! Science Olympiad 2027 Division B ready.', 'info');
  }

  updateRoleBoundaries() {
    const isCoachOrAdmin = authManager.isCoachOrAdmin();

    // 1. Sidebar Classroom Admin Tab: hidden completely from students
    const tabAdmin = document.getElementById('navTabAdmin');
    if (tabAdmin) {
      tabAdmin.style.display = isCoachOrAdmin ? 'flex' : 'none';
    }

    // 2. Test Printer Supervisor Answer Key Button: hidden from students
    const btnKey = document.getElementById('btnPrintKeyOnly');
    if (btnKey) {
      btnKey.style.display = isCoachOrAdmin ? 'block' : 'none';
    }

    // 3. Test Printer Full Packet Button text
    const btnPacket = document.getElementById('btnPrintFullPacket');
    if (btnPacket) {
      btnPacket.innerHTML = isCoachOrAdmin 
        ? '<span>📦</span> Print Complete Packet (Test Booklet + Bubble Sheet + Key)' 
        : '<span>📦</span> Print Student Test Packet (Test Booklet + Bubble Sheet)';
    }

    // 4. Kahoot Host Screen (Projector) button: hidden from students
    const btnKahootHost = document.getElementById('kahootBtnRoleHost');
    if (btnKahootHost) {
      btnKahootHost.style.display = isCoachOrAdmin ? 'inline-block' : 'none';
    }

    // 5. If student lands on view-admin, redirect to predictor
    const secAdmin = document.getElementById('view-admin');
    if (secAdmin && secAdmin.classList.contains('active') && !isCoachOrAdmin) {
      const tabPred = document.querySelector('.nav-tab-btn[data-target="view-predictor"]');
      if (tabPred) tabPred.click();
    }
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

    // 12. Live Online Kahoot Competition Arena
    this.kahootManager = kahootManager;
    this.kahootManager.init();

    // 13. Exam Sub-Navigation (Interactive vs Kahoot vs Print vs Scan)
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
      { btnId: 'subTabExamKahoot', viewId: 'examModeKahoot' },
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
    const btnToggleSidebar = document.getElementById('btnToggleSidebar') || document.getElementById('btnToggleMobileSidebar');
    const sidebarTooltip = document.getElementById('sidebarFloatingTooltip');

    const updateActiveLabel = (tab) => {
      if (!activeLabel || !tab) return;
      const icon = tab.querySelector('.nav-icon')?.textContent || '';
      const text = tab.querySelector('.nav-text')?.textContent || tab.textContent.trim();
      activeLabel.innerHTML = `<span>${icon}</span> <span>${text}</span>`;
    };

    const triggerResize = () => {
      window.dispatchEvent(new Event('resize'));
      if (this.collectorLab && typeof this.collectorLab.resizeCanvas === 'function') {
        this.collectorLab.resizeCanvas();
      }
      if (this.physicsLab && typeof this.physicsLab.resizeCanvases === 'function') {
        this.physicsLab.resizeCanvases();
      }
    };

    const isSidebarExpanded = () => {
      if (!sidebar) return false;
      return sidebar.classList.contains('expanded') || sidebar.classList.contains('sidebar-open');
    };

    const setSidebarExpanded = (expanded) => {
      if (!sidebar) return;
      sidebar.classList.toggle('expanded', expanded);
      sidebar.classList.toggle('sidebar-open', expanded);

      if (btnToggleSidebar) {
        btnToggleSidebar.classList.toggle('active', expanded);
        btnToggleSidebar.setAttribute('title', expanded ? 'Collapse navigation menu' : 'Expand navigation menu');
        btnToggleSidebar.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      }

      // Backdrop only active on mobile screens when expanded
      if (backdrop) {
        if (window.innerWidth <= 768 && expanded) {
          backdrop.classList.add('active');
        } else {
          backdrop.classList.remove('active');
        }
      }

      if (sidebarTooltip && expanded) {
        sidebarTooltip.classList.remove('visible');
      }

      try {
        localStorage.setItem('smithso_sidebar_expanded', expanded ? 'true' : 'false');
      } catch (e) {}

      // Trigger resize immediately and after transition completes
      triggerResize();
      setTimeout(triggerResize, 310);
    };

    const toggleSidebar = () => {
      setSidebarExpanded(!isSidebarExpanded());
    };

    // Restore saved state (default to collapsed icon rail)
    try {
      const saved = localStorage.getItem('smithso_sidebar_expanded');
      if (saved === 'true') {
        setSidebarExpanded(true);
      } else {
        setSidebarExpanded(false);
      }
    } catch (e) {
      setSidebarExpanded(false);
    }

    // Toggle button handler
    if (btnToggleSidebar) {
      btnToggleSidebar.addEventListener('click', toggleSidebar);
    }

    // Backdrop click on mobile closes menu
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        setSidebarExpanded(false);
      });
    }

    // Tab navigation clicks
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetViewId = tab.getAttribute('data-target');
        if (!targetViewId) return;

        // If target is view-admin and user is not coach or admin, block and open Coach login modal
        if (targetViewId === 'view-admin' && !authManager.isCoachOrAdmin()) {
          if (window.showToast) {
            window.showToast('Classroom Administration is reserved for Coaches and Administrators.', 'warning');
          }
          const modal = document.getElementById('modalAuthLogin');
          const tabCoach = document.getElementById('authTabCoach');
          if (tabCoach) tabCoach.click();
          if (modal) modal.style.display = 'flex';
          return;
        }

        // If target is view-kahoot, switch to view-exam and trigger Kahoot subtab
        if (targetViewId === 'view-kahoot') {
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          sections.forEach(sec => {
            sec.classList.toggle('active', sec.id === 'view-exam');
          });
          const subKahoot = document.getElementById('subTabExamKahoot');
          if (subKahoot) subKahoot.click();
          updateActiveLabel(tab);
          if (window.innerWidth <= 768) {
            setSidebarExpanded(false);
          }
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

        // On mobile only, auto-close the drawer when navigating
        if (window.innerWidth <= 768) {
          setSidebarExpanded(false);
        }

        // Trigger resize for canvases inside the active section
        if (targetViewId === 'view-collector' && this.collectorLab) {
          this.collectorLab.resizeCanvas();
        } else if (targetViewId === 'view-physics' && this.physicsLab) {
          this.physicsLab.resizeCanvases();
        }
      });
    });

    // Floating Tooltips for Collapsed Sidebar Navigation Items (in Icon Rail)
    if (sidebarTooltip && sidebar) {
      const tooltipElements = sidebar.querySelectorAll('[data-tooltip]');
      tooltipElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
          if (isSidebarExpanded() || window.innerWidth <= 768) return;
          const text = el.getAttribute('data-tooltip');
          if (!text) return;
          sidebarTooltip.textContent = text;
          sidebarTooltip.classList.add('visible');
          const rect = el.getBoundingClientRect();
          const tipRect = sidebarTooltip.getBoundingClientRect();
          const top = rect.top + (rect.height - tipRect.height) / 2;
          const left = rect.right + 10;
          sidebarTooltip.style.top = `${Math.max(8, top)}px`;
          sidebarTooltip.style.left = `${left}px`;
        });

        el.addEventListener('mouseleave', () => {
          sidebarTooltip.classList.remove('visible');
        });

        el.addEventListener('click', () => {
          sidebarTooltip.classList.remove('visible');
        });
      });
    }

    window.addEventListener('resize', () => {
      triggerResize();
      if ((window.innerWidth <= 768 || isSidebarExpanded()) && sidebarTooltip) {
        sidebarTooltip.classList.remove('visible');
      }
      if (window.innerWidth > 768 && backdrop) {
        backdrop.classList.remove('active');
      }
    });

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
    const btnLogout = document.getElementById('btnDoLogout');
    const quickGrid = document.getElementById('quickSwitchRoster');
    const statusText = document.getElementById('currentLoggedInStatus');

    // Tab switcher elements inside modal
    const authTabStudent = document.getElementById('authTabStudent');
    const authTabCoach = document.getElementById('authTabCoach');
    const authStudentPanel = document.getElementById('authStudentPanel');
    const authCoachPanel = document.getElementById('authCoachPanel');

    // Switch between Student and Coach/Admin modal tabs
    const switchToStudentTab = () => {
      if (authTabStudent) authTabStudent.classList.add('active');
      if (authTabCoach) authTabCoach.classList.remove('active');
      if (authStudentPanel) authStudentPanel.style.display = 'block';
      if (authCoachPanel) authCoachPanel.style.display = 'none';
    };

    const switchToCoachTab = () => {
      if (authTabCoach) authTabCoach.classList.add('active');
      if (authTabStudent) authTabStudent.classList.remove('active');
      if (authCoachPanel) authCoachPanel.style.display = 'block';
      if (authStudentPanel) authStudentPanel.style.display = 'none';
      const pwdInput = document.getElementById('inputAdminPassword');
      if (pwdInput) pwdInput.focus();
    };

    if (authTabStudent) authTabStudent.addEventListener('click', switchToStudentTab);
    if (authTabCoach) authTabCoach.addEventListener('click', switchToCoachTab);

    // Google Instant Modal elements
    const btnGoogleInstant = document.getElementById('btnGoogleInstantLogin');
    const btnQuickAddGoogle = document.getElementById('btnQuickAddGoogleUser');
    const modalGoogleInstant = document.getElementById('modalGoogleInstant');
    const btnCloseGoogleInstant = document.getElementById('modalGoogleInstantClose');
    const btnCancelGoogleInstant = document.getElementById('modalGoogleInstantCancel');
    const formGoogleInstant = document.getElementById('formGoogleInstant');

    // =========================================================================
    // 1. Admin Password Authentication
    // =========================================================================
    const formAdminLogin = document.getElementById('formAdminLogin');
    const inputAdminPassword = document.getElementById('inputAdminPassword');
    const btnAdminLogin = document.getElementById('btnAdminLogin');
    const adminLoginError = document.getElementById('adminLoginError');

    if (formAdminLogin) {
      formAdminLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pwd = (inputAdminPassword?.value || '').trim();
        if (!pwd) return;

        if (btnAdminLogin) {
          btnAdminLogin.disabled = true;
          btnAdminLogin.innerHTML = '<span>⏳</span> Verifying...';
        }
        if (adminLoginError) adminLoginError.style.display = 'none';

        try {
          const res = await authManager.loginAdmin(pwd);
          if (res.success) {
            formAdminLogin.reset();
            if (modalLogin) modalLogin.style.display = 'none';
            this.updateRoleBoundaries();
            if (window.showToast) {
              window.showToast('Welcome, Administrator! Full Coaching Staff controls unlocked.', 'success');
            }
          } else {
            if (adminLoginError) {
              adminLoginError.textContent = res.message || 'Incorrect Admin password.';
              adminLoginError.style.display = 'block';
            }
          }
        } catch (err) {
          if (adminLoginError) {
            adminLoginError.textContent = 'Connection error: ' + err.message;
            adminLoginError.style.display = 'block';
          }
        } finally {
          if (btnAdminLogin) {
            btnAdminLogin.disabled = false;
            btnAdminLogin.innerHTML = '<span>🔓</span> Sign In as Administrator';
          }
        }
      });
    }

    // =========================================================================
    // 2. Coach Email OTP & Magic Link Flow
    // =========================================================================
    const coachStepEmail = document.getElementById('coachStepEmail');
    const coachStepOtp = document.getElementById('coachStepOtp');
    const formSendCoachOtp = document.getElementById('formSendCoachOtp');
    const inputCoachEmail = document.getElementById('inputCoachEmail');
    const btnSendCoachOtp = document.getElementById('btnSendCoachOtp');
    const coachRequestErrorMsg = document.getElementById('coachRequestErrorMsg');

    const formVerifyCoachOtp = document.getElementById('formVerifyCoachOtp');
    const inputCoachOtpCode = document.getElementById('inputCoachOtpCode');
    const btnSubmitCoachOtp = document.getElementById('btnSubmitCoachOtp');
    const coachOtpSentEmail = document.getElementById('coachOtpSentEmail');
    const coachVerifyErrorMsg = document.getElementById('coachVerifyErrorMsg');
    const coachTestCodeNotice = document.getElementById('coachTestCodeNotice');
    const coachTestCodeValue = document.getElementById('coachTestCodeValue');
    const btnBackToCoachEmail = document.getElementById('btnBackToCoachEmail');
    const btnResendCoachOtp = document.getElementById('btnResendCoachOtp');

    let coachResendTimer = null;
    let coachResendSeconds = 0;
    let activeCoachEmail = '';

    const startCoachResendCountdown = () => {
      if (coachResendTimer) clearInterval(coachResendTimer);
      coachResendSeconds = 30;
      if (btnResendCoachOtp) {
        btnResendCoachOtp.disabled = true;
        btnResendCoachOtp.textContent = `Resend Code (${coachResendSeconds}s)`;
      }
      coachResendTimer = setInterval(() => {
        coachResendSeconds--;
        if (coachResendSeconds <= 0) {
          clearInterval(coachResendTimer);
          coachResendTimer = null;
          if (btnResendCoachOtp) {
            btnResendCoachOtp.disabled = false;
            btnResendCoachOtp.textContent = 'Resend Code';
          }
        } else if (btnResendCoachOtp) {
          btnResendCoachOtp.textContent = `Resend Code (${coachResendSeconds}s)`;
        }
      }, 1000);
    };

    if (formSendCoachOtp) {
      formSendCoachOtp.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = (inputCoachEmail?.value || '').trim();
        if (!email) return;

        if (btnSendCoachOtp) {
          btnSendCoachOtp.disabled = true;
          btnSendCoachOtp.innerHTML = '<span>⏳</span> Verifying Whitelist...';
        }
        if (coachRequestErrorMsg) coachRequestErrorMsg.style.display = 'none';

        try {
          const res = await authManager.requestCoachOtp(email);
          if (res.success) {
            activeCoachEmail = email;
            if (coachStepEmail) coachStepEmail.style.display = 'none';
            if (coachStepOtp) coachStepOtp.style.display = 'block';
            if (coachOtpSentEmail) coachOtpSentEmail.textContent = email;
            if (inputCoachOtpCode) {
              inputCoachOtpCode.value = '';
              inputCoachOtpCode.focus();
            }
            if (coachTestCodeNotice && coachTestCodeValue) {
              coachTestCodeValue.textContent = res.code || '123456';
              coachTestCodeNotice.style.display = 'block';
            }
            startCoachResendCountdown();
            if (window.showToast) {
              window.showToast(res.message, res.sentViaEmail ? 'success' : 'info');
            }
          } else {
            if (coachRequestErrorMsg) {
              coachRequestErrorMsg.textContent = res.message;
              coachRequestErrorMsg.style.display = 'block';
            }
          }
        } catch (err) {
          if (coachRequestErrorMsg) {
            coachRequestErrorMsg.textContent = 'Error: ' + err.message;
            coachRequestErrorMsg.style.display = 'block';
          }
        } finally {
          if (btnSendCoachOtp) {
            btnSendCoachOtp.disabled = false;
            btnSendCoachOtp.innerHTML = '<span>📨</span> Send Verification Code &amp; Magic Link';
          }
        }
      });
    }

    if (formVerifyCoachOtp) {
      formVerifyCoachOtp.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = (inputCoachOtpCode?.value || '').trim();
        if (!activeCoachEmail || !code) return;

        if (btnSubmitCoachOtp) {
          btnSubmitCoachOtp.disabled = true;
          btnSubmitCoachOtp.innerHTML = '<span>⏳</span> Verifying Code...';
        }
        if (coachVerifyErrorMsg) coachVerifyErrorMsg.style.display = 'none';

        try {
          const res = await authManager.verifyCoachOtp(activeCoachEmail, code);
          if (res.success) {
            if (modalLogin) modalLogin.style.display = 'none';
            if (coachStepEmail) coachStepEmail.style.display = 'block';
            if (coachStepOtp) coachStepOtp.style.display = 'none';
            formSendCoachOtp.reset();
            formVerifyCoachOtp.reset();
            this.updateRoleBoundaries();
            if (window.showToast) {
              window.showToast(`Welcome, Coach ${res.user.fullName}! Coach View and tournament controls unlocked.`, 'success');
            }
          } else {
            if (coachVerifyErrorMsg) {
              coachVerifyErrorMsg.textContent = res.message;
              coachVerifyErrorMsg.style.display = 'block';
            }
          }
        } catch (err) {
          if (coachVerifyErrorMsg) {
            coachVerifyErrorMsg.textContent = 'Verification error: ' + err.message;
            coachVerifyErrorMsg.style.display = 'block';
          }
        } finally {
          if (btnSubmitCoachOtp) {
            btnSubmitCoachOtp.disabled = false;
            btnSubmitCoachOtp.innerHTML = '<span>✅</span> Verify Code &amp; Unlock Coach View';
          }
        }
      });
    }

    if (btnBackToCoachEmail) {
      btnBackToCoachEmail.addEventListener('click', () => {
        if (coachStepEmail) coachStepEmail.style.display = 'block';
        if (coachStepOtp) coachStepOtp.style.display = 'none';
        if (coachVerifyErrorMsg) coachVerifyErrorMsg.style.display = 'none';
      });
    }

    if (btnResendCoachOtp) {
      btnResendCoachOtp.addEventListener('click', async () => {
        if (!activeCoachEmail || btnResendCoachOtp.disabled) return;
        btnResendCoachOtp.disabled = true;
        btnResendCoachOtp.textContent = 'Sending...';

        const res = await authManager.requestCoachOtp(activeCoachEmail);
        if (res.success) {
          if (coachTestCodeValue) coachTestCodeValue.textContent = res.code;
          startCoachResendCountdown();
          if (window.showToast) window.showToast(`New code generated for ${activeCoachEmail}!`, 'success');
        } else {
          btnResendCoachOtp.disabled = false;
          btnResendCoachOtp.textContent = 'Resend Code';
          if (window.showToast) window.showToast(res.message, 'error');
        }
      });
    }

    // =========================================================================
    // 3. Google Identity Services (GIS) Official OAuth Setup
    // =========================================================================
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
                    this.updateRoleBoundaries();
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
        setTimeout(initGoogleGIS, 800);
      }
    };

    initGoogleGIS();
    window.addEventListener('thermo_google_config_changed', () => initGoogleGIS());

    // =========================================================================
    // 4. Instant Google School Mode Modal Handlers
    // =========================================================================
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
          this.updateRoleBoundaries();
          if (window.showToast) {
            window.showToast(`Welcome, ${res.user.fullName}! Signed in as ${res.user.role === 'admin' ? 'Coach' : 'Student'} (${res.user.email}).`, 'success');
          }
        } else {
          if (window.showToast) window.showToast(res.message, 'error');
        }
      });
    }

    // =========================================================================
    // 5. User Badge UI Updates
    // =========================================================================
    const updateBadge = () => {
      const user = authManager.getCurrentUser();
      const isCoachOrAdmin = authManager.isCoachOrAdmin();
      const elName = document.getElementById('navUserName');
      const elRole = document.getElementById('navUserRole');
      const elAvatar = document.getElementById('navUserAvatar');

      if (user) {
        if (elName) elName.textContent = user.fullName;
        if (elRole) {
          elRole.textContent = isCoachOrAdmin ? 'Coach / Staff (Full Access)' : 'Student Roster';
        }
        if (statusText) {
          statusText.textContent = `Signed in as: ${user.fullName} (${isCoachOrAdmin ? 'Coach / Admin' : 'Student'})`;
        }
        if (elAvatar) {
          if (user.picture) {
            elAvatar.innerHTML = `<img src="${user.picture}" class="nav-avatar-img" alt="${user.fullName}" />`;
          } else {
            elAvatar.textContent = isCoachOrAdmin ? '👨‍🏫' : '🎓';
          }
        }
      } else {
        if (elName) elName.textContent = 'Student (Guest)';
        if (elRole) elRole.textContent = 'Student Roster';
        if (elAvatar) elAvatar.textContent = '🎓';
        if (statusText) statusText.textContent = 'Signed in as: Student (Guest)';
      }

      this.updateRoleBoundaries();
    };

    // =========================================================================
    // 6. Quick Classroom Student Roster Switcher (1-Click Passwordless)
    // =========================================================================
    const populateQuickSwitcher = () => {
      if (!quickGrid) return;
      // Strictly student accounts only; coaches/admins are excluded
      const users = authManager.getAllUsers().filter(u => u.role === 'student' && u.username !== 'admin');
      const current = authManager.getCurrentUser();
      quickGrid.innerHTML = '';

      users.forEach(u => {
        const chip = document.createElement('div');
        chip.className = `user-switch-chip ${current && current.username === u.username ? 'active' : ''}`;
        
        const avatar = u.picture 
          ? `<img src="${u.picture}" class="user-avatar-img" alt="${u.fullName}" />`
          : `<span style="font-size:1.25rem;">🎓</span>`;

        chip.innerHTML = `
          ${avatar}
          <div style="overflow:hidden; flex:1;">
            <span class="switch-chip-name" style="white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${u.fullName}</span>
            <span class="switch-chip-email">${u.email || u.username}</span>
            <span class="switch-chip-role">STUDENT • 1-Click Track</span>
          </div>
        `;

        chip.addEventListener('click', () => {
          const res = authManager.loginPasswordless(u.username);
          if (res.success) {
            if (modalLogin) modalLogin.style.display = 'none';
            this.updateRoleBoundaries();
            if (window.showToast) {
              window.showToast(`Switched account to ${u.fullName} (Student Score Tracking)`, 'success');
            }
          }
        });

        quickGrid.appendChild(chip);
      });
    };

    if (badgeBtn) {
      badgeBtn.addEventListener('click', () => {
        populateQuickSwitcher();
        if (authManager.isCoachOrAdmin()) {
          switchToCoachTab();
        } else {
          switchToStudentTab();
        }
        if (modalLogin) {
          modalLogin.style.display = 'flex';
        }
      });
    }

    if (btnCloseLogin && modalLogin) {
      btnCloseLogin.addEventListener('click', () => {
        modalLogin.style.display = 'none';
        if (adminLoginError) adminLoginError.style.display = 'none';
        if (coachRequestErrorMsg) coachRequestErrorMsg.style.display = 'none';
        if (coachVerifyErrorMsg) coachVerifyErrorMsg.style.display = 'none';
      });
    }

    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        authManager.logout();
        if (modalLogin) modalLogin.style.display = 'none';
        this.updateRoleBoundaries();
        if (window.showToast) {
          window.showToast('Signed out of Coach/Admin mode. Reverted to Student view.', 'info');
        }
      });
    }

    window.addEventListener('thermo_auth_changed', () => {
      updateBadge();
      populateQuickSwitcher();
      this.updateRoleBoundaries();
    });

    updateBadge();
    this.updateRoleBoundaries();
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
