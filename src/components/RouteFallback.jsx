function RouteFallback() {
  return (
    <div className="stack" role="status" aria-live="polite">
      <section className="state-loading">
        <div className="skeleton-card">
          <div className="skeleton skeleton-line long" />
          <div className="skeleton skeleton-line short" />
        </div>
        <div className="skeleton-card">
          <div className="skeleton skeleton-line long" />
          <div className="skeleton skeleton-line short" />
        </div>
      </section>
    </div>
  );
}

export default RouteFallback;
