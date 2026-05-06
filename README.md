# TaskFlow — AI 업무 배정 최적화 시스템

## 빠른 시작

### 1. 패키지 설치
```bash
npm install
```

### 2. 환경 변수 설정
```bash
cp .env.local.example .env.local
```
`.env.local` 파일을 열고 Supabase URL과 anon key 입력
(Supabase → Project Settings → API)

### 3. DB 스키마 적용
Supabase SQL Editor에서 `01_schema.sql` 실행

### 4. 개발 서버 실행
```bash
npm run dev
```
→ http://localhost:3000

## 폴더 구조

```
src/
├── app/                # Next.js 페이지
│   ├── dashboard/      # 대시보드
│   ├── tasks/          # 전체 업무
│   ├── my-work/        # 내 업무
│   ├── projects/       # 프로젝트
│   └── team/           # 팀 현황
├── components/
│   ├── Sidebar.tsx
│   ├── dashboard/
│   └── tasks/
├── lib/
│   └── supabase.ts     # Supabase 클라이언트
└── types/
    └── database.ts     # DB 타입 정의
```

## 다음 단계

- [ ] Supabase Auth 로그인 추가
- [ ] 업무 등록/수정 폼
- [ ] 상태 변경 (칸반 드래그)
- [ ] Planning Feedback 로직
