const labels = { pending: 'Pending', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show', draft: 'Draft', issued: 'Issued' };
export default function StatusBadge({ status }) {
  return <span className={'badge dashboard-status status-' + status}>{labels[status] ?? status}</span>;
}

