import type { Metadata } from "next";
import ViewerLoader from "./ViewerLoader";

export const metadata: Metadata = {
  title: "HWP 뷰어 — DocsSync",
  description: "설치 없이 브라우저에서 HWP/HWPX 파일을 바로 열어보는 뷰어",
};

export default function ViewerPage() {
  return <ViewerLoader />;
}
