import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApiErrorMessage, adminApiService } from '../../services/adminApiService.js';
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  AUDIT_RESULTS,
  AUDIT_ROLES,
  auditActionLabel,
  auditCategoryLabel,
  formatAuditDateTime,
} from '../../services/auditLogPresentation.js';
import '../../styles/admin-audit-logs.css';

const initialFilters = {
  date_from: '', date_to: '', role: '', category: '', action: '', result: '',
};

export default function AdminAuditLogs({ service = adminApiService }) {
  const [filters, setFilters] = useState(initialFilters);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({ loading: true, error: '', items: [], total: 0, pageCount: 1 });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value = searchInput.trim();
      setSearch(value.length >= 2 ? value : '');
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const query = useMemo(() => ({ ...filters, search, page }), [filters, search, page]);
  const load = useCallback(async () => {
    setState(previous => ({ ...previous, loading: true, error: '' }));
    try {
      const result = await service.listAuditLogs(query);
      setState({ loading: false, error: '', items: result.items, total: result.total, pageCount: result.pageCount });
    } catch (error) {
      setState(previous => ({ ...previous, loading: false, error: adminApiErrorMessage(error, 'Unable to load audit logs.') }));
    }
  }, [query, reloadKey, service]);

  useEffect(() => { load(); }, [load]);

  function updateFilter(event) {
    const { name, value } = event.target;
    setFilters(previous => ({ ...previous, [name]: value }));
    setPage(1);
  }

  const hasFilters = search || Object.values(filters).some(Boolean);

  return <div className="admin-audit-logs">
    <header className="audit-heading">
      <h1>Audit Logs</h1>
      <p>Review important security, clinical, account, and scheduling activity.</p>
    </header>

    <section className="audit-panel" aria-labelledby="audit-filters-heading">
      <h2 id="audit-filters-heading">Filters</h2>
      <div className="audit-filter-grid">
        <label className="audit-search">Search actor or target
          <input type="search" value={searchInput} onChange={event => setSearchInput(event.target.value)} minLength="2" maxLength="80" placeholder="Name or safe target" />
        </label>
        <label>Date From<input type="date" name="date_from" value={filters.date_from} onChange={updateFilter} /></label>
        <label>Date To<input type="date" name="date_to" value={filters.date_to} onChange={updateFilter} /></label>
        <label>Role<select name="role" value={filters.role} onChange={updateFilter}><option value="">All roles</option>{AUDIT_ROLES.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
        <label>Category<select name="category" value={filters.category} onChange={updateFilter}><option value="">All categories</option>{AUDIT_CATEGORIES.map(value => <option key={value} value={value}>{auditCategoryLabel(value)}</option>)}</select></label>
        <label>Action<select name="action" value={filters.action} onChange={updateFilter}><option value="">All actions</option>{AUDIT_ACTIONS.map(value => <option key={value} value={value}>{auditActionLabel(value)}</option>)}</select></label>
        <label>Result<select name="result" value={filters.result} onChange={updateFilter}><option value="">All results</option>{AUDIT_RESULTS.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
      </div>
    </section>

    <section className="audit-panel audit-results" aria-labelledby="audit-results-heading">
      <div className="audit-results-heading"><h2 id="audit-results-heading">Activity</h2>{!state.loading && !state.error && <span>{state.total} {state.total === 1 ? 'log' : 'logs'}</span>}</div>
      {state.loading && <p className="audit-message" role="status" aria-live="polite">Loading audit logs…</p>}
      {!state.loading && state.error && <div className="audit-message"><p role="alert">{state.error}</p><button className="action-link" type="button" onClick={() => setReloadKey(value => value + 1)}>Retry</button></div>}
      {!state.loading && !state.error && state.items.length === 0 && <p className="audit-message">{hasFilters ? 'No audit logs match the selected filters.' : 'No audit logs found.'}</p>}
      {!state.loading && !state.error && state.items.length > 0 && <>
        <div className="audit-table-scroll" tabIndex="0" aria-label="Audit log table. Scroll horizontally if needed.">
          <table>
            <thead><tr><th scope="col">Date &amp; Time</th><th scope="col">Actor</th><th scope="col">Role</th><th scope="col">Category</th><th scope="col">Action</th><th scope="col">Target</th><th scope="col">Result</th></tr></thead>
            <tbody>{state.items.map(item => <tr key={item.id}>
              <td data-label="Date & Time">{formatAuditDateTime(item.created_at)}</td>
              <td data-label="Actor">{item.actor || 'Unknown user'}</td>
              <td data-label="Role"><span className="audit-role">{item.actor_role || 'unknown'}</span></td>
              <td data-label="Category"><span className="audit-category">{auditCategoryLabel(item.category)}</span></td>
              <td data-label="Action">{auditActionLabel(item.action)}</td>
              <td data-label="Target">{item.target_display || item.target_type || 'Unknown target'}</td>
              <td data-label="Result"><span className={`audit-result audit-result-${item.result}`}>{item.result ? item.result[0].toUpperCase() + item.result.slice(1) : 'Unknown'}</span></td>
            </tr>)}</tbody>
          </table>
        </div>
        <nav className="audit-pagination" aria-label="Audit log pagination">
          <button className="action-link" type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button>
          <span>Page {page} of {state.pageCount}</span>
          <button className="action-link" type="button" disabled={page >= state.pageCount} onClick={() => setPage(value => value + 1)}>Next</button>
        </nav>
      </>}
    </section>
  </div>;
}
