export default function SettingsLoading() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
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
