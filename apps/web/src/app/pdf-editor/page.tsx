import type { Metadata } from "next";
import PdfEditorLoader from "./PdfEditorLoader";

export const metadata: Metadata = {
  title: "PDF 편집기 — DocsSync",
  description: "설치 없이 브라우저에서 PDF에 주석을 달고 페이지를 편집하는 도구",
};

export default function PdfEditorPage() {
  return <PdfEditorLoader />;
}
