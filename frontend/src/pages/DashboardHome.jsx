import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const DashboardHome = () => {
  const { role } = useSelector((state) => state.auth);

  if (role === 'super_admin' || role === 'data_analyst') {
    return <Navigate to="/analyst-dash" replace />;
  }

  if (role === 'agent') {
    return <Navigate to="/agent-dash" replace />;
  }

  if (role === 'manager') {
    return <Navigate to="/manager-dash" replace />;
  }

  if (role === 'team_lead') {
    return <Navigate to="/team-lead-dash" replace />;
  }

  return <div className="text-sm text-slate-600">No dashboard available for this role.</div>;
};

export default DashboardHome;
