export default function LogLoading() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Log</h1>
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
