/**
 * ThermoOlyMaster - Google Sheets Live Progress & Gradebook Sync Engine
 * Enables Science Olympiad coaches to connect a Google Sheet via Google Apps Script Webhook.
 * Supports:
 * 1. Real-time automatic syncing of exams (ES), collector gains (TS), predictions (PS), and lessons.
 * 2. Full one-click gradebook synchronization with two formatted sheets ("Team Gradebook" and "Score Log").
 * 3. 1-click Google Apps Script template generator.
 */

import { authManager } from './auth-manager.js';

export class SheetsSyncManager {
  constructor() {
    this.STORAGE_KEY_WEBHOOK = 'thermo_sheets_webhook_url_v1';
    this.STORAGE_KEY_SHEET_URL = 'thermo_sheets_sheet_url_v1';
    this.STORAGE_KEY_AUTO_SYNC = 'thermo_sheets_auto_sync_v1';
    this.STORAGE_KEY_LAST_SYNC = 'thermo_sheets_last_sync_v1';

    this.isSyncing = false;
  }

  init() {
    // Listen for real-time progress updates across the app
    window.addEventListener('thermo_progress_updated', (e) => {
      if (this.isAutoSyncEnabled() && this.getWebhookUrl()) {
        this.handleAutoSyncEvent(e.detail);
      }
    });
  }

  getWebhookUrl() {
    return localStorage.getItem(this.STORAGE_KEY_WEBHOOK) || '';
  }

  setWebhookUrl(url) {
    const val = (url || '').trim();
    if (val) {
      localStorage.setItem(this.STORAGE_KEY_WEBHOOK, val);
    } else {
      localStorage.removeItem(this.STORAGE_KEY_WEBHOOK);
    }
    window.dispatchEvent(new CustomEvent('thermo_sheets_config_changed'));
  }

  getSpreadsheetUrl() {
    return localStorage.getItem(this.STORAGE_KEY_SHEET_URL) || '';
  }

  setSpreadsheetUrl(url) {
    const val = (url || '').trim();
    if (val) {
      localStorage.setItem(this.STORAGE_KEY_SHEET_URL, val);
    } else {
      localStorage.removeItem(this.STORAGE_KEY_SHEET_URL);
    }
    window.dispatchEvent(new CustomEvent('thermo_sheets_config_changed'));
  }

  isAutoSyncEnabled() {
    const val = localStorage.getItem(this.STORAGE_KEY_AUTO_SYNC);
    return val === null ? true : val === 'true'; // default true
  }

  setAutoSync(enabled) {
    localStorage.setItem(this.STORAGE_KEY_AUTO_SYNC, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('thermo_sheets_config_changed'));
  }

  getLastSyncTime() {
    return localStorage.getItem(this.STORAGE_KEY_LAST_SYNC) || null;
  }

  setLastSyncTime(date = new Date()) {
    const formatted = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, formatted);
    window.dispatchEvent(new CustomEvent('thermo_sheets_config_changed'));
  }

  /**
   * Dispatches a single score/progress event to the Google Sheet.
   */
  async handleAutoSyncEvent(detail) {
    if (!detail) return;
    const webhook = this.getWebhookUrl();
    if (!webhook) return;

    const user = authManager.getCurrentUser();
    const studentName = user ? user.fullName : (detail.username || 'Student');
    const email = user ? (user.email || `${user.username}@students.school.org`) : 'N/A';

    let eventType = 'Activity';
    let score = '-';
    let details = '';

    if (detail.type === 'exam' || detail.entry?.es !== undefined) {
      eventType = 'Written Exam (ES)';
      score = `${detail.entry.es} / 50 pts (${detail.entry.percent}%)`;
      details = `Raw: ${detail.entry.raw}/${detail.entry.total} • Mode: ${detail.entry.type}`;
    } else if (detail.type === 'lab') {
      eventType = 'Heat Collector Lab (TS)';
      score = `+${detail.entry.tempGain}°C`;
      details = `Final: ${detail.entry.finalTemp}°C • Bulb: ${detail.entry.heightCm}cm • ${detail.entry.wattage}W`;
    } else if (detail.type === 'prediction') {
      eventType = 'Prediction Arena (PS)';
      score = `${detail.entry.ps} / 20 pts (Error: ±${detail.entry.error}°C)`;
      details = `Badge: ${detail.entry.badge} • PE: ${detail.entry.pe}`;
    } else if (detail.type === 'lesson') {
      eventType = 'Curriculum Lesson';
      score = detail.isCompleted ? 'Completed ✅' : 'Incomplete 🔄';
      details = `Lesson ID: ${detail.lessonId}`;
    }

    const payload = {
      action: 'sync_event',
      timestamp: new Date().toISOString(),
      studentName,
      email,
      eventType,
      score,
      details
    };

    try {
      // Use text/plain with no-cors to prevent CORS preflight blocking with Google Apps Script
      await fetch(webhook, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      this.setLastSyncTime();
    } catch (err) {
      console.warn('Google Sheets auto-sync notice:', err);
    }
  }

  /**
   * Syncs the entire classroom gradebook to Google Sheets.
   */
  async syncFullGradebook() {
    const webhook = this.getWebhookUrl();
    if (!webhook) {
      return { success: false, message: 'Please enter a Google Apps Script Webhook URL first.' };
    }

    const students = authManager.getGradebookSummary();
    const payload = {
      action: 'sync_all',
      timestamp: new Date().toISOString(),
      platform: 'ThermoOlyMaster Science Olympiad 2027',
      students
    };

    this.isSyncing = true;
    try {
      await fetch(webhook, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      this.setLastSyncTime();
      this.isSyncing = false;
      return { success: true, count: students.length };
    } catch (err) {
      this.isSyncing = false;
      return { success: false, message: err.message || 'Failed to connect to Google Sheets Webhook.' };
    }
  }

  /**
   * Dispatches a 6-digit OTP verification code to the student/coach email
   * via the Google Apps Script Webhook.
   */
  async sendEmailOtp(email, otp) {
    const webhook = this.getWebhookUrl();
    if (!webhook) {
      return { sentViaEmail: false, reason: 'no_webhook' };
    }

    try {
      await fetch(webhook, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'send_otp',
          email,
          otp,
          timestamp: new Date().toISOString()
        })
      });
      return { sentViaEmail: true };
    } catch (err) {
      console.warn('Failed to send email OTP via webhook:', err);
      return { sentViaEmail: false, error: err.message };
    }
  }

  /**
   * Returns copy-paste ready Google Apps Script code for the teacher's sheet.
   */
  getAppsScriptTemplate() {
    return `/**
 * ThermoOlyMaster - Google Sheets Live Synchronizer & Email OTP Dispatcher
 * Official Science Olympiad Division B Thermodynamics (2027)
 * 
 * SETUP INSTRUCTIONS:
 * 1. In your Google Sheet, click Extensions > Apps Script.
 * 2. Delete existing code and paste this entire script. Click Save (💾).
 * 3. Click Deploy > New deployment.
 * 4. Choose type: "Web app".
 * 5. Set "Execute as: Me" and "Who has access: Anyone".
 * 6. Click Deploy, copy the "Web app URL", and paste it into ThermoOlyMaster!
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Single Real-Time Event Logger -> "Score Log" Sheet
    if (data.action === "sync_event") {
      var logSheet = ss.getSheetByName("Score Log");
      if (!logSheet) {
        logSheet = ss.insertSheet("Score Log");
        logSheet.appendRow(["Timestamp", "Student Name", "Email / Account", "Event Type", "Score / Metric", "Details"]);
        logSheet.getRange("A1:F1").setFontWeight("bold").setBackground("#e0f2fe");
        logSheet.setFrozenRows(1);
      }
      logSheet.appendRow([
        new Date(),
        data.studentName || "Student",
        data.email || "N/A",
        data.eventType || "Activity",
        data.score || "-",
        data.details || ""
      ]);
    }

    // 2. Full Gradebook Sync -> "Team Gradebook" Sheet
    if (data.action === "sync_all" && Array.isArray(data.students)) {
      var gbSheet = ss.getSheetByName("Team Gradebook");
      if (!gbSheet) {
        gbSheet = ss.insertSheet("Team Gradebook");
      }
      gbSheet.clear();
      gbSheet.appendRow([
        "Student Name",
        "Google Account / Email",
        "Username",
        "School / Team",
        "Lessons Finished (of 6)",
        "Exams Taken",
        "Avg Exam Score (ES / 50)",
        "Best Exam Score (ES / 50)",
        "Best Heat Gain (+°C)",
        "Best Prediction (PS / 20)",
        "Last Active"
      ]);
      gbSheet.getRange("A1:K1").setFontWeight("bold").setBackground("#fef3c7");
      gbSheet.setFrozenRows(1);

      data.students.forEach(function(s) {
        gbSheet.appendRow([
          s.fullName,
          s.email,
          s.username,
          s.team,
          s.lessonsCompleted + " / 6",
          s.examsCompleted,
          s.avgES,
          s.bestES,
          "+" + Number(s.bestTG).toFixed(1) + "°C",
          Number(s.bestPS).toFixed(2),
          s.lastActive
        ]);
      });

      // Auto-fit columns
      for (var i = 1; i <= 11; i++) {
        gbSheet.autoResizeColumn(i);
      }
    }

    // 3. Email One-Time Password (OTP) Dispatcher for Public Verification
    if (data.action === "send_otp") {
      var recipient = data.email;
      var code = data.otp;
      var subject = "🔥 ThermoOlyMaster Verification Code: " + code;
      var htmlBody = "<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif; max-width:480px; padding:24px; border:1px solid #e2e8f0; border-radius:12px; background:#ffffff; color:#1e293b;'>" +
        "<div style='display:flex; align-items:center; gap:8px; margin-bottom:12px;'>" +
        "<span style='font-size:24px;'>🔥</span> <h2 style='color:#ea580c; margin:0; font-size:20px;'>ThermoOlyMaster</h2>" +
        "</div>" +
        "<p style='font-size:15px; line-height:1.5; color:#334155;'>Hello,</p>" +
        "<p style='font-size:15px; line-height:1.5; color:#334155;'>Your 6-digit verification code to sign in is:</p>" +
        "<div style='background:#fff7ed; border:2px dashed #fb923c; font-size:32px; font-weight:800; letter-spacing:8px; color:#c2410c; padding:16px 24px; border-radius:8px; text-align:center; font-family:monospace; margin:20px 0;'>" + code + "</div>" +
        "<p style='color:#64748b; font-size:13px; line-height:1.5;'>This verification code is valid for 10 minutes. If you did not request this code, you can safely ignore this email.</p>" +
        "<hr style='border:none; border-top:1px solid #e2e8f0; margin:20px 0;' />" +
        "<p style='color:#94a3b8; font-size:11px; margin:0;'>Science Olympiad 2027 Division B • Thermodynamics Preparation Platform</p>" +
        "</div>";

      MailApp.sendEmail({
        to: recipient,
        subject: subject,
        htmlBody: htmlBody,
        body: "Your ThermoOlyMaster verification code is: " + code + "\nValid for 10 minutes."
      });
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "active",
    app: "ThermoOlyMaster Science Olympiad 2027",
    timestamp: new Date()
  })).setMimeType(ContentService.MimeType.JSON);
}
`;
  }
}

export const sheetsSyncManager = new SheetsSyncManager();
