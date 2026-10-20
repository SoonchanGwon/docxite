"use client";

import dynamic from "next/dynamic";

const PdfEditorClient = dynamic(() => import("./PdfEditorClient"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center py-20 text-sm text-foreground/40">
      편집기 불러오는 중…
    </div>
  ),
});

export default function PdfEditorLoader() {
  return <PdfEditorClient />;
}
