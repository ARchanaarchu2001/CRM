import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getTeamLeadAgents, deactivateUser, resetState, updateAgentMetricsDirectly } from '../../features/users/userManagementSlice';
import { socket, connectSocket } from '../../utils/socketClient';

const AgentList = () => {
  const dispatch = useDispatch();
  const { users, isLoading, isError, message, isSuccess } = useSelector(
    (state) => state.userManagement || {}
  );
  
  const [deactivatingId, setDeactivatingId] = useState(null);

  useEffect(() => {
    dispatch(getTeamLeadAgents());

    connectSocket();
    const handleMetricsUpdate = (data) => {
      dispatch(updateAgentMetricsDirectly(data));
    };

    socket.on('agentMetricsUpdated', handleMetricsUpdate);

    return () => {
      socket.off('agentMetricsUpdated', handleMetricsUpdate);
    };
  }, [dispatch]);

  // Clean up success messages occasionally to avoid lingering banners
  useEffect(() => {
    if (isSuccess && message === 'User deactivated successfully') {
      const timer = setTimeout(() => {
        dispatch(resetState());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, message, dispatch]);

  const handleDeactivate = async (id, name) => {
    if (window.confirm(`Are you absolutely sure you want to deactivate ${name}? They will lose access immediately.`)) {
      setDeactivatingId(id);
      await dispatch(deactivateUser(id));
      setDeactivatingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl rounded-xl bg-white p-6 shadow-md border border-slate-200 mt-8">
      <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">My Managed Agents</h2>
          <p className="text-sm text-slate-500">View and manage agents currently assigned to your team.</p>
        </div>
        <div className="text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
          Total: {users?.length || 0}
        </div>
      </div>

      {isSuccess && message && (
        <div className="mb-6 rounded-md bg-green-50 p-4 border border-green-200">
          <p className="text-sm font-medium text-green-800">{message}</p>
        </div>
      )}

      {isError && message && (
        <div className="mb-6 rounded-md bg-red-50 p-4 border border-red-200">
          <p className="text-sm font-medium text-red-800">{message}</p>
        </div>
      )}

      {isLoading && !deactivatingId ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"></div>
        </div>
      ) : users?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          <svg className="w-12 h-12 mb-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="font-medium text-slate-700">No agents assigned yet</p>
          <p className="text-sm">Use the form to recruit and assign new agents.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-700">
              <tr>
                <th scope="col" className="px-6 py-3 font-semibold border-b border-slate-200 rounded-tl-lg">Agent</th>
                <th scope="col" className="px-6 py-3 font-semibold border-b border-slate-200 text-center">Daily Dials</th>
                <th scope="col" className="px-6 py-3 font-semibold border-b border-slate-200 text-center">Pending Leads</th>
                <th scope="col" className="px-6 py-3 font-semibold border-b border-slate-200 rounded-tr-lg text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((agent) => (
                <tr key={agent._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                  
                  {/* Avatar & Name */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {agent.profilePhoto ? (
                        <img 
                          src={`/uploads/${agent.profilePhoto}`} 
                          alt={agent.fullName} 
                          className="h-10 w-10 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold border border-indigo-200">
                          {agent.fullName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-slate-900">{agent.fullName}</div>
                        <div className="text-xs text-slate-500">Joined {new Date(agent.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </td>

                  {/* Daily Dials Metric */}
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[3rem] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                      {agent.dailyDialsCount || 0}
                    </span>
                  </td>

                  {/* Pending Leads Metric */}
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[3rem] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      {agent.pendingLeadsCount || 0}
                    </span>
                  </td>

                  {/* Action Buttons */}
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDeactivate(agent._id, agent.fullName)}
                      disabled={deactivatingId === agent._id}
                      className="inline-flex items-center justify-center rounded bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm border border-red-200 hover:bg-red-50 hover:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {deactivatingId === agent._id ? (
                        <>
                          <svg className="mr-1.5 h-3 w-3 animate-spin text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Removing...
                        </>
                      ) : (
                        'Deactivate'
                      )}
                    </button>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AgentList;
