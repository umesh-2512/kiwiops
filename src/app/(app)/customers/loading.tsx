export default function CustomersLoading() {
  return (
    <div className="page-stack" aria-busy="true" aria-label="Loading customers">
      <div className="skeleton skeleton-heading" />
      <div className="customer-directory">
        <div className="skeleton skeleton-toolbar" />
        <div className="skeleton-list">{Array.from({ length: 5 }, (_, index) => <div className="skeleton skeleton-row" key={index} />)}</div>
      </div>
    </div>
  );
}
