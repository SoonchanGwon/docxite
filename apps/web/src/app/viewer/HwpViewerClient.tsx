"use client";

import { useRef, useState } from "react";
import type { HwpDocument as HwpDocumentType } from "@rhwp/core";

let wasmReady: Promise<void> | null = null;

function ensureWasmInit() {
  if (!wasmReady) {
    wasmReady = (async () => {
      let measureCtx: CanvasRenderingContext2D | null = null;
      let lastFontSpec = "";

      (globalThis as unknown as { measureTextWidth: (font: string, text: string) => number }).measureTextWidth = (
        fontSpec: string,
        text: string,
      ) => {
        if (!measureCtx) {
          measureCtx = document.createElement("canvas").getContext("2d");
        }
        if (!measureCtx) return text.length * 8;
        if (fontSpec !== lastFontSpec) {
          measureCtx.font = fontSpec;
          lastFontSpec = fontSpec;
        }
        return measureCtx.measureText(text).width;
      };

      const rhwp = await import("@rhwp/core");
      await rhwp.default({ module_or_path: "/rhwp_bg.wasm" });
    })();
  }
  return wasmReady;
}

type Status = "idle" | "loading-wasm" | "ready" | "parsing" | "error";

export default function HwpViewerClient() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [svg, setSvg] = useState("");
  const docRef = useRef<HwpDocumentType | null>(null);

  async function handleFile(file: File) {
    setErrorMessage("");
    setStatus("loading-wasm");
    try {
      await ensureWasmInit();
      setStatus("parsing");

      const rhwp = await import("@rhwp/core");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const doc = new rhwp.HwpDocument(bytes);

      docRef.current?.free?.();
      docRef.current = doc;

      const total = doc.pageCount();
      setFileName(file.name);
      setPageCount(total);
      setPageIndex(0);
      setSvg(doc.renderPageSvg(0));
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }

  function goToPage(next: number) {
    const doc = docRef.current;
    if (!doc) return;
    const clamped = Math.max(0, Math.min(pageCount - 1, next));
    setPageIndex(clamped);
    setSvg(doc.renderPageSvg(clamped));
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-6 py-10">
      <h1 className="text-2xl font-bold">HWP 뷰어</h1>
      <p className="mt-2 text-sm text-foreground/50">
        HWP / HWPX 파일을 브라우저 안에서 바로 열어봅니다 (서버 업로드 없음)
      </p>

      <label className="mt-6 flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-black/15 px-6 py-10 text-center hover:border-brand/50">
        <span className="font-semibold">
          {status === "loading-wasm" || status === "parsing"
            ? "불러오는 중…"
            : "HWP / HWPX 파일 선택"}
        </span>
        <span className="text-sm text-foreground/50">
          {fileName || "클릭해서 파일을 고르세요"}
        </span>
        <input
          type="file"
          accept=".hwp,.hwpx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </label>

      {status === "error" && (
        <p className="mt-4 w-full rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          파일을 열지 못했습니다: {errorMessage}
        </p>
      )}

      {status === "ready" && (
        <>
          <div className="mt-6 flex items-center gap-3">
            <button
              className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium disabled:opacity-30"
              onClick={() => goToPage(pageIndex - 1)}
              disabled={pageIndex <= 0}
            >
              이전
            </button>
            <span className="text-sm text-foreground/60">
              {pageIndex + 1} / {pageCount} 페이지
            </span>
            <button
              className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium disabled:opacity-30"
              onClick={() => goToPage(pageIndex + 1)}
              disabled={pageIndex >= pageCount - 1}
            >
              다음
            </button>
          </div>

          <div
            className="mt-6 w-full overflow-auto rounded-lg border border-black/10 bg-white shadow-sm [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </>
      )}
    </div>
  );
}
