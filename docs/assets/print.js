/* ─────────────────────────────────────────────────────────
   A4 인쇄 — 화면 문제를 인쇄본 워크북과 똑같은 지면으로 다시 조판합니다.
   ─────────────────────────────────────────────────────────
   concept.css 안에 인쇄본 디자인이 그대로 들어 있어서,
   같은 마크업만 만들어 주면 PDF와 동일한 A4 지면이 나옵니다.
   ───────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var CIRC = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚';
  function circ(i) { return i < CIRC.length ? CIRC[i] : '(' + (i + 1) + ')'; }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function page(cls, inner) { return '<section class="page ' + cls + '">' + inner + '</section>'; }

  /* ── 시트 머리말 ──────────────────────────────────────── */
  function head(day, title, ab, count) {
    return '<div class="wshead">' +
      '<div class="daybadge"><span class="dnum">' + day + '</span><span class="dlab">DAY</span></div>' +
      '<div class="wstitle">' + esc(title) + '</div>' +
      '<div class="abbadge">' + ab + '</div>' +
      '<div class="scorebox">' +
      '<div class="sbrow"><span>월</span><span>일</span></div>' +
      '<div class="sbrow"><span>분</span><span>초</span></div>' +
      '<div class="sbtot">맞은 개수 &nbsp;/ ' + count + '</div>' +
      '</div></div>';
  }

  /* ── 문제 유형별 지면 ─────────────────────────────────── */
  var G = {};

  G.mulh = function (s) {
    return '<div class="grid g3">' + s.items.map(function (it, i) {
      return '<div class="mh"><span class="qn">' + circ(i) + '</span>' +
        '<span class="expr">' + it[0] + '<span class="op">×</span>' + it[1] +
        '<span class="op">=</span></span><span class="ansbox"></span></div>';
    }).join('') + '</div>';
  };

  G.divh = function (s) {
    return '<div class="grid g3">' + s.items.map(function (it, i) {
      return '<div class="mh"><span class="qn">' + circ(i) + '</span>' +
        '<span class="expr">' + it[0] + '<span class="op">÷</span>' + it[1] +
        '<span class="op">=</span></span><span class="ansbox sm"></span></div>';
    }).join('') + '</div>';
  };

  G.mulv = function (s) {
    var d = s.digits || 2;
    var hdr = ['일', '십', '백', '천'].slice(0, d + 1).reverse()
      .map(function (h) { return '<th>' + h + '</th>'; }).join('');
    return '<div class="grid g4 vgrid">' + s.items.map(function (it, i) {
      var top = String(it[0]).padStart(d, ' ');
      var tds = '', mid = '', carry = '', blank = '';
      for (var j = 0; j < d; j++) tds += '<td>' + (top[j] === ' ' ? '' : top[j]) + '</td>';
      for (var k = 0; k < d; k++) mid += '<td>' + (k === d - 1 ? it[1] : '') + '</td>';
      for (var m = 0; m < d + 1; m++) { carry += '<td class="carry"></td>'; blank += '<td class="blank"></td>'; }
      return '<div class="vcell"><span class="qn">' + circ(i) + '</span>' +
        '<table class="vt">' +
        '<tr class="vhdr">' + hdr + '</tr>' +
        '<tr class="vcarry">' + carry + '</tr>' +
        '<tr><td></td>' + tds + '</tr>' +
        '<tr class="vline"><td class="sign">×</td>' + mid + '</tr>' +
        '<tr>' + blank + '</tr>' +
        '</table></div>';
    }).join('') + '</div>';
  };

  G.divv = function (s) {
    return '<div class="grid g3 dgrid">' + s.items.map(function (it, i) {
      var ds = String(it[0]);
      var slot = ds.split('').map(function () { return '<td class="qslot"></td>'; }).join('');
      var body = ds.split('').map(function (c) { return '<td>' + c + '</td>'; }).join('');
      return '<div class="dcell"><span class="qn">' + circ(i) + '</span>' +
        '<table class="dt">' +
        '<tr><td class="dempty"></td>' + slot + '</tr>' +
        '<tr class="drow"><td class="dvsr">' + it[1] + '</td>' + body + '</tr>' +
        '</table></div>';
    }).join('') + '</div>';
  };

  G.family = function (s) {
    var row = '<div class="famrow"><span class="fbox"></span> ÷ <span class="fbox"></span>' +
              ' = <span class="fbox"></span></div>';
    return '<div class="grid g2 famgrid">' + s.items.map(function (it, i) {
      return '<div class="fam"><span class="qn">' + circ(i) + '</span>' +
        '<div class="famtop">' + it.d + ' × ' + it.q + ' = ' + it.p + '</div>' +
        '<div class="famarrow">↓ 나눗셈식 두 개로</div>' + row + row + '</div>';
    }).join('') + '</div>';
  };

  G.bundle = function (s) {
    var rows = s.items.map(function (it, i) {
      var v = [it.total, it.per, it.cnt];
      var cells = [0, 1, 2].map(function (j) {
        return '<td>' + (j === it.hidden ? '<span class="hb"></span>' : v[j]) + '</td>';
      }).join('');
      return '<tr><td class="bn">' + circ(i) + '</td>' + cells +
        '<td class="bex"><span class="lbox"></span> ÷ <span class="lbox"></span>' +
        ' = <span class="lbox"></span></td></tr>';
    }).join('');
    return '<div class="bhint">빈칸을 채우고, 그 상황을 나눗셈식으로 나타내세요.</div>' +
      '<table class="btab"><tr class="bthdr"><th></th><th>전체 개수</th>' +
      '<th>한 묶음의 개수</th><th>묶음 수</th><th>나눗셈식으로 쓰기</th></tr>' + rows + '</table>';
  };

  G.unit = function (s) {
    return '<div class="grid g2 ugrid">' + s.items.map(function (it, i) {
      var u1 = '<span class="uu">' + it.u1 + '</span>', u2 = '<span class="uu">' + it.u2 + '</span>';
      return '<div class="ucell"><span class="qn">' + circ(i) + '</span>' +
        '<table class="ut">' +
        '<tr class="ucarry"><td></td><td></td><td></td></tr>' +
        '<tr><td class="usign"></td><td>' + it.a[0] + u1 + '</td><td>' + it.a[1] + u2 + '</td></tr>' +
        '<tr class="uline"><td class="usign">' + (it.op === '+' ? '+' : '−') + '</td>' +
        '<td>' + it.b[0] + u1 + '</td><td>' + it.b[1] + u2 + '</td></tr>' +
        '<tr class="ublank"><td></td><td>' + u1 + '</td><td>' + u2 + '</td></tr>' +
        '</table></div>';
    }).join('') + '</div>';
  };

  G.eq = function (s) {
    var SQ = '<span class="sq"></span>';
    var hint = s.key === 'A'
      ? '□를 손으로 가리고, 어떤 식으로 바꿀지 먼저 적은 다음 답을 구하세요.'
      : '□가 <b>나누어지는 수</b>인지 <b>나누는 수</b>인지 먼저 확인하세요.';
    return '<div class="bhint">' + hint + '</div>' +
      '<div class="grid g2 eqgrid">' + s.items.map(function (it, i) {
        var q;
        if (it.t === 'mr') q = it.x + ' × ' + SQ + ' = ' + it.y;
        else if (it.t === 'ml') q = SQ + ' × ' + it.x + ' = ' + it.y;
        else if (it.t === 'dd') q = SQ + ' ÷ ' + it.x + ' = ' + it.y;
        else q = it.x + ' ÷ ' + SQ + ' = ' + it.y;
        return '<div class="eqcell"><span class="qn">' + circ(i) + '</span>' +
          '<div class="eqq">' + q + '</div>' +
          '<div class="eqs">→ ' + SQ + ' = <span class="eqline"></span>' +
          ' = <span class="eqline short"></span></div></div>';
      }).join('') + '</div>';
  };

  /* ── 지면 조립 ────────────────────────────────────────── */
  function sheetPage(step, day, sheet) {
    var body = (G[sheet.type] || function () { return ''; })(sheet);
    return page('ws',
      head(day, sheet.label, sheet.key, sheet.items.length) +
      '<div class="wsbody">' + body + '</div>' +
      '<div class="pfoot">' + step.no + '회 · ' + esc(step.title) + '</div>');
  }

  function conceptPage(step) {
    var c = step.concept;
    return page('concept',
      '<div class="cpwrap">' +
      '<div class="cphead"><div class="cpkey">원리 한 장</div>' +
      '<h2 class="cptitle">' + esc(c.title) + '</h2>' +
      '<div class="cpsub">' + esc(c.sub) + '</div></div>' +
      '<div class="cpbody">' + c.html + '</div>' +
      '<div class="cptip"><span class="tiplab">이렇게 봐주세요</span>' + c.tip + '</div>' +
      '</div>');
  }

  function coverPage(step) {
    var cells = [1, 2, 3].map(function (d) {
      return '<div class="rcol"><div class="rday">DAY ' + d + '</div>' +
        ['날짜', 'A 맞은 개수', 'A 걸린 시간', 'B 맞은 개수', 'B 걸린 시간'].map(function (t) {
          return '<div class="rcell"><span>' + t + '</span><i></i></div>'; }).join('') +
        '<div class="rface"><span>오늘 기분</span><i></i></div></div>';
    }).join('');
    return page('stepcover',
      '<div class="scnum">' + String(step.no).padStart(2, '0') + '</div>' +
      '<div class="scwrap"><div class="sctag">' + esc(step.tag) + '</div>' +
      '<h2 class="sctitle">' + esc(step.title) + '</h2>' +
      '<div class="scgoal"><span>학습 목표</span>' + esc(step.goal) + '</div></div>' +
      '<div class="record"><div class="rechead">학습 기록표</div>' +
      '<div class="recgrid">' + cells + '</div>' +
      '<div class="recnote">걸린 시간과 맞은 개수를 함께 적어 두면, ' +
      '속도와 정확도 중 무엇을 더 신경 써야 하는지 한눈에 보입니다.</div></div>');
  }

  /* ── 실행 ─────────────────────────────────────────────── */
  function run(html, title) {
    var area = document.getElementById('printarea');
    area.innerHTML = html;
    var prev = document.title;
    document.title = title || prev;
    var done = function () {
      document.title = prev;
      area.innerHTML = '';
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    /* 브라우저가 지면을 다 그린 뒤에 인쇄 대화상자를 엽니다 */
    setTimeout(function () { window.print(); }, 60);
  }

  window.Printer = {
    sheet: function (step, day, sheet) {
      run(sheetPage(step, day, sheet),
          step.no + '회 DAY' + day + ' ' + sheet.key + ' · ' + sheet.label);
    },
    concept: function (step) {
      run(conceptPage(step), step.no + '회 원리 · ' + step.concept.title);
    },
    step: function (step) {
      var pages = [coverPage(step), conceptPage(step)];
      step.days.forEach(function (d) {
        d.sheets.forEach(function (sh) { pages.push(sheetPage(step, d.day, sh)); });
      });
      run(pages.join(''), step.no + '회 · ' + step.title);
    },
    set: function (data) {
      var pages = [];
      data.steps.forEach(function (st) {
        pages.push(coverPage(st), conceptPage(st));
        st.days.forEach(function (d) {
          d.sheets.forEach(function (sh) { pages.push(sheetPage(st, d.day, sh)); });
        });
      });
      run(pages.join(''), data.title + ' · 전체');
    }
  };
})();
