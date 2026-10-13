(function () {
  'use strict';

  const app = { data: null, size: null, session: null, loadToken: 0 };
  const RING_LENGTH = 2 * Math.PI * 70;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = function (id) { return document.getElementById(id); };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(name) {
    const i = document.createElement('i');
    i.setAttribute('data-lucide', name);
    return i;
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function setButtonContent(btn, iconName, label, iconAfter) {
    btn.replaceChildren();
    const span = el('span', null, label);
    if (iconAfter) {
      btn.append(span, icon(iconName));
    } else {
      btn.append(icon(iconName), span);
    }
    refreshIcons();
  }

  const toasts = {
    show: function (type, message) {
      const names = { success: 'circle-check', error: 'circle-alert', warning: 'triangle-alert', info: 'info' };
      const t = el('div', 'toast toast-' + type);
      t.append(icon(names[type] || 'info'), el('span', null, message));
      $('toasts').append(t);
      refreshIcons();
      const remove = function () {
        t.classList.add('out');
        setTimeout(function () { t.remove(); }, 300);
      };
      setTimeout(remove, 4800);
      t.addEventListener('click', remove);
    }
  };

  let modalResolver = null;

  function confirmDialog(title, text, okText, danger) {
    return new Promise(function (resolve) {
      $('modalTitle').textContent = title;
      $('modalText').textContent = text;
      const ok = $('modalOk');
      ok.textContent = okText || 'Tasdiqlash';
      ok.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
      $('modal').classList.remove('hidden');
      ok.focus();
      modalResolver = resolve;
    });
  }

  function closeModal(result) {
    $('modal').classList.add('hidden');
    if (modalResolver) {
      const r = modalResolver;
      modalResolver = null;
      r(result);
    }
  }

  const VIEWS = ['upload', 'settings', 'quiz', 'results', 'review'];

  function showView(name) {
    VIEWS.forEach(function (v) {
      const node = $('view-' + v);
      if (v === name) {
        node.classList.remove('hidden');
        node.classList.remove('view-enter');
        void node.offsetWidth;
        node.classList.add('view-enter');
      } else {
        node.classList.add('hidden');
      }
    });
    const inQuiz = name === 'quiz';
    $('mainHeader').classList.toggle('hidden', inQuiz);
    $('quizHeader').classList.toggle('hidden', !inQuiz);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = $('themeToggle');
    btn.replaceChildren(icon(theme === 'dark' ? 'sun' : 'moon'));
    refreshIcons();
    try { localStorage.setItem('testflow-theme', theme); } catch (e) {}
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem('testflow-theme'); } catch (e) {}
    if (!saved) saved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(saved);
  }

  function setBadgeIcon(ext) {
    const names = { xlsx: 'file-spreadsheet', xls: 'file-spreadsheet', csv: 'file-spreadsheet', docx: 'file-text', txt: 'file-text' };
    $('fileBadge').replaceChildren(icon(names[ext] || 'file'));
    refreshIcons();
  }

  function resetFileUi() {
    $('loadTrack').classList.add('hidden');
    $('loadFill').style.width = '0%';
    $('statusBox').classList.add('hidden');
    $('summaryBox').classList.add('hidden');
    $('previewBox').classList.add('hidden');
    $('startBtn').disabled = true;
  }

  function clearFile() {
    app.loadToken++;
    app.data = null;
    $('filePanel').classList.add('hidden');
    $('dropzone').classList.remove('compact');
    resetFileUi();
  }

  function showStatus(type, message) {
    const box = $('statusBox');
    box.className = 'status status-' + type;
    box.replaceChildren(icon(type === 'error' ? 'circle-alert' : 'triangle-alert'), el('span', null, message));
    refreshIcons();
  }

  function buildSummaryNote(stats) {
    const parts = [];
    if (stats.empty) parts.push(stats.empty + ' ta bo‘sh qator o‘tkazib yuborildi');
    if (stats.noCorrect) parts.push(stats.noCorrect + ' ta qatorda savol yoki to‘g‘ri javob yo‘q');
    if (stats.noWrong) parts.push(stats.noWrong + ' ta savolda xato javob yo‘q');
    if (stats.duplicates) parts.push(stats.duplicates + ' ta takroriy savol olib tashlandi');
    return parts.length ? parts.join(' · ') : 'Barcha qatorlar muvaffaqiyatli o‘qildi.';
  }

  function renderPreview(questions) {
    const list = $('previewList');
    list.replaceChildren();
    questions.slice(0, 5).forEach(function (q, i) {
      const row = el('div', 'pv-item');
      row.append(el('div', 'pv-q', (i + 1) + '. ' + q.question));
      const ans = el('div', 'pv-a');
      ans.append(icon('check'), el('span', null, q.correctAnswer));
      row.append(ans);
      row.append(el('div', 'pv-w', '+ ' + q.wrongAnswers.length + ' ta xato javob'));
      list.append(row);
    });
    if (questions.length > 5) list.append(el('div', 'pv-more', '… va yana ' + (questions.length - 5) + ' ta savol'));
    refreshIcons();
  }

  async function handleFile(file) {
    if (!file) {
      toasts.show('warning', 'Fayl tanlanmagan.');
      return;
    }
    const token = ++app.loadToken;
    app.data = null;
    resetFileUi();
    const ext = Parser.getExtension(file.name);
    $('filePanel').classList.remove('hidden');
    $('dropzone').classList.add('compact');
    $('fileName').textContent = file.name;
    $('fileSub').textContent = (ext ? ext.toUpperCase() : '—') + ' · ' + Parser.formatSize(file.size);
    setBadgeIcon(ext);
    $('loadTrack').classList.remove('hidden');
    const fill = $('loadFill');
    fill.style.width = '6%';
    try {
      const started = Date.now();
      const result = await Parser.parseFile(file, function (p) {
        if (token === app.loadToken) fill.style.width = Math.max(6, Math.round(p * 80)) + '%';
      });
      fill.style.width = '95%';
      const wait = 500 - (Date.now() - started);
      if (wait > 0) await sleep(wait);
      if (token !== app.loadToken) return;
      fill.style.width = '100%';
      await sleep(250);
      if (token !== app.loadToken) return;
      app.data = result;
      $('loadTrack').classList.add('hidden');
      $('foundCount').textContent = String(result.questions.length);
      $('summaryNote').textContent = buildSummaryNote(result.stats);
      const sum = $('summaryBox');
      sum.classList.remove('hidden');
      sum.classList.remove('pop');
      void sum.offsetWidth;
      sum.classList.add('pop');
      renderPreview(result.questions);
      $('previewBox').classList.remove('hidden');
      $('startBtn').disabled = false;
      toasts.show('success', result.questions.length + ' ta savol muvaffaqiyatli o‘qildi.');
      if (result.questions.length < Quiz.SIZES[0]) {
        showStatus('warning', 'Faylda atigi ' + result.questions.length + ' ta savol bor. Standart testlar uchun kamida ' + Quiz.SIZES[0] + ' ta savol kerak, shuning uchun barcha savollar bilan test o‘tkaziladi.');
      }
    } catch (err) {
      if (token !== app.loadToken) return;
      const message = err instanceof Parser.ParseError ? err.message : 'Faylni o‘qishda kutilmagan xatolik yuz berdi.';
      $('loadTrack').classList.add('hidden');
      showStatus('error', message);
      toasts.show('error', message);
    }
  }

  function renderSettings() {
    const total = app.data.questions.length;
    $('availableInfo').textContent = 'Faylda jami ' + total + ' ta savol mavjud.';
    const grid = $('countGrid');
    grid.replaceChildren();
    app.size = null;
    $('beginBtn').disabled = true;
    const sizes = Quiz.availableSizes(total);
    const firstEnabled = sizes.find(function (s) { return s.enabled; });
    sizes.forEach(function (s) {
      const card = el('button', 'count-card');
      card.type = 'button';
      card.disabled = !s.enabled;
      card.dataset.value = String(s.value);
      card.append(el('span', 'count-num', String(s.value)));
      card.append(el('span', 'count-label', s.enabled ? 'ta savol' : 'yetarli emas'));
      card.addEventListener('click', function () { selectSize(s.value); });
      grid.append(card);
    });
    if (firstEnabled) selectSize(firstEnabled.value);
  }

  function selectSize(value) {
    app.size = value;
    document.querySelectorAll('.count-card').forEach(function (c) {
      c.classList.toggle('selected', c.dataset.value === String(value));
    });
    $('beginBtn').disabled = false;
  }

  function startQuiz() {
    app.session = Quiz.createSession(app.data.questions, app.size);
    buildNavGrid();
    showView('quiz');
    renderQuestion(null);
  }

  function buildNavGrid() {
    const grid = $('navGrid');
    grid.replaceChildren();
    app.session.items.forEach(function (item, i) {
      const b = el('button', 'nav-num', String(i + 1));
      b.type = 'button';
      b.setAttribute('aria-label', 'Savol ' + (i + 1));
      b.addEventListener('click', function () { goTo(i); });
      grid.append(b);
    });
  }

  function updateNavGrid() {
    const s = app.session;
    Array.from($('navGrid').children).forEach(function (b, i) {
      const st = Quiz.statusOf(s.items[i]);
      b.classList.toggle('is-correct', st === 'correct');
      b.classList.toggle('is-wrong', st === 'wrong');
      b.classList.toggle('is-current', i === s.index);
      if (i === s.index) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
    });
  }

  function updateProgress() {
    const s = app.session;
    const total = s.items.length;
    const done = Quiz.answeredCount(s);
    const pct = total ? Math.round((done / total) * 100) : 0;
    $('progressLabel').textContent = 'Javob berilgan: ' + done + ' / ' + total;
    $('progressPct').textContent = pct + '%';
    $('quizFill').style.width = pct + '%';
  }

  function renderQuestion(direction, animateFeedback) {
    const s = app.session;
    const item = s.items[s.index];
    const total = s.items.length;
    $('quizCounter').textContent = 'Savol ' + (s.index + 1) + ' / ' + total;
    $('qNumber').textContent = 'Savol ' + (s.index + 1);
    $('qText').textContent = item.question;

    const card = $('qCard');
    if (direction) {
      card.classList.remove('enter-next', 'enter-prev');
      void card.offsetWidth;
      card.classList.add(direction === 'next' ? 'enter-next' : 'enter-prev');
    }

    const box = $('options');
    box.replaceChildren();
    const answered = item.selected !== null;
    item.options.forEach(function (opt, i) {
      const b = el('button', 'option');
      b.type = 'button';
      b.append(el('span', 'opt-letter', Quiz.LETTERS[i] || String(i + 1)));
      b.append(el('span', 'opt-text', opt.text));
      const mark = el('span', 'opt-mark');
      b.append(mark);
      if (answered) {
        b.disabled = true;
        const isSel = i === item.selected;
        if (opt.correct) {
          b.classList.add('correct');
          mark.append(icon('check'));
          if (animateFeedback && isSel) b.classList.add('pop');
        } else if (isSel) {
          b.classList.add('wrong');
          mark.append(icon('x'));
          if (animateFeedback) b.classList.add('shake');
        } else {
          b.classList.add('dim');
        }
      } else {
        b.addEventListener('click', function () { choose(i); });
      }
      box.append(b);
    });

    const fb = $('feedback');
    fb.className = 'feedback';
    fb.replaceChildren();
    if (answered) {
      const ok = item.options[item.selected].correct;
      fb.classList.add('show', ok ? 'ok' : 'bad');
      if (animateFeedback) fb.classList.add('anim');
      fb.append(icon(ok ? 'circle-check' : 'circle-x'), el('span', null, ok ? 'To‘g‘ri javob!' : 'Noto‘g‘ri javob'));
    }

    const last = s.index === total - 1;
    $('prevBtn').disabled = s.index === 0;
    $('nextBtn').classList.toggle('hidden', last);
    $('nextBtn').disabled = !answered;
    $('finishBtn').classList.toggle('hidden', !last);

    refreshIcons();
    updateProgress();
    updateNavGrid();
  }

  function choose(optionIndex) {
    const s = app.session;
    if (!Quiz.answer(s, s.index, optionIndex)) return;
    renderQuestion(null, true);
  }

  function goTo(index) {
    const s = app.session;
    if (index < 0 || index >= s.items.length || index === s.index) return;
    const dir = index > s.index ? 'next' : 'prev';
    s.index = index;
    renderQuestion(dir);
  }

  async function finishQuiz() {
    const s = app.session;
    const st = Quiz.stats(s);
    if (st.skipped > 0) {
      const ok = await confirmDialog('Testni yakunlaysizmi?', 'Hali ' + st.skipped + ' ta savolga javob berilmagan. Yakunlasangiz, ular javobsiz hisoblanadi.', 'Yakunlash', false);
      if (!ok) return;
    }
    s.finished = true;
    showResults();
  }

  function countUp(node, to, duration) {
    if (reducedMotion || to === 0) {
      node.textContent = String(to);
      return;
    }
    const start = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      node.textContent = String(Math.round(to * eased));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function resultMessage(pct) {
    if (pct >= 90) return 'Ajoyib natija! Mavzuni mukammal bilasiz.';
    if (pct >= 70) return 'Yaxshi natija! Bir oz takrorlash bilan yanada yaxshilaysiz.';
    if (pct >= 50) return 'Qoniqarli natija. Xato javoblarni ko‘rib chiqing va qayta urinib ko‘ring.';
    return 'Mavzuni yana bir bor takrorlash tavsiya etiladi. Qayta urinib ko‘ring!';
  }

  function showResults() {
    const st = Quiz.stats(app.session);
    showView('results');
    $('stTotal').textContent = String(st.total);
    $('stCorrect').textContent = String(st.correct);
    $('stWrong').textContent = String(st.wrong);
    $('stSkipped').textContent = String(st.skipped);
    $('scoreTotal').textContent = String(st.total);
    $('scoreMsg').textContent = resultMessage(st.percent);
    const ring = $('ringFg');
    ring.classList.remove('good', 'mid', 'low');
    ring.classList.add(st.percent >= 70 ? 'good' : st.percent >= 50 ? 'mid' : 'low');
    ring.style.strokeDasharray = String(RING_LENGTH);
    ring.style.strokeDashoffset = String(RING_LENGTH);
    $('scorePct').textContent = '0';
    $('scorePoints').textContent = '0';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        ring.style.strokeDashoffset = String(RING_LENGTH * (1 - st.percent / 100));
        countUp($('scorePct'), st.percent, 1200);
        countUp($('scorePoints'), st.points, 1200);
      });
    });
  }

  function showReview() {
    const list = $('reviewList');
    list.replaceChildren();
    app.session.items.forEach(function (item, i) {
      const st = Quiz.statusOf(item);
      const card = el('article', 'rv-card rv-' + st);
      const head = el('div', 'rv-head');
      head.append(el('span', 'rv-num', 'Savol ' + (i + 1)));
      const labels = { correct: 'To‘g‘ri', wrong: 'Noto‘g‘ri', skipped: 'Javobsiz' };
      const iconNames = { correct: 'circle-check', wrong: 'circle-x', skipped: 'circle-help' };
      const badge = el('span', 'rv-badge');
      badge.append(icon(iconNames[st]), el('span', null, labels[st]));
      head.append(badge);
      card.append(head);
      card.append(el('div', 'rv-q', item.question));
      const mine = el('div', 'rv-line rv-mine');
      mine.append(el('b', null, 'Sizning javobingiz: '));
      mine.append(el('span', null, item.selected === null ? 'Javob berilmagan' : item.options[item.selected].text));
      card.append(mine);
      if (st !== 'correct') {
        const right = el('div', 'rv-line rv-right');
        right.append(el('b', null, 'To‘g‘ri javob: '));
        right.append(el('span', null, item.correctAnswer));
        card.append(right);
      }
      list.append(card);
    });
    refreshIcons();
    showView('review');
  }

  async function restart() {
    const ok = await confirmDialog('Testni qayta boshlaysizmi?', 'Joriy natijalar o‘chiriladi. Savollar va variantlar yangidan aralashtiriladi.', 'Qayta boshlash', false);
    if (!ok) return;
    app.session = Quiz.createSession(app.data.questions, app.size);
    buildNavGrid();
    showView('quiz');
    renderQuestion(null);
    toasts.show('info', 'Test qayta boshlandi.');
  }

  async function quitQuiz() {
    const ok = await confirmDialog('Testdan chiqasizmi?', 'Test tugallanmagan. Chiqsangiz, hozirgi natijalar saqlanmaydi.', 'Chiqish', true);
    if (!ok) return;
    app.session = null;
    showView('upload');
  }

  function goHome() {
    showView('upload');
  }

  function bindUpload() {
    const dz = $('dropzone');
    const input = $('fileInput');
    const openPicker = function () { input.click(); };

    dz.addEventListener('click', openPicker);
    dz.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPicker();
      }
    });
    $('pickBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      openPicker();
    });
    input.addEventListener('change', function () {
      const f = input.files && input.files[0];
      input.value = '';
      if (f) handleFile(f);
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) {
        e.preventDefault();
        dz.classList.add('drag');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) {
        e.preventDefault();
        dz.classList.remove('drag');
      });
    });
    dz.addEventListener('drop', function (e) {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) {
        toasts.show('warning', 'Fayl tanlanmagan.');
        return;
      }
      if (files.length > 1) toasts.show('info', 'Faqat birinchi fayl yuklandi.');
      handleFile(files[0]);
    });
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) { e.preventDefault(); });

    $('clearFile').addEventListener('click', clearFile);
    $('startBtn').addEventListener('click', function () {
      if (!app.data) {
        toasts.show('warning', 'Avval test faylini yuklang.');
        return;
      }
      renderSettings();
      showView('settings');
    });
    $('headerUpload').addEventListener('click', function () {
      showView('upload');
      openPicker();
    });
  }

  function bindNav() {
    document.querySelectorAll('[data-action="home"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        goHome();
      });
    });
    document.querySelector('[data-action="about"]').addEventListener('click', function (e) {
      e.preventDefault();
      showView('upload');
      $('about').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    });
    $('themeToggle').addEventListener('click', function () {
      applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }

  function bindFlow() {
    $('settingsBack').addEventListener('click', goHome);
    $('beginBtn').addEventListener('click', function () {
      if (!app.size) {
        toasts.show('warning', 'Savollar sonini tanlang.');
        return;
      }
      if (app.size > app.data.questions.length) {
        toasts.show('error', 'Tanlangan savollar soni mavjud savollardan ko‘p.');
        return;
      }
      startQuiz();
    });
    $('prevBtn').addEventListener('click', function () { goTo(app.session.index - 1); });
    $('nextBtn').addEventListener('click', function () { goTo(app.session.index + 1); });
    $('finishBtn').addEventListener('click', finishQuiz);
    $('endNowBtn').addEventListener('click', finishQuiz);
    $('quitBtn').addEventListener('click', quitQuiz);
    $('quizBrand').addEventListener('click', function (e) {
      e.preventDefault();
      quitQuiz();
    });
    $('reviewBtn').addEventListener('click', showReview);
    $('restartBtn').addEventListener('click', restart);
    $('homeBtn').addEventListener('click', goHome);
    $('reviewBack').addEventListener('click', function () { showView('results'); });

    $('modalOk').addEventListener('click', function () { closeModal(true); });
    $('modalCancel').addEventListener('click', function () { closeModal(false); });
    $('modal').addEventListener('click', function (e) {
      if (e.target === $('modal')) closeModal(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('modal').classList.contains('hidden')) closeModal(false);
    });

    window.addEventListener('beforeunload', function (e) {
      if (app.session && !app.session.finished && Quiz.answeredCount(app.session) > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  function init() {
    initTheme();
    bindUpload();
    bindNav();
    bindFlow();
    refreshIcons();
    showView('upload');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
