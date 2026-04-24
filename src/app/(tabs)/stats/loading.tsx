export default function StatsLoading() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="page-kicker">Trends</div>
          <h1 className="page-title">Stats</h1>
          <p className="page-subtitle">Performance trends and body signals, framed with softer contrast and better readability.</p>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5 h-48 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
