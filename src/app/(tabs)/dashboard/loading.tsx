export default function DashboardLoading() {
  return (
    <div className="page-shell flex flex-col gap-5">
      <div className="page-header">
        <div>
          <div className="page-kicker">Overview</div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Your week at a glance, with the cleanest view of training momentum, streaks, and recovery trends.
          </p>
        </div>
      </div>
      <div className="card p-5 sm:p-6 h-24 animate-pulse" />
      <div className="card p-5 sm:p-6 h-40 animate-pulse" />
      <div className="card p-5 sm:p-6 h-32 animate-pulse" />
    </div>
  );
}
