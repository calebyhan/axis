export default function SettingsLoading() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="page-kicker">Preferences</div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Tune recovery colors, scheduling, and connected services inside the same glassy shell.</p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5 h-24 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
