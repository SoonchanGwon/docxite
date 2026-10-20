"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { setPendingFile } from "@/lib/pendingFile";

const features = [
  {
    title: "HWP / HWPX 지원",
    description: "표준 한글 문서 포맷을 브라우저에서 바로 열고 편집할 수 있습니다.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z M14 3v5h5 M9 13h6 M9 17h6"
      />
    ),
  },
  {
    title: "실시간 공동 작업",
    description: "링크 하나로 팀원을 초대하여 커서 위치와 편집 내용을 실시간으로 공유합니다.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1 M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M23 20v-1a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75"
      />
    ),
  },
  {
    title: "버전 히스토리",
    description: "작업 과정이 타임라인으로 기록되어 언제든지 이전 버전으로 복원할 수 있습니다.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M12 8v4l3 2 M21 12a9 9 0 1 1-3-6.7 M21 3v5h-5"
      />
    ),
  },
  {
    title: "PDF 편집",
    description:
      "PDF의 글자를 고치고, 텍스트·서명·도형·형광펜을 넣고, 페이지를 정리해 다시 PDF로 저장합니다.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M12 3v12 M7 10l5 5 5-5 M5 21h14"
      />
    ),
  },
];

function Icon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={className ?? "h-5 w-5"}
    >
      {children}
    </svg>
  );
}

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openFile(file: File | undefined) {
    if (!file) return;
    setPendingFile(file);
    router.push("/viewer");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept=".hwp,.hwpx"
        className="hidden"
        onChange={(e) => openFile(e.target.files?.[0])}
      />
      <header className="flex items-center justify-between border-b border-black/5 px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-white">
            <Icon className="h-5 w-5">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z M9 13h6 M9 17h6"
              />
            </Icon>
          </span>
          <span>
            <span className="block text-lg font-bold leading-tight">DocsSync</span>
            <span className="block text-xs leading-tight text-foreground/50">독스싱크</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 rounded-full px-3 py-2 text-sm text-foreground/70 hover:bg-black/5">
            <Icon className="h-4 w-4">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M3 12h18 M12 3a14 14 0 0 1 0 18 M12 3a14 14 0 0 0 0 18"
              />
            </Icon>
            English
          </button>
          <button className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/5">
            <GoogleIcon />
            Google로 로그인
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-6 py-16 text-center">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          웹 기반 실시간 한글(HWP/HWPX) · PDF 문서 편집기
        </span>

        <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          한글 문서 작업을,
          <br />
          <span className="text-brand">브라우저에서 팀과 함께</span>
        </h1>

        <p className="mt-5 text-base text-foreground/60 sm:text-lg">
          별도의 뷰어나 설치 프로그램 없이 HWP/HWPX와 PDF 문서를 열고 고치고,
          <br className="hidden sm:block" />
          동료들과 실시간으로 함께 작성하고 공유하세요.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button className="flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand/90">
            <Icon className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14 M5 12h14" />
            </Icon>
            새 문서 작성
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-xl border border-black/10 px-5 py-3 text-sm font-semibold hover:bg-black/5"
          >
            <Icon className="h-4 w-4">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M12 16V4 M8 8l4-4 4 4 M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"
              />
            </Icon>
            HWP · PDF 파일 열기
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-black/10 px-5 py-3 text-sm font-semibold hover:bg-black/5">
            <GoogleIcon />
            Google 계정으로 로그인
          </button>
        </div>

        <div className="mt-6 flex w-full items-center gap-4 rounded-xl border border-black/10 bg-black/[0.02] px-5 py-4 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Icon className="h-5 w-5">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M10 13a5 5 0 0 0 7.07 0l2-2a5 5 0 0 0-7.07-7.07l-1.14 1.13 M14 11a5 5 0 0 0-7.07 0l-2 2a5 5 0 0 0 7.07 7.07l1.14-1.13"
              />
            </Icon>
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">공유 코드를 받으셨나요?</p>
            <p className="text-sm text-foreground/50">6자리 코드로 문서에 바로 참여하세요</p>
          </div>
          <button className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90">
            코드 입력
          </button>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            openFile(e.dataTransfer.files?.[0]);
          }}
          className="mt-6 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-black/15 px-6 py-12"
        >
          <Icon className="h-8 w-8 text-foreground/30">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.6}
              d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z M12 11v5 M9.5 13.5 12 11l2.5 2.5"
            />
          </Icon>
          <p className="font-semibold">HWP / HWPX / PDF 파일을 드래그해서 바로 열기</p>
          <p className="text-sm text-foreground/50">
            또는 위의 &apos;HWP · PDF 파일 열기&apos; 버튼을 클릭하세요
          </p>
        </div>

        <div className="mt-14 grid w-full grid-cols-2 gap-6 text-left sm:grid-cols-4">
          {features.map((f) => (
            <div key={f.title}>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Icon className="h-5 w-5">{f.icon}</Icon>
              </span>
              <p className="mt-3 text-sm font-semibold">{f.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-foreground/50">{f.description}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-black/5 px-6 py-6 text-center text-xs text-foreground/40">
        DocsSync · 실시간 한글 문서 협업 플랫폼 · © {new Date().getFullYear()} DocsSync
      </footer>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.3 7.4 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.6H1.4A12 12 0 0 0 0 12c0 1.9.5 3.8 1.4 5.4l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}
