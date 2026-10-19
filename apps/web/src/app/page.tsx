export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex items-center gap-2">
        <span className="inline-block h-8 w-8 rounded-md bg-brand" />
        <h1 className="text-2xl font-semibold">DocsSync</h1>
      </div>
      <p className="text-sm text-foreground/60">
        모노레포 뼈대 구축 중 — apps/web (Next.js 15 + React 19 + Tailwind 4)
      </p>
    </main>
  );
}
