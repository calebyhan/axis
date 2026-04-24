export default function ActivityLoading() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Activity</h1>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card p-5 h-28 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
