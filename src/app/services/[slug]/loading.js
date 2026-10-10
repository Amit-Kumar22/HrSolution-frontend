export default function ServiceDetailLoading() {
  return (
    <main className="section section-soft">
      <div className="container">
        <div className="skeleton-line skeleton-line-wide" />
        <div className="skeleton-card service-detail-skeleton" />
        <div className="skeleton-card service-detail-skeleton-body" />
      </div>
    </main>
  );
}
