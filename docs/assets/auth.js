/* ─────────────────────────────────────────────────────────
   주차별 인증 코드 잠금장치
   ─────────────────────────────────────────────────────────
   · 학습 데이터는 AES-256-GCM으로 암호화되어 있습니다.
   · 콘텐츠 키는 주차별 코드에서 PBKDF2로 유도한 키로 감싸져 있어,
     올바른 코드 없이는 어떤 문제도 복호화할 수 없습니다.
   · 한 번 인증하면 그 주가 끝날 때까지 이 브라우저에서 유지됩니다.
   ───────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var SKEY = 'htj:v1:unlock';
  var PAST_LOOKBACK = 12;           // 만료 안내용으로 되짚어 볼 지난 주차 수
  var enc = new TextEncoder(), dec = new TextDecoder();

  function b2a(b64) {
    var s = atob(b64), u = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  }
  function a2b(buf) {
    var u = new Uint8Array(buf), s = '';
    for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s);
  }

  var Store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  /* ── 날짜 · 주차 계산 ─────────────────────────────────── */
  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
  }
  function parseDay(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }

  function currentWeekIndex() {
    var anchor = parseDay(window.AUTH.anchor);
    return Math.floor((today() - anchor) / 604800000);   // 7일 = 604,800,000ms
  }
  function weekAt(i) {
    var w = window.AUTH.weeks;
    for (var k = 0; k < w.length; k++) if (w[k].i === i) return w[k];
    return null;
  }
  /* 인증이 유지되는 시점 — 해당 주 일요일 자정까지 */
  function weekExpiry(i) {
    var d = parseDay(window.AUTH.anchor);
    d.setDate(d.getDate() + i * 7 + 7);
    return d.getTime();
  }
  function fmtRange(i) {
    var a = parseDay(window.AUTH.anchor); a.setDate(a.getDate() + i * 7);
    var b = new Date(a); b.setDate(b.getDate() + 6);
    var f = function (d) { return (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; };
    return f(a) + ' ~ ' + f(b);
  }

  /* ── 암호 연산 ────────────────────────────────────────── */
  function normalize(code) { return String(code).toUpperCase().replace(/[^A-Z0-9]/g, ''); }

  function deriveKey(code, salt, iters) {
    return crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: iters, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      });
  }

  /* 주차 하나에 대해 코드를 시도 → 성공하면 콘텐츠 키(raw bytes) */
  function tryWeek(week, code) {
    return deriveKey(code, b2a(week.salt), window.AUTH.iters)
      .then(function (key) {
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b2a(week.iv) }, key, b2a(week.ct));
      })
      .then(function (buf) { return new Uint8Array(buf); })
      .catch(function () { return null; });
  }

  /* ── 공개 API ─────────────────────────────────────────── */
  var Auth = {
    contentKey: null,

    /* 저장된 인증이 아직 유효한지 */
    restore: function () {
      var s = Store.get(SKEY);
      if (!s || !s.ck || !s.exp || Date.now() > s.exp) { Store.del(SKEY); return false; }
      Auth.contentKey = b2a(s.ck);
      Auth.weekIndex = s.week;
      return true;
    },

    /* 코드로 잠금 해제 — 성공하면 true */
    unlock: function (input) {
      var code = normalize(input);
      if (code.length < 4) return Promise.resolve({ ok: false, reason: 'short' });

      var cur = currentWeekIndex();
      var order = [cur];
      if (window.AUTH.grace) order.push(cur - 1);

      var step = function (idx) {
        if (idx >= order.length) return Promise.resolve(null);
        var w = weekAt(order[idx]);
        if (!w) return step(idx + 1);
        return tryWeek(w, code).then(function (ck) {
          if (ck) return { ck: ck, week: w.i };
          return step(idx + 1);
        });
      };

      return step(0).then(function (hit) {
        if (hit) {
          Auth.contentKey = hit.ck;
          Auth.weekIndex = hit.week;
          Store.set(SKEY, { ck: a2b(hit.ck), week: hit.week, exp: weekExpiry(cur) });
          return { ok: true, week: hit.week };
        }
        /* 실패 — 지난 코드인지 확인해서 친절한 안내를 만듭니다 */
        return Auth.findExpired(code).then(function (old) {
          return { ok: false, reason: old !== null ? 'expired' : 'wrong', week: old };
        });
      });
    },

    /* 만료된 코드인지 되짚어 보기 (안내 문구용) */
    findExpired: function (code) {
      var cur = currentWeekIndex();
      var list = [];
      for (var i = cur - 2; i >= cur - PAST_LOOKBACK && i >= 0; i--) list.push(i);
      for (var j = cur + 1; j <= cur + 4; j++) list.push(j);      // 미리 받은 코드도 확인
      var step = function (k) {
        if (k >= list.length) return Promise.resolve(null);
        var w = weekAt(list[k]);
        if (!w) return step(k + 1);
        return tryWeek(w, code).then(function (ck) {
          return ck ? list[k] : step(k + 1);
        });
      };
      return step(0);
    },

    /* 암호화된 학습 데이터 복호화 */
    decryptSet: function (payload) {
      if (!Auth.contentKey) return Promise.reject(new Error('locked'));
      return crypto.subtle.importKey('raw', Auth.contentKey, 'AES-GCM', false, ['decrypt'])
        .then(function (key) {
          return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b2a(payload.iv) }, key, b2a(payload.ct));
        })
        .then(function (buf) { return JSON.parse(dec.decode(buf)); });
    },

    lock: function () { Store.del(SKEY); Auth.contentKey = null; location.reload(); },

    weekLabel: function () {
      var i = currentWeekIndex();
      return (i + 1) + '주차 · ' + fmtRange(i);
    },
    currentWeekIndex: currentWeekIndex,
    fmtRange: fmtRange,
    normalize: normalize,
    deriveKey: deriveKey,
    b2a: b2a
  };
  window.Auth = Auth;

  /* 코드를 모르는 분을 위한 안내 (manifest.js 의 contact 설정) */
  function contactBlock() {
    var c = (window.CURRICULUM && window.CURRICULUM.contact) || {};
    var out = '';
    if (c.note) out += '<b>' + c.note + '</b><br>';
    if (c.guide) out += c.guide;
    if (c.url) {
      out += '<a class="gate-link" href="' + c.url + '" target="_blank" rel="noopener">' +
             (c.label || '코드 문의하기') + ' →</a>';
    }
    return out || '코드는 매주 월요일에 바뀝니다.';
  }

  /* ── 잠금 화면 ────────────────────────────────────────── */
  function showGate(msg) {
    document.body.classList.add('locked');
    var host = document.getElementById('gate');
    host.hidden = false;
    host.innerHTML =
      '<div class="gate-card">' +
      '<div class="gate-mark"></div>' +
      '<h1>가히의 하루 두 장<br>계산 트레이닝</h1>' +
      '<p class="gate-sub">이번 주 인증 코드를 입력해 주세요.</p>' +
      '<form id="gateform" autocomplete="off">' +
      '<input id="gatecode" class="gate-input" type="text" inputmode="latin" ' +
      'placeholder="XXXX-XXXX" maxlength="12" autocapitalize="characters" spellcheck="false">' +
      '<button class="btn lg gate-btn" type="submit" id="gatego">들어가기</button>' +
      '</form>' +
      '<div class="gate-msg" id="gatemsg">' + (msg || '') + '</div>' +
      '<div class="gate-foot">' + contactBlock() + '</div>' +
      '</div>';

    var input = document.getElementById('gatecode');
    var msgEl = document.getElementById('gatemsg');
    var btn = document.getElementById('gatego');
    input.focus();

    /* 입력 편의: 대문자 + 4글자마다 하이픈 */
    input.addEventListener('input', function () {
      var v = normalize(input.value).slice(0, 8);
      input.value = v.length > 4 ? v.slice(0, 4) + '-' + v.slice(4) : v;
      msgEl.textContent = '';
      msgEl.className = 'gate-msg';
    });

    document.getElementById('gateform').addEventListener('submit', function (e) {
      e.preventDefault();
      btn.disabled = true;
      btn.textContent = '확인하는 중…';
      msgEl.className = 'gate-msg';
      msgEl.textContent = '';

      Auth.unlock(input.value).then(function (r) {
        if (r.ok) { start(); return; }
        btn.disabled = false;
        btn.textContent = '들어가기';
        msgEl.className = 'gate-msg err';
        if (r.reason === 'short') msgEl.textContent = '코드를 끝까지 입력해 주세요.';
        else if (r.reason === 'expired') {
          msgEl.textContent = (r.week < currentWeekIndex())
            ? '이미 지난 ' + (r.week + 1) + '주차 코드입니다. 이번 주 코드를 받아 주세요.'
            : '아직 시작하지 않은 ' + (r.week + 1) + '주차 코드입니다.';
        } else msgEl.textContent = '코드가 맞지 않습니다. 대소문자와 하이픈은 신경 쓰지 않아도 돼요.';
        input.select();
      });
    });
  }

  /* ── 시작 ─────────────────────────────────────────────── */
  function start() {
    document.body.classList.remove('locked');
    var g = document.getElementById('gate');
    if (g) { g.hidden = true; g.innerHTML = ''; }
    document.getElementById('shell').hidden = false;
    var wl = document.getElementById('weeklabel');
    if (wl) wl.textContent = Auth.weekLabel();
    window.HTJApp.start();
  }

  function boot() {
    if (!window.crypto || !crypto.subtle) {
      showGate('');
      document.getElementById('gatemsg').className = 'gate-msg err';
      document.getElementById('gatemsg').textContent =
        '이 브라우저에서는 보안 기능을 쓸 수 없습니다. 주소가 https:// 로 시작하는지 확인해 주세요.';
      return;
    }
    if (!window.AUTH) { showGate(''); return; }
    if (Auth.restore()) start(); else showGate('');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
