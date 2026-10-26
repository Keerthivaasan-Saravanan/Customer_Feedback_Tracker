import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout.jsx";
import Icon from "../components/Icon.jsx";
import FilterBar from "../components/FilterBar.jsx";
import FeedbackTable from "../components/FeedbackTable.jsx";
import FeedbackDrawer from "../components/FeedbackDrawer.jsx";
import { ConfirmDialog } from "../components/common.jsx";
import { useApp } from "../context/AppContext.jsx";
import { useFeedbackList, useMeta, useSummary } from "../hooks/useFeedbackData.js";
import { advanceStatus, deleteFeedback, exportFeedbackCsv } from "../feedbackActions.js";
import { INITIAL_FILTERS, PAGE_SIZES } from "../constants.js";

const STATUS_TABS = [
  { value: "", label: "All", countKey: null },
  { value: "New", label: "New", countKey: "New" },
  { value: "Reviewed", label: "Reviewed", countKey: "Reviewed" },
  { value: "Resolved", label: "Resolved", countKey: "Resolved" },
];

export default function FeedbackPage() {
  const { notify, refresh } = useApp();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [limit, setLimit] = useState(PAGE_SIZES[0]);
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const params = useMemo(() => ({ ...filters, limit, offset }), [filters, limit, offset]);
  const list = useFeedbackList(params);
  const summary = useSummary();
  const meta = useMeta();

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;

  // If the current page no longer exists (for example after deleting its last row),
  // move to the last page that does.
  useEffect(() => {
    if (list.loading || total === 0 || offset < total) return;
    setOffset(Math.floor((total - 1) / limit) * limit);
  }, [list.loading, total, offset, limit]);

  const filtersActive = Object.entries(filters).some(([key, value]) => key !== "sort" && value !== "");

  const updateFilter = useCallback((name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setOffset(0);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setOffset(0);
  }, []);

  const closeDrawer = useCallback(() => setSelectedId(null), []);

  const handleAdvance = async (item) => {
    setBusyId(item.id);
    try {
      const updated = await advanceStatus(item);
      notify("success", "Status updated", `${updated.id} is now ${updated.status}.`);
      refresh();
    } catch (err) {
      notify("error", "Status not changed", err.message);
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteFeedback(pendingDelete);
      notify("success", "Feedback deleted", `${pendingDelete.id} was removed.`);
      if (selectedId === pendingDelete.id) setSelectedId(null);
      refresh();
    } catch (err) {
      notify("error", "Delete failed", err.message);
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const count = await exportFeedbackCsv(filters);
      notify("success", "Export ready", `${count} record${count === 1 ? "" : "s"} downloaded as CSV.`);
    } catch (err) {
      notify("error", "Export failed", err.message);
    } finally {
      setExporting(false);
    }
  };

  const counts = summary.data?.count_by_status;
  const totalAll = summary.data?.total_count;

  return (
    <Layout
      route="/feedback"
      title="Feedback"
      subtitle="Review, triage and resolve what customers are telling you."
      actions={
        <>
          <button type="button" className="btn btn--ghost" onClick={handleExport} disabled={exporting || total === 0}>
            <Icon name="download" size={16} />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
          <a className="btn btn--primary" href="#/submit">
            <Icon name="plus" size={16} />
            New feedback
          </a>
        </>
      }
    >
      <div className="tabs" role="tablist" aria-label="Filter by status">
        {STATUS_TABS.map((tab) => {
          const active = filters.status === tab.value;
          const count = tab.countKey ? counts?.[tab.countKey] : totalAll;
          return (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={active}
              className={`tab ${active ? "is-active" : ""}`}
              onClick={() => updateFilter("status", tab.value)}
            >
              {tab.label}
              <span className="tab__count">{count ?? "–"}</span>
            </button>
          );
        })}
      </div>

      <FilterBar filters={filters} meta={meta.data} onChange={updateFilter} onReset={resetFilters} />

      <FeedbackTable
        items={items}
        total={total}
        limit={limit}
        offset={offset}
        loading={list.loading}
        error={list.error}
        filtersActive={filtersActive}
        busyId={busyId}
        selectedId={selectedId}
        onRetry={list.reload}
        onClearFilters={resetFilters}
        onOpen={(item) => setSelectedId(item.id)}
        onAdvance={handleAdvance}
        onDelete={setPendingDelete}
        onOffset={setOffset}
        onLimit={(size) => {
          setLimit(size);
          setOffset(0);
        }}
      />

      {selectedId && (
        <FeedbackDrawer
          key={selectedId}
          itemId={selectedId}
          busy={busyId === selectedId}
          onClose={closeDrawer}
          onAdvance={handleAdvance}
          onDelete={setPendingDelete}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this feedback?"
        message={
          pendingDelete
            ? `${pendingDelete.id} from ${pendingDelete.customer_name} will be permanently removed. Only New feedback can be deleted.`
            : ""
        }
        confirmLabel="Delete feedback"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
        busy={deleting}
      />
    </Layout>
  );
}
