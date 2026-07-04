// core/static/js/codemirror-init.js
// Requires CodeMirror core + modes loaded via CDN in template (or you can load modes here).
window.editors = window.editors || {};
// map questionId -> CodeMirror instance
const cmEditors = {};
// core/static/js/codemirror-init.js
// Creates CodeMirror editors for every textarea.code-editor
(function(){
  // simple debounce
  function _debounce(fn, wait) {
    let t;
    return function() {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(function(){ fn.apply(null, args); }, wait);
    };
  }

  const cmEditors = {};

  function initAllEditors() {
    if (typeof CodeMirror === 'undefined') {
      console.warn('codemirror-init: CodeMirror not found');
      return;
    }

    document.querySelectorAll('.code-editor').forEach(function(ta){
      // support id="code-123" OR id="sql-editor-123"
      let qid = ta.dataset.questionId;
      if (!qid && ta.id) {
        const m = ta.id.match(/(?:code|sql-editor)-(\d+)/);
        if (m) qid = m[1];
      }
      if (!qid) return;
      // avoid double-init
      if (cmEditors[qid]) return;

      // map language to mode
      const langSelect = document.querySelector('.code-language[data-question-id="'+qid+'"]');
      const lang = (langSelect && langSelect.value) ? langSelect.value : 'python';
      const modeMap = { python: 'python', javascript: 'javascript', java: 'text/x-java', c: 'text/x-csrc', cpp: 'text/x-c++src', mysql: 'text/x-mysql' };
      const mode = modeMap[lang] || 'python';

      const editor = CodeMirror.fromTextArea(ta, {
        lineNumbers: true,
        mode: mode,
        indentUnit: 4,
        tabSize: 4,
        autoCloseBrackets: true,
        matchBrackets: true,
        indentWithTabs: true,
        viewportMargin: Infinity,
        theme: 'default'
      });

      cmEditors[qid] = editor;

      // update mode when language changes
      if (langSelect) {
        langSelect.addEventListener('change', function(){
          const newMode = modeMap[this.value] || 'python';
          editor.setOption('mode', newMode);
          // Also save the code when language changes
          const fake = { 
            dataset: { questionId: qid, assessmentId: ta.dataset.assessmentId || '' }, 
            value: editor.getValue(), 
            type: 'textarea',
            classList: { contains: (cls) => cls === 'code-editor' }
          };
          try { saveAnswer(fake); } catch(e) { /* ignore if saveAnswer not ready */ }
        });
      }

      // auto-save on change
      editor.on('change', _debounce(function(){
        // fake element expected by saveAnswer - must have classList for code-editor check
        const fake = { 
          dataset: { questionId: qid, assessmentId: ta.dataset.assessmentId || '' }, 
          value: editor.getValue(), 
          type: 'textarea',
          classList: { contains: (cls) => cls === 'code-editor' }
        };
        try { saveAnswer(fake); } catch(e) { /* ignore if saveAnswer not ready */ }
      }, 900));

      // wire run/format/clear buttons
      const runBtn = document.querySelector('.run-code-btn[data-question-id="'+qid+'"]');
      if (runBtn) runBtn.addEventListener('click', function(e){ e.preventDefault(); try{ editor.save(); }catch{} if (typeof runCode==='function') runCode(qid, ta.dataset.assessmentId || ''); });

      const formatBtn = document.querySelector('.format-code-btn[data-question-id="'+qid+'"]');
      if (formatBtn) formatBtn.addEventListener('click', function(e){ e.preventDefault(); const val = editor.getValue().split('\n').map(l=>l.replace(/\s+$/,'')).join('\n').replace(/\n{3,}/g,'\n\n'); editor.setValue(val); });

      const clearBtn = document.querySelector('.clear-code-btn[data-question-id="'+qid+'"]');
      if (clearBtn) clearBtn.addEventListener('click', function(e){ e.preventDefault(); editor.setValue(''); });

    }); // forEach

    // expose globally
    window.cmEditors = window.cmEditors || {};
    Object.assign(window.cmEditors, cmEditors);
  }

  // expose function
  window.initAllEditors = initAllEditors;
  // auto init if DOM already ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initAllEditors, 50);
  } else {
    document.addEventListener('DOMContentLoaded', initAllEditors);
  }
})();
