import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FiDatabase, FiDownload, FiRefreshCw, FiShield, FiUsers } from 'react-icons/fi';
import { downloadDeveloperExport, fetchDeveloperDashboard } from '../api/developer.js';
import { formatMetricValue } from '../utils/dashboard.js';

const collectionLabels = {
  all: 'Everything',
  users: 'Accounts',
  leads: 'Leads',
  assignments: 'Assignments',
  imports: 'Imports',
  teams: 'Teams',
  savedReports: 'Saved Reports',
  remarkConfigs: 'Remark Configs',
};

const formatDateTime = (value) => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
};

const StatCard = ({ icon: Icon, label, value, tone = 'text-slate-900' }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <Icon className="text-lg text-slate-400" />
    </div>
    <p className={`mt-3 text-3xl font-extrabold tracking-tight ${tone}`}>{formatMetricValue(value)}</p>
  </article>
);

const SimpleBarChart = ({ data, dataKey = 'value', labelKey = 'label', color = '#2563eb' }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
      <XAxis dataKey={labelKey} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
      <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
      <Tooltip />
      <Bar dataKey={dataKey} fill={color} radius={[8, 8, 0, 0]} maxBarSize={42} />
    </BarChart>
  </ResponsiveContainer>
);

const DeveloperDashboardPage = () => {
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState('');
  const [exportLimit, setExportLimit] = useState(5000);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const data = await fetchDeveloperDashboard();
      setDashboard(data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Developer dashboard is not available');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const kpis = dashboard?.kpis || {};
  const exports = dashboard?.exports || [];

  const healthCards = useMemo(() => [
    { label: 'Accounts', value: kpis.totalUsers, icon: FiUsers },
    { label: 'Active Users', value: kpis.activeUsers, icon: FiShield, tone: 'text-emerald-700' },
    { label: 'Leads In DB', value: kpis.totalLeads, icon: FiDatabase },
    { label: 'Assignments', value: kpis.totalAssignments, icon: FiDatabase, tone: 'text-blue-700' },
    { label: 'Open Pipeline', value: kpis.pipelineOpen, icon: FiShield, tone: 'text-amber-700' },
    { label: 'Unassigned Leads', value: kpis.unassignedLeads, icon: FiDatabase, tone: 'text-rose-700' },
  ], [kpis]);

  const handleExport = async (collectionKey) => {
    setIsExporting(collectionKey);
    try {
      const blob = await downloadDeveloperExport(collectionKey, exportLimit);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `developer-${collectionKey}-${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`${collectionLabels[collectionKey] || collectionKey} export started`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Export failed');
    } finally {
      setIsExporting('');
    }
  };

  if (isLoading && !dashboard) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Developer Monitor</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">System Control Dashboard</h1>
            <p className="mt-2 text-sm text-slate-500">
              Full database visibility, assignment monitoring, account status, and controlled exports.
            </p>
          </div>
          <button
            type="button"
            onClick={loadDashboard}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <FiRefreshCw className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {healthCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="text-lg font-bold text-slate-900">Database Activity</h2>
          <p className="mt-1 text-sm text-slate-500">Recent assignment updates, submissions, activations, and reachable leads.</p>
          <div className="mt-5 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboard?.charts?.dailyActivity || []} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="devInteractions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="interactions" name="Interactions" stroke="#2563eb" strokeWidth={3} fill="url(#devInteractions)" />
                <Area type="monotone" dataKey="submitted" name="Submitted" stroke="#059669" strokeWidth={2} fill="transparent" />
                <Area type="monotone" dataKey="reachable" name="Reachable" stroke="#0f766e" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Download Data</h2>
          <p className="mt-1 text-sm text-slate-500">Exports are limited per sheet to keep downloads responsive.</p>
          <label className="mt-4 block text-xs font-bold uppercase text-slate-500" htmlFor="export-limit">Row Limit</label>
          <input
            id="export-limit"
            type="number"
            min="100"
            max="10000"
            step="100"
            value={exportLimit}
            onChange={(event) => setExportLimit(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <div className="mt-4 grid gap-2">
            {exports.map((collectionKey) => (
              <button
                key={collectionKey}
                type="button"
                onClick={() => handleExport(collectionKey)}
                disabled={Boolean(isExporting)}
                className="inline-flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                <span>{collectionLabels[collectionKey] || collectionKey}</span>
                {isExporting === collectionKey ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                ) : (
                  <FiDownload />
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Users By Role</h2>
          <div className="mt-5 h-[260px]">
            <SimpleBarChart data={dashboard?.charts?.usersByRole || []} color="#0f172a" />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Leads By Product</h2>
          <div className="mt-5 h-[260px]">
            <SimpleBarChart data={dashboard?.charts?.leadsByProduct || []} color="#2563eb" />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Assignment Status</h2>
          <div className="mt-5 h-[260px]">
            <SimpleBarChart data={dashboard?.charts?.assignmentsByStatus || []} color="#059669" />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">Who Data Is Assigned To</h2>
            <p className="mt-1 text-sm text-slate-500">Top agents by assigned records with outcomes.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3 text-right">Assigned</th>
                  <th className="px-4 py-3 text-right">Submitted</th>
                  <th className="px-4 py-3 text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(dashboard?.tables?.agentAssignments || []).map((row) => (
                  <tr key={row.agentId || row.agentName}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.agentName}</td>
                    <td className="px-4 py-3 text-slate-500">{row.team || 'Unassigned'}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatMetricValue(row.assigned)}</td>
                    <td className="px-4 py-3 text-right">{formatMetricValue(row.submitted)}</td>
                    <td className="px-4 py-3 text-right">{formatMetricValue(row.openPipeline)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">Dataset Status</h2>
            <p className="mt-1 text-sm text-slate-500">Batch size, assignment coverage, and duplicates.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-right">Leads</th>
                  <th className="px-4 py-3 text-right">Assigned Links</th>
                  <th className="px-4 py-3 text-right">Duplicates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(dashboard?.tables?.batchStats || []).map((row) => (
                  <tr key={row._id || row.batchName}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.batchName}</td>
                    <td className="px-4 py-3 uppercase text-slate-500">{row.product}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatMetricValue(row.totalLeads)}</td>
                    <td className="px-4 py-3 text-right">{formatMetricValue(row.assignedAgentCount)}</td>
                    <td className="px-4 py-3 text-right">{formatMetricValue((row.duplicateInFile || 0) + (row.duplicateInSystem || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Recent Accounts</h2>
          <div className="mt-4 space-y-3">
            {(dashboard?.tables?.recentUsers || []).map((user) => (
              <div key={user._id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                <div>
                  <p className="font-bold text-slate-900">{user.fullName}</p>
                  <p className="text-xs text-slate-500">{user.email} - {user.role}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${user.isActive && !user.isBlocked ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {user.isActive && !user.isBlocked ? 'Active' : 'Blocked'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Recent DB Changes</h2>
          <div className="mt-4 space-y-3">
            {(dashboard?.tables?.recentAssignments || []).map((item) => (
              <div key={item._id} className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-slate-900">{item.agent?.fullName || 'Unassigned'}</p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                    {item.status || 'new'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {item.batchName} - {String(item.product || '').toUpperCase()} - {formatDateTime(item.updatedAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default DeveloperDashboardPage;
