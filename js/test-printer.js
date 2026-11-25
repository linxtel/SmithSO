/**
 * ThermoOlyMaster - Test Printer Module
 * Generates print-ready paper competition test booklets,
 * optical mark recognition (OMR) bubble answer sheets with corner fiducial marks,
 * and event supervisor answer keys.
 */

import { EXAM_QUESTIONS, selectRuleCompliantQuestions, generateDynamicQuestionVariant, formatMathHtml } from './exam-arena.js';

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
            size: A4 portrait;
            margin: 10mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          html, body {
            width: 100%;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #000000;
            background: #ffffff;
            line-height: 1.22;
            font-size: 8.5pt;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .page {
            width: 100%;
            max-width: 190mm;
            margin: 0 auto;
            break-after: page;
            page-break-after: always;
            position: relative;
          }
          .page:last-child {
            break-after: auto;
            page-break-after: avoid;
          }
          .header-box {
            border: 1.5px solid #000;
            padding: 5px 8px;
            margin-bottom: 6px;
          }
          .header-title {
            text-align: center;
            font-size: 11.5pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.35px;
            margin-bottom: 2px;
          }
          .header-sub {
            text-align: center;
            font-size: 8pt;
            font-weight: 600;
            color: #333;
            margin-bottom: 5px;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px 10px;
            font-size: 8pt;
          }
          .meta-field {
            display: flex;
            align-items: flex-end;
            min-width: 0;
          }
          .meta-label {
            font-weight: bold;
            margin-right: 4px;
            white-space: nowrap;
          }
          .meta-line {
            flex: 1;
            border-bottom: 1px solid #000;
            min-height: 11px;
            min-width: 20px;
          }
          .instructions-box {
            background: #f4f4f4;
            border: 1px solid #ccc;
            padding: 4px 7px;
            font-size: 7.4pt;
            line-height: 1.2;
            margin-bottom: 6px;
          }
          .questions-flow {
            width: 100%;
          }
          .q-block {
            margin-bottom: 5.5px;
            break-inside: avoid;
            page-break-inside: avoid;
            overflow-wrap: break-word;
            word-wrap: break-word;
          }
          .q-title {
            font-size: 8.5pt;
            font-weight: 700;
            margin-bottom: 2px;
          }
          .q-tag {
            font-size: 6.5pt;
            font-weight: bold;
            color: #555;
            text-transform: uppercase;
            border: 1px solid #777;
            padding: 0px 3px;
            border-radius: 2px;
            margin-left: 4px;
            white-space: nowrap;
          }
          .opt-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1.5px 8px;
            margin-left: 8px;
            font-size: 8pt;
          }
          .opt-item {
            display: flex;
            align-items: flex-start;
            min-width: 0;
            overflow-wrap: break-word;
          }
          .opt-letter {
            font-weight: 700;
            width: 17px;
            flex-shrink: 0;
          }

          /* Mathematical Formula Typography (Subscripts, Superscripts & Stacked Fractions) */
          sub, sup {
            font-size: 74%;
            line-height: 0;
            position: relative;
            vertical-align: baseline;
          }
          sup {
            top: -0.42em;
          }
          sub {
            bottom: -0.22em;
          }
          .math-frac {
            display: inline-flex;
            flex-direction: column;
            align-items: center;
            vertical-align: middle;
            font-size: 0.84em;
            line-height: 1.02;
            margin: 0 0.12em;
            text-align: center;
          }
          .math-frac > .num {
            border-bottom: 1px solid #000;
            padding: 0 0.16em 0.03em;
            width: 100%;
          }
          .math-frac > .den {
            padding: 0.03em 0.16em 0;
            width: 100%;
          }

          /* OMR Bubble Sheet Styles — Strictly locked to 1 single A4 printable page (190mm x 273mm) */
          .omr-page {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .omr-sheet {
            border: 2.5px solid #000;
            padding: 12mm 10mm 9mm;
            width: 100%;
            height: 273mm;
            max-height: 273mm;
            overflow: hidden;
            position: relative;
            background: #fff;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .fiducial-mark {
            position: absolute;
            width: 16px;
            height: 16px;
            background: #000;
          }
          .fiducial-tl { top: 8px; left: 8px; }
          .fiducial-tr { top: 8px; right: 8px; }
          .fiducial-bl { bottom: 8px; left: 8px; }
          .fiducial-br { bottom: 8px; right: 8px; }

          .omr-title-block {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 6px;
            margin-bottom: 8px;
          }
          .omr-meta-grid {
            display: grid;
            grid-template-columns: 2.2fr 1fr;
            gap: 10px;
            margin-bottom: 8px;
            font-size: 8.5pt;
          }
          .omr-info-box {
            border: 1px solid #000;
            padding: 6px 8px;
            display: flex;
            flex-direction: column;
            gap: 5px;
          }
          .omr-info-row {
            display: flex;
            align-items: flex-end;
            gap: 8px;
          }
          .omr-grid-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            margin-top: 4px;
            flex: 1;
            align-content: start;
          }
          .omr-column {
            display: flex;
            flex-direction: column;
            gap: 5px;
          }
          .omr-row {
            display: flex;
            align-items: center;
            padding: 2.5px 6px;
            border-bottom: 1px dotted #ccc;
          }
          .omr-qnum {
            width: 28px;
            font-weight: bold;
            font-size: 9.5pt;
            text-align: right;
            margin-right: 10px;
            font-family: monospace;
          }
          .omr-bubbles {
            display: flex;
            gap: 11px;
            align-items: center;
          }
          .bubble-circle {
            width: 20px;
            height: 20px;
            border: 1.8px solid #000;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 7.5pt;
            font-weight: bold;
            font-family: monospace;
          }
          /* Compact mode when 25-30+ questions are printed on one A4 bubble sheet */
          .omr-sheet.omr-compact .omr-column {
            gap: 2.5px;
          }
          .omr-sheet.omr-compact .omr-row {
            padding: 1.5px 5px;
          }
          .omr-sheet.omr-compact .bubble-circle {
            width: 17px;
            height: 17px;
            font-size: 7pt;
          }
          .omr-sheet.omr-compact .omr-qnum {
            font-size: 8.5pt;
          }

          /* Answer Key Specifics */
          table.key-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 7.8pt;
            margin-top: 5px;
            table-layout: fixed;
          }
          table.key-table thead {
            display: table-header-group;
          }
          table.key-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          table.key-table th, table.key-table td {
            border: 1px solid #333;
            padding: 2.5px 4px;
            text-align: left;
            overflow-wrap: break-word;
            word-wrap: break-word;
          }
          table.key-table th {
            background: #eee;
          }
          .correct-badge {
            font-weight: bold;
            font-size: 8.5pt;
            font-family: monospace;
            padding: 1px 4px;
            background: #e2e8f0;
            border: 1px solid #000;
          }

          @media screen {
            body {
              background: #e5e7eb;
              padding-bottom: 24px;
            }
            .page {
              width: 210mm;
              max-width: 210mm;
              min-height: 297mm;
              background: #ffffff;
              padding: 10mm;
              margin: 14px auto;
              box-shadow: 0 4px 18px rgba(0, 0, 0, 0.16);
            }
          }

          @media print {
            .no-print { display: none !important; }
            html, body {
              background: #ffffff !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .page {
              width: 100% !important;
              max-width: none !important;
              min-height: 0 !important;
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="padding: 10px; background: #ffffcc; border-bottom: 1px solid #e0c000; text-align: center; font-size: 10pt;">
          <strong>A4 Ready (210mm × 297mm):</strong> Press Ctrl+P / Cmd+P, select <strong>Paper size: A4</strong>, Margins: Default, Scale: 100%, and enable "Background graphics".
          <button onclick="window.print()" style="margin-left: 15px; padding: 4px 12px; font-weight: bold; cursor: pointer;">🖨️ Print A4 Now</button>
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
  getRuleCompliantQuestions(count = 18, isRandom = false, useDynamicNumbers = false) {
    const selected = selectRuleCompliantQuestions(this.questions, count, isRandom);
    if (useDynamicNumbers) {
      return selected.map(q => generateDynamicQuestionVariant(q, true));
    }
    return selected;
  }

  /**
   * Builds the Paper Test Booklet HTML.
   */
  generateTestBookletHtml(count = 20, isRandom = false, customQList = null) {
    const qList = customQList || this.getRuleCompliantQuestions(count, isRandom);

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
            ${idx + 1}. ${formatMathHtml(q.text)}
            <span class="q-tag">${q.area}</span>
          </div>
          <div class="opt-grid">
      `;
      q.options.forEach((opt, oIdx) => {
        html += `
          <div class="opt-item">
            <span class="opt-letter">(${letters[oIdx]})</span>
            <span>${formatMathHtml(opt)}</span>
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
    const compactClass = count > 20 ? ' omr-compact' : '';

    let html = `
      <div class="page omr-page">
        <div class="omr-sheet${compactClass}">
          <!-- 4 Corner Alignment Fiducial Marks for Auto-Scanning -->
          <div class="fiducial-mark fiducial-tl"></div>
          <div class="fiducial-mark fiducial-tr"></div>
          <div class="fiducial-mark fiducial-bl"></div>
          <div class="fiducial-mark fiducial-br"></div>

          <div>
            <div class="omr-title-block">
              <div style="font-size: 13.5pt; font-weight: 800; letter-spacing: 0.4px;">SCIENCE OLYMPIAD THERMODYNAMICS</div>
              <div style="font-size: 9pt; font-weight: 600; color: #444;">OFFICIAL OMR BUBBLE ANSWER SHEET • DIVISION B (A4)</div>
            </div>

            <div class="omr-meta-grid">
              <div class="omr-info-box">
                <div class="omr-info-row">
                  <div class="meta-field" style="flex:1;"><span class="meta-label">Team Name:</span><span class="meta-line"></span></div>
                </div>
                <div class="omr-info-row">
                  <div class="meta-field" style="flex:1;"><span class="meta-label">Student 1:</span><span class="meta-line"></span></div>
                  <div class="meta-field" style="flex:1;"><span class="meta-label">Student 2:</span><span class="meta-line"></span></div>
                </div>
                <div class="omr-info-row">
                  <div class="meta-field" style="flex:1;"><span class="meta-label">Date:</span><span class="meta-line"></span></div>
                  <div class="meta-field" style="flex:1;"><span class="meta-label">Room / Station:</span><span class="meta-line"></span></div>
                </div>
              </div>
              <div style="border: 1px solid #000; padding: 6px; text-align: center; display: flex; flex-direction: column; justify-content: center;">
                <strong style="font-size: 8.5pt;">TEAM NUMBER</strong>
                <div style="display: flex; justify-content: center; gap: 4px; margin: 5px 0 3px;">
                  <div style="border: 1px solid #000; width: 19px; height: 24px;"></div>
                  <div style="border: 1px solid #000; width: 19px; height: 24px;"></div>
                  <div style="border: 1px solid #000; width: 19px; height: 24px;"></div>
                </div>
                <span style="font-size: 7pt; color: #555;">(e.g., B04, B12)</span>
              </div>
            </div>

            <div style="background: #f0f0f0; border: 1px solid #888; padding: 4px 6px; font-size: 7.5pt; text-align: center; margin-bottom: 8px;">
              <strong>SCORING INSTRUCTIONS:</strong> Use a dark #2 pencil or black pen. Darken each bubble completely. Example: 
              <span style="display:inline-flex; align-items:center; gap:2px; vertical-align:middle;">
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#000;"></span>
              </span>. 
              Do NOT use checkmarks or crosses. Erase cleanly. Do NOT fold or make stray marks outside the bubble boxes.
            </div>
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
          <div style="margin-top: 8px; border-top: 1px solid #000; padding-top: 6px; display: flex; justify-content: space-between; font-size: 7.5pt; color: #555;">
            <span>ThermoOlyMaster OMR Version 2.0 • Division B Calibration Form (A4)</span>
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
  generateAnswerKeyHtml(count = 20, customQList = null) {
    const qList = customQList || this.getRuleCompliantQuestions(count, false);
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
              <th style="width: 6%; text-align: center;">Q#</th>
              <th style="width: 8%; text-align: center;">Key</th>
              <th style="width: 24%;">Syllabus Area</th>
              <th style="width: 62%;">Solution Derivation & Explanation</th>
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
          <td>${formatMathHtml(q.explanation)}</td>
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
  printFullCompetitionPacket(count = 20, useDynamicNumbers = false) {
    const qList = this.getRuleCompliantQuestions(count, useDynamicNumbers, useDynamicNumbers);
    const booklet = this.generateTestBookletHtml(count, false, qList);
    const bubbleSheet = this.generateBubbleSheetHtml(count);
    const key = this.generateAnswerKeyHtml(count, qList);

    const fullHtml = booklet + bubbleSheet + key;
    const suffix = useDynamicNumbers ? ' • Dynamic Variant' : '';
    this.openPrintWindow(fullHtml, `ThermoOlyMaster Competition Packet (${count} Questions${suffix})`);
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
