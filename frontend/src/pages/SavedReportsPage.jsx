import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchSavedReports, deleteSavedReport } from '../api/leads.js';
import { LuFileText, LuPlay, LuTrash2, LuClock } from 'react-icons/lu';
import { toast } from 'react-toastify';

const SavedReportsPage = () => {
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const data = await fetchSavedReports();
      setReports(data.reports);
    } catch (err) {
      toast.error('Failed to load saved reports');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this report?')) return;
    try {
      await deleteSavedReport(id);
      toast.success('Report deleted');
      setReports(reports.filter(r => r._id !== id));
    } catch (err) {
      toast.error('Failed to delete report');
    }
  };

  const handleLoad = (report) => {
    // Navigate to reports page with search params
    const params = new URLSearchParams();
    Object.entries(report.filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    navigate(`/analyst-reports?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-8 animate-in fade-in duration-500">
      <header className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm">
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-700/10">
          Analytics Management
        </span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900">Saved Reports</h1>
        <p className="mt-2 text-lg text-slate-600">Access and manage your frequently used reporting configurations.</p>
      </header>

      {reports.length === 0 ? (
        <div className="rounded-[2.5rem] border border-dashed border-slate-300 bg-slate-50 p-20 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200 text-slate-400">
            <LuFileText className="text-3xl" />
          </div>
          <h2 className="mt-6 text-xl font-bold text-slate-900">No reports saved yet</h2>
          <p className="mt-2 text-slate-500 max-w-sm mx-auto">
            Go to the Advanced Reports page, apply filters, and click "Save Report" to see them here.
          </p>
          <button
            onClick={() => navigate('/analyst-reports')}
            className="mt-8 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700"
          >
            Create Your First Report
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <div 
              key={report._id} 
              className="group flex flex-col rounded-[2rem] border border-slate-200 bg-white p-1 shadow-sm transition hover:shadow-xl hover:shadow-indigo-50/50"
            >
              <div className="p-6 flex-1">
                <div className="flex items-start justify-between">
                  <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 transition group-hover:scale-110">
                    <LuFileText className="text-2xl" />
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-full uppercase">
                    <LuClock />
                    {new Date(report.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <h3 className="mt-6 text-xl font-bold text-slate-900 line-clamp-1">{report.name}</h3>
                <p className="mt-2 text-sm text-slate-500 line-clamp-2 h-10">
                  {report.description || 'No description provided.'}
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                   <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                    {report.filters.range}
                   </span>
                   <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                    {report.filters.teamId === 'all' ? 'All Teams' : 'Scoped Team'}
                   </span>
                   {report.filters.product && (
                     <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                      {report.filters.product}
                     </span>
                   )}
                </div>
              </div>

              <div className="flex gap-1 border-t border-slate-100 p-2">
                <button
                  onClick={() => handleLoad(report)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-xs font-bold text-white transition hover:bg-indigo-700"
                >
                  <LuPlay className="text-sm" />
                  Load Report
                </button>
                <button
                  onClick={() => handleDelete(report._id)}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-rose-500 transition hover:bg-rose-50"
                  title="Delete Report"
                >
                  <LuTrash2 className="text-lg" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedReportsPage;
