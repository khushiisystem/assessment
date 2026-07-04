// ---------- main.js (complete) ----------
// must be global
window.editors = window.editors || {};

// small helper
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

/* ============================
   CSRF helper
   ============================ */
function getCSRFToken() {
  const tokenInput = document.querySelector("[name=csrfmiddlewaretoken]");
  if (tokenInput && tokenInput.value) return tokenInput.value;

  const name = "csrftoken=";
  const decoded = decodeURIComponent(document.cookie || "");
  const ca = decoded.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i].trim();
    if (c.indexOf(name) === 0) return c.substring(name.length, c.length);
  }
  return "";
}

/* ============================
   Debounce utility
   ============================ */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/* ============================
   Timer (AssessmentTimer)
   ============================ */
class AssessmentTimer {
  constructor(totalMinutes, onTimeUp, onTick) {
    this.totalSeconds = Math.max(1, Math.floor(totalMinutes * 60));
    this.remainingSeconds = this.totalSeconds;
    this.onTimeUp = onTimeUp;
    this.onTick = onTick;
    this.interval = null;
  }

  start() {
    if (this.interval) this.stop();
    this.interval = setInterval(() => {
      this.remainingSeconds--;
      if (this.onTick) this.onTick(this.remainingSeconds);
      if (this.remainingSeconds <= 0) {
        this.stop();
        if (this.onTimeUp) this.onTimeUp();
      }
    }, 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
}

/* ============================
   Save all answers (sequential, throttled)
   ============================ */
async function saveAllAnswers() {
  // gather inputs/textarea/select with name attribute
  const inputs = Array.from(document.querySelectorAll('input[name], textarea[name], select[name]'));
  // also include stdin inputs even if name missing (so they persist)
  const stdins = Array.from(document.querySelectorAll('.stdin-input'));
  // IMPORTANT: Include code editors (they don't have name attribute)
  const codeEditors = Array.from(document.querySelectorAll('.code-editor[data-question-id]'));
  // Include subjective and fill_blank textareas/inputs with data-question-id
  const otherAnswers = Array.from(document.querySelectorAll('textarea[data-question-id]:not(.code-editor), input[type="text"][data-question-id]'));

  const qmap = {};
  
  // Process regular inputs with name attribute
  inputs.forEach(el => {
    let qid = el.dataset ? el.dataset.questionId : null;
    if (!qid && el.name) {
      const m = el.name.match(/(\d+)$/) || el.name.match(/question[-_](\d+)/);
      if (m) qid = m[1];
    }
    if (!qid) return;
    if (!qmap[qid]) qmap[qid] = el;
    else {
      if ((el.type === 'radio' || el.type === 'checkbox') && el.checked) qmap[qid] = el;
      if (el.tagName.toLowerCase() === 'textarea') qmap[qid] = el;
    }
  });
  
  // Add code editors to qmap
  codeEditors.forEach(el => {
    const qid = el.dataset.questionId;
    if (qid && !qmap[qid]) qmap[qid] = el;
  });
  
  // Add other answer fields (subjective, fill_blank)
  otherAnswers.forEach(el => {
    const qid = el.dataset.questionId;
    if (qid && !qmap[qid]) qmap[qid] = el;
  });

  const results = [];
  for (const qid of Object.keys(qmap)) {
    const el = qmap[qid];

    // assessment id
    let assessmentId = (el && el.dataset && (el.dataset.assessmentId || window.ASSESSMENT_ID)) || window.ASSESSMENT_ID || null;
    if (!assessmentId) {
      const any = document.querySelector(`[data-question-id="${qid}"][data-assessment-id]`);
      if (any) assessmentId = any.dataset.assessmentId;
    }
    if (!assessmentId) { results.push(null); continue; }

    // answer value
    let answer = '';
    if (el.type === 'checkbox') {
      answer = Array.from(document.querySelectorAll(`input[name="${el.name}"]:checked`)).map(c=>c.value).join(',');
    } else if (el.type === 'radio') {
      const sel = document.querySelector(`input[name="${el.name}"]:checked`);
      answer = sel ? sel.value : '';
    } else {
      if (el.classList && el.classList.contains('code-editor') && window.cmEditors && window.cmEditors[qid]) {
        try { answer = window.cmEditors[qid].getValue(); } catch(e){ answer = el.value || ''; }
      } else {
        answer = el.value || '';
      }
    }

    const codeLanguageEl = document.querySelector(`.code-language[data-question-id="${qid}"]`);
    const code_language = codeLanguageEl ? codeLanguageEl.value : '';

    // find stdin for this qid (optional)
    const stdinEl = stdins.find(s => s.dataset && s.dataset.questionId === qid);
    const stdinVal = stdinEl ? (stdinEl.value || '') : '';

    try {
      const resp = await fetch('/api/save-answer/', {
        method: 'POST',
        headers: {'Content-Type':'application/json','X-CSRFToken': getCSRFToken()},
        body: JSON.stringify({
          question_id: qid,
          assessment_id: assessmentId,
          answer: answer,
          code_language: code_language,
          stdin: stdinVal // backend may ignore if not supported
        })
      });
      const data = await (resp.ok ? resp.json() : resp.text().then(t=>({error:t})));
      results.push(data);
    } catch (err) {
      console.error('saveAllAnswers error qid=', qid, err);
      results.push(null);
    }

    // throttle to reduce DB locks
    await sleep(30);
  }

  // also persist any stray stdin inputs without a paired qmap entry
  for (const s of stdins) {
    const qid = s.dataset ? s.dataset.questionId : null;
    const assessmentId = s.dataset ? (s.dataset.assessmentId || window.ASSESSMENT_ID) : (window.ASSESSMENT_ID || null);
    if (!qid || !assessmentId) continue;

    try {
      await fetch('/api/save-answer/', {
        method: 'POST',
        headers: {'Content-Type':'application/json','X-CSRFToken': getCSRFToken()},
        body: JSON.stringify({
          question_id: qid,
          assessment_id: assessmentId,
          stdin: s.value || ''
        })
      });
    } catch(e) { /* ignore */ }
    await sleep(10);
  }

  return results;
}

/* ============================
   Auto-save (answers)
   ============================ */
function setupAutoSave() {
  // For MCQ, True/False - use change event
  const radioCheckboxInputs = document.querySelectorAll("input[type='radio'], input[type='checkbox'], select");
  radioCheckboxInputs.forEach((input) => {
    input.addEventListener(
      "change",
      debounce(function () {
        saveAnswer(this);
      }, 700)
    );
  });

  // For text inputs and textareas (subjective, fill_blank) - use input event for real-time save
  const textInputs = document.querySelectorAll("input[type='text'][data-question-id], textarea[data-question-id]");
  textInputs.forEach((input) => {
    input.addEventListener(
      "input",
      debounce(function () {
        saveAnswer(this);
      }, 1000)
    );
  });

  // Also listen to typing in code editors & stdin
  document.querySelectorAll(".code-editor, .stdin-input").forEach((el) => {
    el.addEventListener(
      "input",
      debounce(function () {
        saveAnswer(this);
      }, 1000)
    );
  });

  // Language change should save immediately
  document.querySelectorAll(".code-language").forEach((el) => {
    el.addEventListener("change", function () {
      saveAnswer(this.closest('.coding-question')?.querySelector('.code-editor') || this);
    });
  });
}

function saveAnswer(element) {
  if (!element || !element.dataset) return;
  const questionId = element.dataset.questionId;
  const assessmentId = element.dataset.assessmentId || window.ASSESSMENT_ID || null;
  if (!questionId || !assessmentId) return;

  // If stdin box triggered
  if (element.classList.contains('stdin-input')) {
    fetch("/api/save-answer/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCSRFToken() },
      body: JSON.stringify({
        question_id: questionId,
        assessment_id: assessmentId,
        stdin: element.value || ""
      }),
    }).then(r=>r.json()).then(()=>showAutoSaveIndicator()).catch(()=>{});
    return;
  }

  // Regular answers
  let answer = element.value;

  if (element.type === "checkbox") {
    const checkedValues = Array.from(
      document.querySelectorAll(`input[name="${element.name}"]:checked`)
    ).map((cb) => cb.value);
    answer = checkedValues.join(",");
  } else if (element.type === "radio") {
    const selectedValue = document.querySelector(`input[name="${element.name}"]:checked`);
    answer = selectedValue ? selectedValue.value : "";
  } else if (element.classList.contains('code-editor') && window.cmEditors && window.cmEditors[questionId]) {
    try { answer = window.cmEditors[questionId].getValue(); } catch(e){ answer = element.value || ''; }
  }

  const codeLanguageEl = document.querySelector(`.code-language[data-question-id="${questionId}"]`);
  const codeLanguage = codeLanguageEl ? codeLanguageEl.value : "";

  fetch("/api/save-answer/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCSRFToken(),
    },
    body: JSON.stringify({
      question_id: questionId,
      assessment_id: assessmentId,
      answer: answer,
      code_language: codeLanguage,
      stdin: (document.querySelector(`#stdin-${questionId}`)?.value || '')
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data && (data.status === "success" || data.ok)) {
        showAutoSaveIndicator();
      }
    })
    .catch((error) => {
      console.error("Error saving answer:", error);
    });
}

function showAutoSaveIndicator() {
  let indicator = document.getElementById("auto-save-indicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.id = "auto-save-indicator";
    indicator.style.position = "fixed";
    indicator.style.bottom = "20px";
    indicator.style.right = "20px";
    indicator.style.padding = "8px 16px";
    indicator.style.background = "#28a745";
    indicator.style.color = "white";
    indicator.style.borderRadius = "4px";
    indicator.style.zIndex = "1000";
    indicator.style.fontSize = "14px";
    document.body.appendChild(indicator);
  }
  indicator.textContent = "Auto-saved";
  indicator.style.display = "block";
  setTimeout(() => { indicator.style.display = "none"; }, 1500);
}

/* ============================
   Proctoring helpers (hard rules)
   - 3rd violation (FS/tab/app) => auto-submit
   - disable stay/leave prompt during auto-submit
   ============================ */

const VIOLATION_LIMIT = 2; // allowed 2, 3rd triggers submit
let __lastUiActivityTs = 0;
let __lastTabSwitchTs = 0;

['mousedown','keydown','touchstart'].forEach(evt => {
  document.addEventListener(evt, () => { __lastUiActivityTs = Date.now(); }, true);
});

// counters per assessment (sessionStorage)
function _aid() { return window.ASSESSMENT_ID || 'aid'; }
function keyFS() { return `fs_exit_count_${_aid()}`; }
function keyTS() { return `tab_switch_count_${_aid()}`; }
function readCount(k){ try { return parseInt(sessionStorage.getItem(k) || '0', 10) || 0; } catch { return 0; } }
function writeCount(k,n){ try { sessionStorage.setItem(k, String(n)); } catch {} }

// COMMENTED: Auto-submit for violations disabled - only timer should auto-submit
// async function autoSubmitAssessment(reasonMsg) {
//   if (window.__AUTO_SUBMITTING__) return;
//   window.__AUTO_SUBMITTING__ = true;

//   try {
//     showProctoringWarning(reasonMsg || "Policy violations exceeded. Submitting the test.");

//     // disable beforeunload prompt for this navigation
//     window.__ALLOW_UNLOAD__ = true;

//     // Save answers
//     if (typeof saveAllAnswers === 'function') {
//       try { await saveAllAnswers(); } catch {}
//     }

//     // Exit fullscreen to avoid browser prompts
//     try { document.exitFullscreen?.(); } catch {}

//     // Submit silently
//     setTimeout(() => {
//       const autoForm = document.getElementById("auto-submit-form");
//       if (autoForm) autoForm.submit();
//       else window.location.reload();
//     }, 200);
//   } catch (e) {
//     console.error('Auto-submit failed', e);
//     window.__AUTO_SUBMITTING__ = false;
//   }
// }

// async function checkAndMaybeSubmit(typeLabel, count) {
//   if (count > VIOLATION_LIMIT) {
//     await autoSubmitAssessment(`${typeLabel} limit exceeded. Submitting the test.`);
//   }
// }

function setupProctoring() {
  try {
    // Bind only after assessment starts via gate
    if (!window.__ASSESSMENT_ACTIVE__) return;

    // Avoid multiple bindings
    if (window.__PROCTOR_BOUND__) return;
    window.__PROCTOR_BOUND__ = true;

    const hasAssessmentDom =
      !!document.getElementById('assessment-id') &&
      !!document.querySelector('.assessment-container');
    if (!hasAssessmentDom) return;

    if (!/take_assessment|assessment/.test(window.location.pathname)) return;

    window.__fsChangeRecently = false;
    // ✅ common guard for intentional submit / auto submit
    function shouldIgnoreIncident() {
      return !window.__ASSESSMENT_ACTIVE__ ||
             window.__AUTO_SUBMITTING__ ||
             window.__INTENTIONAL_SUBMIT__;
    }

    // ✅ simple debounce helper (duplicate events ko ignore karne ke liye)
    function recentEventGuard(key, delay = 800) {
      const now = Date.now();
      if (window[key] && (now - window[key]) < delay) return true;
      window[key] = now;
      return false;
    }


    // Fullscreen change
    async function onFullscreenChange() {
      // if (!window.__ASSESSMENT_ACTIVE__) return;
      if (!window.__ASSESSMENT_ACTIVE__) return;
      // do NOT count if we are auto-submitting or intentional manual submit
      if (window.__AUTO_SUBMITTING__ || window.__INTENTIONAL_SUBMIT__) return;

      // de-bounce: some browsers fire both webkit + standard events
      const nowTs = Date.now();
      if (window.__FS_EXIT_LAST_TS && (nowTs - window.__FS_EXIT_LAST_TS) < 800) {
        return; // ignore duplicate within 800ms
      }
      window.__FS_EXIT_LAST_TS = nowTs;
      window.__fsChangeRecently = true;
      setTimeout(() => { window.__fsChangeRecently = false; }, 600);

      const inFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (inFS) return;

      let exits = readCount(keyFS()) + 1;
      writeCount(keyFS(), exits);

      recordIncident("fullscreen_exit", `Candidate exited fullscreen (count=${exits})`);
      
      // Show strict modal instead of just warning
      showFullscreenExitModal(exits);
      
      // COMMENTED: Auto-submit on fullscreen exit disabled
      // await checkAndMaybeSubmit('Fullscreen exit', exits);
    }
    
    // Show modal when fullscreen is exited
    function showFullscreenExitModal(exitCount) {
      // Remove any existing modal
      const existingModal = document.getElementById('fullscreen-exit-modal');
      if (existingModal) existingModal.remove();
      
      // Create modal
      const modal = document.createElement('div');
      modal.id = 'fullscreen-exit-modal';
      modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.8);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      
      modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 12px; max-width: 500px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
          <div style="font-size: 48px; color: #dc3545; margin-bottom: 20px;">⚠️</div>
          <h3 style="color: #dc3545; margin-bottom: 15px;">Assessment Interrupted!</h3>
          <p style="font-size: 16px; color: #333; margin-bottom: 10px;">
            <strong>This assessment can only run in fullscreen mode.</strong>
          </p>
          <p style="font-size: 14px; color: #666; margin-bottom: 25px;">
            You have exited fullscreen <strong>${exitCount}</strong> time(s). 
            Please click "Continue Test" to return to fullscreen mode, or "Submit & Exit" to end your assessment.
          </p>
          <div style="display: flex; gap: 15px; justify-content: center;">
            <button id="continue-test-btn" style="
              background: #28a745;
              color: white;
              border: none;
              padding: 12px 30px;
              border-radius: 6px;
              font-size: 16px;
              font-weight: bold;
              cursor: pointer;
              transition: all 0.3s;
            " onmouseover="this.style.background='#218838'" onmouseout="this.style.background='#28a745'">
              ✓ Continue Test
            </button>
            <button id="submit-exit-btn" style="
              background: #dc3545;
              color: white;
              border: none;
              padding: 12px 30px;
              border-radius: 6px;
              font-size: 16px;
              font-weight: bold;
              cursor: pointer;
              transition: all 0.3s;
            " onmouseover="this.style.background='#c82333'" onmouseout="this.style.background='#dc3545'">
              ✗ Submit & Exit
            </button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Continue button - return to fullscreen
      document.getElementById('continue-test-btn').addEventListener('click', async () => {
        modal.remove();
        // Try to re-enter fullscreen
        try {
          const el = document.documentElement;
          if (el.requestFullscreen) await el.requestFullscreen();
          else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        } catch (e) {
          alert('Please manually enable fullscreen mode (press F11 or click fullscreen button)');
        }
      });
      
      // Submit & Exit button
      document.getElementById('submit-exit-btn').addEventListener('click', async () => {
        modal.remove();
        // Mark as intentional submit to prevent proctoring warnings
        window.__INTENTIONAL_SUBMIT__ = true;
        window.__ALLOW_UNLOAD__ = true;
        
        // Save all answers before submitting
        try {
          if (typeof saveAllAnswers === 'function') {
            await saveAllAnswers();
          }
        } catch (e) {
          console.error('Error saving answers:', e);
        }
        
        // Exit fullscreen
        try { document.exitFullscreen?.(); } catch {}
        
        // Submit the form
        setTimeout(() => {
          const autoForm = document.getElementById("auto-submit-form");
          if (autoForm) autoForm.submit();
          else window.location.reload();
        }, 200);
      });
      
      // COMMENTED: Auto-submit after multiple exits disabled
      // if (exitCount >= 3) {
      //   let countdown = 5;
      //   const countdownInterval = setInterval(() => {
      //     const submitBtn = document.getElementById('submit-exit-btn');
      //     if (submitBtn) {
      //       submitBtn.textContent = `✗ Auto-submitting in ${countdown}s`;
      //     }
      //     countdown--;
      //     if (countdown < 0) {
      //       clearInterval(countdownInterval);
      //       modal.remove();
      //       checkAndMaybeSubmit('Too many fullscreen exits', exitCount, true);
      //     }
      //   }, 1000);
      // }
    }
    document.addEventListener("fullscreenchange", onFullscreenChange, true);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange, true);

    
    // Visibility change (tab switch)
    document.addEventListener("visibilitychange", function () {
      if (shouldIgnoreIncident()) return;              // ← submit/auto-submit par ignore
      if (window.__fsChangeRecently) return;           // fullscreen exit ke turant baad ignore
      if (recentEventGuard('__VIS_LAST_TS')) return;   // ← debounce (duplicate fire)

      if (document.hidden) {
        let sw = readCount(keyTS()) + 1;
        writeCount(keyTS(), sw);
        recordIncident("tab_switch", `Tab switch (count=${sw})`);
        showProctoringWarning("Tab switch detected!");
        // COMMENTED: Auto-submit on tab switch disabled
        // checkAndMaybeSubmit('Tab/App switch', sw);
      }
    }, true);

      // Blur (app switch)
      window.addEventListener('blur', function () {
      if (shouldIgnoreIncident()) return;

      const firedAt = Date.now();
      setTimeout(() => {
        if (Date.now() - __lastUiActivityTs < 300) return; // internal focus change
        if (window.__fsChangeRecently) return;

        const lost = !document.hasFocus() || document.hidden;
        if (!lost) return;

        if (recentEventGuard('__VIS_LAST_TS')) return; // ← same debounce key as visibility

        let sw = readCount(keyTS()) + 1;
        writeCount(keyTS(), sw);
        recordIncident("tab_switch", `App switch (count=${sw})`);
        showProctoringWarning("App switch detected!");
        // COMMENTED: Auto-submit on app switch disabled
        // checkAndMaybeSubmit('Tab/App switch', sw);
      }, 220);
    }, true);

    // Clipboard / context menu locks (editor allowed)
    document.addEventListener("copy", function (e) {
      if (!window.__ASSESSMENT_ACTIVE__) return;
      recordIncident("copy_paste", "Copy attempt detected");
      showProctoringWarning("Copying is not allowed during assessment!");
      e.preventDefault();
    }, true);

    document.addEventListener("paste", function (e) {
      if (!window.__ASSESSMENT_ACTIVE__) return;
      recordIncident("copy_paste", "Paste attempt detected");
      showProctoringWarning("Pasting is not allowed during assessment!");
      e.preventDefault();
    }, true);

    document.addEventListener('keydown', function(e){
      if (!window.__ASSESSMENT_ACTIVE__) return;
      const cmd = e.ctrlKey || e.metaKey;
      if (cmd && ['c','v','x','a'].includes(e.key.toLowerCase())) {
        recordIncident("copy_paste", `Shortcut ${e.key.toUpperCase()} blocked`);
        showProctoringWarning("Clipboard shortcuts are blocked during assessment!");
        e.preventDefault();
      }
    }, true);

    document.addEventListener("contextmenu", function (e) {
      if (!window.__ASSESSMENT_ACTIVE__) return;
      if (e.target.closest('.CodeMirror, .code-editor')) return; // allow inside editor
      e.preventDefault();
      showProctoringWarning("Right-click is disabled during assessment!");
    }, true);

    // Leave guard (suppressed during auto-submit)
    window.addEventListener('beforeunload', function (e) {
      if (!window.__ASSESSMENT_ACTIVE__) return;
      if (window.__ALLOW_UNLOAD__) return;  // auto-submit path
      const msg = 'Your assessment is in progress. Leaving will submit your test.';
      e.preventDefault();
      e.returnValue = msg;
      return msg;
    });

  } catch (err) {
    console.error('setupProctoring error', err);
  }
}

function recordIncident(type, details) {
  // COMMENTED: Stop proctoring email functionality
  return;
  
  if (window.__AUTO_SUBMITTING__ || window.__INTENTIONAL_SUBMIT__  || window.__CONFIRM_ACTIVE__)
    { 
      console.log('Incident ignored due to auto-submit/intentional submit/confirmation active', window.__CONFIRM_ACTIVE__);
      return;}
  const assessmentId = document.getElementById("assessment-data")?.dataset.assessmentId || window.ASSESSMENT_ID || null;
  if (!assessmentId) return;

  let severity = 'medium';
  if (type === 'tab_switch' || type === 'fullscreen_exit') severity = 'high';
  else if (type === 'copy_paste') severity = 'critical';

  // Record incident but disable email functionality
  fetch("/api/proctoring-incident/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCSRFToken() },
    body: JSON.stringify({
      incident_type: type,
      details: details,
      assessment_id: assessmentId,
      severity: severity,
      // Add flag to disable email sending
      disable_email: true
    }),
  })
  .then(response => response.json())
  .then(data => {
    // COMMENTED: Email notifications disabled
    // if (data.email_sent) {
    //   console.log('Alert emails sent to admin and candidate');
    // }
  })
  .catch((err) => {
    console.debug("Proctoring incident send failed:", err);
  });
}

function showProctoringWarning(message) {
  const existing = document.getElementById("proctoring-warning");
  if (existing) existing.remove();
  const warning = document.createElement("div");
  warning.id = "proctoring-warning";
  warning.className = "proctoring-warning";
  warning.textContent = message;
  // basic inline styles so it's visible
  warning.style.position = "fixed";
  warning.style.top = "10px";
  warning.style.left = "50%";
  warning.style.transform = "translateX(-50%)";
  warning.style.background = "#ffc107";
  warning.style.color = "#333";
  warning.style.padding = "8px 12px";
  warning.style.borderRadius = "6px";
  warning.style.zIndex = "9999";
  document.body.appendChild(warning);
  setTimeout(() => { warning.remove(); }, 4000);
}

/* ============================
   Code editor helpers / run
   ============================ */

// save on typing for plain textareas (if CodeMirror not present)
function setupCodeEditor() {
  const codeEditors = document.querySelectorAll(".code-editor");
  codeEditors.forEach((editor) => {
    editor.addEventListener(
      "input",
      debounce(function () {
        saveAnswer(this);
      }, 1200)
    );
  });
}

// new runCode: runs all testcases by default (ignores custom input), optional "custom run"
async function runCode(questionId, assessmentId, useCustom=false) {
  // prefer CodeMirror editor if present
  let code = '';
  if (window.cmEditors && window.cmEditors[questionId]) {
    try { code = window.cmEditors[questionId].getValue(); } catch(e){ code = document.querySelector(`#code-${questionId}`)?.value || ''; }
  } else {
    code = document.querySelector(`#code-${questionId}`)?.value || '';
  }

  const language =
    document.querySelector(`.code-language[data-question-id="${questionId}"]`)
      ?.value || "python";
  // read custom input but DO NOT send it unless useCustom === true
  const stdin = document.querySelector(`#stdin-${questionId}`)?.value || "";

  const outputElement = document.querySelector(`#output-${questionId}`);
  const tcResultsEl = document.querySelector(`#tc-results-${questionId}`);
  const statusEl = document.getElementById(`status-${questionId}`);
  if (statusEl) statusEl.classList.remove('d-none');

  if (outputElement) {
    outputElement.innerHTML =
      '<div class="text-center"><div class="spinner-border spinner-border-sm"></div> Running code...</div>';
  }
  if (tcResultsEl) tcResultsEl.innerHTML = '';

  try {
    const resp = await fetch('/api/run-code/', {
      method: 'POST',
      headers: {'Content-Type':'application/json','X-CSRFToken': getCSRFToken()},
      body: JSON.stringify({
        question_id: questionId,
        code: code,
        language: language,
        stdin: stdin,
        use_custom_input: useCustom,
        assessment_id: assessmentId || window.ASSESSMENT_ID || null
      })
    });

    const data = await resp.json();
    console.log('Run code response:', data); // Debug log

    if (data.status !== "success") {
      if (outputElement) outputElement.innerHTML = `<div class="text-danger">Error: ${escapeHtml(data.message || 'Execution failed')}</div>`;
      return;
    }

    const payload = data.data || {};
    const results = payload.results || [];
    const summary = payload.summary || {};
    
    console.log('Results:', results); // Debug log

    // Summary header
    let headerHtml = `<div class="mb-2"><strong>Passed:</strong> ${summary.passed_count || 0} / ${summary.total_cases || results.length}`;
    if (summary.total_points !== undefined) headerHtml += ` &nbsp; <strong>Score:</strong> ${summary.earned_points || 0} / ${summary.total_points || 0}`;
    headerHtml += `</div>`;

    // Overall output box: show high-level status
    if (outputElement) outputElement.innerHTML = headerHtml;

    // Per-testcase results
    if (results.length && tcResultsEl) {
      tcResultsEl.innerHTML = ''; // clear
      results.forEach((r, idx) => {
        console.log(`Testcase ${idx+1}:`, r); // Debug each testcase
        
        const div = document.createElement('div');
        div.className = 'p-2 mb-2 border rounded bg-white';
        const passedBadge = r.passed ? '<span class="badge bg-success">Passed</span>' : '<span class="badge bg-danger">Failed</span>';
        let inner = `<div class="d-flex justify-content-between"><div><strong>Testcase ${idx+1}</strong> ${passedBadge}</div><div><small>Time: ${r.time || '-'} | Memory: ${r.memory || '-'}</small></div></div>`;
        if (r.is_hidden) {
          inner += `<div class="small text-muted">(hidden testcase)</div>`;
        }
        
        // Check if there's an error based on status
        const hasError = r.status && !r.passed && (
          r.status.includes('Error') || 
          r.status.includes('Exceeded') || 
          r.status === 'Unknown'
        );
        
        // Show compilation error if present
        if (r.compile_output && r.compile_output.trim()) {
          console.log('Showing compile error:', r.compile_output);
          inner += `<div class="mt-2"><strong>Compilation Error:</strong><pre class="bg-danger text-white p-2">${escapeHtml(r.compile_output)}</pre></div>`;
        }
        
        // Show runtime error if present
        if (r.stderr && r.stderr.trim()) {
          console.log('Showing stderr:', r.stderr);
          inner += `<div class="mt-2"><strong>Runtime Error:</strong><pre class="bg-warning p-2">${escapeHtml(r.stderr)}</pre></div>`;
        } else if (hasError && r.status) {
          // If no stderr but status indicates error, show status as error
          inner += `<div class="mt-2"><strong>Error:</strong><pre class="bg-warning p-2">${escapeHtml(r.status)}</pre></div>`;
        }
        
        // Show stdout (actual output) - always show unless there's a compilation error
        const hasCompileError = r.compile_output && r.compile_output.trim();
        
        if (!hasCompileError) {
          const outputLabel = hasError ? 'Your Output (with errors):' : 'Your Output:';
          inner += `<div class="mt-2"><strong>${outputLabel}</strong><pre class="bg-light p-2">${escapeHtml(r.stdout || '(no output)')}</pre></div>`;
        }
        
        // Show expected output only for non-hidden testcases and only if test failed or output differs
        if (!r.is_hidden && r.expected_output !== undefined && !r.passed) {
          inner += `<div class="mt-1"><strong>Expected Output:</strong><pre class="bg-info bg-opacity-10 p-2">${escapeHtml(r.expected_output || '')}</pre></div>`;
        }
        
        if (r.status) inner += `<div class="mt-1 small text-muted">Status: ${escapeHtml(r.status)}</div>`;
        div.innerHTML = inner;
        tcResultsEl.appendChild(div);
      });
    } else if (outputElement) {
      // fallback
      const fallback = (payload.raw && (payload.raw.stdout || payload.raw.compile_output || payload.raw.stderr)) || '';
      outputElement.innerHTML += `<pre class="bg-light p-2 mt-2">${escapeHtml(fallback)}</pre>`;
    }
  } catch (err) {
    console.error('runCode error:', err);
    if (outputElement) outputElement.innerHTML = `<div class="text-danger">Network/Server error while running code.</div>`;
  } finally {
    if (statusEl) statusEl.classList.add('d-none');
  }
}

// Bind clicks for run buttons
document.addEventListener('click', function(evt){
  const runBtn = evt.target.closest && evt.target.closest('.run-code-btn');
  if (runBtn) {
    const qid = runBtn.dataset.questionId;
    if (qid) runCode(qid, runBtn.dataset.assessmentId || window.ASSESSMENT_ID || null, false);
    return;
  }
  const runCustom = evt.target.closest && evt.target.closest('.run-custom-btn');
  if (runCustom) {
    const qid = runCustom.dataset.questionId;
    if (qid) runCode(qid, runCustom.dataset.assessmentId || window.ASSESSMENT_ID || null, true);
    return;
  }
});

/* helper: escape HTML */
function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"'`]/g, function (m) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" }[m];
  });
}

/* ============================
   Navigation & UI glue
   ============================ */

window.__cm_current_index = 0;

function showQuestion(index) {
  const cards = Array.from(document.querySelectorAll(".question-card"));
  if (!cards.length) return;
  if (index < 0) index = 0;
  if (index >= cards.length) index = cards.length - 1;

  cards.forEach((c) => {
    c.classList.add("d-none");
    c.classList.remove("active");
  });

  const card = cards[index];
  if (card) {
    card.classList.remove("d-none");
    card.classList.add("active");

    // autofocus CodeMirror or textarea inside shown card
    const ta = card.querySelector(".code-editor");
    if (ta) {
      const qid = ta.dataset.questionId;
      if (window.cmEditors && window.cmEditors[qid]) {
        try {
          window.cmEditors[qid].refresh();
          window.cmEditors[qid].focus();
        } catch (e) {}
      } else {
        try {
          ta.focus();
        } catch (e) {}
      }
    }
  }

  // update nav buttons UI
  const navBtns = Array.from(document.querySelectorAll(".question-nav-btn"));
  navBtns.forEach((b, i) => {
    b.classList.remove("btn-primary");
    b.classList.add("btn-outline-secondary");
    if (i === index) {
      b.classList.remove("btn-outline-secondary");
      b.classList.add("btn-primary");
    }
  });

  // prev/next disabled state
  const prev = document.getElementById("prev-question");
  const next = document.getElementById("next-question");
  if (prev) prev.disabled = index === 0;
  if (next) next.disabled = index === cards.length - 1;

  window.__cm_current_index = index;
}

function initializeNavigation() {
  if (window.__nav_initialized) return;
  window.__nav_initialized = true;

  const prev = document.getElementById("prev-question");
  const next = document.getElementById("next-question");
  if (prev) prev.addEventListener("click", () => showQuestion(window.__cm_current_index - 1));
  if (next) next.addEventListener("click", () => showQuestion(window.__cm_current_index + 1));

  document.querySelectorAll(".question-nav-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const idx = parseInt(this.dataset.questionIndex, 10);
      if (!isNaN(idx)) showQuestion(idx);
    });
  });

  // ensure there's a visible question
  showQuestion(window.__cm_current_index || 0);
}

/* initializeTimer: reads window.assessmentData.endTime (ms) if present */
function initializeTimer() {
  try {
    const timerEl = document.getElementById("time-display");
    if (!timerEl) return;
    if (window.__timer_initialized) return;
    window.__timer_initialized = true;

    const ad = window.assessmentData || window.ASSESSMENT_DATA || null;
    const endMs = ad && ad.endTime ? Number(ad.endTime) : null;

    if (typeof AssessmentTimer !== "undefined" && endMs) {
      const now = Date.now();
      let remainingSeconds = Math.max(0, Math.floor((endMs - now) / 1000));
      const minutes = Math.ceil(remainingSeconds / 60) || 1;
      const t = new AssessmentTimer(minutes, function onTimeUp() {
        timerEl.textContent = "00:00:00";
        // Set flags to prevent proctoring alerts during auto-submit
        window.__AUTO_SUBMITTING__ = true;
        window.__ALLOW_UNLOAD__ = true;
        window.__ASSESSMENT_ACTIVE__ = false;
        document.getElementById("auto-submit-form")?.submit();
      }, function onTick(secLeft) {
        timerEl.textContent = t.formatTime(secLeft);
      });
      t.remainingSeconds = remainingSeconds;
      t.start();
      window.__assessment_timer = t;
    } else {
      if (!endMs) { timerEl.textContent = "00:00:00"; return; }
      function tick() {
        const diff = endMs - Date.now();
        if (diff <= 0) {
          timerEl.textContent = "00:00:00";
          // Set flags to prevent proctoring alerts during auto-submit
          window.__AUTO_SUBMITTING__ = true;
          window.__ALLOW_UNLOAD__ = true;
          window.__ASSESSMENT_ACTIVE__ = false;
          document.getElementById("auto-submit-form")?.submit();
          return;
        }
        const hrs = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        timerEl.textContent = `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      }
      tick();
      setInterval(tick, 1000);
    }
  } catch (e) {
    console.error("initializeTimer error", e);
  }
}

function initializeAutoSave() {
  if (typeof setupAutoSave === "function") setupAutoSave();
}
function initializeProctoring() {
  if (typeof setupProctoring === "function") setupProctoring();
}

/* Button delegation for code controls */
function bindCodeButtons() {
  // run button
  document.addEventListener("click", function (evt) {
    const runBtn = evt.target.closest && evt.target.closest(".run-code-btn");
    if (runBtn) {
      const qid = runBtn.dataset.questionId;
      runCode(qid, runBtn.dataset.assessmentId || window.ASSESSMENT_ID || null);
    }
  });

  // format
  document.addEventListener("click", function (evt) {
    const fmt = evt.target.closest && evt.target.closest(".format-code-btn");
    if (!fmt) return;
    const qid = fmt.dataset.questionId;
    if (window.cmEditors && window.cmEditors[qid]) {
      try {
        const ed = window.cmEditors[qid];
        const val = ed.getValue().split("\n").map(l => l.replace(/\s+$/, "")).join("\n").replace(/\n{3,}/g, "\n\n");
        ed.setValue(val);
      } catch (e) { console.debug(e); }
    } else {
      const ta = document.getElementById(`code-${qid}`);
      if (ta) {
        const val = ta.value.split("\n").map(l => l.replace(/\s+$/, "")).join("\n").replace(/\n{3,}/g, "\n\n");
        ta.value = val;
      }
    }
  });

  // clear code
  document.addEventListener("click", function (evt) {
    const clr = evt.target.closest && evt.target.closest(".clear-code-btn");
    if (!clr) return;
    const qid = clr.dataset.questionId;
    if (window.cmEditors && window.cmEditors[qid]) {
      try { window.cmEditors[qid].setValue(""); } catch (e) {}
    } else {
      const ta = document.getElementById(`code-${qid}`);
      if (ta) ta.value = "";
    }
  });

  // clear output
  document.addEventListener("click", function (evt) {
    const co = evt.target.closest && evt.target.closest(".clear-output-btn");
    if (!co) return;
    const container = co.closest(".coding-question") || co.closest(".output-container");
    if (!container) return;
    const out = container.querySelector(".output-content") || container.querySelector("pre.output-content") || container.querySelector(`#output-${co.dataset.questionId}`);
    if (out) out.textContent = "";
    const tc = container.querySelector(".testcase-results");
    if (tc) tc.innerHTML = "";
  });
}

// ---------- ensure final submit waits for saves ----------
document.addEventListener('DOMContentLoaded', function(){
  // Modal confirm (Yes, Submit)
  const modalConfirmBtn = document.querySelector('#submitModal form button[type="submit"]');
  if (modalConfirmBtn) {
    modalConfirmBtn.addEventListener('click', function(e){
      e.preventDefault();
      modalConfirmBtn.disabled = true;
      (async function(){
        try {
          await saveAllAnswers();
          // allow unload prompt for manual submit
          window.__ALLOW_UNLOAD__ = true;
          setTimeout(()=> modalConfirmBtn.closest('form').submit(), 150);
        } catch(err) {
          console.error('Error saving before submit:', err);
          window.__ALLOW_UNLOAD__ = true;
          modalConfirmBtn.closest('form').submit();
        } finally {
          modalConfirmBtn.disabled = false;
        }
      })();
    });
  }

  // Auto-submit form (timer)
  const autoForm = document.getElementById('auto-submit-form');
  if (autoForm) {
    const origSubmit = autoForm.submit.bind(autoForm);
    autoForm.submit = function(){
      (async function(){
        try {
          await saveAllAnswers();
          // timer-initiated submit: allow navigation
          window.__ALLOW_UNLOAD__ = true;
          setTimeout(()=> origSubmit(), 150);
        } catch(e) { 
          window.__ALLOW_UNLOAD__ = true;
          origSubmit(); 
        }
      })();
    };
  }
});

document.addEventListener('submit', function (e) {
  const form = e.target;
  if (form && form.id === 'auto-submit-form') {
    // allow exiting fullscreen only after submission kicks off
    setTimeout(() => { document.exitFullscreen?.(); }, 200);
  }
}, true);

async function runSQL(qid, aid) {
  const out = document.getElementById(`sql-output-${qid}`);
  try {
    const ed = (window.cmEditors && window.cmEditors[qid]) || null;
    const ta = document.getElementById(`sql-editor-${qid}`);
    const query = ed ? ed.getValue() : (ta ? ta.value : '');
    if (out) out.textContent = "Running...";

    const form = new FormData();
    form.append("question_id", String(qid));
    form.append("assessment_id", String(aid || ''));
    form.append("query", query);

    const res = await fetch("/api/sql/run/", {
      method: "POST",
      body: form,
      headers: { "X-CSRFToken": getCSRFToken() }
    });
    const data = await res.json().catch(()=> ({}));
    if (!res.ok || data.error) {
      out && (out.innerHTML = `<pre class='error'>${(data && data.error) || 'Run failed'}</pre>`);
      return;
    }
    out && (out.innerHTML = window.renderRowsTable(data.rows, data.truncated));
  } catch (e) {
    console.error("RUN exception", e);
    out && (out.innerHTML = `<pre class='error'>${escapeHtml(e.message || String(e))}</pre>`);
  }
}

async function gradeSQL(qid, aid) {
  const out = document.getElementById(`sql-output-${qid}`);
  try {
    const ed = (window.cmEditors && window.cmEditors[qid]) || null;
    const ta = document.getElementById(`sql-editor-${qid}`);
    const query = ed ? ed.getValue() : (ta ? ta.value : '');
    if (out) out.textContent = "Grading...";

    const form = new FormData();
    form.append("question_id", String(qid));
    form.append("assessment_id", String(aid || ''));
    form.append("query", query);

    const res = await fetch("/api/sql/grade/", {
      method: "POST",
      body: form,
      headers: { "X-CSRFToken": getCSRFToken() }
    });
    const data = await res.json().catch(()=> ({}));
    if (!res.ok || data.error) {
      out && (out.innerHTML = `<pre class='error'>${(data && data.error) || 'Grade failed'}</pre>`);
      return;
    }
    out && (out.innerHTML = window.renderGradeResults(data));
  } catch (e) {
    console.error("GRADE exception", e);
    out && (out.innerHTML = `<pre class='error'>${escapeHtml(e.message || String(e))}</pre>`);
  }
}

// ---- helpers (global) ----
function escapeHtml(x) {
  if (x === null || x === undefined) return '';
  return String(x)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.renderRowsTable = function(rows, truncated) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return "<em>No rows</em>";
  }
  let html = "<div class='table-responsive'><table class='table table-sm table-bordered mb-2'><tbody>";
  for (const r of rows) {
    html += "<tr>" + r.map(c => `<td>${escapeHtml(c)}</td>`).join("") + "</tr>";
  }
  html += "</tbody></table></div>";
  if (truncated) html += "<div class='text-muted small'>Showing first 50 rows</div>";
  return html;
};

window.renderGradeResults = function(data) {
  const total = data.total_points ?? 0;
  const earned = data.earned_points ?? 0;
  const results = Array.isArray(data.results) ? data.results : [];
  let html = `<div class="mb-2"><strong>Score:</strong> ${earned} / ${total}</div>`;
  html += `<div class='table-responsive'><table class='table table-sm table-bordered'>
    <thead><tr><th>#</th><th>Status</th><th>Points</th></tr></thead><tbody>`;
  results.forEach((r, i) => {
    const status = r.error ? `❌ ${escapeHtml(r.error)}` : (r.passed ? "✅ Passed" : "❌ Failed");
    html += `<tr>
      <td>${i + 1}${r.hidden ? " (hidden)" : ""}</td>
      <td>${status}</td>
      <td>${(r.received || 0)} / ${r.points}</td>
    </tr>`;
  });
  html += "</tbody></table></div>";
  return html;
};

/* expose to window for inline template code */
window.initializeTimer = initializeTimer;
window.initializeNavigation = initializeNavigation;
window.initializeAutoSave = initializeAutoSave;
window.initializeProctoring = initializeProctoring;
window.showQuestion = showQuestion;
window.runCode = runCode;

/* DOM ready initialization */
document.addEventListener("DOMContentLoaded", function () {
  // basic features (actual start flag is set by gate in template)
  setTimeout(function () {
    initializeTimer && initializeTimer();
    initializeNavigation && initializeNavigation();
    initializeAutoSave && initializeAutoSave();
    initializeProctoring && initializeProctoring();
    setupCodeEditor && setupCodeEditor();
    bindCodeButtons && bindCodeButtons();
  }, 60);
});
