// The Athanor office renders from /public/index.html's engine modules.
// In the Next.js build we embed it via an iframe to reuse the exact engine
// without porting the canvas loop into React (which would add nothing).
export default function Home() {
  return (
    <iframe
      src="/index.html"
      style={{ border: "none", width: "100vw", height: "100vh", display: "block" }}
      title="Athanor Office"
    />
  );
}
