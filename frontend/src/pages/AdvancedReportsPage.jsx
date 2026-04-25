import React, { useEffect, useState, useMemo } from 'react';
import ReportFilterPanel from '../components/dashboard/ReportFilterPanel.jsx';
import KpiCardGrid from '../components/dashboard/KpiCardGrid.jsx';
import AdvancedTrendChart from '../components/dashboard/AdvancedTrendChart.jsx';
import AgentLeaderboard from '../components/dashboard/AgentLeaderboard.jsx';
import DistributionPieCharts from '../components/dashboard/DistributionPieCharts.jsx';
import DetailedInteractionLog from '../components/dashboard/DetailedInteractionLog.jsx';
import { fetchLeadMetadata, fetchAdvancedReports, downloadAdvancedReportExport, saveReport } from '../api/leads.js';
import { getDefaultDashboardFilter, buildDashboardParams, formatMetricValue } from '../utils/dashboard.js';
import { LuDownload, LuSave } from 'react-icons/lu';
import { toast } from 'react-toastify';
import { useSearchParams } from 'react-router-dom';
import SaveReportModal from '../components/dashboard/SaveReportModal.jsx';

const AdvancedReportsPage = () => {
  const [searchParams] = useSearchParams();
  
  const [filter, setFilter] = useState({
    ...getDefaultDashboardFilter(),
    range: searchParams.get('range') || getDefaultDashboardFilter().range,
    from: searchParams.get('from') || getDefaultDashboardFilter().from,
    to: searchParams.get('to') || getDefaultDashboardFilter().to,
    teamId: searchParams.get('teamId') || 'all',
    agentId: searchParams.get('agentId') || 'all',
    importBatchId: searchParams.get('importBatchId') || '',
    product: searchParams.get('product') || '',
  });
  
  const [metadata, setMetadata] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isSavedModalOpen, setIsSavedModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // 1. Initial Metadata Load (Teams, Agents, Batches)
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const data = await fetchLeadMetadata();
        setMetadata(data);
      } catch (err) {
        console.error('Failed to load report metadata', err);
      }
    };
    loadMetadata();
  }, []);

  // 2. Fetch Report Data whenever filters change
  useEffect(() => {
    const loadReport = async () => {
      setIsLoading(true);
      setError('');
      try {
        const params = {
          ...buildDashboardParams(filter),
          teamId: filter.teamId,
          agentId: filter.agentId,
          importBatchId: filter.importBatchId,
          product: filter.product,
        };
        const response = await fetchAdvancedReports(params);
        setReportData(response.report);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to generate report');
      } finally {
        setIsLoading(false);
      }
    };

    loadReport();
  }, [filter]);

  const handleFilterChange = (updates) => {
    setFilter(prev => ({ ...prev, ...updates }));
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = {
        ...buildDashboardParams(filter),
        teamId: filter.teamId,
        agentId: filter.agentId,
        importBatchId: filter.importBatchId,
        product: filter.product,
      };
      
      const blob = await downloadAdvancedReportExport(params);
      
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      
      const fileName = `Report_${filter.range}_${new Date().getTime()}.xlsx`;
      link.setAttribute('download', fileName);
      
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      
      toast.success('Excel report generated successfully');
    } catch (err) {
      console.error('Export failed', err);
      toast.error('Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveReport = async (reportData) => {
    setIsSaving(true);
    try {
      await saveReport(reportData);
      toast.success('Report configurations saved!');
      setIsSavedModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save report');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 py-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <section className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
            Analytics Module
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Advanced Reports
          </h1>
          <p className="mt-2 text-lg text-slate-600 max-w-2xl">
            Get granular insights into sales performance across teams, agents, and custom time horizons.
          </p>
        </div>
        
        {reportData?.filter && (
          <div className="flex items-center gap-4">
            <div className="hidden rounded-2xl bg-slate-50 p-4 border border-slate-100 sm:block text-right">
              <p className="text-xs font-bold uppercase text-slate-400">Current Window</p>
              <p className="mt-1 text-sm font-bold text-slate-700">{reportData.filter.displayLabel}</p>
            </div>
            
            <button
              onClick={handleExport}
              disabled={isExporting || isLoading}
              className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 hover:shadow-indigo-300 disabled:opacity-50"
            >
              {isExporting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <LuDownload className="text-lg" />
              )}
              {isExporting ? 'Generating...' : 'Export Excel'}
            </button>

            <button
               onClick={() => setIsSavedModalOpen(true)}
               disabled={isLoading}
               className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <LuSave className="text-lg text-indigo-600" />
              Save Report
            </button>
          </div>
        )}
      </section>

      {/* Filter Section */}
      <ReportFilterPanel 
        filter={filter} 
        onChange={handleFilterChange} 
        metadata={metadata || {}} 
        isLoading={isLoading}
      />

      {error ? (
        <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-sm font-bold text-rose-700 flex items-center gap-3">
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
          {error}
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className={`${isLoading ? 'opacity-50 pointer-events-none' : ''} transition-opacity`}>
            <KpiCardGrid kpis={reportData?.kpis || []} agentData={reportData?.agentTable || []} />
          </div>

          <div className={`grid gap-8 lg:grid-cols-3 ${isLoading ? 'opacity-50 pointer-events-none' : ''} transition-opacity`}>
             {/* Trend Analysis */}
             <div className="lg:col-span-2">
                <AdvancedTrendChart 
                  data={reportData?.charts?.trend || []} 
                  title="Performance Trends"
                  description="Visualize the velocity of calls and submissions across the selected time period."
                />
             </div>

             {/* Distribution Mix */}
             <div className="flex flex-col gap-8">
                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100 flex flex-col justify-center text-center">
                  <p className="text-sm font-bold text-slate-500 uppercase">Avg Daily Dials</p>
                  <p className="mt-2 text-5xl font-extrabold text-indigo-600">
                    {reportData?.summary?.dials && reportData?.charts?.trend?.length > 0
                      ? (reportData.summary.dials / reportData.charts.trend.length).toFixed(1)
                      : '0'}
                  </p>
                  <p className="mt-2 text-xs text-slate-400 font-medium">Per interval in scope</p>
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100 flex flex-col justify-center text-center">
                  <p className="text-sm font-bold text-emerald-600 uppercase">Conversion Efficiency</p>
                  <p className="mt-2 text-5xl font-extrabold text-slate-900">
                    {reportData?.summary?.dials > 0
                      ? ((reportData.summary.submissions / reportData.summary.dials) * 100).toFixed(1)
                      : '0'}%
                  </p>
                  <p className="mt-2 text-xs text-slate-400 font-medium">Submissions vs Total Dials</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Connected', value: reportData?.summary?.connectCallCount || 0, tone: 'text-blue-700' },
                    { label: 'Reachable', value: reportData?.summary?.reachableCount || 0, tone: 'text-teal-700' },
                    { label: 'Open', value: reportData?.summary?.pipelineCount || 0, tone: 'text-slate-900' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm ring-1 ring-slate-100">
                      <p className="text-[11px] font-bold uppercase text-slate-500">{item.label}</p>
                      <p className={`mt-2 text-2xl font-extrabold ${item.tone}`}>{formatMetricValue(item.value)}</p>
                    </div>
                  ))}
                </div>
             </div>
          </div>

          {/* Deep Dive Distribution */}
          <div className={`${isLoading ? 'opacity-50 pointer-events-none' : ''} transition-opacity`}>
            <DistributionPieCharts 
              kpis={reportData?.kpis || []} 
              products={reportData?.charts?.productPerformance || []} 
            />
          </div>

          {/* Performance Rankings */}
          <div className={`${isLoading ? 'opacity-50 pointer-events-none' : ''} transition-opacity`}>
            <AgentLeaderboard 
              data={reportData?.charts?.agentSubmissions || []} 
              title="Agent Performance Rankings"
              description="Rank your team members by total submissions and conversion efficiency."
            />
          </div>

          {/* Detailed Interaction Log */}
          <div className={`${isLoading ? 'opacity-50 pointer-events-none' : ''} transition-opacity pt-4`}>
             <DetailedInteractionLog 
               data={reportData?.detailedLogs || []} 
               isLoading={isLoading}
             />
          </div>
        </>
      )}

      {/* Footer Insight */}
      <footer className="text-center py-6 text-slate-400 text-sm italic">
        Report generated based on {formatMetricValue(reportData?.summary?.dials || 0)} recorded interactions.
      </footer>

      <SaveReportModal 
        isOpen={isSavedModalOpen}
        onClose={() => setIsSavedModalOpen(false)}
        onSave={handleSaveReport}
        filters={filter}
        isSaving={isSaving}
      />
    </div>
  );
};

export default AdvancedReportsPage;
