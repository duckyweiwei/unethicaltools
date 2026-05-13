export function AnimatedBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Solid base */}
      <div className="absolute inset-0 bg-[var(--color-bg)]" />

      {/* Soft gradient orbs */}
      <div
        className="orb-a absolute -top-40 -left-40 h-[60vw] w-[60vw] max-w-[900px] max-h-[900px] rounded-full opacity-40 blur-3xl will-change-transform"
        style={{
          background:
            "radial-gradient(closest-side, rgba(139, 92, 246, 0.55), transparent 70%)",
        }}
      />
      <div
        className="orb-b absolute top-1/3 -right-40 h-[55vw] w-[55vw] max-w-[850px] max-h-[850px] rounded-full opacity-35 blur-3xl will-change-transform"
        style={{
          background:
            "radial-gradient(closest-side, rgba(6, 182, 212, 0.5), transparent 70%)",
        }}
      />
      <div
        className="orb-c absolute -bottom-40 left-1/4 h-[50vw] w-[50vw] max-w-[800px] max-h-[800px] rounded-full opacity-25 blur-3xl will-change-transform"
        style={{
          background:
            "radial-gradient(closest-side, rgba(168, 85, 247, 0.45), transparent 70%)",
        }}
      />

      {/* Faint grid */}
      <div className="absolute inset-0 grid-overlay opacity-50" />

      {/* Top→bottom vignette to anchor content */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at top, transparent 0%, rgba(7,7,11,0.6) 80%)",
        }}
      />
    </div>
  );
}
