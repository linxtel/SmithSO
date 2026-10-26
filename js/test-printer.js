/**
 * ThermoOlyMaster - Test Printer Module
 * Generates print-ready paper competition test booklets,
 * optical mark recognition (OMR) bubble answer sheets with corner fiducial marks,
 * and event supervisor answer keys.
 */

import { EXAM_QUESTIONS } from './exam-arena.js';

export class TestPrinter {
  constructor() {
    this.questions = [...EXAM_QUESTIONS];
  }

  /**
   * Generates and opens a printable document in a new window.
   */
  openPrintWindow(contentHtml, title = 'ThermoOlyMaster Competition Test') {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      if (window.showToast) {
        window.showToast('Please allow popups to print the test and bubble sheet.', 'warning');
      }
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          @page {
            size: letter portrait;
            margin: 0.5in;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #000000;
            background: #ffffff;
            line-height: 1.4;
            font-size: 11pt;
          }
          .page {
            page-break-after: always;
            position: relative;
            padding-bottom: 20px;
          }
          .page:last-child {
            page-break-after: avoid;
          }
          .header-box {
            border: 2px solid #000;
            padding: 12px;
            margin-bottom: 16px;
          }
          .header-title {
            text-align: center;
            font-size: 16pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
          }
          .header-sub {
            text-align: center;
            font-size: 10pt;
            font-weight: 600;
            color: #333;
            margin-bottom: 12px;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 16px;
            font-size: 10pt;
          }
          .meta-field {
            display: flex;
            align-items: flex-end;
          }
          .meta-label {
            font-weight: bold;
            margin-right: 6px;
            white-space: nowrap;
          }
          .meta-line {
            flex: 1;
            border-bottom: 1px solid #000;
            min-height: 16px;
          }
          .instructions-box {
            background: #f4f4f4;
            border: 1px solid #ccc;
            padding: 8px 12px;
            font-size: 9pt;
            margin-bottom: 16px;
          }
          .q-block {
            margin-bottom: 14px;
            page-break-inside: avoid;
          }
          .q-title {
            font-weight: 700;
            margin-bottom: 4px;
          }
          .q-tag {
            font-size: 8pt;
            font-weight: bold;
            color: #555;
            text-transform: uppercase;
            border: 1px solid #777;
            padding: 1px 4px;
            border-radius: 3px;
            margin-left: 6px;
          }
          .opt-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px 12px;
            margin-left: 14px;
            font-size: 10pt;
          }
          .opt-item {
            display: flex;
            align-items: flex-start;
          }
          .opt-letter {
            font-weight: 700;
            width: 20px;
            flex-shrink: 0;
          }

          /* OMR Bubble Sheet Styles */
          .omr-sheet {
            border: 3px solid #000;
            padding: 24px;
            min-height: 9.8in;
            position: relative;
            background: #fff;
          }
          .fiducial-mark {
            position: absolute;
            width: 20px;
            height: 20px;
            background: #000;
          }
          .fiducial-tl { top: 12px; left: 12px; }
          .fiducial-tr { top: 12px; right: 12px; }
          .fiducial-bl { bottom: 12px; left: 12px; }
          .fiducial-br { bottom: 12px; right: 12px; }

          .omr-title-block {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
            margin-bottom: 16px;
          }
          .omr-grid-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 10px;
          }
          .omr-column {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .omr-row {
            display: flex;
            align-items: center;
            padding: 3px 6px;
            border-bottom: 1px dotted #ccc;
          }
          .omr-qnum {
            width: 32px;
            font-weight: bold;
            font-size: 10pt;
            text-align: right;
            margin-right: 12px;
            font-family: monospace;
          }
          .omr-bubbles {
            display: flex;
            gap: 12px;
            align-items: center;
          }
          .bubble-circle {
            width: 22px;
            height: 22px;
            border: 2px solid #000;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 8pt;
            font-weight: bold;
            font-family: monospace;
          }

          /* Answer Key Specifics */
          table.key-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
            margin-top: 10px;
          }
          table.key-table th, table.key-table td {
            border: 1px solid #333;
            padding: 5px 8px;
            text-align: left;
          }
          table.key-table th {
            background: #eee;
          }
          .correct-badge {
            font-weight: bold;
            font-size: 11pt;
            font-family: monospace;
            padding: 2px 6px;
            background: #e2e8f0;
            border: 1px solid #000;
          }

          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="padding: 10px; background: #ffffcc; border-bottom: 1px solid #e0c000; text-align: center; font-size: 11pt;">
          <strong>Ready to print:</strong> Click your browser's Print button (or press Ctrl+P / Cmd+P). Make sure "Background graphics" is enabled if bubbles do not appear.
          <button onclick="window.print()" style="margin-left: 15px; padding: 4px 12px; font-weight: bold; cursor: pointer;">🖨️ Print Now</button>
        </div>
        ${contentHtml}
      </body>
      </html>
    `);

    printWindow.document.close();
  }

  /**
   * Generates a balanced question list strictly compliant with the official tournament rule:
   * "The test will consist of at least three questions from each of the following areas: i, ii, iii, iv, v, vi."
   */
  getRuleCompliantQuestions(count = 18, isRandom = false) {
    const areaKeys = [
      'Area 1: Foundations & Scales',
      'Area 2: Phases & Gas Laws',
      'Area 3: Heat Transfer Mechanics',
      'Area 4: Processes & Cycles',
      'Area 5: History of Thermodynamics',
      'Area 6: Advanced Radiation & 3rd Law'
    ];

    // Group questions by syllabus area
    const grouped = {};
    areaKeys.forEach(area => {
      let pool = this.questions.filter(q => q.area === area);
      if (isRandom) {
        pool = [...pool].sort(() => 0.5 - Math.random());
      }
      grouped[area] = pool;
    });

    // Each area receives at least 3 questions to satisfy the official rule
    const perArea = Math.max(3, Math.floor(count / 6));
    let selected = [];

    areaKeys.forEach(area => {
      const pool = grouped[area];
      selected.push(...pool.slice(0, Math.min(perArea, pool.length)));
    });

    // If more questions needed to meet total count, pick from remaining unpicked questions
    if (selected.length < count) {
      let remaining = this.questions.filter(q => !selected.some(s => s.id === q.id));
      if (isRandom) {
        remaining = [...remaining].sort(() => 0.5 - Math.random());
      }
      selected.push(...remaining.slice(0, count - selected.length));
    }

    // Sort by id for clean sequential test presentation
    return selected.slice(0, count).sort((a, b) => a.id - b.id);
  }

  /**
   * Builds the Paper Test Booklet HTML.
   */
  generateTestBookletHtml(count = 20, isRandom = false) {
    const qList = this.getRuleCompliantQuestions(count, isRandom);

    let html = `
      <div class="page">
        <div class="header-box">
          <div class="header-title">Science Olympiad — Thermodynamics (Div B)</div>
          <div class="header-sub">Official Written Examination (Part 1 — ES Mode: 50 Points) • 2027 Ruleset</div>
          <div class="meta-grid">
            <div class="meta-field"><span class="meta-label">School / Team Name:</span><span class="meta-line"></span></div>
            <div class="meta-field"><span class="meta-label">Team Number:</span><span class="meta-line"></span></div>
            <div class="meta-field"><span class="meta-label">Student 1 Name:</span><span class="meta-line"></span></div>
            <div class="meta-field"><span class="meta-label">Student 2 Name:</span><span class="meta-line"></span></div>
          </div>
        </div>

        <div class="instructions-box">
          <strong>GENERAL INSTRUCTIONS & RULES (Rule 5.a – 5.d):</strong><br>
          1. <strong>Time Allowed:</strong> 50 minutes. Maximum Part 1 Exam Score is 50 points.<br>
          2. <strong>Resources Allowed:</strong> Each team may bring ONE 2" or smaller 3-ring binder containing reference notes and up to TWO standalone calculators (Class III).<br>
          3. <strong>Calculations:</strong> Metric (SI) units only. All calculations require standard arithmetic and single-variable algebra only (NO trigonometry or calculus).<br>
          4. <strong>Answering:</strong> Record all answers by completely filling the corresponding bubbles (A, B, C, or D) on your official OMR Answer Sheet with a #2 pencil. Answers on this question booklet will NOT be scored.
        </div>

        <div class="questions-flow">
    `;

    qList.forEach((q, idx) => {
      const letters = ['A', 'B', 'C', 'D'];
      html += `
        <div class="q-block">
          <div class="q-title">
            ${idx + 1}. ${q.text}
            <span class="q-tag">${q.area}</span>
          </div>
          <div class="opt-grid">
      `;
      q.options.forEach((opt, oIdx) => {
        html += `
          <div class="opt-item">
            <span class="opt-letter">(${letters[oIdx]})</span>
            <span>${opt}</span>
          </div>
        `;
      });
      html += `
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Builds the official Scantron / OMR Bubble Sheet HTML with corner fiducial marks.
   */
  generateBubbleSheetHtml(count = 20) {
    const half = Math.ceil(count / 2);
    const letters = ['A', 'B', 'C', 'D'];

    let html = `
      <div class="page">
        <div class="omr-sheet">
          <!-- 4 Corner Alignment Fiducial Marks for Auto-Scanning -->
          <div class="fiducial-mark fiducial-tl"></div>
          <div class="fiducial-mark fiducial-tr"></div>
          <div class="fiducial-mark fiducial-bl"></div>
          <div class="fiducial-mark fiducial-br"></div>

          <div class="omr-title-block">
            <div style="font-size: 15pt; font-weight: 800; letter-spacing: 0.5px;">SCIENCE OLYMPIAD THERMODYNAMICS</div>
            <div style="font-size: 10pt; font-weight: 600; color: #444;">OFFICIAL OMR BUBBLE ANSWER SHEET • DIVISION B</div>
          </div>

          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 15px; margin-bottom: 12px; font-size: 9.5pt;">
            <div style="border: 1px solid #000; padding: 8px;">
              <div style="margin-bottom: 6px;"><strong>Team Name:</strong> _________________________________________</div>
              <div style="margin-bottom: 6px;"><strong>Student 1:</strong> __________________ <strong>Student 2:</strong> __________________</div>
              <div><strong>Date:</strong> _______________________ <strong>Room / Station:</strong> _________________</div>
            </div>
            <div style="border: 1px solid #000; padding: 8px; text-align: center;">
              <strong>TEAM NUMBER</strong>
              <div style="display: flex; justify-content: center; gap: 4px; margin-top: 6px;">
                <div style="border: 1px solid #000; width: 20px; height: 26px;"></div>
                <div style="border: 1px solid #000; width: 20px; height: 26px;"></div>
                <div style="border: 1px solid #000; width: 20px; height: 26px;"></div>
              </div>
              <span style="font-size: 7.5pt; color: #555;">(e.g., B04, B12)</span>
            </div>
          </div>

          <div style="background: #f0f0f0; border: 1px solid #888; padding: 6px; font-size: 8pt; text-align: center; margin-bottom: 12px;">
            <strong>SCORING INSTRUCTIONS:</strong> Use a dark #2 pencil or black pen. Darken each bubble completely. Example: 
            <span style="display:inline-flex; align-items:center; gap:2px; vertical-align:middle;">
              <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:#000;"></span>
            </span>. 
            Do NOT use checkmarks or crosses. Erase cleanly. Do NOT fold or make stray marks outside the bubble boxes.
          </div>

          <!-- Question Bubble Grid (2 Columns) -->
          <div class="omr-grid-container" id="omrBubbleGridArea">
            <!-- Left Column -->
            <div class="omr-column">
    `;

    for (let i = 0; i < half; i++) {
      html += `
        <div class="omr-row" data-q="${i + 1}">
          <span class="omr-qnum">${i + 1}.</span>
          <div class="omr-bubbles">
            ${letters.map(l => `<span class="bubble-circle" data-opt="${l}">${l}</span>`).join('')}
          </div>
        </div>
      `;
    }

    html += `
            </div>
            <!-- Right Column -->
            <div class="omr-column">
    `;

    for (let i = half; i < count; i++) {
      html += `
        <div class="omr-row" data-q="${i + 1}">
          <span class="omr-qnum">${i + 1}.</span>
          <div class="omr-bubbles">
            ${letters.map(l => `<span class="bubble-circle" data-opt="${l}">${l}</span>`).join('')}
          </div>
        </div>
      `;
    }

    html += `
            </div>
          </div>

          <!-- Bottom Supervisor Area -->
          <div style="margin-top: 20px; border-top: 1px solid #000; padding-top: 8px; display: flex; justify-content: space-between; font-size: 8pt; color: #555;">
            <span>ThermoOlyMaster OMR Version 2.0 • Division B Calibration Form</span>
            <span>OFFICIAL SCORE: _______ / ${count} (${((count/count)*50).toFixed(0)} ES pts)</span>
          </div>
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Builds the Supervisor Master Answer Key and Grading Rubric HTML.
   */
  generateAnswerKeyHtml(count = 20) {
    const qList = this.getRuleCompliantQuestions(count, false);
    const letters = ['A', 'B', 'C', 'D'];

    let html = `
      <div class="page">
        <div class="header-box">
          <div class="header-title">EVENT SUPERVISOR MASTER ANSWER KEY</div>
          <div class="header-sub">Science Olympiad Thermodynamics (Div B) • Official Scoring Rubric & Tiebreakers</div>
        </div>

        <table class="key-table">
          <thead>
            <tr>
              <th style="width: 35px;">Q#</th>
              <th style="width: 50px;">Key</th>
              <th style="width: 150px;">Syllabus Area</th>
              <th>Solution Derivation & Explanation</th>
            </tr>
          </thead>
          <tbody>
    `;

    qList.forEach((q, idx) => {
      html += `
        <tr>
          <td style="font-weight: bold; text-align: center;">${idx + 1}</td>
          <td style="text-align: center;"><span class="correct-badge">${letters[q.correct]}</span></td>
          <td style="font-size: 8pt;">${q.area}</td>
          <td>${q.explanation}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    return html;
  }

  /**
   * Prints the complete competition package (Test Booklet + OMR Bubble Sheet + Key).
   */
  printFullCompetitionPacket(count = 20) {
    const booklet = this.generateTestBookletHtml(count, false);
    const bubbleSheet = this.generateBubbleSheetHtml(count);
    const key = this.generateAnswerKeyHtml(count);

    const fullHtml = booklet + bubbleSheet + key;
    this.openPrintWindow(fullHtml, `ThermoOlyMaster Competition Packet (${count} Questions)`);
  }

  /**
   * Prints only the OMR Bubble Sheet.
   */
  printBubbleSheetOnly(count = 20) {
    const bubbleSheet = this.generateBubbleSheetHtml(count);
    this.openPrintWindow(bubbleSheet, `ThermoOlyMaster OMR Bubble Sheet (${count} Questions)`);
  }

  /**
   * Prints only the Question Test Booklet.
   */
  printTestBookletOnly(count = 20) {
    const booklet = this.generateTestBookletHtml(count, false);
    this.openPrintWindow(booklet, `ThermoOlyMaster Test Booklet (${count} Questions)`);
  }

  /**
   * Prints only the Supervisor Answer Key.
   */
  printAnswerKeyOnly(count = 20) {
    const key = this.generateAnswerKeyHtml(count);
    this.openPrintWindow(key, `ThermoOlyMaster Supervisor Answer Key (${count} Questions)`);
  }
}
