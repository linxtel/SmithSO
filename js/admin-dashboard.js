/**
 * ThermoOlyMaster - Admin & Classroom Dashboard Controller
 * Provides teachers and coaches with:
 * 1. Student roster management (Google Accounts, Instant Mode, Roles).
 * 2. Google OAuth 2.0 configuration & coach whitelist management.
 * 3. Live Google Sheets Score & Gradebook Sync integration.
 * 4. Real-time class progress tracking, gradebooks, and performance analytics.
 * 5. Individual student diagnostic drill-down and CSV grade export.
 */

import { authManager } from './auth-manager.js';
import { sheetsSyncManager } from './sheets-sync.js';

export class AdminDashboard {
  constructor() {
    this.selectedStudent = null;
  }

  init() {
    this.bindEvents();
    this.render();

    window.addEventListener('thermo_auth_changed', () => this.render());
    window.addEventListener('thermo_progress_updated', () => this.render());
    window.addEventListener('thermo_google_config_changed', () => this.renderGoogleConfig());
    window.addEventListener('thermo_sheets_config_changed', () => this.renderSheetsConfig());
  }

  bindEvents() {
    // Add user button & modal
    const btnOpenAdd = document.getElementById('adminBtnOpenAddUser');
    const modalAdd = document.getElementById('modalAddUser');
    const btnCloseAdd = document.getElementById('modalAddUserClose');
    const btnCancelAdd = document.getElementById('modalAddUserCancel');
    const formAdd = document.getElementById('formAddUser');

    if (btnOpenAdd && modalAdd) {
      btnOpenAdd.addEventListener('click', () => {
        modalAdd.style.display = 'flex';
        const inputUser = document.getElementById('newFullName');
        if (inputUser) inputUser.focus();
      });
    }

    const closeModal = () => {
      if (modalAdd) modalAdd.style.display = 'none';
      if (formAdd) formAdd.reset();
    };

    if (btnCloseAdd) btnCloseAdd.addEventListener('click', closeModal);
    if (btnCancelAdd) btnCancelAdd.addEventListener('click', closeModal);

    if (formAdd) {
      formAdd.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('newUsername').value;
        const fullName = document.getElementById('newFullName').value;
        const email = document.getElementById('newEmail') ? document.getElementById('newEmail').value : '';
        const team = document.getElementById('newTeam').value;
        const password = document.getElementById('newPassword').value;
        const role = document.getElementById('newRole').value;

        const res = authManager.addUser({ username, password, fullName, team, role, email });
        if (res.success) {
          closeModal();
          this.render();
          if (window.showToast) window.showToast(`User "${fullName}" (${username}) successfully added!`, 'success');
        } else {
          if (window.showToast) window.showToast(res.message, 'error');
        }
      });
    }

    // Google OAuth Config Form
    const formGoogle = document.getElementById('formGoogleConfig');
    if (formGoogle) {
      formGoogle.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputClientId = document.getElementById('adminGoogleClientId');
        const inputCoachEmails = document.getElementById('adminCoachEmails');

        const clientId = inputClientId ? inputClientId.value.trim() : '';
        const coachEmails = inputCoachEmails ? inputCoachEmails.value.trim() : '';

        authManager.setGoogleClientId(clientId);
        authManager.setCoachEmails(coachEmails);
        this.renderGoogleConfig();

        if (window.showToast) {
          window.showToast('Google authentication settings saved successfully!', 'success');
        }
      });
    }

    // Google Sheets Sync Config Form
    const formSheets = document.getElementById('formSheetsConfig');
    if (formSheets) {
      formSheets.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputWebhook = document.getElementById('sheetsWebhookUrl');
        const inputSheetDoc = document.getElementById('sheetsSpreadsheetUrl');
        const chkAuto = document.getElementById('chkSheetsAutoSync');

        const webhook = inputWebhook ? inputWebhook.value.trim() : '';
        const sheetDoc = inputSheetDoc ? inputSheetDoc.value.trim() : '';
        const autoSync = chkAuto ? chkAuto.checked : true;

        sheetsSyncManager.setWebhookUrl(webhook);
        sheetsSyncManager.setSpreadsheetUrl(sheetDoc);
        sheetsSyncManager.setAutoSync(autoSync);
        this.renderSheetsConfig();

        if (window.showToast) {
          window.showToast('Google Sheets sync settings saved successfully!', 'success');
        }
      });
    }

    // Sync All Current Grades to Google Sheet Now
    const btnSyncAll = document.getElementById('btnSyncAllToSheets');
    if (btnSyncAll) {
      btnSyncAll.addEventListener('click', async () => {
        const origText = btnSyncAll.innerHTML;
        btnSyncAll.innerHTML = '<span>⏳</span> Syncing to Google Sheet...';
        btnSyncAll.disabled = true;

        const res = await sheetsSyncManager.syncFullGradebook();
        btnSyncAll.innerHTML = origText;
        btnSyncAll.disabled = false;

        if (res.success) {
          this.renderSheetsConfig();
          if (window.showToast) {
            window.showToast(`Successfully synced ${res.count} student records to Google Sheet!`, 'success');
          }
        } else {
          if (window.showToast) {
            window.showToast(res.message, 'warning');
          }
        }
      });
    }

    // Copy Google Apps Script Button
    const btnCopyScript = document.getElementById('btnCopyAppsScript');
    if (btnCopyScript) {
      btnCopyScript.addEventListener('click', () => {
        const code = sheetsSyncManager.getAppsScriptTemplate();
        navigator.clipboard.writeText(code).then(() => {
          if (window.showToast) {
            window.showToast('Google Apps Script copied to clipboard! Paste into Extensions > Apps Script.', 'success');
          }
        }).catch(() => {
          if (window.showToast) {
            window.showToast('Select and copy the script text below.', 'info');
          }
        });
      });
    }

    // Export CSV
    const btnExport = document.getElementById('adminBtnExportCsv');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        authManager.exportGradebookCsv();
        if (window.showToast) window.showToast('Gradebook CSV exported successfully!', 'success');
      });
    }

    // Print Class Report
    const btnPrintReport = document.getElementById('adminBtnPrintReport');
    if (btnPrintReport) {
      btnPrintReport.addEventListener('click', () => {
        window.print();
      });
    }

    // Student Detail Modal Close
    const modalDetail = document.getElementById('modalStudentDetail');
    const btnCloseDetail = document.getElementById('modalStudentDetailClose');
    if (btnCloseDetail && modalDetail) {
      btnCloseDetail.addEventListener('click', () => {
        modalDetail.style.display = 'none';
      });
    }

    // Coach Whitelist Add Form
    const formAddCoach = document.getElementById('formAddCoach');
    if (formAddCoach) {
      formAddCoach.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inputName = document.getElementById('inputNewCoachName');
        const inputEmail = document.getElementById('inputNewCoachEmail');
        const btnSubmit = document.getElementById('btnAddCoach');

        const name = (inputName?.value || '').trim();
        const email = (inputEmail?.value || '').trim();
        if (!name || !email) return;

        if (btnSubmit) btnSubmit.disabled = true;
        try {
          const res = await authManager.addCoach(name, email);
          if (res.success) {
            formAddCoach.reset();
            await this.renderCoachesTable();
            if (window.showToast) {
              window.showToast(`Coach "${name}" (${email}) added to authorized whitelist!`, 'success');
            }
          } else {
            if (window.showToast) {
              window.showToast(res.message || 'Failed to add coach.', 'error');
            }
          }
        } catch (err) {
          if (window.showToast) window.showToast('Error adding coach: ' + err.message, 'error');
        } finally {
          if (btnSubmit) btnSubmit.disabled = false;
        }
      });
    }
  }

  render() {
    this.renderMetrics();
    this.renderAccessRequestsTable();
    this.renderCoachesTable();
    this.renderRosterTable();
    this.renderGradebookTable();
    this.renderGoogleConfig();
    this.renderSheetsConfig();
  }

  async renderAccessRequestsTable() {
    const container = document.getElementById('adminAccessRequestsTable');
    const badgePending = document.getElementById('badgePendingRequestsCount');
    if (!container) return;

    try {
      const requests = await authManager.getAccessRequests();
      const pendingCount = (requests || []).filter(r => r.status === 'pending').length;
      if (badgePending) {
        badgePending.textContent = `${pendingCount} Pending`;
        badgePending.style.color = pendingCount > 0 ? 'var(--gold-accent)' : 'var(--safe-green)';
        badgePending.style.borderColor = pendingCount > 0 ? 'var(--gold-accent)' : 'var(--safe-green)';
      }

      let html = `
        <table class="reference-table">
          <thead>
            <tr>
              <th>Applicant Name</th>
              <th>Email Address</th>
              <th>School / Team</th>
              <th>Role</th>
              <th>Notes / Events</th>
              <th>Submitted</th>
              <th>Status</th>
              <th style="text-align:center;">Action</th>
            </tr>
          </thead>
          <tbody>
      `;

      if (!requests || requests.length === 0) {
        html += `<tr><td colspan="8" style="text-align:center; padding:1.25rem; color:var(--text-muted);">No sign-up or access requests received yet. Incoming requests notify <strong>najam@linxtel.com</strong>.</td></tr>`;
      } else {
        requests.forEach(r => {
          const isPending = r.status === 'pending';
          const isApproved = r.status === 'approved';
          const isCoachRole = r.requestedRole === 'coach';

          let statusBadge = `<span class="badge-official" style="color:var(--gold-accent); border-color:var(--gold-accent);">Pending</span>`;
          if (isApproved) {
            statusBadge = `<span class="badge-official" style="color:var(--safe-green); border-color:var(--safe-green);">Approved</span>`;
          } else if (r.status === 'declined') {
            statusBadge = `<span class="badge-official" style="color:var(--danger); border-color:var(--danger);">Declined</span>`;
          }

          const roleBadge = isCoachRole
            ? `<span class="badge-official" style="color:var(--gold-accent); border-color:var(--gold-accent);">Coach</span>`
            : `<span class="badge-official" style="color:var(--cryo-cyan); border-color:var(--cryo-cyan);">Student</span>`;

          html += `
            <tr>
              <td>
                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <span>${isCoachRole ? '👨‍🏫' : '🎓'}</span>
                  <strong>${r.fullName}</strong>
                </div>
              </td>
              <td><span class="mono" style="color:var(--cryo-cyan); font-size:0.8rem;">${r.email}</span></td>
              <td style="font-size:0.8rem; color:var(--text-secondary);">${r.team || '—'}</td>
              <td>${roleBadge}</td>
              <td style="font-size:0.78rem; color:var(--text-muted); max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${r.notes || ''}">
                ${r.notes || '—'}
              </td>
              <td style="color:var(--text-secondary); font-size:0.78rem;">${r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'Recent'}</td>
              <td>${statusBadge}</td>
              <td style="text-align:center; white-space:nowrap;">
                ${isPending ? `
                  <div style="display:flex; gap:0.35rem; justify-content:center;">
                    <button class="btn btn-primary btn-sm" data-btn-action-req="${r.id}" data-action="approve" style="padding:0.25rem 0.55rem; font-size:0.75rem; background:rgba(34,197,94,0.15); border-color:var(--safe-green); color:var(--safe-green);">
                      ✓ Approve
                    </button>
                    <button class="btn btn-secondary btn-sm" data-btn-action-req="${r.id}" data-action="decline" style="padding:0.25rem 0.55rem; font-size:0.75rem; color:var(--danger); border-color:rgba(239,68,68,0.3);">
                      ✕ Decline
                    </button>
                  </div>
                ` : `
                  <span style="font-size:0.75rem; color:var(--text-muted);">${r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString() : 'Reviewed'}</span>
                `}
              </td>
            </tr>
          `;
        });
      }

      html += `</tbody></table>`;
      container.innerHTML = html;

      container.querySelectorAll('[data-btn-action-req]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.getAttribute('data-btn-action-req');
          const action = e.currentTarget.getAttribute('data-action');
          btn.disabled = true;
          try {
            const res = await authManager.handleAccessRequestAction(id, action);
            if (res.success) {
              await this.renderAccessRequestsTable();
              await this.renderCoachesTable();
              this.renderRosterTable();
              if (window.showToast) {
                window.showToast(`Access request ${action === 'approve' ? 'approved' : 'declined'} successfully!`, action === 'approve' ? 'success' : 'info');
              }
            } else {
              if (window.showToast) window.showToast(res.message || 'Action failed.', 'error');
            }
          } catch (err) {
            if (window.showToast) window.showToast('Error: ' + err.message, 'error');
          }
        });
      });
    } catch (e) {
      console.error('Error rendering access requests table:', e);
    }
  }

  async renderCoachesTable() {
    const container = document.getElementById('adminCoachesTable');
    if (!container) return;

    try {
      const coaches = await authManager.getCoaches();
      let html = `
        <table class="reference-table">
          <thead>
            <tr>
              <th>Coach Name</th>
              <th>Authorized Login Email</th>
              <th>Date Added</th>
              <th>Access Level</th>
              <th style="text-align:center;">Action</th>
            </tr>
          </thead>
          <tbody>
      `;

      if (!coaches || coaches.length === 0) {
        html += `<tr><td colspan="5" style="text-align:center; padding:1.25rem; color:var(--text-muted);">No coaches listed.</td></tr>`;
      } else {
        coaches.forEach(c => {
          const isPrimary = c.email.toLowerCase() === 'coach.smith@school.org';
          html += `
            <tr>
              <td>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                  <span>👨‍🏫</span>
                  <strong>${c.name}</strong>
                </div>
              </td>
              <td><span class="mono" style="color:var(--cryo-cyan);">${c.email}</span></td>
              <td style="color:var(--text-secondary); font-size:0.8rem;">${c.addedAt ? new Date(c.addedAt).toLocaleDateString() : 'Initial Roster'}</td>
              <td><span class="badge-official" style="color:var(--gold-accent); border-color:var(--gold-accent);">Coach / Staff</span></td>
              <td style="text-align:center;">
                ${isPrimary ? `<span style="font-size:0.75rem; color:var(--text-muted);">Primary Head Coach</span>` : `
                  <button class="btn btn-secondary btn-sm" data-btn-del-coach="${c.email}" style="padding:0.2rem 0.5rem; font-size:0.75rem; color:var(--danger);">
                    🗑️ Remove
                  </button>
                `}
              </td>
            </tr>
          `;
        });
      }

      html += `</tbody></table>`;
      container.innerHTML = html;

      container.querySelectorAll('[data-btn-del-coach]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const email = e.currentTarget.getAttribute('data-btn-del-coach');
          if (confirm(`Revoke coach access for ${email}?`)) {
            const res = await authManager.removeCoach(email);
            if (res.success) {
              await this.renderCoachesTable();
              if (window.showToast) window.showToast(`Coach "${email}" removed from whitelist.`, 'info');
            }
          }
        });
      });
    } catch (e) {
      console.error('Error rendering coaches table:', e);
    }
  }

  renderMetrics() {
    const summary = authManager.getGradebookSummary();
    const users = authManager.getAllUsers();
    const studentCount = users.filter(u => u.role === 'student').length;

    const totalExams = summary.reduce((acc, s) => acc + s.examsCompleted, 0);
    
    // Class average ES
    const validScores = summary.filter(s => s.examsCompleted > 0);
    const classAvgES = validScores.length > 0 
      ? (validScores.reduce((acc, s) => acc + s.avgES, 0) / validScores.length).toFixed(1)
      : '0.0';

    // Top TG
    const topTG = summary.length > 0 ? Math.max(...summary.map(s => s.bestTG)) : 0;
    // Top PS
    const topPS = summary.length > 0 ? Math.max(...summary.map(s => s.bestPS)) : 0;

    const elTotalStudents = document.getElementById('metricTotalStudents');
    const elTotalExams = document.getElementById('metricTotalExams');
    const elClassAvgES = document.getElementById('metricClassAvgES');
    const elTopTG = document.getElementById('metricTopTG');
    const elTopPS = document.getElementById('metricTopPS');

    if (elTotalStudents) elTotalStudents.textContent = studentCount;
    if (elTotalExams) elTotalExams.textContent = totalExams;
    if (elClassAvgES) elClassAvgES.textContent = `${classAvgES} / 50`;
    if (elTopTG) elTopTG.textContent = `+${topTG.toFixed(1)}°C`;
    if (elTopPS) elTopPS.textContent = `${topPS.toFixed(1)} / 20`;
  }

  renderGoogleConfig() {
    const inputClientId = document.getElementById('adminGoogleClientId');
    const inputCoachEmails = document.getElementById('adminCoachEmails');
    const badgeStatus = document.getElementById('googleConfigStatusBadge');

    const clientId = authManager.getGoogleClientId();
    const coachEmails = authManager.getCoachEmails();

    if (inputClientId && document.activeElement !== inputClientId) {
      inputClientId.value = clientId;
    }
    if (inputCoachEmails && document.activeElement !== inputCoachEmails) {
      inputCoachEmails.value = coachEmails.join(', ');
    }

    if (badgeStatus) {
      if (clientId) {
        badgeStatus.textContent = '🟢 Google OAuth Active';
        badgeStatus.style.color = 'var(--success)';
        badgeStatus.style.borderColor = 'var(--success)';
      } else {
        badgeStatus.textContent = '⚡ Instant School Mode Active';
        badgeStatus.style.color = 'var(--cryo-cyan)';
        badgeStatus.style.borderColor = 'var(--border-accent)';
      }
    }
  }

  renderSheetsConfig() {
    const inputWebhook = document.getElementById('sheetsWebhookUrl');
    const inputSheetDoc = document.getElementById('sheetsSpreadsheetUrl');
    const chkAuto = document.getElementById('chkSheetsAutoSync');
    const elLastSync = document.getElementById('sheetsLastSyncTime');
    const badgeStatus = document.getElementById('sheetsSyncStatusBadge');
    const linkDoc = document.getElementById('linkOpenGoogleSheet');
    const codeBlock = document.getElementById('codeAppsScriptBlock');

    const webhook = sheetsSyncManager.getWebhookUrl();
    const sheetDoc = sheetsSyncManager.getSpreadsheetUrl();
    const autoSync = sheetsSyncManager.isAutoSyncEnabled();
    const lastSync = sheetsSyncManager.getLastSyncTime();

    if (inputWebhook && document.activeElement !== inputWebhook) {
      inputWebhook.value = webhook;
    }
    if (inputSheetDoc && document.activeElement !== inputSheetDoc) {
      inputSheetDoc.value = sheetDoc;
    }
    if (chkAuto) {
      chkAuto.checked = autoSync;
    }
    if (elLastSync) {
      elLastSync.textContent = lastSync || 'Never';
    }

    if (linkDoc) {
      if (sheetDoc) {
        linkDoc.href = sheetDoc;
        linkDoc.style.display = 'inline-flex';
      } else {
        linkDoc.style.display = 'none';
      }
    }

    if (codeBlock) {
      codeBlock.textContent = sheetsSyncManager.getAppsScriptTemplate();
    }

    if (badgeStatus) {
      if (webhook) {
        badgeStatus.textContent = '🟢 Connected & Live Sync Active';
        badgeStatus.style.color = 'var(--success)';
        badgeStatus.style.borderColor = 'var(--success)';
      } else {
        badgeStatus.textContent = '⚡ Ready (Enter Webhook URL)';
        badgeStatus.style.color = 'var(--text-muted)';
        badgeStatus.style.borderColor = 'var(--border-subtle)';
      }
    }
  }

  renderRosterTable() {
    const container = document.getElementById('adminRosterTable');
    if (!container) return;

    const users = authManager.getAllUsers();
    let html = `
      <table class="reference-table">
        <thead>
          <tr>
            <th>User / Student</th>
            <th>Google / School Email</th>
            <th>Username</th>
            <th>School / Team</th>
            <th>Role</th>
            <th>Auth Mode</th>
            <th style="text-align:center;">Actions</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (users.length === 0) {
      html += `<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No users found.</td></tr>`;
    } else {
      users.forEach(u => {
        const isAdmin = u.role === 'admin';
        const roleBadge = isAdmin
          ? '<span class="badge-official" style="color:var(--thermal-primary); border-color:var(--thermal-primary);">Coach / Admin</span>'
          : '<span class="badge-official" style="color:var(--cryo-cyan); border-color:var(--cryo-cyan);">Student</span>';

        const avatar = u.picture 
          ? `<img src="${u.picture}" class="user-avatar-img" alt="${u.fullName}" />`
          : `<span style="font-size:1.15rem;">${isAdmin ? '👨‍🏫' : '🎓'}</span>`;

        const authBadge = u.authProvider === 'google'
          ? '<span class="google-badge-pill">Google OAuth</span>'
          : '<span class="badge-official" style="font-size:0.65rem;">Instant School</span>';

        html += `
          <tr>
            <td>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                ${avatar}
                <strong>${u.fullName}</strong>
              </div>
            </td>
            <td><span class="mono" style="font-size:0.8rem; color:var(--cryo-cyan);">${u.email || 'N/A'}</span></td>
            <td><span class="mono" style="font-size:0.8rem; color:var(--text-muted);">${u.username}</span></td>
            <td style="color:var(--text-secondary); font-size:0.85rem;">${u.team}</td>
            <td>${roleBadge}</td>
            <td>${authBadge}</td>
            <td style="text-align:center;">
              <button class="btn btn-secondary btn-sm" data-btn-view-user="${u.username}" style="padding:0.25rem 0.6rem; font-size:0.75rem;">
                🔍 View
              </button>
              ${!isAdmin ? `
                <button class="btn btn-secondary btn-sm" data-btn-del-user="${u.username}" style="padding:0.25rem 0.6rem; font-size:0.75rem; color:var(--danger);">
                  🗑️
                </button>
              ` : ''}
            </td>
          </tr>
        `;
      });
    }

    html += `</tbody></table>`;
    container.innerHTML = html;

    // Attach row button events
    container.querySelectorAll('[data-btn-view-user]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const uname = e.currentTarget.getAttribute('data-btn-view-user');
        this.openStudentDetail(uname);
      });
    });

    container.querySelectorAll('[data-btn-del-user]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const uname = e.currentTarget.getAttribute('data-btn-del-user');
        if (confirm(`Are you sure you want to remove user "${uname}" and their testing records?`)) {
          const res = authManager.deleteUser(uname);
          if (res.success) {
            this.render();
            if (window.showToast) window.showToast(`User "${uname}" removed.`, 'info');
          }
        }
      });
    });
  }

  renderGradebookTable() {
    const container = document.getElementById('adminGradebookTable');
    if (!container) return;

    const summary = authManager.getGradebookSummary();
    let html = `
      <table class="reference-table">
        <thead>
          <tr>
            <th>Student &amp; Account</th>
            <th>School / Team</th>
            <th style="text-align:center;">Lessons Finished</th>
            <th>Exams Taken</th>
            <th>Avg Exam (ES / 50)</th>
            <th>Best Exam (ES / 50)</th>
            <th>Best Heat Gain (TG)</th>
            <th>Best Prediction (PS / 20)</th>
            <th>Last Active</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (summary.length === 0) {
      html += `<tr><td colspan="9" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No student records logged yet.</td></tr>`;
    } else {
      summary.forEach(s => {
        const avatar = s.picture 
          ? `<img src="${s.picture}" class="user-avatar-img" alt="${s.fullName}" style="width:24px; height:24px;" />`
          : `<span>🎓</span>`;

        html += `
          <tr>
            <td>
              <div style="display:flex; align-items:center; gap:0.45rem;">
                ${avatar}
                <div>
                  <strong>${s.fullName}</strong>
                  <div style="font-size:0.72rem; color:var(--text-muted);">${s.email}</div>
                </div>
              </div>
            </td>
            <td style="color:var(--text-secondary);">${s.team}</td>
            <td class="mono" style="text-align:center;"><span class="badge-official" style="font-size:0.75rem; color:var(--cryo-cyan); border-color:rgba(0,229,255,0.3);">${s.lessonsCompleted} / 6</span></td>
            <td class="mono" style="text-align:center;">${s.examsCompleted}</td>
            <td class="mono" style="color:var(--cryo-cyan); font-weight:bold;">${s.avgES}</td>
            <td class="mono" style="color:var(--thermal-primary); font-weight:bold;">${s.bestES}</td>
            <td class="mono" style="color:var(--gold-accent);">+${s.bestTG.toFixed(1)}°C</td>
            <td class="mono" style="color:var(--success);">${s.bestPS.toFixed(2)}</td>
            <td style="font-size:0.8rem; color:var(--text-muted);">${s.lastActive}</td>
          </tr>
        `;
      });
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  openStudentDetail(username) {
    const users = authManager.getAllUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return;

    const progress = authManager.getUserProgress(username);
    const modal = document.getElementById('modalStudentDetail');
    if (!modal) return;

    const elTitle = document.getElementById('detailStudentName');
    const elSub = document.getElementById('detailStudentSub');
    const elExamsList = document.getElementById('detailExamsList');
    const elLabsList = document.getElementById('detailLabsList');
    const elPredsList = document.getElementById('detailPredsList');

    if (elTitle) elTitle.textContent = `${user.fullName} (${user.username})`;
    if (elSub) elSub.textContent = `${user.team} • Role: ${user.role.toUpperCase()} • ${user.email || ''}`;

    // Render exams history
    if (elExamsList) {
      if (progress.exams.length === 0) {
        elExamsList.innerHTML = '<div style="padding:0.75rem; color:var(--text-muted); font-size:0.85rem;">No exam attempts recorded yet.</div>';
      } else {
        let html = '<table class="reference-table" style="font-size:0.85rem;"><thead><tr><th>Date</th><th>Type</th><th>Score</th><th>ES (50 pts)</th><th>Percentage</th></tr></thead><tbody>';
        progress.exams.forEach(e => {
          html += `
            <tr>
              <td>${e.date}</td>
              <td><span class="badge-official" style="font-size:0.7rem;">${e.type === 'scanned' ? '📷 Scanned Paper' : '💻 Screen Test'}</span></td>
              <td class="mono">${e.raw} / ${e.total}</td>
              <td class="mono" style="color:var(--thermal-primary); font-weight:bold;">${e.es}</td>
              <td class="mono" style="color:var(--cryo-cyan);">${e.percent}%</td>
            </tr>
          `;
        });
        html += '</tbody></table>';
        elExamsList.innerHTML = html;
      }
    }

    // Render heat collector runs
    if (elLabsList) {
      if (progress.labRuns.length === 0) {
        elLabsList.innerHTML = '<div style="padding:0.75rem; color:var(--text-muted); font-size:0.85rem;">No heat collector simulations recorded.</div>';
      } else {
        let html = '<table class="reference-table" style="font-size:0.85rem;"><thead><tr><th>Date</th><th>Lamp Height</th><th>Wattage</th><th>Temp Gain</th><th>Final Temp</th></tr></thead><tbody>';
        progress.labRuns.forEach(l => {
          html += `
            <tr>
              <td>${l.date}</td>
              <td class="mono">${l.heightCm} cm</td>
              <td class="mono">${l.wattage} W</td>
              <td class="mono" style="color:var(--gold-accent);">+${l.tempGain}°C</td>
              <td class="mono">${l.finalTemp}°C</td>
            </tr>
          `;
        });
        html += '</tbody></table>';
        elLabsList.innerHTML = html;
      }
    }

    // Render predictions
    if (elPredsList) {
      if (progress.predictions.length === 0) {
        elPredsList.innerHTML = '<div style="padding:0.75rem; color:var(--text-muted); font-size:0.85rem;">No prediction arena tests recorded.</div>';
      } else {
        let html = '<table class="reference-table" style="font-size:0.85rem;"><thead><tr><th>Date</th><th>Error</th><th>PE</th><th>PS (20 pts)</th><th>Awarded Badge</th></tr></thead><tbody>';
        progress.predictions.forEach(p => {
          html += `
            <tr>
              <td>${p.date}</td>
              <td class="mono">±${p.error}°C</td>
              <td class="mono">${p.pe}</td>
              <td class="mono" style="color:var(--success); font-weight:bold;">${p.ps}</td>
              <td>${p.badge}</td>
            </tr>
          `;
        });
        html += '</tbody></table>';
        elPredsList.innerHTML = html;
      }
    }

    modal.style.display = 'flex';
  }
}
