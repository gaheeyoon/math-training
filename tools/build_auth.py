#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
주차별 인증 코드 생성 + 학습 데이터 암호화 빌드 스크립트
────────────────────────────────────────────────────────────────
source/*.js  (평문 문제 데이터)  →  docs/data/*.enc.js  (암호화본)
                                 →  docs/data/keys.js      (주차별 열쇠)
                                 →  docs/data/adminvault.js(관리자 금고)

동작 방식
  1) 학습 데이터를 무작위 콘텐츠 키(CK)로 AES-256-GCM 암호화합니다.
  2) 주차마다 무작위 인증 코드를 만들고, 그 코드에서 PBKDF2로 키를 유도해
     콘텐츠 키(CK)를 한 번 더 감쌉니다(키 래핑).
     → 올바른 코드가 없으면 CK를 얻을 수 없고, 데이터도 복호화할 수 없습니다.
  3) 모든 주차의 코드 목록은 관리자 비밀번호로 암호화해 따로 보관합니다.
     → 관리자 페이지에서 비밀번호를 넣어야 이번 주 코드를 볼 수 있습니다.

사용법
  python3 tools/build_auth.py --admin-pass '관리자비밀번호'
  python3 tools/build_auth.py --admin-pass '...' --weeks 52 --start 2026-08-10
  python3 tools/build_auth.py --admin-pass '...' --grace 1
"""

import argparse, base64, datetime, json, os, re, secrets, sys

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes
except ImportError:
    sys.exit("필요한 패키지가 없습니다.  pip install cryptography  를 먼저 실행해 주세요.")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'source')
OUT = os.path.join(ROOT, 'docs', 'data')

# 헷갈리는 글자(I, O, 0, 1)를 뺀 32글자 — 아이가 받아 적기 쉽도록
ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
ITERS = 310_000          # PBKDF2 반복 횟수 (OWASP 권장치)


def b64(b):
    return base64.b64encode(b).decode()


def derive(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERS)
    return kdf.derive(password.encode('utf-8'))


def encrypt(key: bytes, plaintext: bytes):
    iv = secrets.token_bytes(12)
    return iv, AESGCM(key).encrypt(iv, plaintext, None)


def make_code() -> str:
    """XXXX-XXXX 형태의 8글자 코드 (32^8 ≈ 1.1조 가지)"""
    raw = ''.join(secrets.choice(ALPHABET) for _ in range(8))
    return raw[:4] + '-' + raw[4:]


def normalize(code: str) -> str:
    """입력 코드 정규화 — 대문자로 바꾸고 영문·숫자만 남깁니다."""
    return re.sub(r'[^A-Z0-9]', '', code.upper())


def read_source_sets():
    """source/*.js 안의 registerSet(...) 페이로드를 읽어옵니다."""
    sets = {}
    if not os.path.isdir(SRC):
        sys.exit(f"source 폴더가 없습니다: {SRC}")
    for name in sorted(os.listdir(SRC)):
        if not name.endswith('.js'):
            continue
        path = os.path.join(SRC, name)
        text = open(path, encoding='utf-8').read()
        m = re.search(r'window\.registerSet\(\s*(\{.*\})\s*\)\s*;?\s*$', text, re.S)
        if not m:
            print(f"  건너뜀 (registerSet 형식이 아님): {name}")
            continue
        data = json.loads(m.group(1))
        sets[data['id']] = data
    return sets


def read_js_payload(path, varname):
    """자동 생성된 js 파일에서 JSON 페이로드를 꺼냅니다."""
    text = open(path, encoding='utf-8').read()
    m = re.search(r'window\.' + varname + r'\s*=\s*(\{.*\})\s*;?\s*$', text, re.S)
    if not m:
        sys.exit(f"{path} 형식을 읽을 수 없습니다.")
    return json.loads(m.group(1))


def rebuild_data_only(admin_pass, one_code=None):
    """인증 코드를 그대로 유지한 채 학습 데이터만 다시 암호화합니다.

    관리자 비밀번호(또는 --code 로 넘긴 인증 코드 하나)로 콘텐츠 키를 되찾아
    새 데이터를 같은 키로 암호화합니다. keys.js 와 adminvault.js 는 건드리지 않습니다.
    """
    vault_path = os.path.join(OUT, 'adminvault.js')
    keys_path = os.path.join(OUT, 'keys.js')
    for path in (vault_path, keys_path):
        if not os.path.exists(path):
            sys.exit(f"{path} 가 없습니다. 먼저 코드를 발급해 주세요(--data-only 없이 실행).")

    auth = read_js_payload(keys_path, 'AUTH')
    content_key = None

    if one_code:
        # 인증 코드 하나만 알고 있을 때 — 모든 주차에 대해 맞춰 봅니다
        for w in auth['weeks']:
            try:
                content_key = AESGCM(derive(normalize(one_code), base64.b64decode(w['salt']))) \
                    .decrypt(base64.b64decode(w['iv']), base64.b64decode(w['ct']), None)
                print(f"  {w['i']}주차 코드로 콘텐츠 키를 찾았습니다.")
                break
            except Exception:
                continue
        if content_key is None:
            sys.exit("그 코드로는 콘텐츠 키를 찾지 못했습니다. 코드를 다시 확인해 주세요.")
    else:
        vault = read_js_payload(vault_path, 'ADMIN_VAULT')
        try:
            raw = AESGCM(derive(admin_pass, base64.b64decode(vault['salt']))) \
                .decrypt(base64.b64decode(vault['iv']), base64.b64decode(vault['ct']), None)
        except Exception:
            sys.exit("관리자 비밀번호가 맞지 않습니다.")
        codes = json.loads(raw.decode('utf-8'))
        weeks = {w['i']: w for w in auth['weeks']}
        for c in codes:
            w = weeks.get(c['i'])
            if not w:
                continue
            try:
                content_key = AESGCM(derive(normalize(c['code']), base64.b64decode(w['salt']))) \
                    .decrypt(base64.b64decode(w['iv']), base64.b64decode(w['ct']), None)
                break
            except Exception:
                continue
    if content_key is None:
        sys.exit("콘텐츠 키를 되찾지 못했습니다. keys.js 와 adminvault.js 가 짝이 맞는지 확인해 주세요.")

    sets = read_source_sets()
    if not sets:
        sys.exit("source 폴더에서 학습 데이터를 찾지 못했습니다.")
    for sid, data in sets.items():
        blob = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        iv, ct = encrypt(content_key, blob)
        with open(os.path.join(OUT, f'{sid}.enc.js'), 'w', encoding='utf-8') as f:
            f.write('/* 자동 생성 — 암호화된 학습 데이터. 직접 수정하지 마세요. */\n')
            f.write('window.registerEncryptedSet(' +
                    json.dumps({'id': sid, 'iv': b64(iv), 'ct': b64(ct)},
                               ensure_ascii=False, separators=(',', ':')) + ');\n')
        print(f"  다시 암호화: {sid}  ({len(blob):,}바이트)")

    print("\n학습 데이터만 새로 암호화했습니다. 인증 코드는 그대로입니다.")
    return


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--admin-pass', help='관리자 페이지 비밀번호')
    ap.add_argument('--code', help='--data-only 전용. 인증 코드 하나로 콘텐츠 키를 되찾습니다')
    ap.add_argument('--weeks', type=int, default=52, help='만들어 둘 주차 수 (기본 52주)')
    ap.add_argument('--start', default=None,
                    help='1주차 시작일 (YYYY-MM-DD, 월요일 권장). 생략하면 이번 주 월요일')
    ap.add_argument('--grace', type=int, default=1,
                    help='지난 주 코드도 며칠 더 받아줄지 (0=이번 주만, 1=지난 주까지)')
    ap.add_argument('--data-only', action='store_true',
                    help='인증 코드는 그대로 두고 학습 데이터만 다시 암호화합니다')
    args = ap.parse_args()

    if args.data_only:
        if not args.admin_pass and not args.code:
            sys.exit("--data-only 는 --admin-pass 또는 --code 중 하나가 필요합니다.")
        return rebuild_data_only(args.admin_pass, args.code)

    if not args.admin_pass or len(args.admin_pass) < 8:
        sys.exit("관리자 비밀번호를 8자 이상으로 --admin-pass 에 넣어 주세요.")

    # ── 1주차 시작일 (월요일 기준) ──────────────────────────
    if args.start:
        start = datetime.date.fromisoformat(args.start)
    else:
        today = datetime.date.today()
        start = today - datetime.timedelta(days=today.weekday())

    os.makedirs(OUT, exist_ok=True)

    # ── 학습 데이터 암호화 ─────────────────────────────────
    sets = read_source_sets()
    if not sets:
        sys.exit("source 폴더에서 학습 데이터를 찾지 못했습니다.")

    content_key = secrets.token_bytes(32)
    for sid, data in sets.items():
        raw = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        iv, ct = encrypt(content_key, raw)
        with open(os.path.join(OUT, f'{sid}.enc.js'), 'w', encoding='utf-8') as f:
            f.write('/* 자동 생성 — 암호화된 학습 데이터. 직접 수정하지 마세요. */\n')
            f.write('window.registerEncryptedSet(' +
                    json.dumps({'id': sid, 'iv': b64(iv), 'ct': b64(ct)},
                               ensure_ascii=False, separators=(',', ':')) + ');\n')
        print(f"  암호화: {sid}  ({len(raw):,}바이트 → {len(ct):,}바이트)")

    # ── 주차별 코드 생성 + 콘텐츠 키 래핑 ───────────────────
    weeks, codes = [], []
    for i in range(args.weeks):
        code = make_code()
        salt = secrets.token_bytes(16)
        iv, ct = encrypt(derive(normalize(code), salt), content_key)
        wstart = start + datetime.timedelta(weeks=i)
        weeks.append({'i': i, 'start': wstart.isoformat(),
                      'salt': b64(salt), 'iv': b64(iv), 'ct': b64(ct)})
        codes.append({'i': i, 'start': wstart.isoformat(),
                      'end': (wstart + datetime.timedelta(days=6)).isoformat(),
                      'code': code})

    with open(os.path.join(OUT, 'keys.js'), 'w', encoding='utf-8') as f:
        f.write('/* 자동 생성 — 주차별 열쇠. 코드 없이는 열 수 없습니다. */\n')
        f.write('window.AUTH = ' + json.dumps(
            {'anchor': start.isoformat(), 'iters': ITERS, 'grace': args.grace, 'weeks': weeks},
            ensure_ascii=False, separators=(',', ':')) + ';\n')

    # ── 관리자 금고 (코드 목록을 관리자 비밀번호로 암호화) ───
    asalt = secrets.token_bytes(16)
    aiv, act = encrypt(derive(args.admin_pass, asalt),
                       json.dumps(codes, ensure_ascii=False).encode('utf-8'))
    with open(os.path.join(OUT, 'adminvault.js'), 'w', encoding='utf-8') as f:
        f.write('/* 자동 생성 — 관리자 비밀번호로 잠긴 코드 목록 */\n')
        f.write('window.ADMIN_VAULT = ' + json.dumps(
            {'salt': b64(asalt), 'iv': b64(aiv), 'ct': b64(act), 'iters': ITERS},
            ensure_ascii=False, separators=(',', ':')) + ';\n')

    print(f"\n완료했습니다.")
    print(f"  1주차 시작일 : {start}  (월요일 기준)")
    print(f"  만든 주차 수 : {args.weeks}주  (~{codes[-1]['end']})")
    print(f"  지난 주 코드 : {'허용' if args.grace else '불허'}")
    print(f"\n  이번 주 코드 : {codes[0]['code']}   ({codes[0]['start']} ~ {codes[0]['end']})")
    print(f"  다음 주 코드 : {codes[1]['code']}   ({codes[1]['start']} ~ {codes[1]['end']})")
    print(f"\n  ※ 관리자 비밀번호는 어디에도 저장되지 않습니다. 따로 기록해 두세요.")
    print(f"  ※ source/ 폴더는 평문이므로 깃허브에 올리지 마세요(.gitignore 확인).")


if __name__ == '__main__':
    main()
