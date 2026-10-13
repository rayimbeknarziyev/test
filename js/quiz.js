(function (global) {
  'use strict';

  const SIZES = [25, 30, 50];
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function createSession(source, size) {
    const picked = shuffle(source).slice(0, Math.min(size, source.length));
    const items = picked.map(function (q) {
      const options = shuffle([{ text: q.correctAnswer, correct: true }].concat(
        q.wrongAnswers.map(function (w) { return { text: w, correct: false }; })
      ));
      return {
        id: q.id,
        question: q.question,
        correctAnswer: q.correctAnswer,
        options: options,
        selected: null
      };
    });
    return { size: size, items: items, index: 0, finished: false };
  }

  function answer(session, itemIndex, optionIndex) {
    if (session.finished) return false;
    const item = session.items[itemIndex];
    if (!item || item.selected !== null) return false;
    if (optionIndex < 0 || optionIndex >= item.options.length) return false;
    item.selected = optionIndex;
    return true;
  }

  function statusOf(item) {
    if (item.selected === null) return 'skipped';
    return item.options[item.selected].correct ? 'correct' : 'wrong';
  }

  function stats(session) {
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    session.items.forEach(function (item) {
      const s = statusOf(item);
      if (s === 'correct') correct++;
      else if (s === 'wrong') wrong++;
      else skipped++;
    });
    const total = session.items.length;
    const percent = total ? Math.round((correct / total) * 100) : 0;
    return { total: total, correct: correct, wrong: wrong, skipped: skipped, percent: percent, points: correct };
  }

  function answeredCount(session) {
    return session.items.filter(function (i) { return i.selected !== null; }).length;
  }

  function availableSizes(total) {
    const list = SIZES.map(function (n) { return { value: n, enabled: total >= n, label: n + ' ta savol' }; });
    if (total < SIZES[0]) list.push({ value: total, enabled: true, label: 'Barcha ' + total + ' ta savol' });
    return list;
  }

  global.Quiz = {
    createSession: createSession,
    answer: answer,
    statusOf: statusOf,
    stats: stats,
    answeredCount: answeredCount,
    availableSizes: availableSizes,
    SIZES: SIZES,
    LETTERS: LETTERS
  };
})(window);
