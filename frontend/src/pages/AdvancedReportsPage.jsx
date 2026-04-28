import React, { useEffect, useState, useMemo } from 'react';
import ReportFilterPanel from '../components/dashboard/ReportFilterPanel.jsx';
import UserReportList from '../components/dashboard/UserReportList.jsx';
import DatasetReportList from '../components/dashboard/DatasetReportList.jsx';
import UserDrilldownView from '../components/dashboard/UserDrilldownView.jsx';
import DatasetDrilldownView from '../components/dashboard/DatasetDrilldownView.jsx';
import SaveReportModal from '../components/dashboard/SaveReportModal.jsx';

import { 
  fetchLeadMetadata, 
  fetchAdvancedReports, 
  fetchAdvancedUserReport, 
  fetchAdvancedBatchReport,
  downloadAdvancedReportExport, 
  saveReport 
} from '../api/leads.js';
import { getDefaultDashboardFilter, buildDashboardParams, formatMetricValue } from '../utils/dashboard.js';
import { LuDownload, LuSave, LuUsers, LuDatabase, LuFileText } from 'react-icons/lu';
import { toast } from 'react-toastify';
import { useSearchParams } from 'react-router-dom';

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
  
  // Summary State
  const [summaryData, setSummaryData] = useState(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  
  // Perspective State
  const [viewPerspective, setViewPerspective] = useState('user'); // 'user' or 'dataset'
  
  // Drill-down State
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userReportData, setUserReportData] = useState(null);
  const [isUserReportLoading, setIsUserReportLoading] = useState(false);
  
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [batchReportData, setBatchReportData] = useState(null);
  const [isBatchReportLoading, setIsBatchReportLoading] = useState(false);
  
  const [isExporting, setIsExporting] = useState(false);
  const [isSavedModalOpen, setIsSavedModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // 1. Initial Metadata Load
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

  // 2. Fetch Summary Report Data whenever filters change
  useEffect(() => {
    const loadSummaryReport = async () => {
      setIsSummaryLoading(true);
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
        setSummaryData(response.report);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to generate report');
      } finally {
        setIsSummaryLoading(false);
      }
    };

    loadSummaryReport();
  }, [filter]);

  // 3. Fetch User Drill-down Data
  useEffect(() => {
    if (!selectedUserId) {
      setUserReportData(null);
      return;
    }
    const loadUserReport = async () => {
      setIsUserReportLoading(true);
      try {
        const params = {
          ...buildDashboardParams(filter),
          teamId: filter.teamId,
          importBatchId: filter.importBatchId,
          product: filter.product,
        };
        const response = await fetchAdvancedUserReport(selectedUserId, params);
        setUserReportData(response.report);
      } catch (err) {
        toast.error('Failed to load user details');
        setUserReportData(null);
      } finally {
        setIsUserReportLoading(false);
      }
    };
    loadUserReport();
  }, [selectedUserId, filter]);

  // 4. Fetch Dataset Drill-down Data
  useEffect(() => {
    if (!selectedBatchId) {
      setBatchReportData(null);
      return;
    }
    const loadBatchReport = async () => {
      setIsBatchReportLoading(true);
      try {
        const params = {
          ...buildDashboardParams(filter),
          teamId: filter.teamId,
          agentId: filter.agentId,
          product: filter.product,
        };
        const response = await fetchAdvancedBatchReport(selectedBatchId, params);
        setBatchReportData(response.report);
      } catch (err) {
        toast.error('Failed to load dataset details');
        setBatchReportData(null);
      } finally {
        setIsBatchReportLoading(false);
      }
    };
    loadBatchReport();
  }, [selectedBatchId, filter]);

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
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      {/* Top Section */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 z-10 px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
              <span className="bg-indigo-100 text-indigo-700 p-2 rounded-xl">
                <LuFileText className="text-xl" />
              </span>
              Advanced Reporting
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Multi-perspective insights into users and datasets.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center">
              <button
                onClick={() => setViewPerspective('user')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                  viewPerspective === 'user' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <LuUsers /> User View
              </button>
              <button
                onClick={() => setViewPerspective('dataset')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                  viewPerspective === 'dataset' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <LuDatabase /> Dataset View
              </button>
            </div>
            
            <button
              onClick={handleExport}
              disabled={isExporting || isSummaryLoading}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
            >
              {isExporting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <LuDownload />}
              Export
            </button>
            <button
               onClick={() => setIsSavedModalOpen(true)}
               disabled={isSummaryLoading}
               className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <LuSave className="text-indigo-600" /> Save
            </button>
          </div>
        </div>

        <ReportFilterPanel 
          filter={filter} 
          onChange={handleFilterChange} 
          metadata={metadata || {}} 
          isLoading={isSummaryLoading}
        />
        
        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700 flex items-center gap-2">
            {error}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex relative">
        {isSummaryLoading && !summaryData && (
          <div className="absolute inset-0 z-50 bg-white/50 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600 mb-4" />
              <p className="text-slate-500 font-medium">Aggregating report data...</p>
            </div>
          </div>
        )}

        {/* Sidebar List */}
        <div className="w-80 flex-shrink-0 z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
          {viewPerspective === 'user' ? (
            <UserReportList 
              users={summaryData?.agentTable || []} 
              selectedUserId={selectedUserId} 
              onSelectUser={setSelectedUserId} 
            />
          ) : (
            <DatasetReportList 
              datasets={summaryData?.datasetTable || []} 
              selectedBatchId={selectedBatchId} 
              onSelectBatch={setSelectedBatchId} 
            />
          )}
        </div>

        {/* Drill-down View */}
        <div className="flex-1 overflow-hidden flex flex-col relative z-0">
          {viewPerspective === 'user' ? (
            <UserDrilldownView report={userReportData} isLoading={isUserReportLoading} />
          ) : (
            <DatasetDrilldownView report={batchReportData} isLoading={isBatchReportLoading} />
          )}
        </div>
      </div>

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
