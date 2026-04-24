export default function ActivityLoading() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="page-kicker">Feed</div>
          <h1 className="page-title">Activity</h1>
          <p className="page-subtitle">Every run and session, arranged in a cleaner timeline that stays comfortable on mobile.</p>
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
