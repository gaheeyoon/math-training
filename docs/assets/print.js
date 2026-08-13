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


  /* ═══ 1학년 유형 ═══════════════════════════════════════ */

  G.part = function (s) {
    return '<div class="bhint">' + esc(s.hint || '') + '</div>' +
      '<div class="grid g2 pgrid">' + s.items.map(function (it, i) {
        var v = [it.w, it.a, it.b];
        var c = function (j) {
          return j === it.hidden ? '<span class="pb-blank"></span>' : v[j];
        };
        return '<div class="pcell"><span class="qn">' + circ(i) + '</span>' +
          '<div class="pbar"><div class="pb-top">' + c(0) + '</div>' +
          '<div class="pb-bot"><div class="pb-half">' + c(1) + '</div>' +
          '<div class="pb-half">' + c(2) + '</div></div></div></div>';
      }).join('') + '</div>';
  };

  G.arith = function (s) {
    return '<div class="grid g3">' + s.items.map(function (it, i) {
      return '<div class="mh"><span class="qn">' + circ(i) + '</span>' +
        '<span class="expr">' + it[0] + '<span class="op">' + (it[1] === '+' ? '+' : '−') +
        '</span>' + it[2] + '<span class="op">=</span></span><span class="ansbox sm"></span></div>';
    }).join('') + '</div>';
  };

  G.atable = function (s) {
    var it = s.items[0];
    var head = '<tr><th class="corner">' + it.op + '</th>' +
      it.cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr>';
    var rows = it.rows.map(function (r) {
      return '<tr><th class="rowh">' + r + '</th>' +
        it.cols.map(function () { return '<td class="tblank"></td>'; }).join('') + '</tr>';
    }).join('');
    var hint = it.op === '+' ? '가로줄의 수와 세로줄의 수를 더해서 빈칸에 쓰세요.'
                             : '왼쪽 수에서 위쪽 수를 빼서 빈칸에 쓰세요.';
    return '<div class="bhint">' + hint + '</div>' +
           '<table class="atab' + (it.rows[0] > 9 ? ' wide2' : '') + '">' + head + rows + '</table>';
  };

  G.eq1 = function (s) {
    var SQ = '<span class="sq1"></span>';
    return '<div class="bhint">' + esc(s.hint || '') + '</div>' +
      '<div class="grid g2 eq1grid">' + s.items.map(function (it, i) {
        var q;
        if (it.t === 'ar') q = it.x + ' + ' + SQ + ' = ' + it.y;
        else if (it.t === 'al') q = SQ + ' + ' + it.x + ' = ' + it.y;
        else if (it.t === 'sr') q = it.x + ' − ' + SQ + ' = ' + it.y;
        else q = SQ + ' − ' + it.x + ' = ' + it.y;
        return '<div class="eq1"><span class="qn">' + circ(i) + '</span>' +
               '<span class="eq1q">' + q + '</span></div>';
      }).join('') + '</div>';
  };

  G.numfam = function (s) {
    return '<div class="bhint">세 수로 덧셈식 두 개와 뺄셈식 두 개를 만들어 보세요.</div>' +
      '<div class="grid g2 nfgrid">' + s.items.map(function (it, i) {
        return '<div class="nfam"><span class="qn">' + circ(i) + '</span>' +
          '<div class="nf-nums"><span>' + it.a + '</span><span>' + it.b + '</span><span>' + it.c + '</span></div>' +
          '<div class="nf-grid">' +
          '<div class="nf-item">' + it.a + ' + ' + it.b + ' = <span class="nf-box"></span></div>' +
          '<div class="nf-item">' + it.b + ' + ' + it.a + ' = <span class="nf-box"></span></div>' +
          '<div class="nf-item">' + it.c + ' − ' + it.a + ' = <span class="nf-box"></span></div>' +
          '<div class="nf-item">' + it.c + ' − ' + it.b + ' = <span class="nf-box"></span></div>' +
          '</div></div>';
      }).join('') + '</div>';
  };

  G.seq = function (s) {
    return '<div class="bhint">수의 순서에 맞게 빈칸을 채우세요.</div>' +
      '<table class="stab">' + s.items.map(function (it, i) {
        var tds = '';
        for (var k = 0; k < 5; k++) {
          tds += it.hide.indexOf(k) >= 0 ? '<td class="sblank"></td>'
                                         : '<td>' + (it.start + k) + '</td>';
        }
        return '<tr><td class="sn">' + circ(i) + '</td>' + tds + '</tr>';
      }).join('') + '</table>';
  };


  /* ── 1학년 2학기 유형 ─────────────────────────────────── */

  function pframe(n, cross) {
    var c = '';
    for (var k = 0; k < 10; k++) {
      var cls = 'tfc';
      if (k < n) cls += (cross && k >= n - cross) ? ' tf-on tf-x' : ' tf-on';
      c += '<span class="' + cls + '"></span>';
    }
    return '<span class="tframe">' + c + '</span>';
  }

  G.tens = function (s) {
    return '<div class="bhint">10개씩 묶음과 낱개를 보고 빈칸을 채우세요.</div>' +
      '<div class="tgrid">' + s.items.map(function (it, i) {
        var bars = '', dots = '', k;
        for (k = 0; k < it.t; k++) bars += '<span class="tbar">10</span>';
        for (k = 0; k < it.o; k++) dots += '<span class="tdot"></span>';
        var pic = '<span class="tpic">' + bars + (it.o ? '<span class="tgap"></span>' : '') + dots + '</span>';
        var q = it.m === 'to'
          ? pic + '<span class="tarrow">→</span><span class="ansbox sm"></span>'
          : '<span class="tnum">' + (it.t * 10 + it.o) + '</span><span class="tarrow">→</span>' +
            '<span class="tsplit">10개씩 묶음 <span class="ansbox xs"></span>개 · ' +
            '낱개 <span class="ansbox xs"></span>개</span>';
        return '<div class="tcell"><span class="qn">' + circ(i) + '</span>' + q + '</div>';
      }).join('') + '</div>';
  };

  G.vert = function (s) {
    return '<div class="bhint">자리를 맞추어 세로로 계산하세요.</div>' +
      '<div class="grid g4 vgrid">' + s.items.map(function (it, i) {
        var a = it[0], op = it[1], b = it[2];
        var bt = b >= 10 ? String(Math.floor(b / 10)) : '';
        return '<div class="vcell"><span class="qn">' + circ(i) + '</span>' +
          '<table class="v2"><tr class="vhdr"><td></td><td>십</td><td>일</td></tr>' +
          '<tr><td class="vsign"></td><td>' + Math.floor(a / 10) + '</td><td>' + (a % 10) + '</td></tr>' +
          '<tr class="vline"><td class="vsign">' + (op === '+' ? '+' : '−') + '</td>' +
          '<td>' + bt + '</td><td>' + (b % 10) + '</td></tr>' +
          '<tr class="vres"><td></td><td colspan="2"><span class="ansbox sm"></span></td></tr>' +
          '</table></div>';
      }).join('') + '</div>';
  };

  G.three = function (s) {
    return '<div class="bhint">' + esc(s.hint || '') + '</div>' +
      '<div class="grid g3">' + s.items.map(function (it, i) {
        var o1 = it.o1 === '+' ? '+' : '−', o2 = it.o2 === '+' ? '+' : '−';
        return '<div class="mh"><span class="qn">' + circ(i) + '</span>' +
          '<span class="expr">' + it.a + '<span class="op">' + o1 + '</span>' + it.b +
          '<span class="op">' + o2 + '</span>' + it.c + '<span class="op">=</span></span>' +
          '<span class="ansbox sm"></span></div>';
      }).join('') + '</div>';
  };

  G.chain = function (s) {
    return '<div class="bhint">' + esc(s.hint || '') + '</div>' +
      '<div class="grid g2 chgrid">' + s.items.map(function (it, i) {
        var o1 = it.o1 === '+' ? '+' : '−', o2 = it.o2 === '+' ? '+' : '−', q, s1, s2;
        if (it.hi === 1) {
          q = it.a + ' ' + o1 + ' <u>' + it.b + ' ' + o2 + ' ' + it.c + '</u>';
          s1 = it.b + ' ' + o2 + ' ' + it.c; s2 = it.a + ' ' + o1 + ' ①';
        } else {
          q = '<u>' + it.a + ' ' + o1 + ' ' + it.b + '</u> ' + o2 + ' ' + it.c;
          s1 = it.a + ' ' + o1 + ' ' + it.b; s2 = '① ' + o2 + ' ' + it.c;
        }
        return '<div class="chain"><span class="qn">' + circ(i) + '</span>' +
          '<span class="chq">' + q + '</span>' +
          '<span class="chstep">① ' + s1 + ' = <span class="ansbox xs"></span></span>' +
          '<span class="chstep">② ' + s2 + ' = <span class="ansbox xs"></span></span></div>';
      }).join('') + '</div>';
  };

  G.tenframe = function (s) {
    return '<div class="bhint">틀을 보고 빈칸에 알맞은 수를 쓰세요.</div>' +
      '<div class="grid g2 tfgrid">' + s.items.map(function (it, i) {
        var pic = it.m === 'add' ? pframe(it.a, 0) : pframe(10, it.a);
        var q = it.m === 'add'
          ? it.a + ' + <span class="ansbox xs"></span> = 10'
          : '10 − ' + it.a + ' = <span class="ansbox xs"></span>';
        return '<div class="tfcell"><span class="qn">' + circ(i) + '</span>' + pic +
               '<span class="tfq">' + q + '</span></div>';
      }).join('') + '</div>';
  };

  G.frames = function (s) {
    return '<div class="bhint">앞의 틀을 먼저 10으로 채우세요. ' +
           '① 채우는 데 필요한 수 · ② 남는 수 · ③ 답</div>' +
      '<div class="grid g2 frgrid">' + s.items.map(function (it, i) {
        return '<div class="frcell"><span class="qn">' + circ(i) + '</span>' +
          '<div class="frq">' + it.a + ' + ' + it.b + '</div>' +
          '<div class="frpic">' + pframe(it.a, 0) + '<span class="frplus">+</span>' +
          pframe(it.b, 0) + '</div>' +
          '<div class="frstep">① <span class="ansbox xs"></span> ' +
          '② <span class="ansbox xs"></span> ③ <span class="ansbox xs"></span></div></div>';
      }).join('') + '</div>';
  };

  G.bridge = function (s) {
    return '<div class="bhint">십몇을 10과 몇으로 가른 다음, 10에서 빼세요.</div>' +
      '<div class="grid g2 brggrid">' + s.items.map(function (it, i) {
        var ones = it.a - 10;
        return '<div class="brg"><span class="qn">' + circ(i) + '</span>' +
          '<div class="brgq">' + it.a + ' − ' + it.b + '</div>' +
          '<div class="brgsplit"><span class="brgt">10</span><span class="brgo">' + ones + '</span></div>' +
          '<div class="brgstep">① 10 − ' + it.b + ' = <span class="ansbox xs"></span></div>' +
          '<div class="brgstep">② ① + ' + ones + ' = <span class="ansbox xs"></span></div></div>';
      }).join('') + '</div>';
  };

  /* 지면 머리말의 '맞은 개수'는 문항 수를 기준으로 셉니다 (표는 칸 수) */
  function blankCount(sheet) {
    if (sheet.type === 'atable') {
      var it = sheet.items[0];
      return it.rows.length * it.cols.length;
    }
    return sheet.items.length;
  }

  /* ── 지면 조립 ────────────────────────────────────────── */
  function sheetPage(step, day, sheet) {
    var body = (G[sheet.type] || function () { return ''; })(sheet);
    return page('ws',
      head(day, sheet.label, sheet.key, blankCount(sheet)) +
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
    var rows = step.days.map(function (d) {
      return '<tr><td class="rd">DAY ' + d.day + '</td>' +
        '<td></td><td></td><td></td><td></td><td></td><td></td></tr>';
    }).join('');
    return page('stepcover',
      '<div class="scnum">' + String(step.no).padStart(2, '0') + '</div>' +
      '<div class="scwrap"><div class="sctag">' + esc(step.tag) + '</div>' +
      '<h2 class="sctitle">' + esc(step.title) + '</h2>' +
      '<div class="scgoal"><span>학습 목표</span>' + esc(step.goal) + '</div></div>' +
      '<div class="record"><div class="rechead">학습 기록표</div>' +
      '<table class="rectab">' +
      '<tr class="rechdr"><th></th><th>날짜</th><th>A 맞은 개수</th><th>A 걸린 시간</th>' +
      '<th>B 맞은 개수</th><th>B 걸린 시간</th><th>확인</th></tr>' + rows + '</table>' +
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
