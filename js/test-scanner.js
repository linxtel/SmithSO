/**
 * ThermoOlyMaster - Test Scanner & Auto-Grader Module (OMR Computer Vision)
 * Reads scanned or photographed bubble sheets, detects filled pencil marks,
 * scores them against the official Science Olympiad answer key, generates
 * visual overlays, and syncs the ES score directly to the Tournament Calculator!
 */

import { EXAM_QUESTIONS } from './exam-arena.js';
import { authManager } from './auth-manager.js';

export class TestScanner {
  constructor() {
    this.questions = [...EXAM_QUESTIONS];
    this.activeQuestionCount = 20; // default competition length
    this.detectedAnswers = [];     // Array of detected answers: [0, 1, 2, ...] or -1 if blank
    this.rawScore = 0;
    this.examScore50 = 0;
    this.gradedResults = [];

    this.stream = null;
    this.currentImage = null;
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    // File upload input
    const fileInput = document.getElementById('scannerFileInput');
    const dropZone = document.getElementById('scannerDropZone');

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.processImageFile(e.target.files[0]);
        }
      });
    }

    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.processImageFile(e.dataTransfer.files[0]);
        }
      });
    }

    // Sample sheet test button
    const btnSample = document.getElementById('scannerBtnSample');
    if (btnSample) {
      btnSample.addEventListener('click', () => {
        this.loadSampleScannedSheet();
      });
    }

    // Webcam buttons
    const btnWebcam = document.getElementById('scannerBtnWebcam');
    const btnCapture = document.getElementById('scannerBtnCapture');
    const btnStopCam = document.getElementById('scannerBtnStopCam');

    if (btnWebcam) {
      btnWebcam.addEventListener('click', () => this.startWebcam());
    }
    if (btnCapture) {
      btnCapture.addEventListener('click', () => this.captureWebcamFrame());
    }
    if (btnStopCam) {
      btnStopCam.addEventListener('click', () => this.stopWebcam());
    }

    // Export to Tournament Calculator button
    const btnExport = document.getElementById('scannerBtnExportCalc');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.exportToTournamentCalculator());
    }

    // Question count selector for scanning
    const countSelect = document.getElementById('scannerCountSelect');
    if (countSelect) {
      countSelect.addEventListener('change', (e) => {
        this.activeQuestionCount = parseInt(e.target.value, 10);
        if (this.currentImage) {
          this.analyzeAndGrade(this.currentImage);
        }
      });
    }
  }

  /**
   * Reads an uploaded image file (PNG/JPG) into an Image object.
   */
  processImageFile(file) {
    if (!file.type.match('image.*')) {
      if (window.showToast) window.showToast('Please upload a valid image file (PNG or JPG).', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        this.currentImage = img;
        this.analyzeAndGrade(img);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  /**
   * Starts the user's camera / webcam for live sheet capture.
   */
  async startWebcam() {
    const video = document.getElementById('scannerVideo');
    const camContainer = document.getElementById('scannerCamContainer');
    const btnCapture = document.getElementById('scannerBtnCapture');
    const btnStopCam = document.getElementById('scannerBtnStopCam');
    const btnWebcam = document.getElementById('scannerBtnWebcam');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (window.showToast) window.showToast('Camera access is not supported by your browser.', 'error');
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } }
      });
      if (video) {
        video.srcObject = this.stream;
        video.play();
      }
      if (camContainer) camContainer.style.display = 'block';
      if (btnCapture) btnCapture.style.display = 'inline-flex';
      if (btnStopCam) btnStopCam.style.display = 'inline-flex';
      if (btnWebcam) btnWebcam.style.display = 'none';

      if (window.showToast) window.showToast('Camera active. Align sheet inside viewfinder and click Capture.', 'info');
    } catch (err) {
      console.error(err);
      if (window.showToast) window.showToast('Unable to access camera: ' + err.message, 'error');
    }
  }

  stopWebcam() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    const camContainer = document.getElementById('scannerCamContainer');
    const btnCapture = document.getElementById('scannerBtnCapture');
    const btnStopCam = document.getElementById('scannerBtnStopCam');
    const btnWebcam = document.getElementById('scannerBtnWebcam');

    if (camContainer) camContainer.style.display = 'none';
    if (btnCapture) btnCapture.style.display = 'none';
    if (btnStopCam) btnStopCam.style.display = 'none';
    if (btnWebcam) btnWebcam.style.display = 'inline-flex';
  }

  captureWebcamFrame() {
    const video = document.getElementById('scannerVideo');
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.onload = () => {
      this.currentImage = img;
      this.stopWebcam();
      this.analyzeAndGrade(img);
    };
    img.src = canvas.toDataURL('image/png');
  }

  /**
   * Generates a synthetic scanned bubble sheet (simulating 90% correct answers)
   * so teachers and students can test the grading engine immediately without printing!
   */
  loadSampleScannedSheet() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1100;
    const ctx = canvas.getContext('2d');

    // White paper background with slight texture
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border and title
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

    // Fiducial Marks in 4 corners
    ctx.fillStyle = '#000000';
    ctx.fillRect(40, 40, 22, 22);
    ctx.fillRect(canvas.width - 62, 40, 22, 22);
    ctx.fillRect(40, canvas.height - 62, 22, 22);
    ctx.fillRect(canvas.width - 62, canvas.height - 62, 22, 22);

    // Header Text
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCIENCE OLYMPIAD THERMODYNAMICS', canvas.width / 2, 75);
    ctx.font = '13px sans-serif';
    ctx.fillText('OFFICIAL OMR BUBBLE ANSWER SHEET • DIVISION B', canvas.width / 2, 98);

    // Student Info simulated
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Team Name: Centerville Middle School (Team B04)', 60, 135);
    ctx.fillText('Students: Alex Chen & Maya Patel', 60, 155);

    // Draw the bubble grid
    const totalQ = this.activeQuestionCount;
    const half = Math.ceil(totalQ / 2);
    const letters = ['A', 'B', 'C', 'D'];

    const col1X = 70;
    const col2X = 440;
    const startY = 210;
    const rowH = 36;
    const bubbleGap = 32;

    for (let i = 0; i < totalQ; i++) {
      const isCol2 = i >= half;
      const qIdxInCol = isCol2 ? (i - half) : i;
      const x = isCol2 ? col2X : col1X;
      const y = startY + qIdxInCol * rowH;

      // Question number
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${i + 1}.`, x + 35, y + 15);

      // Bubbles
      const correctOpt = this.questions[i] ? this.questions[i].correct : (i % 4);
      // Make 90% correct, miss questions 7 and 14 for realistic demo
      let chosenOpt = correctOpt;
      if (i === 6) chosenOpt = (correctOpt + 1) % 4; // miss Q7
      if (i === 13) chosenOpt = (correctOpt + 2) % 4; // miss Q14

      for (let o = 0; o < 4; o++) {
        const bx = x + 60 + o * bubbleGap;
        const by = y + 10;
        const radius = 10;

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(bx, by, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(letters[o], bx, by + 3.5);

        // Fill chosen bubble with realistic dark pencil mark
        if (o === chosenOpt) {
          ctx.fillStyle = '#1a1a1a'; // dark pencil graphite
          ctx.beginPath();
          ctx.arc(bx, by, radius - 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const img = new Image();
    img.onload = () => {
      this.currentImage = img;
      this.analyzeAndGrade(img);
      if (window.showToast) window.showToast('Sample Scanned Sheet loaded! Auto-grading complete.', 'success');
    };
    img.src = canvas.toDataURL('image/png');
  }

  /**
   * Main Optical Mark Recognition (OMR) algorithm:
   * Analyzes pixel darkness at predicted bubble locations, scores answers,
   * and draws visual overlays.
   */
  analyzeAndGrade(image) {
    const canvas = document.getElementById('scannerResultCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Standardize processing dimensions
    const stdW = 800;
    const stdH = 1100;
    canvas.width = stdW;
    canvas.height = stdH;

    // Draw the scanned image scaled to canvas
    ctx.drawImage(image, 0, 0, stdW, stdH);

    // Get pixel data for luminance analysis
    const imgData = ctx.getImageData(0, 0, stdW, stdH);
    const data = imgData.data;

    // Helper: samples average darkness inside a circle of radius R at (cx, cy)
    // Returns 0 (white paper) to 255 (pitch black)
    const getBubbleDarkness = (cx, cy, r = 8) => {
      let totalDarkness = 0;
      let count = 0;

      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r) {
            const px = Math.round(cx + dx);
            const py = Math.round(cy + dy);
            if (px >= 0 && px < stdW && py >= 0 && py < stdH) {
              const idx = (py * stdW + px) * 4;
              const rVal = data[idx];
              const gVal = data[idx + 1];
              const bVal = data[idx + 2];
              // Standard perceptual luminance
              const luminance = 0.299 * rVal + 0.587 * gVal + 0.114 * bVal;
              totalDarkness += (255 - luminance);
              count++;
            }
          }
        }
      }
      return count > 0 ? (totalDarkness / count) : 0;
    };

    const totalQ = Math.min(this.activeQuestionCount, this.questions.length);
    const half = Math.ceil(totalQ / 2);
    const col1X = 70;
    const col2X = 440;
    const startY = 210;
    const rowH = 36;
    const bubbleGap = 32;

    this.detectedAnswers = [];
    this.gradedResults = [];
    this.rawScore = 0;

    for (let i = 0; i < totalQ; i++) {
      const isCol2 = i >= half;
      const qIdxInCol = isCol2 ? (i - half) : i;
      const x = isCol2 ? col2X : col1X;
      const y = startY + qIdxInCol * rowH;

      const q = this.questions[i];
      const correctOpt = q ? q.correct : 0;

      const darknessScores = [];
      const coords = [];

      for (let o = 0; o < 4; o++) {
        const bx = x + 60 + o * bubbleGap;
        const by = y + 10;
        coords.push({ x: bx, y: by });
        const d = getBubbleDarkness(bx, by, 7);
        darknessScores.push(d);
      }

      // Determine darkest marked bubble
      let maxD = -1;
      let chosenOpt = -1;
      for (let o = 0; o < 4; o++) {
        if (darknessScores[o] > maxD) {
          maxD = darknessScores[o];
          chosenOpt = o;
        }
      }

      // Threshold: must be significantly darker than unshaded paper threshold (~55)
      // and noticeably darker than the second darkest bubble
      const sortedD = [...darknessScores].sort((a, b) => b - a);
      const isMarked = maxD > 65 && (sortedD[0] - sortedD[1] > 20);

      const finalAnswer = isMarked ? chosenOpt : -1;
      this.detectedAnswers.push(finalAnswer);

      const isCorrect = finalAnswer === correctOpt;
      if (isCorrect) this.rawScore++;

      this.gradedResults.push({
        qNum: i + 1,
        question: q,
        studentAnswer: finalAnswer,
        correctAnswer: correctOpt,
        isCorrect: isCorrect,
        coords: coords
      });

      // =====================================================================
      // DRAW GRADING VISUAL OVERLAY ON CANVAS
      // =====================================================================
      ctx.save();
      if (isCorrect) {
        // Draw green circle around chosen correct bubble
        const pt = coords[finalAnswer];
        ctx.strokeStyle = '#00e676';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
        ctx.stroke();

        // Small checkmark
        ctx.fillStyle = '#00e676';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('✓', coords[3].x + 22, y + 14);
      } else {
        // Wrong answer or blank
        if (finalAnswer !== -1) {
          // Draw red circle around the incorrect student mark
          const pt = coords[finalAnswer];
          ctx.strokeStyle = '#ff1744';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Draw dotted green target outline around the correct bubble
        const correctPt = coords[correctOpt];
        ctx.strokeStyle = '#00e5ff';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(correctPt.x, correctPt.y, 13, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Small cross
        ctx.fillStyle = '#ff1744';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('✗', coords[3].x + 22, y + 14);
      }
      ctx.restore();
    }

    // Exam Score out of 50 points (Rule 6.d)
    this.examScore50 = parseFloat(((this.rawScore / totalQ) * 50).toFixed(2));

    this.displayGradingReport();
  }

  /**
   * Updates the UI with scoring metrics, summary cards, and itemized breakdown.
   */
  displayGradingReport() {
    const totalQ = Math.min(this.activeQuestionCount, this.questions.length);
    const percent = Math.round((this.rawScore / totalQ) * 100);

    const elReportCard = document.getElementById('scannerReportCard');
    const elRaw = document.getElementById('scanRawScore');
    const elES = document.getElementById('scanESScore');
    const elPct = document.getElementById('scanPercent');
    const elTable = document.getElementById('scanBreakdownTable');

    if (elReportCard) elReportCard.style.display = 'block';
    if (elRaw) elRaw.textContent = `${this.rawScore} / ${totalQ}`;
    if (elES) elES.textContent = `${this.examScore50.toFixed(1)} / 50`;
    if (elPct) elPct.textContent = `${percent}%`;

    if (elTable) {
      const letters = ['A', 'B', 'C', 'D'];
      let html = `
        <table class="reference-table" style="font-size: 0.85rem;">
          <thead>
            <tr>
              <th>Q#</th>
              <th>Syllabus Area</th>
              <th>Student Mark</th>
              <th>Correct Key</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
      `;

      this.gradedResults.forEach((res) => {
        const studentLetter = res.studentAnswer === -1 ? '<span style="color:var(--text-muted);">Blank</span>' : letters[res.studentAnswer];
        const correctLetter = letters[res.correctAnswer];
        const statusBadge = res.isCorrect 
          ? '<span style="color:var(--success); font-weight:bold;">✓ Correct (+1)</span>'
          : `<span style="color:var(--danger); font-weight:bold;">✗ Wrong (Key: ${correctLetter})</span>`;

        html += `
          <tr style="${res.isCorrect ? '' : 'background: rgba(255, 23, 68, 0.08);'}">
            <td class="mono"><strong>${res.qNum}</strong></td>
            <td style="font-size:0.75rem; color:var(--text-secondary);">${res.question ? res.question.area : 'Thermodynamics'}</td>
            <td class="mono" style="font-size:1rem; font-weight:bold; color:${res.isCorrect ? 'var(--success)' : 'var(--danger)'};">${studentLetter}</td>
            <td class="mono" style="font-size:1rem; font-weight:bold; color:var(--cryo-cyan);">${correctLetter}</td>
            <td>${statusBadge}</td>
          </tr>
        `;
      });

      html += `</tbody></table>`;
      elTable.innerHTML = html;
    }

    // Record score to student profile in authManager
    authManager.recordExamResult({
      raw: this.rawScore,
      total: totalQ,
      es: this.examScore50,
      percent: percent,
      type: 'scanned'
    });

    if (window.showToast) {
      window.showToast(`Scanned and graded: ${this.rawScore}/${totalQ} correct (${this.examScore50.toFixed(1)} / 50 ES points)!`, 'success');
    }
  }

  /**
   * One-click integration: transfers the scanned Part 1 Exam Score directly
   * into Module 5 (ScoreCalculator), updates tournament standings, and notifies user.
   */
  exportToTournamentCalculator() {
    const calcInput = document.getElementById('calcTeamExam');
    if (calcInput) {
      calcInput.value = this.examScore50.toFixed(1);
      // Trigger calculation in score calculator
      calcInput.dispatchEvent(new Event('input', { bubbles: true }));
      calcInput.dispatchEvent(new Event('change', { bubbles: true }));

      if (window.showToast) {
        window.showToast(`Transferred ES score (${this.examScore50.toFixed(1)} pts) to Tournament Score Calculator!`, 'success');
      }

      // Automatically switch to Score Calculator tab for instant visual feedback
      const scoreTabBtn = document.querySelector('[data-target="view-scores"]');
      if (scoreTabBtn) {
        scoreTabBtn.click();
      }
    }
  }
}
