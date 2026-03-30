import React, { useEffect, useMemo, useState } from 'react';

const PAGE_SIZE = 8;

const AgentProductConversionTable = ({
  title = 'Agent Product Conversion Table',
  description = '',
  rows = [],
  products = [],
}) => {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [rows.length, products.length]);

  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;
    return rows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [rows, safePage]);

  const visibleTotals = useMemo(
    () => ({
      totalAssignedLeads: rows.reduce((sum, agent) => sum + (agent.totalAssignedLeads || 0), 0),
      totalSubmissions: rows.reduce((sum, agent) => sum + (agent.totalSubmissions || 0), 0),
    }),
    [rows]
  );

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
          {rows.length} agents
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1100px] text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-700">
            <tr>
              <th className="px-4 py-3 font-semibold" rowSpan={2}>Agent</th>
              <th className="px-4 py-3 font-semibold text-center" rowSpan={2}>All Leads</th>
              <th className="px-4 py-3 font-semibold text-center" rowSpan={2}>All Submissions</th>
              {products.map((product) => (
                <th key={product.product} className="px-4 py-3 font-semibold text-center" colSpan={2}>
                  {product.label}
                </th>
              ))}
            </tr>
            <tr>
              {products.map((product) => (
                <React.Fragment key={`${product.product}-subheaders`}>
                  <th className="px-4 py-3 font-semibold text-center">Leads</th>
                  <th className="px-4 py-3 font-semibold text-center">Submissions</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((agent) => (
              <tr key={agent.agentId} className="border-t border-slate-100">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-700">
                      {agent.agentName?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{agent.agentName}</p>
                      <p className="text-xs text-slate-500">{agent.teamName}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-center font-semibold text-slate-900">{agent.totalAssignedLeads}</td>
                <td className="px-4 py-4 text-center font-semibold text-slate-900">{agent.totalSubmissions}</td>
                {agent.products.map((product) => (
                  <React.Fragment key={`${agent.agentId}-${product.product}`}>
                    <td className="px-4 py-4 text-center text-slate-700">{product.totalLeads}</td>
                    <td className="px-4 py-4 text-center text-slate-700">{product.submissions}</td>
                  </React.Fragment>
                ))}
              </tr>
            ))}

            {rows.length > 0 && (
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td className="px-4 py-4 font-semibold text-slate-900">Total</td>
                <td className="px-4 py-4 text-center font-semibold text-slate-900">{visibleTotals.totalAssignedLeads}</td>
                <td className="px-4 py-4 text-center font-semibold text-slate-900">{visibleTotals.totalSubmissions}</td>
                {products.map((product) => (
                  <React.Fragment key={`total-${product.product}`}>
                    <td className="px-4 py-4 text-center font-semibold text-slate-900">{product.totalLeads}</td>
                    <td className="px-4 py-4 text-center font-semibold text-slate-900">{product.submissions}</td>
                  </React.Fragment>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-slate-500">
          No product conversion rows found for this scope.
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Showing {Math.min((safePage - 1) * PAGE_SIZE + 1, rows.length)}-
            {Math.min(safePage * PAGE_SIZE, rows.length)} of {rows.length} agents
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage === 1}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
              Page {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={safePage === totalPages}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default AgentProductConversionTable;
