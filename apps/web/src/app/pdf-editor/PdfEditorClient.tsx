"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from "pdfjs-dist";
import { takePendingFile } from "@/lib/pendingFile";
import { hexToRgb01, pointsToSvgPath, type PdfPoint } from "./pdfGeometry";

type Tool =
  | "select"
  | "pen"
  | "highlighter"
  | "rectangle"
  | "ellipse"
  | "line"
  | "arrow"
  | "text"
  | "whiteout";

interface PageEntry {
  id: string;
  kind: "original" | "blank" | "merged";
  docIndex: number; // index into docsRef.current (ignored for "blank")
  sourcePageIndex: number; // 0-based page index within that doc
  rotation: number; // user-applied rotation added on top of the page's own rotation
  width: number; // unrotated page width in pt
  height: number; // unrotated page height in pt
}

interface Annotation {
  id: string;
  pageEntryId: string;
  tool: Exclude<Tool, "select">;
  color: string;
  strokeWidth: number;
  points?: PdfPoint[];
  rect?: { x: number; y: number; w: number; h: number };
  text?: string;
}

interface Snapshot {
  pageEntries: PageEntry[];
  annotations: Annotation[];
}

let nextId = 1;
function makeId(prefix: string) {
  return `${prefix}-${nextId++}-${Date.now().toString(36)}`;
}

const TOOLS: { id: Tool; label: string }[] = [
  { id: "select", label: "선택" },
  { id: "pen", label: "펜" },
  { id: "highlighter", label: "형광펜" },
  { id: "rectangle", label: "사각형" },
  { id: "ellipse", label: "원" },
  { id: "line", label: "선" },
  { id: "arrow", label: "화살표" },
  { id: "text", label: "텍스트" },
  { id: "whiteout", label: "가리기" },
];

const COLORS = ["#111111", "#e03131", "#2b5bf0", "#2f9e44", "#f59f00"];

const DISPLAY_WIDTH = 760;

export default function PdfEditorClient() {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [pageEntries, setPageEntries] = useState<PageEntry[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [busy, setBusy] = useState(false);
  const [pendingText, setPendingText] = useState<{
    canvasX: number;
    canvasY: number;
    pdf: PdfPoint;
  } | null>(null);

  const docsRef = useRef<{ pdfjs: PDFDocumentProxy; bytes: Uint8Array }[]>([]);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<PageViewport | null>(null);
  const drawingRef = useRef<PdfPoint[] | null>(null);
  const dragStartRef = useRef<PdfPoint | null>(null);

  const historyRef = useRef<Snapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const [, setHistoryTick] = useState(0);

  function pushHistory(next: Snapshot) {
    const h = historyRef.current.slice(0, historyIndexRef.current + 1);
    h.push(next);
    historyRef.current = h;
    historyIndexRef.current = h.length - 1;
    setHistoryTick((t) => t + 1);
  }

  function applySnapshot(next: Snapshot) {
    setPageEntries(next.pageEntries);
    setAnnotations(next.annotations);
  }

  function commit(entries: PageEntry[], anns: Annotation[]) {
    setPageEntries(entries);
    setAnnotations(anns);
    pushHistory({ pageEntries: entries, annotations: anns });
  }

  function undo() {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    applySnapshot(historyRef.current[historyIndexRef.current]);
    setHistoryTick((t) => t + 1);
  }

  function redo() {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    applySnapshot(historyRef.current[historyIndexRef.current]);
    setHistoryTick((t) => t + 1);
  }

  async function loadIntoEditor(file: File, append: boolean) {
    setBusy(true);
    setErrorMessage("");
    if (!append) setStatus("loading");
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;

      const docIndex = docsRef.current.length;
      docsRef.current.push({ pdfjs: pdf, bytes });

      const newEntries: PageEntry[] = [];
      for (let i = 0; i < pdf.numPages; i++) {
        const page = await pdf.getPage(i + 1);
        const [x0, y0, x1, y1] = page.view;
        newEntries.push({
          id: makeId("pg"),
          kind: append ? "merged" : "original",
          docIndex,
          sourcePageIndex: i,
          rotation: 0,
          width: x1 - x0,
          height: y1 - y0,
        });
      }

      if (!append) {
        setFileName(file.name);
        commit(newEntries, []);
        setActiveId(newEntries[0]?.id ?? null);
        setStatus("ready");
      } else {
        const merged = [...pageEntries, ...newEntries];
        commit(merged, annotations);
      }
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const pending = takePendingFile();
    if (pending) void loadIntoEditor(pending, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeEntry = useMemo(
    () => pageEntries.find((e) => e.id === activeId) ?? null,
    [pageEntries, activeId],
  );

  const activeAnnotations = useMemo(
    () => annotations.filter((a) => a.pageEntryId === activeId),
    [annotations, activeId],
  );

  async function getActivePdfPage(): Promise<PDFPageProxy | null> {
    if (!activeEntry || activeEntry.kind === "blank") return null;
    const doc = docsRef.current[activeEntry.docIndex];
    if (!doc) return null;
    return doc.pdfjs.getPage(activeEntry.sourcePageIndex + 1);
  }

  // Render the background (actual PDF content) whenever the active page or its rotation changes.
  useEffect(() => {
    let cancelled = false;
    async function render() {
      const canvas = bgCanvasRef.current;
      const overlay = overlayCanvasRef.current;
      if (!canvas || !overlay || !activeEntry) return;

      if (activeEntry.kind === "blank") {
        const scale = DISPLAY_WIDTH / activeEntry.width;
        canvas.width = Math.round(activeEntry.width * scale);
        canvas.height = Math.round(activeEntry.height * scale);
        overlay.width = canvas.width;
        overlay.height = canvas.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        viewportRef.current = null;
        drawOverlay();
        return;
      }

      const page = await getActivePdfPage();
      if (!page || cancelled) return;
      const scale = DISPLAY_WIDTH / activeEntry.width;
      const viewport = page.getViewport({ scale, rotation: activeEntry.rotation });
      viewportRef.current = viewport;

      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      overlay.width = canvas.width;
      overlay.height = canvas.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      if (!cancelled) drawOverlay();
    }
    void render();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEntry?.id, activeEntry?.rotation]);

  function pxToPdf(px: number, py: number): PdfPoint {
    const vp = viewportRef.current;
    if (vp) {
      const [x, y] = vp.convertToPdfPoint(px, py);
      return { x, y };
    }
    // blank page: simple linear map, no rotation support
    const scale = DISPLAY_WIDTH / (activeEntry?.width ?? DISPLAY_WIDTH);
    return { x: px / scale, y: (activeEntry?.height ?? 0) - py / scale };
  }

  function pdfToPx(p: PdfPoint): [number, number] {
    const vp = viewportRef.current;
    if (vp) {
      const [x, y] = vp.convertToViewportPoint(p.x, p.y);
      return [x, y];
    }
    const scale = DISPLAY_WIDTH / (activeEntry?.width ?? DISPLAY_WIDTH);
    return [p.x * scale, ((activeEntry?.height ?? 0) - p.y) * scale];
  }

  function drawOverlay(liveRect?: { x: number; y: number; w: number; h: number }, livePoints?: PdfPoint[]) {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    for (const a of activeAnnotations) drawAnnotation(ctx, a);

    if (livePoints && livePoints.length > 1) {
      drawAnnotation(ctx, {
        id: "__live",
        pageEntryId: "",
        tool: tool === "highlighter" ? "highlighter" : "pen",
        color,
        strokeWidth,
        points: livePoints,
      });
    }
    if (liveRect) {
      const [x1, y1] = pdfToPx({ x: liveRect.x, y: liveRect.y + liveRect.h });
      const [x2, y2] = pdfToPx({ x: liveRect.x + liveRect.w, y: liveRect.y });
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.setLineDash([4, 4]);
      if (tool === "ellipse") {
        ctx.beginPath();
        ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      }
      ctx.setLineDash([]);
    }
  }

  function drawAnnotation(ctx: CanvasRenderingContext2D, a: Annotation) {
    ctx.save();
    if (a.tool === "pen" || a.tool === "highlighter") {
      const pts = (a.points ?? []).map((p) => pdfToPx(p));
      if (pts.length < 2) {
        ctx.restore();
        return;
      }
      ctx.strokeStyle = a.color;
      ctx.lineWidth = a.tool === "highlighter" ? a.strokeWidth * 4 : a.strokeWidth;
      ctx.globalAlpha = a.tool === "highlighter" ? 0.35 : 1;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
      ctx.stroke();
    } else if (a.tool === "line" || a.tool === "arrow") {
      const pts = a.points ?? [];
      if (pts.length < 2) {
        ctx.restore();
        return;
      }
      const [x1, y1] = pdfToPx(pts[0]);
      const [x2, y2] = pdfToPx(pts[1]);
      ctx.strokeStyle = a.color;
      ctx.lineWidth = a.strokeWidth;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (a.tool === "arrow") {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = 10 + a.strokeWidth;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    } else if (a.tool === "rectangle" || a.tool === "ellipse" || a.tool === "whiteout") {
      const r = a.rect;
      if (!r) {
        ctx.restore();
        return;
      }
      const [x1, y1] = pdfToPx({ x: r.x, y: r.y + r.h });
      const [x2, y2] = pdfToPx({ x: r.x + r.w, y: r.y });
      if (a.tool === "whiteout") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
        ctx.strokeStyle = "#d0d0d0";
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      } else if (a.tool === "ellipse") {
        ctx.strokeStyle = a.color;
        ctx.lineWidth = a.strokeWidth;
        ctx.beginPath();
        ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = a.color;
        ctx.lineWidth = a.strokeWidth;
        ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      }
    } else if (a.tool === "text") {
      const p = a.points?.[0];
      if (!p) {
        ctx.restore();
        return;
      }
      const [x, y] = pdfToPx(p);
      ctx.fillStyle = a.color;
      ctx.font = `${Math.round(a.strokeWidth * 6 + 12)}px sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(a.text ?? "", x, y);
    }
    ctx.restore();
  }

  useEffect(() => {
    drawOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAnnotations]);

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (tool === "select" || !activeEntry) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const pdf = pxToPdf(px, py);

    if (tool === "text") {
      setPendingText({ canvasX: px, canvasY: py, pdf });
      return;
    }
    if (tool === "pen" || tool === "highlighter") {
      drawingRef.current = [pdf];
    } else {
      dragStartRef.current = pdf;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (tool === "select" || !activeEntry) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const pdf = pxToPdf(px, py);

    if ((tool === "pen" || tool === "highlighter") && drawingRef.current) {
      drawingRef.current.push(pdf);
      drawOverlay(undefined, drawingRef.current);
    } else if (dragStartRef.current && (tool === "rectangle" || tool === "ellipse" || tool === "whiteout")) {
      const s = dragStartRef.current;
      drawOverlay({
        x: Math.min(s.x, pdf.x),
        y: Math.min(s.y, pdf.y),
        w: Math.abs(pdf.x - s.x),
        h: Math.abs(pdf.y - s.y),
      });
    } else if (dragStartRef.current && (tool === "line" || tool === "arrow")) {
      drawOverlay(undefined, [dragStartRef.current, pdf]);
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (tool === "select" || !activeEntry) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const pdf = pxToPdf(px, py);

    let newAnn: Annotation | null = null;

    if ((tool === "pen" || tool === "highlighter") && drawingRef.current) {
      const pts = [...drawingRef.current, pdf];
      if (pts.length > 1) {
        newAnn = { id: makeId("an"), pageEntryId: activeEntry.id, tool, color, strokeWidth, points: pts };
      }
      drawingRef.current = null;
    } else if (dragStartRef.current && (tool === "rectangle" || tool === "ellipse" || tool === "whiteout")) {
      const s = dragStartRef.current;
      const rectShape = {
        x: Math.min(s.x, pdf.x),
        y: Math.min(s.y, pdf.y),
        w: Math.abs(pdf.x - s.x),
        h: Math.abs(pdf.y - s.y),
      };
      if (rectShape.w > 2 && rectShape.h > 2) {
        newAnn = { id: makeId("an"), pageEntryId: activeEntry.id, tool, color, strokeWidth, rect: rectShape };
      }
      dragStartRef.current = null;
    } else if (dragStartRef.current && (tool === "line" || tool === "arrow")) {
      const s = dragStartRef.current;
      newAnn = { id: makeId("an"), pageEntryId: activeEntry.id, tool, color, strokeWidth, points: [s, pdf] };
      dragStartRef.current = null;
    }

    if (newAnn) {
      const next = [...annotations, newAnn];
      commit(pageEntries, next);
    } else {
      drawOverlay();
    }
  }

  function commitText() {
    if (!pendingText || !activeEntry) {
      setPendingText(null);
      return;
    }
    const value = textDraftRef.current.trim();
    textDraftRef.current = "";
    if (value) {
      const newAnn: Annotation = {
        id: makeId("an"),
        pageEntryId: activeEntry.id,
        tool: "text",
        color,
        strokeWidth,
        points: [pendingText.pdf],
        text: value,
      };
      commit(pageEntries, [...annotations, newAnn]);
    }
    setPendingText(null);
  }
  const textDraftRef = useRef("");

  // ---- page management ----

  function updateEntries(mutate: (entries: PageEntry[]) => PageEntry[]) {
    const next = mutate(pageEntries);
    commit(next, annotations);
  }

  function rotatePage(id: string, delta: number) {
    updateEntries((entries) =>
      entries.map((e) => (e.id === id ? { ...e, rotation: (((e.rotation + delta) % 360) + 360) % 360 } : e)),
    );
  }

  function deletePage(id: string) {
    updateEntries((entries) => entries.filter((e) => e.id !== id));
    setAnnotations((prev) => prev.filter((a) => a.pageEntryId !== id));
    if (activeId === id) {
      const remaining = pageEntries.filter((e) => e.id !== id);
      setActiveId(remaining[0]?.id ?? null);
    }
  }

  function duplicatePage(id: string) {
    updateEntries((entries) => {
      const idx = entries.findIndex((e) => e.id === id);
      if (idx === -1) return entries;
      const copy: PageEntry = { ...entries[idx], id: makeId("pg") };
      const next = [...entries];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }

  function movePage(id: string, dir: -1 | 1) {
    updateEntries((entries) => {
      const idx = entries.findIndex((e) => e.id === id);
      const target = idx + dir;
      if (idx === -1 || target < 0 || target >= entries.length) return entries;
      const next = [...entries];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function addBlankPage() {
    const last = pageEntries[pageEntries.length - 1];
    const entry: PageEntry = {
      id: makeId("pg"),
      kind: "blank",
      docIndex: -1,
      sourcePageIndex: -1,
      rotation: 0,
      width: last?.width ?? 595.28,
      height: last?.height ?? 841.89,
    };
    updateEntries((entries) => [...entries, entry]);
    setActiveId(entry.id);
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ---- export ----

  async function buildExportDoc(entries: PageEntry[]) {
    const pdfLib = await import("pdf-lib");
    const out = await pdfLib.PDFDocument.create();
    out.registerFontkit((await import("@pdf-lib/fontkit")).default);
    const fontBytes = await fetch("/fonts/NotoSansKR-Variable.ttf").then((r) => r.arrayBuffer());
    const font = await out.embedFont(fontBytes, { subset: true });

    // Build one pdf-lib source doc per distinct docIndex used, lazily.
    const sourceDocs = new Map<number, import("pdf-lib").PDFDocument>();
    async function getSourceDoc(docIndex: number) {
      if (!sourceDocs.has(docIndex)) {
        const bytes = docsRef.current[docIndex].bytes;
        sourceDocs.set(docIndex, await pdfLib.PDFDocument.load(bytes));
      }
      return sourceDocs.get(docIndex)!;
    }

    for (const entry of entries) {
      let page;
      if (entry.kind === "blank") {
        page = out.addPage([entry.width, entry.height]);
      } else {
        const src = await getSourceDoc(entry.docIndex);
        const [copied] = await out.copyPages(src, [entry.sourcePageIndex]);
        page = out.addPage(copied);
      }
      if (entry.rotation !== 0) {
        const current = page.getRotation().angle;
        page.setRotation(pdfLib.degrees(current + entry.rotation));
      }

      for (const a of annotations.filter((x) => x.pageEntryId === entry.id)) {
        drawAnnotationToPdfLib(page, a, font, pdfLib);
      }
    }
    return out;
  }

  function drawAnnotationToPdfLib(
    page: import("pdf-lib").PDFPage,
    a: Annotation,
    font: import("pdf-lib").PDFFont,
    pdfLib: typeof import("pdf-lib"),
  ) {
    const { r, g, b } = hexToRgb01(a.color);
    const col = pdfLib.rgb(r, g, b);

    if (a.tool === "pen" || a.tool === "highlighter") {
      if (!a.points || a.points.length < 2) return;
      const path = pointsToSvgPath(a.points);
      page.drawSvgPath(path, {
        x: 0,
        y: 0,
        borderColor: col,
        borderWidth: a.tool === "highlighter" ? a.strokeWidth * 4 : a.strokeWidth,
        borderOpacity: a.tool === "highlighter" ? 0.35 : 1,
        borderLineCap: pdfLib.LineCapStyle.Round,
      });
    } else if (a.tool === "line" || a.tool === "arrow") {
      if (!a.points || a.points.length < 2) return;
      const [s, e] = a.points;
      page.drawLine({ start: s, end: e, thickness: a.strokeWidth, color: col, lineCap: pdfLib.LineCapStyle.Round });
      if (a.tool === "arrow") {
        const angle = Math.atan2(e.y - s.y, e.x - s.x);
        const headLen = 10 + a.strokeWidth;
        const p1 = { x: e.x - headLen * Math.cos(angle - Math.PI / 6), y: e.y - headLen * Math.sin(angle - Math.PI / 6) };
        const p2 = { x: e.x - headLen * Math.cos(angle + Math.PI / 6), y: e.y - headLen * Math.sin(angle + Math.PI / 6) };
        page.drawLine({ start: e, end: p1, thickness: a.strokeWidth, color: col });
        page.drawLine({ start: e, end: p2, thickness: a.strokeWidth, color: col });
      }
    } else if (a.tool === "rectangle" && a.rect) {
      page.drawRectangle({ x: a.rect.x, y: a.rect.y, width: a.rect.w, height: a.rect.h, borderColor: col, borderWidth: a.strokeWidth });
    } else if (a.tool === "ellipse" && a.rect) {
      page.drawEllipse({
        x: a.rect.x + a.rect.w / 2,
        y: a.rect.y + a.rect.h / 2,
        xScale: a.rect.w / 2,
        yScale: a.rect.h / 2,
        borderColor: col,
        borderWidth: a.strokeWidth,
      });
    } else if (a.tool === "whiteout" && a.rect) {
      page.drawRectangle({ x: a.rect.x, y: a.rect.y, width: a.rect.w, height: a.rect.h, color: pdfLib.rgb(1, 1, 1) });
    } else if (a.tool === "text" && a.points?.[0]) {
      page.drawText(a.text ?? "", {
        x: a.points[0].x,
        y: a.points[0].y - (strokeWidth * 6 + 12),
        size: strokeWidth * 6 + 12,
        font,
        color: col,
      });
    }
  }

  async function downloadAll() {
    setBusy(true);
    try {
      const out = await buildExportDoc(pageEntries);
      const bytes = await out.save();
      triggerDownload(bytes, (fileName.replace(/\.pdf$/i, "") || "document") + "-edited.pdf");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function downloadSelected() {
    const entries = pageEntries.filter((e) => selected.has(e.id));
    if (entries.length === 0) return;
    setBusy(true);
    try {
      const out = await buildExportDoc(entries);
      const bytes = await out.save();
      triggerDownload(bytes, (fileName.replace(/\.pdf$/i, "") || "document") + "-selected.pdf");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function splitToZip() {
    setBusy(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (let i = 0; i < pageEntries.length; i++) {
        const out = await buildExportDoc([pageEntries[i]]);
        const bytes = await out.save();
        zip.file(`page-${i + 1}.pdf`, bytes);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (fileName.replace(/\.pdf$/i, "") || "document") + "-pages.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function triggerDownload(bytes: Uint8Array, name: string) {
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (status !== "ready") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">PDF 편집기</h1>
        <p className="mt-2 text-sm text-foreground/50">PDF 파일을 선택해서 바로 편집을 시작하세요 (서버 업로드 없음)</p>
        <label className="mt-6 flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-black/15 px-6 py-12 text-center hover:border-brand/50">
          <span className="font-semibold">{status === "loading" ? "불러오는 중…" : "PDF 파일 선택"}</span>
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void loadIntoEditor(file, false);
            }}
          />
        </label>
        {status === "error" && (
          <p className="mt-4 w-full rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{errorMessage}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-0px)] flex-1 flex-col">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-black/10 bg-white px-4 py-2">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tool === t.id ? "bg-brand text-white" : "hover:bg-black/5"
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="mx-2 h-6 w-px bg-black/10" />
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-black" : "border-transparent"}`}
            style={{ backgroundColor: c }}
            aria-label={c}
          />
        ))}
        <input
          type="range"
          min={1}
          max={10}
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="w-24"
        />
        <span className="mx-2 h-6 w-px bg-black/10" />
        <button onClick={undo} disabled={historyIndexRef.current <= 0} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm disabled:opacity-30">
          실행 취소
        </button>
        <button
          onClick={redo}
          disabled={historyIndexRef.current >= historyRef.current.length - 1}
          className="rounded-lg border border-black/10 px-3 py-1.5 text-sm disabled:opacity-30"
        >
          다시 실행
        </button>
        <span className="mx-2 h-6 w-px bg-black/10" />
        <button onClick={addBlankPage} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm">
          + 빈 페이지
        </button>
        <label className="cursor-pointer rounded-lg border border-black/10 px-3 py-1.5 text-sm">
          다른 PDF 합치기
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void loadIntoEditor(file, true);
            }}
          />
        </label>
        <button
          onClick={() => void downloadSelected()}
          disabled={selected.size === 0 || busy}
          className="rounded-lg border border-black/10 px-3 py-1.5 text-sm disabled:opacity-30"
        >
          선택 페이지 저장
        </button>
        <button onClick={() => void splitToZip()} disabled={busy} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm">
          전체 쪽별로 나누기(ZIP)
        </button>
        <span className="flex-1" />
        <button
          onClick={() => void downloadAll()}
          disabled={busy}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "처리 중…" : "다운로드"}
        </button>
      </div>

      {errorMessage && (
        <p className="bg-red-50 px-4 py-2 text-sm text-red-600">{errorMessage}</p>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* page list */}
        <div className="w-56 shrink-0 overflow-y-auto border-r border-black/10 bg-black/[0.02] p-2">
          {pageEntries.map((entry, idx) => (
            <div
              key={entry.id}
              className={`mb-2 rounded-lg border p-2 text-xs ${
                activeId === entry.id ? "border-brand bg-brand/5" : "border-black/10 bg-white"
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                <input type="checkbox" checked={selected.has(entry.id)} onChange={() => toggleSelected(entry.id)} />
                <button className="flex-1 text-left font-medium" onClick={() => setActiveId(entry.id)}>
                  {idx + 1}쪽 {entry.kind === "blank" ? "(빈 페이지)" : entry.kind === "merged" ? "(합침)" : ""}
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => movePage(entry.id, -1)} className="rounded border border-black/10 px-1.5 py-0.5">
                  ↑
                </button>
                <button onClick={() => movePage(entry.id, 1)} className="rounded border border-black/10 px-1.5 py-0.5">
                  ↓
                </button>
                {entry.kind !== "blank" && (
                  <>
                    <button onClick={() => rotatePage(entry.id, -90)} className="rounded border border-black/10 px-1.5 py-0.5">
                      ⟲
                    </button>
                    <button onClick={() => rotatePage(entry.id, 90)} className="rounded border border-black/10 px-1.5 py-0.5">
                      ⟳
                    </button>
                  </>
                )}
                <button onClick={() => duplicatePage(entry.id)} className="rounded border border-black/10 px-1.5 py-0.5">
                  복제
                </button>
                <button onClick={() => deletePage(entry.id)} className="rounded border border-black/10 px-1.5 py-0.5 text-red-600">
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* canvas */}
        <div className="flex flex-1 items-start justify-center overflow-auto p-6">
          <div className="relative inline-block shadow-sm" style={{ lineHeight: 0 }}>
            <canvas ref={bgCanvasRef} className="block bg-white" />
            <canvas
              ref={overlayCanvasRef}
              className="absolute left-0 top-0"
              style={{ cursor: tool === "select" ? "default" : "crosshair" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
            {pendingText && (
              <textarea
                autoFocus
                className="absolute z-10 min-w-[120px] rounded border border-brand bg-white/90 p-1 text-sm outline-none"
                style={{ left: pendingText.canvasX, top: pendingText.canvasY }}
                onChange={(e) => {
                  textDraftRef.current = e.target.value;
                }}
                onBlur={commitText}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    (e.target as HTMLTextAreaElement).blur();
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
