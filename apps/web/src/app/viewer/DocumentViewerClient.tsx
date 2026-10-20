"use client";

import { useEffect, useRef, useState } from "react";
import type { HwpDocument as HwpDocumentType } from "@rhwp/core";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { takePendingFile } from "@/lib/pendingFile";

let hwpWasmReady: Promise<void> | null = null;

function ensureHwpWasmInit() {
  if (!hwpWasmReady) {
    hwpWasmReady = (async () => {
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
  return hwpWasmReady;
}

function getFileKind(name: string): "hwp" | "pdf" | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".hwp") || lower.endsWith(".hwpx")) return "hwp";
  if (lower.endsWith(".pdf")) return "pdf";
  return null;
}

type Status = "idle" | "loading" | "ready" | "error";

export default function DocumentViewerClient() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileKind, setFileKind] = useState<"hwp" | "pdf" | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [svg, setSvg] = useState("");

  const hwpDocRef = useRef<HwpDocumentType | null>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  async function renderPdfPage(pdf: PDFDocumentProxy, pageNum: number) {
    const page = await pdf.getPage(pageNum + 1);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  }

  async function handleFile(file: File) {
    setErrorMessage("");
    setStatus("loading");
    hwpDocRef.current?.free?.();
    hwpDocRef.current = null;
    pdfDocRef.current = null;
    setSvg("");

    const kind = getFileKind(file.name);
    if (!kind) {
      setStatus("error");
      setErrorMessage("HWP, HWPX, PDF 파일만 열 수 있습니다.");
      return;
    }
    setFileKind(kind);

    try {
      if (kind === "hwp") {
        await ensureHwpWasmInit();
        const rhwp = await import("@rhwp/core");
        const bytes = new Uint8Array(await file.arrayBuffer());
        const doc = new rhwp.HwpDocument(bytes);
        hwpDocRef.current = doc;

        const total = doc.pageCount();
        setFileName(file.name);
        setPageCount(total);
        setPageIndex(0);
        setSvg(doc.renderPageSvg(0));
        setStatus("ready");
      } else {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const bytes = new Uint8Array(await file.arrayBuffer());
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        pdfDocRef.current = pdf;

        setFileName(file.name);
        setPageCount(pdf.numPages);
        setPageIndex(0);
        setStatus("ready");
        await renderPdfPage(pdf, 0);
      }
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }

  // Runs once on mount to pick up a file handed off from the home page.
  useEffect(() => {
    const pending = takePendingFile();
    if (pending) void handleFile(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function goToPage(next: number) {
    const clamped = Math.max(0, Math.min(pageCount - 1, next));
    setPageIndex(clamped);
    if (fileKind === "hwp" && hwpDocRef.current) {
      setSvg(hwpDocRef.current.renderPageSvg(clamped));
    } else if (fileKind === "pdf" && pdfDocRef.current) {
      await renderPdfPage(pdfDocRef.current, clamped);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-6 py-10">
      <h1 className="text-2xl font-bold">문서 뷰어</h1>
      <p className="mt-2 text-sm text-foreground/50">
        HWP / HWPX / PDF 파일을 브라우저 안에서 바로 열어봅니다 (서버 업로드 없음)
      </p>

      <label className="mt-6 flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-black/15 px-6 py-10 text-center hover:border-brand/50">
        <span className="font-semibold">
          {status === "loading" ? "불러오는 중…" : "HWP / HWPX / PDF 파일 선택"}
        </span>
        <span className="text-sm text-foreground/50">
          {fileName || "클릭해서 파일을 고르세요"}
        </span>
        <input
          type="file"
          accept=".hwp,.hwpx,.pdf"
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

      {fileKind && (
        <>
          {status === "ready" && (
            <div className="mt-6 flex items-center gap-3">
              <button
                className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium disabled:opacity-30"
                onClick={() => void goToPage(pageIndex - 1)}
                disabled={pageIndex <= 0}
              >
                이전
              </button>
              <span className="text-sm text-foreground/60">
                {pageIndex + 1} / {pageCount} 페이지
              </span>
              <button
                className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium disabled:opacity-30"
                onClick={() => void goToPage(pageIndex + 1)}
                disabled={pageIndex >= pageCount - 1}
              >
                다음
              </button>
            </div>
          )}

          <div
            className="mt-6 w-full overflow-auto rounded-lg border border-black/10 bg-white shadow-sm"
            hidden={status !== "ready"}
          >
            {fileKind === "hwp" ? (
              <div
                className="[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            ) : (
              <canvas ref={canvasRef} className="mx-auto block max-w-full" />
            )}
          </div>
        </>
      )}
    </div>
  );
}
