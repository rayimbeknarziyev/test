(function (global) {
  'use strict';

  const SUPPORTED = ['xlsx', 'xls', 'csv', 'docx', 'txt'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  class ParseError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ParseError';
    }
  }

  function getExtension(name) {
    const i = name.lastIndexOf('.');
    return i === -1 ? '' : name.slice(i + 1).toLowerCase();
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function cleanCell(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function validateFile(file) {
    if (!file) throw new ParseError('Fayl tanlanmagan. Iltimos, test faylini tanlang.');
    const ext = getExtension(file.name);
    if (!SUPPORTED.includes(ext)) {
      throw new ParseError('Qo‘llab-quvvatlanmaydigan format: .' + (ext || '?') + '. Faqat ' + SUPPORTED.map(function (e) { return '.' + e; }).join(', ') + ' fayllari mumkin.');
    }
    if (file.size === 0) throw new ParseError('Fayl bo‘sh.');
    if (file.size > MAX_FILE_SIZE) {
      throw new ParseError('Fayl hajmi juda katta (' + formatSize(file.size) + '). Maksimal hajm: ' + formatSize(MAX_FILE_SIZE) + '.');
    }
    return ext;
  }

  function readFileAsync(file, mode, onProgress) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onprogress = function (e) {
        if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
      };
      reader.onerror = function () {
        reject(new ParseError('Faylni o‘qib bo‘lmadi. Fayl shikastlangan yoki ochilmayapti.'));
      };
      reader.onload = function () {
        resolve(reader.result);
      };
      if (mode === 'text') reader.readAsText(file, 'UTF-8');
      else reader.readAsArrayBuffer(file);
    });
  }

  function detectDelimiter(text) {
    const lines = text.split(/\r?\n/).filter(function (l) { return l.trim() !== ''; }).slice(0, 20);
    if (!lines.length) return ',';
    const candidates = ['\t', ';', '|', ','];
    for (let i = 0; i < candidates.length; i++) {
      const d = candidates[i];
      const hits = lines.filter(function (l) { return l.indexOf(d) !== -1; }).length;
      if (hits / lines.length >= 0.6) return d;
    }
    return ',';
  }

  function parseDelimited(text, delimiter) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"' && field === '') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
    if (field !== '' || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  function textToRows(text) {
    const clean = text.replace(/^\uFEFF/, '');
    return parseDelimited(clean, detectDelimiter(clean));
  }

  function isHeaderRow(row) {
    const first = cleanCell(row[0]).toLowerCase();
    const second = cleanCell(row[1]).toLowerCase();
    const firstHeader = /^(№|#|t\/r|savol(lar)?|question|questions|вопрос|вопросы)$/.test(first);
    const secondHeader = /^(to['‘’ʻʼ`]?g['‘’ʻʼ`]?ri( javob)?|correct( answer)?|javob|answer|правильный( ответ)?)$/.test(second);
    return firstHeader || secondHeader;
  }

  function stripHeader(rows) {
    if (rows.length && isHeaderRow(rows[0])) return rows.slice(1);
    return rows;
  }

  function rowsToQuestions(rows) {
    const stats = { rows: 0, empty: 0, noCorrect: 0, noWrong: 0, duplicates: 0, valid: 0 };
    const questions = [];
    const seen = new Set();

    rows.forEach(function (rawRow) {
      const row = Array.isArray(rawRow) ? rawRow.map(cleanCell) : [];
      if (!row.some(function (c) { return c !== ''; })) {
        stats.empty++;
        return;
      }
      stats.rows++;
      const question = row[0] || '';
      const correct = row[1] || '';
      if (!question || !correct) {
        stats.noCorrect++;
        return;
      }
      const wrong = [];
      const used = new Set([correct.toLowerCase()]);
      for (let i = 2; i < row.length; i++) {
        const a = row[i];
        if (!a) continue;
        const key = a.toLowerCase();
        if (used.has(key)) continue;
        used.add(key);
        wrong.push(a);
      }
      if (!wrong.length) {
        stats.noWrong++;
        return;
      }
      const qKey = question.toLowerCase();
      if (seen.has(qKey)) {
        stats.duplicates++;
        return;
      }
      seen.add(qKey);
      questions.push({
        id: 'q' + (questions.length + 1),
        question: question,
        correctAnswer: correct,
        wrongAnswers: wrong
      });
    });

    stats.valid = questions.length;
    return { questions: questions, stats: stats };
  }

  function mergeResults(results) {
    const merged = { questions: [], stats: { rows: 0, empty: 0, noCorrect: 0, noWrong: 0, duplicates: 0, valid: 0 } };
    const seen = new Set();
    results.forEach(function (r) {
      Object.keys(r.stats).forEach(function (k) {
        if (k !== 'valid' && k !== 'duplicates') merged.stats[k] += r.stats[k];
      });
      merged.stats.duplicates += r.stats.duplicates;
      r.questions.forEach(function (q) {
        const key = q.question.toLowerCase();
        if (seen.has(key)) {
          merged.stats.duplicates++;
          return;
        }
        seen.add(key);
        merged.questions.push(Object.assign({}, q, { id: 'q' + (merged.questions.length + 1) }));
      });
    });
    merged.stats.valid = merged.questions.length;
    return merged;
  }

  function parseSpreadsheet(buffer) {
    if (typeof XLSX === 'undefined') throw new ParseError('Excel o‘qish kutubxonasi (SheetJS) yuklanmadi. Internet aloqasini tekshiring.');
    let workbook;
    try {
      workbook = XLSX.read(buffer, { type: 'array' });
    } catch (e) {
      throw new ParseError('Excel faylini o‘qib bo‘lmadi. Fayl shikastlangan bo‘lishi mumkin.');
    }
    if (!workbook.SheetNames.length) throw new ParseError('Faylda hech qanday varaq topilmadi.');
    const results = workbook.SheetNames.map(function (name) {
      const sheet = workbook.Sheets[name];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false, raw: false });
      return rowsToQuestions(stripHeader(rows));
    });
    return mergeResults(results);
  }

  function parseTextFile(text) {
    const rows = textToRows(text);
    return rowsToQuestions(stripHeader(rows));
  }

  async function parseDocx(buffer) {
    if (typeof mammoth === 'undefined') throw new ParseError('DOCX o‘qish kutubxonasi (Mammoth) yuklanmadi. Internet aloqasini tekshiring.');
    let html;
    try {
      const res = await mammoth.convertToHtml({ arrayBuffer: buffer });
      html = res.value;
    } catch (e) {
      throw new ParseError('DOCX faylini o‘qib bo‘lmadi. Fayl shikastlangan bo‘lishi mumkin.');
    }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const tables = Array.from(doc.querySelectorAll('table'));
    if (tables.length) {
      const results = tables.map(function (table) {
        const rows = Array.from(table.querySelectorAll('tr')).map(function (tr) {
          return Array.from(tr.children).map(function (cell) { return cell.textContent; });
        });
        return rowsToQuestions(stripHeader(rows));
      });
      const merged = mergeResults(results);
      if (merged.questions.length) return merged;
    }
    let raw;
    try {
      raw = (await mammoth.extractRawText({ arrayBuffer: buffer })).value;
    } catch (e) {
      throw new ParseError('DOCX matnini o‘qib bo‘lmadi.');
    }
    const fallback = parseTextFile(raw);
    if (fallback.questions.length) return fallback;
    throw new ParseError('DOCX faylida savollar jadvali topilmadi. Savollarni 5 ustunli jadval ko‘rinishida (Savol | To‘g‘ri javob | Xato javoblar) joylashtiring yoki .xlsx/.csv formatida yuklang.');
  }

  async function parseFile(file, onProgress) {
    const ext = validateFile(file);
    let result;
    if (ext === 'xlsx' || ext === 'xls') {
      const buffer = await readFileAsync(file, 'buffer', onProgress);
      result = parseSpreadsheet(buffer);
    } else if (ext === 'docx') {
      const buffer = await readFileAsync(file, 'buffer', onProgress);
      result = await parseDocx(buffer);
    } else {
      const text = await readFileAsync(file, 'text', onProgress);
      if (!text.trim()) throw new ParseError('Fayl bo‘sh.');
      result = parseTextFile(text);
    }
    if (!result.stats.rows) throw new ParseError('Faylda ma’lumot topilmadi.');
    if (!result.questions.length) {
      throw new ParseError('Yaroqli savollar topilmadi. Har bir qatorda savol, to‘g‘ri javob va kamida bitta xato javob bo‘lishi kerak.');
    }
    return {
      questions: result.questions,
      stats: result.stats,
      meta: { name: file.name, ext: ext, size: file.size }
    };
  }

  global.Parser = {
    parseFile: parseFile,
    parseSpreadsheet: parseSpreadsheet,
    parseTextFile: parseTextFile,
    parseDocx: parseDocx,
    rowsToQuestions: rowsToQuestions,
    ParseError: ParseError,
    formatSize: formatSize,
    getExtension: getExtension,
    SUPPORTED: SUPPORTED
  };
})(window);
