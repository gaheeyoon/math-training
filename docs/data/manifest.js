/* ────────────────────────────────────────────────────────────
   사이트 설정
   ──────────────────────────────────────────────────────────── */
window.CURRICULUM = {

  title: '가히의 하루 두 장 계산 트레이닝',

  /* 안내 문구에 넣을 사이트 주소 (끝에 / 를 붙입니다) */
  siteUrl: 'https://yoongahee.com/math-training/',

  /* ── 코드 문의 안내 ────────────────────────────────────────
     인증 코드를 모르는 분에게 잠금 화면에서 보여줄 안내입니다.
     url 에 블로그 글 주소를 넣으면 화면에 링크 버튼이 생깁니다.
     비워 두면 안내 문구만 나옵니다.                              */
  contact: {
    note:  '코드는 매주 월요일에 바뀝니다.',
    guide: '코드를 모르시면 블로그 댓글로 문의해 주세요.',
    label: '블로그에서 코드 문의하기',
    url:   ''      // 예: 'https://blog.naver.com/아이디/223456789'
  },

  /* ── 학기 목록 ─────────────────────────────────────────────
     새 학기를 추가할 때는 아래 배열에 항목 하나만 추가하면 됩니다.

       id       : data/<id>.js 파일 이름과 같아야 함
       status   : 'ready'(공개) 또는 'soon'(준비 중)             */
  sets: [
    {
      id: '1-1', grade: 1, term: 1,
      title: '1학년 1학기',
      subtitle: '덧셈과 뺄셈의 시작',
      desc: '모으기와 가르기부터 □가 있는 식까지',
      sheets: 200,          /* 10회차 × DAY 10 × A·B */
      status: 'ready'
    },
    {
      id: '1-2', grade: 1, term: 2,
      title: '1학년 2학기',
      subtitle: '받아올림과 받아내림까지',
      desc: '100까지의 수부터 □가 있는 식까지',
      sheets: 200,          /* 10회차 × DAY 10 × A·B */
      status: 'ready'
    },
    {
      id: '3-1', grade: 3, term: 1,
      title: '3학년 1학기',
      subtitle: '곱셈과 나눗셈',
      desc: '(두 자리 수) × (한 자리 수)부터 □가 있는 식까지',
      sheets: 200,          /* 10회차 × DAY 10 × A·B */
      status: 'ready'
    },
    {
      id: '3-2', grade: 3, term: 2,
      title: '3학년 2학기',
      subtitle: '큰 수의 곱셈과 나눗셈',
      desc: '준비 중입니다',
      status: 'soon'
    },
    {
      id: '4-1', grade: 4, term: 1,
      title: '4학년 1학기',
      subtitle: '큰 수 · 분수의 덧셈과 뺄셈',
      desc: '준비 중입니다',
      status: 'soon'
    },
    {
      id: '4-2', grade: 4, term: 2,
      title: '4학년 2학기',
      subtitle: '소수 · 혼합 계산',
      desc: '준비 중입니다',
      status: 'soon'
    }
  ]
};
