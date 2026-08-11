/* ─────────────────────────────────────────────────────────
   하루 두 장 계산 트레이닝 — 온라인 버전
   정적 파일만으로 동작합니다. (빌드 도구 불필요)
   ───────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ── 저장소 (localStorage 사용 불가 시 메모리로 대체) ── */
  var Store = (function () {
    var mem = {}, ok = false;
    try {
      var k = '__t__'; window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k); ok = true;
    } catch (e) { ok = false; }
    return {
      get: function (key, def) {
        try {
          var raw = ok ? window.localStorage.getItem(key) : mem[key];
          return raw ? JSON.parse(raw) : def;
        } catch (e) { return def; }
      },
      set: function (key, val) {
        var raw = JSON.stringify(val);
        try { if (ok) window.localStorage.setItem(key, raw); else mem[key] = raw; }
        catch (e) { mem[key] = raw; }
      }
    };
  })();

  var PKEY = 'htj:v1:progress';
  function progress() { return Store.get(PKEY, {}); }
  function saveResult(setId, stepNo, day, sheet, res) {
    var p = progress();
    if (!p[setId]) p[setId] = {};
    var k = stepNo + '-' + day + '-' + sheet;
    var prev = p[setId][k];
    // 기록은 최고 점수를 유지합니다
    if (!prev || res.score > prev.score) p[setId][k] = res;
    Store.set(PKEY, p);
  }
  function getResult(setId, stepNo, day, sheet) {
    var p = progress()[setId];
    return p ? p[stepNo + '-' + day + '-' + sheet] : null;
  }
  function isCleared(r) { return r && r.total > 0 && r.score / r.total >= 0.9; }

  /* ── 데이터 로딩 ────────────────────────────────────── */
  var SETS = {};
  var pending = {};

  function deliver(id, data) {
    if (data) SETS[id] = data;
    if (pending[id]) { pending[id].forEach(function (f) { f(data); }); delete pending[id]; }
  }
  /* 평문 데이터(개발용) */
  window.registerSet = function (data) { deliver(data.id, data); };
  /* 암호화 데이터(배포용) — 인증된 콘텐츠 키로 복호화 */
  window.registerEncryptedSet = function (payload) {
    if (!window.Auth || !window.Auth.contentKey) return deliver(payload.id, null);
    window.Auth.decryptSet(payload)
      .then(function (data) { deliver(payload.id, data); })
      .catch(function () { deliver(payload.id, null); });
  };

  function loadSet(id, cb) {
    if (SETS[id]) return cb(SETS[id]);
    if (pending[id]) { pending[id].push(cb); return; }
    pending[id] = [cb];
    var s = document.createElement('script');
    s.src = 'data/' + id + '.enc.js';
    s.onerror = function () {
      /* 암호화본이 없으면 평문 데이터로 한 번 더 시도(로컬 개발용) */
      var t = document.createElement('script');
      t.src = 'data/' + id + '.js';
      t.onerror = function () { deliver(id, null); };
      document.head.appendChild(t);
    };
    document.head.appendChild(s);
  }
  function setMeta(id) {
    var list = (window.CURRICULUM && window.CURRICULUM.sets) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* ── 유틸 ───────────────────────────────────────────── */
  var app = document.getElementById('app');
  var crumbEl = document.getElementById('crumbs');
  var CIRC = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚';
  function circ(i) { return i < CIRC.length ? CIRC[i] : '(' + (i + 1) + ')'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
  function mmss(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function crumbs(items) {
    crumbEl.innerHTML = items.map(function (it, i) {
      var sep = i ? '<span class="sep">›</span>' : '';
      return sep + (it.href
        ? '<a href="' + it.href + '">' + esc(it.label) + '</a>'
        : '<span class="now">' + esc(it.label) + '</span>');
    }).join('');
  }

  /* ─────────────────────────────────────────────────────
     문제 렌더러
     각 렌더러는 { html, answers, cols } 를 돌려줍니다.
     answers[i] = i번 문제의 정답 배열(빈칸 순서대로, 문자열)
     ───────────────────────────────────────────────────── */
  function inp(cls) { return '<input class="blank ' + (cls || '') + '" type="text" inputmode="numeric" autocomplete="off">'; }

  var R = {};

  R.mulh = function (sheet) {
    var answers = [];
    var html = sheet.items.map(function (it, i) {
      answers.push([String(it[0] * it[1])]);
      return '<div class="q" data-i="' + i + '"><span class="no">' + circ(i) + '</span>' +
        '<div class="body"><span class="expr">' + it[0] + '<span class="op">×</span>' + it[1] +
        '<span class="op">=</span></span>' + inp() + '<span class="mark"></span></div></div>';
    }).join('');
    return { html: html, answers: answers, cols: 3 };
  };

  R.divh = function (sheet) {
    var answers = [];
    var html = sheet.items.map(function (it, i) {
      answers.push([String(it[0] / it[1])]);
      return '<div class="q" data-i="' + i + '"><span class="no">' + circ(i) + '</span>' +
        '<div class="body"><span class="expr">' + it[0] + '<span class="op">÷</span>' + it[1] +
        '<span class="op">=</span></span>' + inp('sm') + '<span class="mark"></span></div></div>';
    }).join('');
    return { html: html, answers: answers, cols: 3 };
  };

  R.mulv = function (sheet) {
    var d = sheet.digits || 2, w = d + 1;
    var answers = [];
    var html = sheet.items.map(function (it, i) {
      var prod = it[0] * it[1];
      answers.push([String(prod)]);
      var top = String(it[0]).padStart(d, ' ');
      var cells = '';
      for (var j = 0; j < d; j++) cells += '<td>' + (top[j] === ' ' ? '' : top[j]) + '</td>';
      var mid = '';
      for (var k = 0; k < d; k++) mid += '<td>' + (k === d - 1 ? it[1] : '') + '</td>';
      var hdr = ['천', '백', '십', '일'].slice(-(w)).map(function (h) {
        return '<td class="hdr">' + h + '</td>'; }).join('');
      return '<div class="q" data-i="' + i + '"><span class="no">' + circ(i) + '</span>' +
        '<div class="body"><div class="vwrap"><table class="vtable">' +
        '<tr>' + hdr + '</tr>' +
        '<tr><td class="pad"></td>' + cells + '</tr>' +
        '<tr class="uline"><td class="sign">×</td>' + mid + '</tr>' +
        '</table>' + inp() + '</div><span class="mark"></span></div></div>';
    }).join('');
    return { html: html, answers: answers, cols: 3 };
  };

  R.divv = function (sheet) {
    var answers = [];
    var html = sheet.items.map(function (it, i) {
      answers.push([String(it[0] / it[1])]);
      var ds = String(it[0]);
      var body = ds.split('').map(function (c) { return '<td>' + c + '</td>'; }).join('');
      var blanks = ds.split('').map(function () { return '<td></td>'; }).join('');
      return '<div class="q" data-i="' + i + '"><span class="no">' + circ(i) + '</span>' +
        '<div class="body"><div class="vwrap"><table class="dtable">' +
        '<tr><td class="none"></td>' + blanks + '</tr>' +
        '<tr><td class="dv none">' + it[1] + '</td>' + body + '</tr>' +
        '</table>' + inp('sm') + '</div><span class="mark"></span></div></div>';
    }).join('');
    return { html: html, answers: answers, cols: 3 };
  };

  R.family = function (sheet) {
    var answers = [];
    var html = sheet.items.map(function (it, i) {
      answers.push([String(it.p), String(it.d), String(it.q),
                    String(it.p), String(it.q), String(it.d)]);
      return '<div class="q family" data-i="' + i + '"><span class="no">' + circ(i) + '</span>' +
        '<span class="mark"></span>' +
        '<div class="fam-top">' + it.d + ' × ' + it.q + ' = ' + it.p + '</div>' +
        '<div class="fam-row">' + inp('xs') + ' ÷ ' + inp('xs') + ' = ' + inp('xs') + '</div>' +
        '<div class="fam-row">' + inp('xs') + ' ÷ ' + inp('xs') + ' = ' + inp('xs') + '</div>' +
        '</div>';
    }).join('');
    return {
      html: html, answers: answers, cols: 2,
      // 두 나눗셈식은 순서를 바꿔 써도 정답으로 인정합니다
      check: function (qi, v) {
        var it = sheet.items[qi];
        var a = v.slice(0, 3).join('/'), b = v.slice(3, 6).join('/');
        var w1 = [it.p, it.d, it.q].join('/'), w2 = [it.p, it.q, it.d].join('/');
        return (a === w1 && b === w2) || (a === w2 && b === w1);
      }
    };
  };

  R.bundle = function (sheet) {
    var answers = [];
    var rows = sheet.items.map(function (it, i) {
      var vals = [it.total, it.per, it.cnt];
      answers.push([String(vals[it.hidden]), String(it.total), String(it.per), String(it.cnt)]);
      var c = [0, 1, 2].map(function (j) {
        return '<td>' + (j === it.hidden ? inp('xs') : vals[j]) + '</td>'; }).join('');
      return '<tr data-i="' + i + '"><td class="qn">' + circ(i) + '</td>' + c +
        '<td><div class="bundle-eq">' + inp('xs') + ' ÷ ' + inp('xs') + ' = ' + inp('xs') +
        ' <span class="mark"></span></div></td></tr>';
    }).join('');
    var html = '<table class="bundle-tab"><tr><th></th><th>전체 개수</th><th>한 묶음의 개수</th>' +
      '<th>묶음 수</th><th>나눗셈식으로 쓰기</th></tr>' + rows + '</table>';
    return { html: html, answers: answers, cols: 1, table: true };
  };

  R.unit = function (sheet) {
    var answers = [];
    var html = sheet.items.map(function (it, i) {
      var x1 = it.a[0], y1 = it.a[1], x2 = it.b[0], y2 = it.b[1], m, s;
      if (it.op === '+') { s = y1 + y2; m = x1 + x2 + Math.floor(s / it.base); s = s % it.base; }
      else { var t = (x1 * it.base + y1) - (x2 * it.base + y2); m = Math.floor(t / it.base); s = t % it.base; }
      answers.push([String(m), String(s)]);
      var u1 = '<span class="uu">' + it.u1 + '</span>', u2 = '<span class="uu">' + it.u2 + '</span>';
      return '<div class="q" data-i="' + i + '"><span class="no">' + circ(i) + '</span>' +
        '<span class="mark"></span><div class="body"><table class="utable">' +
        '<tr><td class="sign"></td><td>' + x1 + u1 + '</td><td>' + y1 + u2 + '</td></tr>' +
        '<tr class="uline"><td class="sign">' + (it.op === '+' ? '+' : '−') + '</td>' +
        '<td>' + x2 + u1 + '</td><td>' + y2 + u2 + '</td></tr>' +
        '<tr><td class="res sign"></td>' +
        '<td class="res"><div class="ures">' + inp('xs') + u1 + '</div></td>' +
        '<td class="res"><div class="ures">' + inp('xs') + u2 + '</div></td></tr>' +
        '</table></div></div>';
    }).join('');
    return { html: html, answers: answers, cols: 2 };
  };

  R.eq = function (sheet) {
    var answers = [];
    var html = sheet.items.map(function (it, i) {
      var q, hint, val;
      var SQ = '<span class="sqbox">□</span>';
      if (it.t === 'mr') { q = it.x + ' × ' + SQ + ' = ' + it.y; val = it.y / it.x; hint = '□ = ' + it.y + ' ÷ ' + it.x; }
      else if (it.t === 'ml') { q = SQ + ' × ' + it.x + ' = ' + it.y; val = it.y / it.x; hint = '□ = ' + it.y + ' ÷ ' + it.x; }
      else if (it.t === 'dd') { q = SQ + ' ÷ ' + it.x + ' = ' + it.y; val = it.y * it.x; hint = '□ = ' + it.y + ' × ' + it.x; }
      else { q = it.x + ' ÷ ' + SQ + ' = ' + it.y; val = it.x / it.y; hint = '□ = ' + it.x + ' ÷ ' + it.y; }
      answers.push([String(val)]);
      return '<div class="q eq" data-i="' + i + '" data-hint="' + esc(hint) + '">' +
        '<span class="no">' + circ(i) + '</span><span class="mark"></span>' +
        '<div class="eq-q">' + q + '</div>' +
        '<div class="eq-a">→ <span class="sqbox">□</span> = ' + inp('sm') + '</div></div>';
    }).join('');
    return { html: html, answers: answers, cols: 2 };
  };


  /* ═══ 1학년 유형 ═══════════════════════════════════════ */

  R.part = function (sheet) {
    var answers = [];
    var html = sheet.items.map(function (it, i) {
      var v = [it.w, it.a, it.b];
      answers.push([String(v[it.hidden])]);
      var cell = function (j, cls) {
        return j === it.hidden ? inp('xs') : '<span class="' + cls + '">' + v[j] + '</span>';
      };
      return '<div class="q part" data-i="' + i + '"><span class="no">' + circ(i) + '</span>' +
        '<span class="mark"></span>' +
        '<div class="pbar"><div class="pb-top">' + cell(0, 'pv') + '</div>' +
        '<div class="pb-bot"><div class="pb-half">' + cell(1, 'pv') + '</div>' +
        '<div class="pb-half">' + cell(2, 'pv') + '</div></div></div></div>';
    }).join('');
    return { html: html, answers: answers, cols: 2, hint: sheet.hint };
  };

  R.arith = function (sheet) {
    var answers = [];
    var html = sheet.items.map(function (it, i) {
      answers.push([String(it[1] === '+' ? it[0] + it[2] : it[0] - it[2])]);
      return '<div class="q" data-i="' + i + '"><span class="no">' + circ(i) + '</span>' +
        '<div class="body"><span class="expr">' + it[0] + '<span class="op">' + it[1] + '</span>' +
        it[2] + '<span class="op">=</span></span>' + inp('sm') + '<span class="mark"></span></div></div>';
    }).join('');
    return { html: html, answers: answers, cols: 3 };
  };

  R.atable = function (sheet) {
    var it = sheet.items[0], answers = [];
    var head = '<tr><th class="corner">' + it.op + '</th>' +
      it.cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr>';
    var rows = it.rows.map(function (r, ri) {
      var tds = it.cols.map(function (c, ci) {
        answers.push([String(it.op === '+' ? r + c : r - c)]);
        return '<td data-i="' + (ri * it.cols.length + ci) + '">' + inp('xs') +
               '<span class="mark"></span></td>';
      }).join('');
      return '<tr><th class="rowh">' + r + '</th>' + tds + '</tr>';
    }).join('');
    return {
      html: '<table class="atab">' + head + rows + '</table>',
      answers: answers, cols: 1, table: true, cellSel: '.atab td[data-i]',
      hint: it.op === '+' ? '가로줄의 수와 세로줄의 수를 더해서 빈칸에 쓰세요.'
                          : '왼쪽 수에서 위쪽 수를 빼서 빈칸에 쓰세요.'
    };
  };

  R.eq1 = function (sheet) {
    var answers = [], SQ = '<span class="sq1"></span>';
    var html = sheet.items.map(function (it, i) {
      var q, v;
      if (it.t === 'ar') { q = it.x + ' + ' + SQ + ' = ' + it.y; v = it.y - it.x; }
      else if (it.t === 'al') { q = SQ + ' + ' + it.x + ' = ' + it.y; v = it.y - it.x; }
      else if (it.t === 'sr') { q = it.x + ' − ' + SQ + ' = ' + it.y; v = it.x - it.y; }
      else { q = SQ + ' − ' + it.x + ' = ' + it.y; v = it.x + it.y; }
      answers.push([String(v)]);
      return '<div class="q eq1" data-i="' + i + '"><span class="no">' + circ(i) + '</span>' +
        '<span class="mark"></span><div class="eq1q">' + q.replace(SQ, inp('xs')) + '</div></div>';
    }).join('');
    return { html: html, answers: answers, cols: 2, hint: sheet.hint };
  };

  R.numfam = function (sheet) {
    var answers = [];
    var html = sheet.items.map(function (it, i) {
      answers.push([String(it.c), String(it.c), String(it.b), String(it.a)]);
      return '<div class="q numfam" data-i="' + i + '"><span class="no">' + circ(i) + '</span>' +
        '<span class="mark"></span>' +
        '<div class="nf-nums"><span>' + it.a + '</span><span>' + it.b + '</span><span>' + it.c + '</span></div>' +
        '<div class="nf-grid">' +
        '<div class="nf-item">' + it.a + ' + ' + it.b + ' = ' + inp('xs') + '</div>' +
        '<div class="nf-item">' + it.b + ' + ' + it.a + ' = ' + inp('xs') + '</div>' +
        '<div class="nf-item">' + it.c + ' − ' + it.a + ' = ' + inp('xs') + '</div>' +
        '<div class="nf-item">' + it.c + ' − ' + it.b + ' = ' + inp('xs') + '</div>' +
        '</div></div>';
    }).join('');
    return { html: html, answers: answers, cols: 2,
             hint: '세 수로 덧셈식 두 개와 뺄셈식 두 개를 만들어 보세요.' };
  };

  R.seq = function (sheet) {
    var answers = [];
    var rows = sheet.items.map(function (it, i) {
      var av = [], tds = '';
      for (var k = 0; k < 5; k++) {
        if (it.hide.indexOf(k) >= 0) { av.push(String(it.start + k)); tds += '<td>' + inp('xs') + '</td>'; }
        else tds += '<td class="sfix">' + (it.start + k) + '</td>';
      }
      answers.push(av);
      return '<tr data-i="' + i + '"><td class="sn">' + circ(i) + '</td>' + tds +
             '<td class="smark"><span class="mark"></span></td></tr>';
    }).join('');
    return { html: '<table class="stab">' + rows + '</table>', answers: answers,
             cols: 1, table: true, cellSel: '.stab tr[data-i]',
             hint: '수의 순서에 맞게 빈칸을 채우세요.' };
  };

  /* ─────────────────────────────────────────────────────
     화면 1 — 학기 목록
     ───────────────────────────────────────────────────── */
  function viewHome() {
    crumbs([{ label: '학기 선택' }]);
    var sets = (window.CURRICULUM && window.CURRICULUM.sets) || [];
    var p = progress();

    var cards = sets.map(function (s) {
      if (s.status !== 'ready') {
        return '<div class="card soon"><div class="card-tag">준비 중</div>' +
          '<h3>' + esc(s.title) + '</h3><div class="sub">' + esc(s.subtitle) + '</div>' +
          '<div class="desc">' + esc(s.desc || '') + '</div></div>';
      }
      var rec = p[s.id] || {}, cleared = 0;
      Object.keys(rec).forEach(function (k) { if (isCleared(rec[k])) cleared++; });
      var total = s.sheets || 200;
      var pct = Math.round(cleared / total * 100);
      return '<a class="card" href="#/s/' + s.id + '"><div class="card-tag">' +
        s.grade + '학년 ' + s.term + '학기</div>' +
        '<h3>' + esc(s.title) + '</h3><div class="sub">' + esc(s.subtitle) + '</div>' +
        '<div class="desc">' + esc(s.desc || '') + '</div>' +
        '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="bar-label"><span>진행률</span><b>' + cleared + ' / ' + total + '장</b></div></a>';
    }).join('');

    app.innerHTML =
      '<div class="page-head center"><span class="eyebrow">온라인 연습</span>' +
      '<h1>어느 학기를 풀어볼까요?</h1>' +
      '<p>학기를 고르면 회차별 연습장이 열립니다. 문제를 풀고 <b>채점하기</b>를 누르면 바로 정답을 확인할 수 있어요.<br>' +
      '기록은 이 브라우저에만 저장되며, 서버로 전송되지 않습니다.</p></div>' +
      '<div class="card-grid">' + cards + '</div>';
  }

  /* ─────────────────────────────────────────────────────
     화면 2 — 회차 목록
     ───────────────────────────────────────────────────── */
  function viewSet(setId) {
    var meta = setMeta(setId);
    crumbs([{ label: '학기 선택', href: '#/' }, { label: meta ? meta.title : setId }]);
    app.innerHTML = '<div class="loading">불러오는 중…</div>';

    loadSet(setId, function (data) {
      if (!data) {
        app.innerHTML = '<div class="page-head"><h1>학기 데이터를 찾을 수 없습니다</h1>' +
          '<p><code>data/' + esc(setId) + '.js</code> 파일이 있는지 확인해 주세요.</p></div>' +
          '<div class="btn-row"><a class="btn ghost" href="#/">학기 목록으로</a></div>';
        return;
      }
      var rec = (progress()[setId]) || {};
      var dayCount = data.steps[0] ? data.steps[0].days.length : 10;
      var pagesPerStep = dayCount * 2 + 2;      /* 표지 + 원리 + 연습 */
      var rows = data.steps.map(function (st) {
        var done = 0;
        st.days.forEach(function (d) {
          d.sheets.forEach(function (sh) {
            if (isCleared(rec[st.no + '-' + d.day + '-' + sh.key])) done++;
          });
        });
        var totalSheets = st.days.length * 2;
        return '<div class="step-row' + (done === totalSheets ? ' done' : '') + '">' +
          '<div class="step-no">' + st.no + '회</div>' +
          '<div class="step-main"><h3>' + esc(st.title) +
          '<span class="tag">' + esc(st.tag) + '</span></h3>' +
          '<p>' + esc(st.goal) + '</p>' +
          '<div class="bar"><i style="width:' + Math.round(done / totalSheets * 100) + '%"></i></div>' +
          '<div class="bar-label"><span>' + esc(st.concept.title) + '</span><b>' + done + ' / ' + totalSheets + '장</b></div>' +
          '</div>' +
          '<div class="step-acts">' +
          '<a class="btn ghost" href="#/s/' + setId + '/' + st.no + '/concept">원리 보기</a>' +
          '<a class="btn" href="#/s/' + setId + '/' + st.no + '">연습하기</a>' +
          '</div></div>';
      }).join('');

      app.innerHTML =
        '<div class="page-head withaction">' +
        '<div class="ph-main"><span class="eyebrow">' + esc(data.title) + '</span>' +
        '<h1>' + esc(data.subtitle) + '</h1>' +
        '<p>' + esc(data.desc || '') + ' · 한 회차는 <b>원리 1장 + 연습 ' + (dayCount * 2) +
        '장(DAY 1~' + dayCount + ' × A·B)</b>입니다.<br>' +
        '하루에 A·B 두 장씩, ' + dayCount + '일이면 한 회차가 끝나요.</p></div>' +
        '<div class="ph-act"><button class="btn ghost" id="printset" ' +
        'title="' + data.steps.length + '회차 전부를 A4 ' + (data.steps.length * pagesPerStep) +
        '장으로 인쇄합니다">학기 전체 인쇄</button>' +
        '<span class="ph-hint">A4 ' + (data.steps.length * pagesPerStep) + '장</span></div>' +
        '</div>' +
        '<div class="step-list">' + rows + '</div>';

      document.getElementById('printset').addEventListener('click', function () {
        if (confirm(data.steps.length + '회차 전체를 인쇄합니다. A4 ' +
                    (data.steps.length * pagesPerStep) +
                    '장이 출력됩니다. 시간이 걸릴 수 있어요. 계속할까요?')) window.Printer.set(data);
      });
    });
  }

  /* ─────────────────────────────────────────────────────
     화면 3 — 회차 상세 (DAY 목록)
     ───────────────────────────────────────────────────── */
  function viewStep(setId, stepNo) {
    loadSet(setId, function (data) {
      if (!data) return viewSet(setId);
      var st = data.steps.filter(function (s) { return s.no === stepNo; })[0];
      if (!st) return viewSet(setId);
      crumbs([{ label: '학기 선택', href: '#/' },
              { label: data.title, href: '#/s/' + setId },
              { label: stepNo + '회' }]);

      var rec = (progress()[setId]) || {};
      var boxes = st.days.map(function (d) {
        var links = d.sheets.map(function (sh) {
          var r = rec[st.no + '-' + d.day + '-' + sh.key];
          var score = r ? r.score + ' / ' + r.total : sh.items.length + '문항';
          return '<a class="sheet-link' + (isCleared(r) ? ' cleared' : '') + '" href="#/s/' +
            setId + '/' + st.no + '/' + d.day + '/' + sh.key + '">' +
            '<span>' + sh.key + '. ' + esc(sh.label) + '</span>' +
            '<span class="score">' + score + '</span></a>';
        }).join('');
        return '<div class="day-box"><h4>DAY ' + d.day + '</h4>' + links + '</div>';
      }).join('');

      var sheetCount = st.days.length * 2 + 2;
      app.innerHTML =
        '<div class="page-head withaction">' +
        '<div class="ph-main"><span class="eyebrow">' + esc(st.tag) + '</span>' +
        '<h1>' + stepNo + '회 · ' + esc(st.title) + '</h1>' +
        '<p>' + esc(st.goal) + '</p></div>' +
        '<div class="ph-act"><button class="btn ghost" id="printstep" ' +
        'title="표지 · 원리 · 연습 6장을 A4로 인쇄합니다">이 회차 인쇄</button>' +
        '<span class="ph-hint">A4 ' + sheetCount + '장</span></div>' +
        '</div>' +
        '<div class="btn-row"><a class="btn navy" href="#/s/' + setId + '/' + stepNo + '/concept">' +
        '원리 한 장 먼저 읽기</a>' +
        '<a class="btn ghost" href="#/s/' + setId + '">회차 목록</a></div>' +
        '<div class="day-grid">' + boxes + '</div>';

      document.getElementById('printstep').addEventListener('click', function () {
        window.Printer.step(st);
      });
    });
  }

  /* ─────────────────────────────────────────────────────
     화면 4 — 원리 한 장
     ───────────────────────────────────────────────────── */
  function viewConcept(setId, stepNo) {
    loadSet(setId, function (data) {
      if (!data) return viewSet(setId);
      var st = data.steps.filter(function (s) { return s.no === stepNo; })[0];
      if (!st) return viewSet(setId);
      crumbs([{ label: '학기 선택', href: '#/' },
              { label: data.title, href: '#/s/' + setId },
              { label: stepNo + '회', href: '#/s/' + setId + '/' + stepNo },
              { label: '원리' }]);

      var c = st.concept;
      app.innerHTML =
        '<div class="btn-row center" style="margin:0 0 16px">' +
        '<a class="btn ghost" href="#/s/' + setId + '/' + stepNo + '">← 회차로 돌아가기</a>' +
        '<a class="btn" href="#/s/' + setId + '/' + stepNo + '/1/A">바로 연습하기</a>' +
        '<button class="btn ghost" id="zoom" hidden>크게 보기</button>' +
        '<button class="btn ghost" id="printcon">인쇄</button></div>' +
        '<div class="paper-fit" id="fit"><div class="paper" id="paper">' +
        '<div class="page concept"><div class="cpwrap">' +
        '<div class="cphead"><div class="cpkey">원리 한 장</div>' +
        '<h2 class="cptitle">' + esc(c.title) + '</h2>' +
        '<div class="cpsub">' + esc(c.sub) + '</div></div>' +
        '<div class="cpbody">' + c.html + '</div>' +
        '<div class="cptip"><span class="tiplab">이렇게 봐주세요</span>' + c.tip + '</div>' +
        '</div></div></div></div>' +
        '<div class="btn-row center"><a class="btn lg" href="#/s/' + setId + '/' + stepNo + '/1/A">' +
        'DAY 1 · A 시작하기 →</a></div>';

      fitPaper();

      document.getElementById('printcon').addEventListener('click', function () {
        window.Printer.concept(st);
      });

      var zb = document.getElementById('zoom');
      if (zb) {
        if (window.innerWidth < 760) zb.hidden = false;
        zb.addEventListener('click', function () {
          zoomed = !zoomed;
          zb.textContent = zoomed ? '화면에 맞추기' : '크게 보기';
          fitPaper();
        });
      }
    });
  }

  /* 좁은 화면에서 원리 페이지를 키워 볼 수 있게 */
  var zoomed = false;

  /* 원리 페이지(A4 폭 고정)를 화면 폭에 맞춰 축소 */
  function fitPaper() {
    var fit = document.getElementById('fit'), paper = document.getElementById('paper');
    if (!fit || !paper) return;
    var scale = Math.min(1, fit.clientWidth / paper.offsetWidth);
    if (zoomed) scale = Math.max(scale, 0.9);
    paper.style.transform = 'scale(' + scale + ')';
    var shownW = paper.offsetWidth * scale;
    /* 축소된 지면이 화면 가운데에 오도록 여백을 직접 계산합니다 */
    paper.style.marginLeft = Math.max(0, (fit.clientWidth - shownW) / 2) + 'px';
    fit.style.height = (paper.offsetHeight * scale) + 'px';
    fit.style.overflowX = shownW > fit.clientWidth + 1 ? 'auto' : 'hidden';
  }
  window.addEventListener('resize', function () {
    if (document.getElementById('paper')) fitPaper();
  });

  /* ─────────────────────────────────────────────────────
     화면 5 — 연습 시트
     ───────────────────────────────────────────────────── */
  function viewSheet(setId, stepNo, day, key) {
    loadSet(setId, function (data) {
      if (!data) return viewSet(setId);
      var st = data.steps.filter(function (s) { return s.no === stepNo; })[0];
      if (!st) return viewSet(setId);
      var dd = st.days.filter(function (d) { return d.day === day; })[0];
      if (!dd) return viewStep(setId, stepNo);
      var sheet = dd.sheets.filter(function (s) { return s.key === key; })[0];
      if (!sheet) return viewStep(setId, stepNo);

      crumbs([{ label: '학기 선택', href: '#/' },
              { label: data.title, href: '#/s/' + setId },
              { label: stepNo + '회', href: '#/s/' + setId + '/' + stepNo },
              { label: 'DAY ' + day + ' · ' + key }]);

      var rend = R[sheet.type](sheet);
      var n = sheet.items.length;

      app.innerHTML =
        '<div class="sheet-head">' +
        '<div class="sh-badge"><b>' + day + '</b><span>DAY</span></div>' +
        '<div class="sh-title"><h2>' + esc(sheet.label) + '</h2>' +
        '<p>' + stepNo + '회 · ' + esc(st.title) + ' · ' + key + '</p></div>' +
        '<div class="sh-meta">' +
        '<div class="chip"><small>걸린 시간</small><span id="timer">0:00</span></div>' +
        '<div class="chip" id="scorechip"><small>맞은 개수</small><span>— / ' + n + '</span></div>' +
        '<button class="btn ghost sm" id="printsheet" title="A4 한 장으로 인쇄">인쇄</button>' +
        '</div></div>' +
        '<div id="result"></div>' +
        (rend.hint ? '<div class="bhint">' + rend.hint + '</div>' : '') +
        '<div class="q-grid cols' + rend.cols + '" id="qgrid">' + rend.html + '</div>' +
        '<div class="actionbar" id="bar">' +
        '<button class="btn lg coral" id="grade">채점하기</button>' +
        '</div>';

      document.getElementById('printsheet').addEventListener('click', function () {
        window.Printer.sheet(st, day, sheet);
      });

      var inputs = Array.prototype.slice.call(app.querySelectorAll('input.blank'));

      /* 이전 기록 표시 */
      var prev = getResult(setId, stepNo, day, key);
      if (prev) {
        document.getElementById('scorechip').innerHTML =
          '<small>최고 기록</small><span>' + prev.score + ' / ' + prev.total + '</span>';
      }

      /* 타이머 */
      var sec = 0, timerOn = false, tid = null;
      var tEl = document.getElementById('timer');
      function startTimer() {
        if (timerOn) return;
        timerOn = true;
        tid = setInterval(function () { sec++; tEl.textContent = mmss(sec); }, 1000);
      }
      function stopTimer() { timerOn = false; if (tid) clearInterval(tid); }

      /* 입력 편의: 첫 입력 시 타이머 시작, Enter로 다음 칸 이동 */
      inputs.forEach(function (input, idx) {
        input.addEventListener('focus', startTimer);
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            var next = inputs[idx + 1];
            if (next) next.focus(); else grade();
          }
        });
        input.addEventListener('input', function () {
          input.value = input.value.replace(/[^0-9]/g, '');
        });
      });

      /* 채점 */
      function grade() {
        stopTimer();
        var flat = 0, score = 0, wrongIdx = [];
        var nodes = rend.table
          ? Array.prototype.slice.call(app.querySelectorAll(rend.cellSel || '.bundle-tab tr[data-i]'))
          : Array.prototype.slice.call(app.querySelectorAll('.q[data-i]'));

        rend.answers.forEach(function (ans, qi) {
          var node = nodes[qi];
          var fields = Array.prototype.slice.call(node.querySelectorAll('input.blank'));
          var allRight = true, vals = [];
          ans.forEach(function (a, bi) {
            var f = fields[bi];
            if (!f) { allRight = false; vals.push(''); return; }
            var v = (f.value || '').trim();
            vals.push(v);
            if (v !== a) allRight = false;
            f.disabled = true;
            flat++;
          });
          if (!allRight && rend.check) allRight = rend.check(qi, vals);
          node.classList.remove('right', 'wrong');
          node.classList.add(allRight ? 'right' : 'wrong');
          var mk = node.querySelector('.mark');
          if (mk) mk.textContent = allRight ? '○' : '✕';
          if (allRight) score++;
          else {
            wrongIdx.push(qi);
            /* 정답 안내 */
            if (!node.querySelector('.correct-hint')) {
              var hint = document.createElement('span');
              hint.className = 'correct-hint';
              hint.textContent = '정답 ' + ans.join(' , ');
              var host = node.querySelector('.body') || node.querySelector('.eq-a') ||
                         node.querySelector('.bundle-eq') || node;
              host.appendChild(hint);
            }
            if (node.dataset.hint && !node.querySelector('.solve-hint')) {
              var sh = document.createElement('div');
              sh.className = 'solve-hint';
              sh.textContent = node.dataset.hint;
              node.appendChild(sh);
            }
          }
        });

        var total = rend.answers.length;
        var pct = Math.round(score / total * 100);
        saveResult(setId, stepNo, day, key, { score: score, total: total, sec: sec, ts: Date.now() });

        document.getElementById('scorechip').className = 'chip ' + (pct >= 90 ? 'ok' : 'ng');
        document.getElementById('scorechip').innerHTML =
          '<small>맞은 개수</small><span>' + score + ' / ' + total + '</span>';

        var nav = nextLink(data, st, day, key, setId);
        document.getElementById('result').innerHTML =
          '<div class="result ' + (pct >= 90 ? 'pass' : 'fail') + '">' +
          '<div class="big">' + pct + '점</div>' +
          '<div class="txt">' + total + '문제 중 <b>' + score + '문제</b>를 맞혔어요. 걸린 시간 <b>' + mmss(sec) + '</b>.<br>' +
          (pct >= 90
            ? '아주 좋아요. 다음 장으로 넘어가도 좋습니다.'
            : '<b>틀린 문제만 다시 풀어보세요.</b> 90점을 넘으면 다음 장으로 넘어갑니다.') +
          '</div></div>';
        window.scrollTo({ top: 0, behavior: 'smooth' });

        document.getElementById('bar').innerHTML =
          (wrongIdx.length ? '<button class="btn lg ghost" id="retry">틀린 문제만 다시 풀기 (' + wrongIdx.length + ')</button>' : '') +
          '<button class="btn lg ghost" id="again">전체 다시 풀기</button>' +
          (nav ? '<a class="btn lg" href="' + nav.href + '">' + esc(nav.label) + ' →</a>' : '');

        var rt = document.getElementById('retry');
        if (rt) rt.addEventListener('click', function () { reset(wrongIdx); });
        document.getElementById('again').addEventListener('click', function () { reset(null); });
      }

      /* 다시 풀기 */
      function reset(onlyIdx) {
        var nodes = rend.table
          ? Array.prototype.slice.call(app.querySelectorAll(rend.cellSel || '.bundle-tab tr[data-i]'))
          : Array.prototype.slice.call(app.querySelectorAll('.q[data-i]'));
        nodes.forEach(function (node, qi) {
          if (onlyIdx && onlyIdx.indexOf(qi) === -1) return;
          node.classList.remove('right', 'wrong');
          var mk = node.querySelector('.mark'); if (mk) mk.textContent = '';
          var ch = node.querySelector('.correct-hint'); if (ch) ch.remove();
          var sh = node.querySelector('.solve-hint'); if (sh) sh.remove();
          Array.prototype.slice.call(node.querySelectorAll('input.blank')).forEach(function (f) {
            f.value = ''; f.disabled = false;
          });
        });
        document.getElementById('result').innerHTML = '';
        document.getElementById('bar').innerHTML =
          '<button class="btn lg coral" id="grade">채점하기</button>';
        document.getElementById('grade').addEventListener('click', grade);
        sec = 0; tEl.textContent = '0:00';
        var first = app.querySelector('input.blank:not([disabled])');
        if (first) first.focus();
      }

      document.getElementById('grade').addEventListener('click', grade);
    });
  }

  /* 다음 시트 링크 계산 */
  function nextLink(data, st, day, key, setId) {
    if (key === 'A') return { href: '#/s/' + setId + '/' + st.no + '/' + day + '/B', label: 'DAY ' + day + ' · B' };
    var maxDay = st.days.length;
    if (day < maxDay) return { href: '#/s/' + setId + '/' + st.no + '/' + (day + 1) + '/A', label: 'DAY ' + (day + 1) + ' · A' };
    var next = data.steps.filter(function (s) { return s.no === st.no + 1; })[0];
    if (next) return { href: '#/s/' + setId + '/' + next.no + '/concept', label: next.no + '회 원리' };
    return { href: '#/s/' + setId, label: '회차 목록' };
  }

  /* ─────────────────────────────────────────────────────
     라우터
     #/                          학기 목록
     #/s/3-1                     회차 목록
     #/s/3-1/4                   회차 상세
     #/s/3-1/4/concept           원리
     #/s/3-1/4/2/A               연습
     ───────────────────────────────────────────────────── */
  function route() {
    var h = (location.hash || '#/').replace(/^#\/?/, '');
    var p = h.split('/').filter(Boolean);
    window.scrollTo(0, 0);

    if (p[0] !== 's' || !p[1]) return viewHome();
    if (!p[2]) return viewSet(p[1]);
    var stepNo = parseInt(p[2], 10);
    if (isNaN(stepNo)) return viewSet(p[1]);
    if (!p[3]) return viewStep(p[1], stepNo);
    if (p[3] === 'concept') return viewConcept(p[1], stepNo);
    var day = parseInt(p[3], 10);
    var key = (p[4] || 'A').toUpperCase();
    if (isNaN(day)) return viewStep(p[1], stepNo);
    return viewSheet(p[1], stepNo, day, key);
  }

  /* 인증(auth.js)이 끝난 뒤 호출됩니다 */
  window.HTJApp = {
    start: function () {
      window.addEventListener('hashchange', route);
      route();
    }
  };
  if (window.HTJ_NO_AUTH) window.HTJApp.start();
})();
