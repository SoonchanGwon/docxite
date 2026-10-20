"use client";

import dynamic from "next/dynamic";

const HwpViewerClient = dynamic(() => import("./HwpViewerClient"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center py-20 text-sm text-foreground/40">
      뷰어 불러오는 중…
    </div>
  ),
});

export default function ViewerLoader() {
  return <HwpViewerClient />;
}
