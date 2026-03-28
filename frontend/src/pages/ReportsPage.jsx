import React, { useState, useEffect } from 'react';
import { FaDownload, FaFileExcel, FaTrash, FaSyncAlt } from 'react-icons/fa';
import ReportsTable from '../components/ReportsTable';
import {
  getLeadReport,
  getAgentPerformanceReport,
  getDailyReport,
  getWeeklyReport,
  getMonthlyReport,
  getAllReports,
  saveReport,
  deleteReport,
  exportReportAsExcel,
  fetchLeadsForReport,
  fetchAgentsForReport,
} from '../api/reports.js';

// Helper function to get current week number
function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('generate'); // generate, saved
  const [category, setCategory] = useState(''); // agent, sales
  const [timePeriod, setTimePeriod] = useState('daily'); // daily, weekly, monthly
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('all');
  const [selectedDataset, setSelectedDataset] = useState('all');
  const [reportName, setReportName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentWeek, setCurrentWeek] = useState(getWeekNumber(new Date()));
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const [generatedReport, setGeneratedReport] = useState(null);
  const [savedReports, setSavedReports] = useState([]);
  const [leads, setLeads] = useState([]);
  const [agents, setAgents] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  const showMessage = (type, text) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage({ type: '', text: '' }), 3000);
  };

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch leads
      try {
        const leadsResponse = await fetchLeadsForReport();
        console.log('Leads Response:', leadsResponse);
        const leadsArray = leadsResponse.leads || [];
        console.log('Leads Array:', leadsArray);
        setLeads(leadsArray);
        
        // Extract unique datasets/batch names
        const uniqueDatasets = [...new Set(leadsArray.map(lead => lead.batchName))].sort();
        setDatasets(uniqueDatasets);
        
        if (leadsArray.length === 0) {
          console.warn('No leads returned from API');
        }
      } catch (leadsError) {
        console.error('Error fetching leads:', leadsError);
        showMessage('error', 'Failed to load leads: ' + leadsError.message);
      }

      // Fetch agents
      try {
        const agentsResponse = await fetchAgentsForReport();
        console.log('Agents Response:', agentsResponse);
        const agentsArray = agentsResponse.data || [];
        console.log('Agents Array:', agentsArray);
        setAgents(agentsArray);
        if (agentsArray.length === 0) {
          console.warn('No agents returned from API');
        }
      } catch (agentsError) {
        console.error('Error fetching agents:', agentsError);
        showMessage('error', 'Failed to load agents: ' + agentsError.message);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      showMessage('error', 'Failed to load initial data');
    } finally {
      setIsLoading(false);
    }
  };

  // Load leads, agents and saved reports on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'saved') {
      loadSavedReports();
    }
  }, [activeTab]);

  const loadSavedReports = async () => {
    try {
      setIsLoading(true);
      const response = await getAllReports();
      setSavedReports(response.data || []);
    } catch (error) {
      showMessage('error', 'Failed to load saved reports');
    } finally {
      setIsLoading(false);
    }
  };

  const generateReport = async () => {
    try {
      if (!category) {
        showMessage('error', 'Please select Agent or Sales');
        return;
      }

      setIsLoading(true);
      setGeneratedReport(null);

      let response;
      let newReportName = reportName;
      let reportType = category === 'agent' ? 'agent_performance' : 'lead';

      const agentParams =
        selectedAgentId && selectedAgentId !== 'all'
          ? { agentId: selectedAgentId }
          : {};
      const datasetParams =
        selectedDataset && selectedDataset !== 'all'
          ? { dataset: selectedDataset }
          : {};

      if (category === 'agent') {
        const selectedAgent = agents.find(a => a._id === selectedAgentId);

        if (timePeriod === 'daily') {
          response = await getDailyReport(customDate, agentParams);
          newReportName =
            newReportName ||
            `Daily Agent Report - ${selectedAgent?.fullName || 'All Agents'} (${customDate})`;
        } else if (timePeriod === 'weekly') {
          response = await getWeeklyReport(currentWeek, currentYear, agentParams);
          newReportName =
            newReportName ||
            `Weekly Agent Report - ${selectedAgent?.fullName || 'All Agents'} (Week ${currentWeek}/${currentYear})`;
        } else if (timePeriod === 'monthly') {
          response = await getMonthlyReport(currentMonth, currentYear, agentParams);
          newReportName =
            newReportName ||
            `Monthly Agent Report - ${selectedAgent?.fullName || 'All Agents'} (${currentMonth}/${currentYear})`;
        }
      } else if (category === 'sales') {
        const datasetLabel =
          selectedDataset && selectedDataset !== 'all'
            ? selectedDataset
            : 'All Datasets';

        if (timePeriod === 'daily') {
          response = await getDailyReport(customDate, datasetParams);
          newReportName = newReportName || `Daily Report - ${datasetLabel} (${customDate})`;
        } else if (timePeriod === 'weekly') {
          response = await getWeeklyReport(currentWeek, currentYear, datasetParams);
          newReportName =
            newReportName ||
            `Weekly Report - ${datasetLabel} (Week ${currentWeek}/${currentYear})`;
        } else if (timePeriod === 'monthly') {
          response = await getMonthlyReport(currentMonth, currentYear, datasetParams);
          newReportName =
            newReportName || `Monthly Report - ${datasetLabel} (${currentMonth}/${currentYear})`;
        }
      }

      setGeneratedReport({
        ...response.data,
        name: newReportName,
        type: reportType,
      });
      showMessage('success', 'Report generated successfully');
    } catch (error) {
      showMessage(
        'error',
        error.response?.data?.message || 'Failed to generate report'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveReport = async () => {
    if (!generatedReport) {
      showMessage('error', 'No report to save');
      return;
    }

    try {
      setIsLoading(true);
      const reportType = category === 'agent' ? 'agent_performance' : 'lead';
      const reportData = {
        reportType: reportType,
        reportName: generatedReport.name,
        reportData: generatedReport,
        summary: generatedReport.summary || {},
        dateRange: generatedReport.dateRange || {
          startDate: new Date(),
          endDate: new Date(),
        },
      };

      await saveReport(reportData);
      showMessage('success', 'Report saved successfully');
      setGeneratedReport(null);
      setReportName('');
    } catch (error) {
      showMessage('error', 'Failed to save report');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('Are you sure you want to delete this report?')) {
      return;
    }

    try {
      setIsLoading(true);
      await deleteReport(reportId);
      showMessage('success', 'Report deleted successfully');
      loadSavedReports();
    } catch (error) {
      showMessage('error', 'Failed to delete report');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadReport = () => {
    if (!generatedReport) return;
    const fileName = `${generatedReport.name.replace(/\s+/g, '_')}.xlsx`;
    exportReportAsExcel(generatedReport, fileName);
  };

  // Render report data based on type
  const renderReportData = () => {
    if (!generatedReport) return null;

    // Display agent metrics table if available
    if (generatedReport.agentMetrics && generatedReport.agentMetrics.length > 0) {
      const reportTitle = `Agent Metrics - ${generatedReport.reportDate || generatedReport.period || ''}`;
      return <ReportsTable agentMetrics={generatedReport.agentMetrics} reportTitle={reportTitle} />;
    }

    switch (timePeriod) {
      case 'daily':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded bg-blue-50 p-4">
                <p className="text-sm text-gray-600">Total Assignments</p>
                <p className="text-2xl font-bold text-blue-600">
                  {generatedReport.totalAssignments}
                </p>
              </div>
              {Object.entries(generatedReport.statusBreakdown || {}).map(
                ([status, count]) => (
                  <div key={status} className="rounded bg-green-50 p-4">
                    <p className="text-sm text-gray-600 capitalize">{status}</p>
                    <p className="text-2xl font-bold text-green-600">{count}</p>
                  </div>
                )
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-3 font-semibold">Contact Status</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left">Status</th>
                      <th className="text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(
                      generatedReport.contactabilityBreakdown || {}
                    ).map(([status, count]) => (
                      <tr key={status} className="border-b">
                        <td>{status || 'Not Set'}</td>
                        <td className="text-right font-semibold">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="mb-3 font-semibold">Product Breakdown</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left">Product</th>
                      <th className="text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(generatedReport.productBreakdown || {}).map(
                      ([product, count]) => (
                        <tr key={product} className="border-b">
                          <td className="capitalize">{product}</td>
                          <td className="text-right font-semibold">{count}</td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case 'weekly':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded bg-blue-50 p-4">
                <p className="text-sm text-gray-600">Total Assignments</p>
                <p className="text-2xl font-bold text-blue-600">
                  {generatedReport.totalAssignments}
                </p>
              </div>
              {Object.entries(generatedReport.statusBreakdown || {}).map(
                ([status, count]) => (
                  <div key={status} className="rounded bg-green-50 p-4">
                    <p className="text-sm text-gray-600 capitalize">{status}</p>
                    <p className="text-2xl font-bold text-green-600">{count}</p>
                  </div>
                )
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-3 font-semibold">Contact Status</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left">Status</th>
                      <th className="text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(
                      generatedReport.contactabilityBreakdown || {}
                    ).map(([status, count]) => (
                      <tr key={status} className="border-b">
                        <td>{status || 'Not Set'}</td>
                        <td className="text-right font-semibold">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="mb-3 font-semibold">Product Breakdown</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left">Product</th>
                      <th className="text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(generatedReport.productBreakdown || {}).map(
                      ([product, count]) => (
                        <tr key={product} className="border-b">
                          <td className="capitalize">{product}</td>
                          <td className="text-right font-semibold">{count}</td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case 'monthly':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded bg-blue-50 p-4">
                <p className="text-sm text-gray-600">Total Assignments</p>
                <p className="text-2xl font-bold text-blue-600">
                  {generatedReport.totalAssignments}
                </p>
              </div>
              <div className="rounded bg-green-50 p-4">
                <p className="text-sm text-gray-600">Completion Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {(generatedReport.summary?.completionRate || 0).toFixed(2)}%
                </p>
              </div>
              <div className="rounded bg-purple-50 p-4">
                <p className="text-sm text-gray-600">Conversions</p>
                <p className="text-2xl font-bold text-purple-600">
                  {generatedReport.summary?.conversions || 0}
                </p>
              </div>
            </div>

            <div>
              <h3 className="mb-3 font-semibold">Agent Performance</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-4 py-2 text-left">Agent</th>
                      <th className="px-4 py-2 text-right">Assignments</th>
                      <th className="px-4 py-2 text-right">Completed</th>
                      <th className="px-4 py-2 text-right">Reachable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(generatedReport.agentPerformance || []).map((agent) => (
                      <tr key={agent.agentId} className="border-b">
                        <td className="px-4 py-2">{agent.agentName}</td>
                        <td className="px-4 py-2 text-right">
                          {agent.totalAssignments}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {agent.completed}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {agent.reachable}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Reports</h1>
          <p className="text-gray-600">
            Generate and manage various CRM reports
          </p>
        </div>

        {/* Status Message */}
        {statusMessage.text && (
          <div
            className={`mb-4 rounded p-4 ${
              statusMessage.type === 'success'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b">
          <button
            onClick={() => setActiveTab('generate')}
            className={`px-4 py-2 font-semibold ${
              activeTab === 'generate'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Generate Report
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-2 font-semibold ${
              activeTab === 'saved'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Saved Reports
          </button>
        </div>

        {/* Generate Report Tab */}
        {activeTab === 'generate' && (
          <div className="space-y-6">
            {/* Category Selection */}
            <div className="rounded bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold">1. Select Category</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  { value: 'agent', label: 'Agent Performance' },
                  { value: 'sales', label: 'Sales / Leads' },
                ].map((cat) => (
                  <label
                    key={cat.value}
                    className="flex cursor-pointer items-center rounded border-2 p-4 hover:bg-gray-50"
                    style={{
                      borderColor: category === cat.value ? '#2563eb' : '#d1d5db',
                      backgroundColor: category === cat.value ? '#eff6ff' : 'white',
                    }}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={cat.value}
                      checked={category === cat.value}
                      onChange={(e) => setCategory(e.target.value)}
                      className="mr-3"
                    />
                    <span className="text-lg font-semibold">{cat.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Time Period Selection */}
            {category && (
              <div className="rounded bg-white p-6 shadow">
                <h2 className="mb-4 text-xl font-semibold">2. Select Time Period</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {[
                    { value: 'daily', label: 'Daily Report' },
                    { value: 'weekly', label: 'Weekly Report' },
                    { value: 'monthly', label: 'Monthly Report' },
                  ].map((period) => (
                    <label
                      key={period.value}
                      className="flex cursor-pointer items-center rounded border p-3 hover:bg-gray-50"
                    >
                      <input
                        type="radio"
                        name="timePeriod"
                        value={period.value}
                        checked={timePeriod === period.value}
                        onChange={(e) => setTimePeriod(e.target.value)}
                        className="mr-3"
                      />
                      <span>{period.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Report Parameters */}
            {category && (
              <div className="rounded bg-white p-6 shadow">
                <h2 className="mb-4 text-xl font-semibold">3. Report Parameters</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Report Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700">
                      Report Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                      placeholder="e.g., Daily Sales Report"
                      className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                    />
                  </div>

                  {/* Agent Selection (for Agent Performance) */}
                  {category === 'agent' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700">
                        Select Agent *
                      </label>
                      {agents.length === 0 ? (
                        <p className="mt-1 text-sm text-gray-500">
                          Loading agents... {isLoading && 'Please wait'}
                        </p>
                      ) : (
                        <select
                          value={selectedAgentId}
                          onChange={(e) => setSelectedAgentId(e.target.value)}
                          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                        >
                                <option value="all">All Agents</option>
                          {agents.map((agent) => (
                            <option key={agent._id} value={agent._id}>
                              {agent.fullName} ({agent.email})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {/* Daily Report - Date */}
                  {timePeriod === 'daily' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700">
                        Select Date
                      </label>
                      <input
                        type="date"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                      />
                    </div>
                  )}

                  {/* Weekly Report - Week & Year */}
                  {timePeriod === 'weekly' && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700">
                          Week (1-53)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="53"
                          value={currentWeek}
                          onChange={(e) =>
                            setCurrentWeek(parseInt(e.target.value))
                          }
                          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700">
                        Year
                      </label>
                      <select
                        value={currentYear}
                        onChange={(e) =>
                          setCurrentYear(parseInt(e.target.value))
                        }
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                      >
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = new Date().getFullYear() - 2 + i;
                          return (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </>
                )}

                {/* Monthly Report - Month & Year */}
                {timePeriod === 'monthly' && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700">
                        Month
                      </label>
                      <select
                        value={currentMonth}
                        onChange={(e) =>
                          setCurrentMonth(parseInt(e.target.value))
                        }
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(
                          (month) => (
                            <option key={month} value={month}>
                              {new Date(2000, month - 1).toLocaleString(
                                'default',
                                { month: 'long' }
                              )}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700">
                        Year
                      </label>
                      <select
                        value={currentYear}
                        onChange={(e) =>
                          setCurrentYear(parseInt(e.target.value))
                        }
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                      >
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = new Date().getFullYear() - 2 + i;
                          return (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </>
                )}

                {/* Sales/Lead Report - Dataset Selection */}
                {category === 'sales' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700">
                      Select Dataset *
                    </label>
                    {datasets.length === 0 ? (
                      <p className="mt-1 text-sm text-gray-500">
                        Loading datasets... {isLoading && 'Please wait'}
                      </p>
                    ) : (
                      <select
                        value={selectedDataset}
                        onChange={(e) => setSelectedDataset(e.target.value)}
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                      >
                        <option value="all">All Datasets</option>
                        {datasets.map((dataset) => (
                          <option key={dataset} value={dataset}>
                            {dataset}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Generate Button */}
            {category && (
              <button
                onClick={generateReport}
                disabled={isLoading}
                className="mt-6 flex items-center gap-2 rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <FaSyncAlt /> {isLoading ? 'Generating...' : 'Generate Report'}
              </button>
            )}

            {/* Generated Report Display */}
            {generatedReport && (
              <div className="rounded bg-white p-6 shadow">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">
                    {generatedReport.name}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownloadReport}
                      className="flex items-center gap-2 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                    >
                      <FaDownload /> Download
                    </button>
                    <button
                      onClick={handleSaveReport}
                      disabled={isLoading}
                      className="flex items-center gap-2 rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-50"
                    >
                      <FaFileExcel /> Save Report
                    </button>
                  </div>
                </div>
                {renderReportData()}
              </div>
            )}
          </div>
        )}

        {/* Saved Reports Tab */}
        {activeTab === 'saved' && (
          <div>
            {isLoading ? (
              <p className="text-center text-gray-600">Loading reports...</p>
            ) : savedReports.length === 0 ? (
              <p className="text-center text-gray-600">No saved reports yet</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {savedReports.map((report) => (
                  <div
                    key={report._id}
                    className="flex flex-col rounded bg-white p-6 shadow"
                  >
                    <h3 className="mb-2 font-semibold text-gray-800">
                      {report.reportName}
                    </h3>
                    <p className="mb-3 text-sm text-gray-600">
                      <strong>Type:</strong>{' '}
                      {report.reportType.replace(/_/g, ' ')}
                    </p>
                    <p className="mb-3 text-sm text-gray-600">
                      <strong>Generated:</strong>{' '}
                      {new Date(report.createdAt).toLocaleDateString()}
                    </p>
                    <p className="mb-4 text-sm text-gray-600">
                      <strong>By:</strong> {report.generatedBy?.fullName}
                    </p>
                    <div className="mt-auto flex gap-2">
                      <button
                        onClick={() => {
                          setGeneratedReport({
                            ...report.reportData,
                            name: report.reportName,
                            type: report.reportType,
                          });
                          setActiveTab('generate');
                        }}
                        className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDeleteReport(report._id)}
                        className="flex-1 rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
                      >
                        <FaTrash className="inline mr-1" /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
