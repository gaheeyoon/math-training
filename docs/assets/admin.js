/* ─────────────────────────────────────────────────────────
   관리자 페이지 — 이번 주 인증 코드 확인
   ─────────────────────────────────────────────────────────
   주차별 코드 목록은 관리자 비밀번호로 암호화되어 있습니다.
   비밀번호는 저장하지 않으며, 매번 입력해야 열립니다.
   ───────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var enc = new TextEncoder(), dec = new TextDecoder();

  function b2a(b64) {
    var s = atob(b64), u = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function parseDay(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function fmt(s) {
    var d = parseDay(s);
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  }
  function curWeek() {
    if (!window.AUTH) return 0;
    return Math.floor((today() - parseDay(window.AUTH.anchor)) / 604800000);
  }

  function unlockVault(password) {
    var v = window.ADMIN_VAULT;
    return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: b2a(v.salt), iterations: v.iters, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      })
      .then(function (key) {
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b2a(v.iv) }, key, b2a(v.ct));
      })
      .then(function (buf) { return JSON.parse(dec.decode(buf)); })
      .catch(function () { return null; });
  }

  /* ── 로그인 화면 ──────────────────────────────────────── */
  function showLogin(err) {
    var host = document.getElementById('gate');
    host.hidden = false;
    host.innerHTML =
      '<div class="gate-card">' +
      '<div class="gate-mark admin"></div>' +
      '<h1>운영자 페이지</h1>' +
      '<p class="gate-sub">운영자 전용입니다. 비밀번호를 입력하면 이번 주 코드를 볼 수 있어요.</p>' +
      '<form id="lf" autocomplete="off">' +
      '<input id="pw" class="gate-input pw" type="password" placeholder="관리자 비밀번호" ' +
      'autocomplete="current-password" spellcheck="false">' +
      '<button class="btn lg gate-btn" type="submit" id="go">확인</button>' +
      '</form>' +
      '<div class="gate-msg' + (err ? ' err' : '') + '" id="msg">' + (err || '') + '</div>' +
      '<div class="gate-foot">비밀번호를 잊었다면 <code>tools/build_auth.py</code>로 코드를 다시 발급해야 합니다.</div>' +
      '</div>';

    var pw = document.getElementById('pw'), btn = document.getElementById('go');
    pw.focus();
    document.getElementById('lf').addEventListener('submit', function (e) {
      e.preventDefault();
      btn.disabled = true; btn.textContent = '확인하는 중…';
      unlockVault(pw.value).then(function (codes) {
        if (!codes) { showLogin('비밀번호가 맞지 않습니다.'); return; }
        host.hidden = true; host.innerHTML = '';
        document.body.classList.remove('locked');
        render(codes);
      });
    });
  }

  /* ── 코드 목록 화면 ───────────────────────────────────── */
  function render(codes) {
    var shell = document.getElementById('shell');
    shell.hidden = false;

    var cw = curWeek();
    var now = codes.filter(function (c) { return c.i === cw; })[0];
    var next = codes.filter(function (c) { return c.i === cw + 1; })[0];
    var grace = window.AUTH && window.AUTH.grace;

    var rows = codes.map(function (c) {
      var state = c.i === cw ? 'now' : (c.i < cw ? 'past' : 'future');
      var label = state === 'now' ? '이번 주' : (state === 'past' ? '지난 주' : '예정');
      return '<tr class="' + state + '">' +
        '<td class="wk">' + (c.i + 1) + '주차</td>' +
        '<td class="range">' + fmt(c.start) + ' ~ ' + fmt(c.end) + '</td>' +
        '<td class="code"><code>' + esc(c.code) + '</code></td>' +
        '<td class="st"><span class="pill ' + state + '">' + label + '</span></td>' +
        '<td><button class="mini" data-code="' + esc(c.code) + '">복사</button></td>' +
        '</tr>';
    }).join('');

    shell.innerHTML =
      '<div class="page-head center"><span class="eyebrow">운영자</span>' +
      '<h1>이번 주 인증 코드</h1>' +
      '<p>블로그 댓글로 코드를 물어보신 분에게 아래 코드를 알려주세요.<br>' +
      '코드는 매주 월요일에 자동으로 바뀝니다.</p></div>' +

      (now
        ? '<div class="codehero">' +
          '<div class="ch-label">' + (cw + 1) + '주차 · ' + fmt(now.start) + ' ~ ' + fmt(now.end) + '</div>' +
          '<div class="ch-code" id="bigcode">' + esc(now.code) + '</div>' +
          '<div class="ch-acts">' +
          '<button class="btn" id="copybig">코드만 복사</button>' +
          '<button class="btn ghost" id="copyreply">댓글 답변 문구 복사</button>' +
          '</div>' +
          (next ? '<div class="ch-next">다음 주(' + (cw + 2) + '주차) 코드는 <b>' + esc(next.code) +
                  '</b> 입니다 · ' + fmt(next.start) + ' 부터</div>' : '') +
          '</div>'
        : '<div class="result fail"><div class="txt">이번 주에 해당하는 코드가 없습니다. ' +
          '<b>tools/build_auth.py</b> 를 다시 실행해 주차를 더 만들어 주세요.</div></div>') +

      '<div class="notebox">' +
      '<b>운영 안내</b>' +
      '<ul>' +
      '<li>한 번 인증한 브라우저는 그 주 일요일 밤까지 코드를 다시 묻지 않습니다. ' +
      '월요일마다 새 코드를 안내해 주시면 됩니다.</li>' +
      '<li>' + (grace ? '지난 주 코드도 한 주 동안은 받아줍니다. 월요일에 바로 답을 못 드려도 괜찮아요.'
                      : '지난 주 코드는 받지 않습니다(유예 설정 꺼짐).') + '</li>' +
      '<li>이 페이지 주소와 비밀번호는 알려주지 마세요. 보호자에게는 <b>8자리 코드만</b> 전하면 됩니다.</li>' +
      '<li>남은 주차가 4주 이하로 줄면 <b>tools/build_auth.py</b> 를 다시 실행해 주세요.</li>' +
      '</ul></div>' +

      '<h2 class="sec-title">전체 주차 코드</h2>' +
      '<div class="tablewrap"><table class="codetab">' +
      '<tr><th>주차</th><th>기간</th><th>코드</th><th>상태</th><th></th></tr>' +
      rows + '</table></div>' +
      '<div class="btn-row center"><a class="btn ghost" href="index.html">학습 페이지 열기</a>' +
      '<button class="btn ghost" id="relock">잠그기</button></div>';

    /* 복사 동작 */
    function copy(text, btn) {
      var done = function () {
        var old = btn.textContent; btn.textContent = '복사됨';
        setTimeout(function () { btn.textContent = old; }, 1200);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); });
      } else fallback(text, done);
    }
    function fallback(text, done) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      document.body.removeChild(ta);
    }

    if (now) {
      document.getElementById('copybig').addEventListener('click', function () {
        copy(now.code, this);
      });
      document.getElementById('copyreply').addEventListener('click', function () {
        /* manifest.js 의 siteUrl 을 먼저 쓰고, 없으면 현재 주소에서 유추합니다 */
        var site = (window.CURRICULUM && window.CURRICULUM.siteUrl) ||
                   location.href.replace(/admin\.html.*$/, '');
        copy('안녕하세요! 이번 주(' + fmt(now.start) + ' ~ ' + fmt(now.end) + ') 인증 코드는 ' +
             now.code + ' 입니다.\n' +
             '아래 주소에서 코드를 입력하시면 바로 들어가실 수 있어요.\n' + site + '\n' +
             '코드는 매주 월요일에 바뀌니, 다음 주에 다시 댓글 남겨주시면 알려드릴게요.', this);
      });
    }
    Array.prototype.forEach.call(shell.querySelectorAll('.mini'), function (b) {
      b.addEventListener('click', function () { copy(b.dataset.code, b); });
    });
    document.getElementById('relock').addEventListener('click', function () { location.reload(); });
  }

  /* ── 시작 ─────────────────────────────────────────────── */
  if (!window.crypto || !crypto.subtle) {
    document.getElementById('gate').hidden = false;
    document.getElementById('gate').innerHTML =
      '<div class="gate-card"><h1>사용할 수 없습니다</h1>' +
      '<p class="gate-sub">주소가 https:// 로 시작하는지 확인해 주세요. ' +
      '보안 연결에서만 동작합니다.</p></div>';
  } else if (!window.ADMIN_VAULT) {
    document.getElementById('gate').hidden = false;
    document.getElementById('gate').innerHTML =
      '<div class="gate-card"><h1>준비가 필요합니다</h1>' +
      '<p class="gate-sub"><code>tools/build_auth.py</code> 를 실행해 코드를 먼저 발급해 주세요.</p></div>';
  } else {
    showLogin('');
  }
})();
