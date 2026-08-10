#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────
# 깃허브 저장소 생성 + 푸시 + GitHub Pages 켜기 (한 번에)
#
#   bash tools/deploy.sh                        # 기본: math-training, 공개
#   bash tools/deploy.sh my-repo                # 저장소 이름 지정
#   bash tools/deploy.sh my-repo private        # 비공개 (GitHub Pro 이상 필요)
#   bash tools/deploy.sh my-repo public force   # 원격 내용을 덮어쓰고 밀어넣기
#
# 준비물: GitHub CLI (gh)  https://cli.github.com
#   설치 후 한 번만:  gh auth login
# ────────────────────────────────────────────────────────────
set -euo pipefail

REPO="${1:-math-training}"
VIS="${2:-public}"
FORCE="${3:-}"

cd "$(dirname "$0")/.."

# ── 준비 확인 ───────────────────────────────────────────────
command -v git >/dev/null || { echo "git 이 필요합니다."; exit 1; }
command -v gh  >/dev/null || {
  echo "GitHub CLI(gh)가 필요합니다.  https://cli.github.com 에서 설치한 뒤"
  echo "  gh auth login"
  echo "을 한 번 실행하고 다시 시도해 주세요."; exit 1; }

gh auth status >/dev/null 2>&1 || { echo "먼저 'gh auth login' 으로 로그인해 주세요."; exit 1; }

OWNER="$(gh api user --jq .login)"
echo "▶ 계정      : $OWNER"
echo "▶ 저장소    : $REPO ($VIS)"

# ── 인증 코드가 발급되어 있는지 확인 ────────────────────────
if [ ! -f docs/data/keys.js ] || [ ! -f docs/data/adminvault.js ]; then
  echo
  echo "인증 코드가 아직 없습니다. 먼저 아래를 실행해 주세요."
  echo "  python3 tools/build_auth.py --admin-pass '관리자_비밀번호'"
  exit 1
fi

# ── 커밋 ────────────────────────────────────────────────────
if [ ! -d .git ]; then
  git init -q
  git branch -M main
fi
git add -A
git commit -q -m "가히의 하루 두 장 계산 트레이닝 사이트" || echo "  (변경 사항 없음 — 커밋 건너뜀)"

# 평문 데이터가 실수로 올라가지 않는지 마지막 확인
if git ls-files --error-unmatch source/ >/dev/null 2>&1; then
  echo
  echo "⚠ source/ 폴더가 커밋에 포함되어 있습니다. 평문 문제 데이터가 공개됩니다."
  echo "  .gitignore 를 확인하고 'git rm -r --cached source' 후 다시 시도해 주세요."
  exit 1
fi

# ── 저장소 생성 · 푸시 ──────────────────────────────────────
if gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
  echo "▶ 이미 있는 저장소에 밀어 넣습니다."
  git remote get-url origin >/dev/null 2>&1 || \
    git remote add origin "https://github.com/$OWNER/$REPO.git"

  if [ "$FORCE" = "force" ]; then
    git push -u origin main --force
  elif ! git push -u origin main 2>/dev/null; then
    # 원격에 이미 커밋이 있어 거부된 경우 — 무엇이 있는지 보여주고 안내합니다
    echo
    echo "원격 저장소에 이미 다른 내용이 있어서 밀어 넣지 못했습니다."
    git fetch -q origin || true
    echo
    echo "  ── 원격에 들어 있는 것 ──────────────────────────"
    git log --oneline -5 origin/main 2>/dev/null | sed 's/^/    /' || true
    echo
    git ls-tree --name-only -r origin/main 2>/dev/null | head -20 | sed 's/^/    /' || true
    echo "  ────────────────────────────────────────────────"
    echo
    echo "저장소를 만들 때 깃허브가 자동으로 넣어준 README/LICENSE 뿐이라면"
    echo "아래처럼 덮어써도 됩니다."
    echo
    echo "    bash tools/deploy.sh $REPO $VIS force"
    echo
    echo "남겨야 할 내용이 있다면 두 이력을 먼저 합쳐 주세요."
    echo
    echo "    git pull origin main --allow-unrelated-histories --no-rebase"
    echo "    git add . && git commit"
    echo "    bash tools/deploy.sh $REPO $VIS"
    echo
    exit 1
  fi
else
  echo "▶ 저장소를 새로 만듭니다."
  gh repo create "$OWNER/$REPO" "--$VIS" \
    --description "가히의 하루 두 장 계산 트레이닝 — 주차별 인증 코드로 여는 초등 계산 연습 사이트" \
    --source=. --remote=origin --push
fi

# ── GitHub Pages 켜기 (main 브랜치 /docs) ───────────────────
echo "▶ GitHub Pages 설정 중…"
gh api -X POST "repos/$OWNER/$REPO/pages" \
  -f "source[branch]=main" -f "source[path]=/docs" >/dev/null 2>&1 \
  || gh api -X PUT "repos/$OWNER/$REPO/pages" \
       -f "source[branch]=main" -f "source[path]=/docs" >/dev/null 2>&1 \
  || {
       echo "  Pages 자동 설정에 실패했습니다. 아래 중 하나로 켜 주세요."
       echo "    · 저장소 → Settings → Pages → Branch: main / 폴더: /docs"
       echo "    · 또는  gh api -X POST repos/$OWNER/$REPO/pages -f \"source[branch]=main\" -f \"source[path]=/docs\""
     }

URL="https://$OWNER.github.io/$REPO/"
echo
echo "완료했습니다. 처음 배포는 1~2분 정도 걸립니다."
echo
echo "  학습 페이지 : $URL"
echo "  관리자 페이지: ${URL}admin.html"
echo
echo "  ※ 관리자 페이지에서 이번 주 인증 코드를 확인해 아이에게 알려주세요."
