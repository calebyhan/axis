export default function LogLoading() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="page-kicker">Capture</div>
          <h1 className="page-title">Log</h1>
          <p className="page-subtitle">Fast, thumb-friendly inputs for workouts, runs, and daily body weight.</p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-5 h-20 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
