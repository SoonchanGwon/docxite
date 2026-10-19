# DocsSync

브라우저에서 한글(HWP·HWPX) 파일과 PDF를 열고, 원본 서식 그대로 고치고, 여러 사람이 실시간으로 함께 편집하는 서비스.

## 모노레포 구조

- `apps/web` — Next.js 15 + React 19 + Tailwind 4 (Vercel 배포)
- `apps/server` — Express + WebSocket + Yjs + Prisma (Render 배포)
- `packages/shared` — 웹/서버 공용 타입·유틸

## 로컬 개발 환경

### 준비물

- Node.js 20+
- PostgreSQL (로컬 개발용 DB)

### 설치

```bash
npm install
cp .env.example apps/server/.env
cp .env.example apps/web/.env.local
```

`apps/server/.env`의 `DATABASE_URL`을 로컬 Postgres 접속 정보로 채운다.

### DB 마이그레이션

```bash
npm run --workspace=apps/server prisma:migrate
```

### 개발 서버 실행

```bash
npm run dev
```

- 웹: http://localhost:3000
- API: http://localhost:4000 (`/health`, `/health/db`)

### 타입 체크

```bash
npm run check
```

## 커밋 주의사항

- `rhwp-오픈소스/` 폴더와 `.env` 계열 파일은 절대 커밋하지 않는다.
- 커밋할 때는 파일을 하나하나 지정한다 (`git add -A` 금지).
