import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '../features/auth/authSlice.js';

const MainLayout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, role } = useSelector((state) => state.auth);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/login');
  };

  const links = [
    { to: role === 'agent' ? '/agent-dash' : '/dashboard', label: 'Home', show: true },
    { to: '/admin-dash', label: 'Admin Dashboard', show: ['super_admin'].includes(role) },
    { to: '/analyst-dash', label: 'Analyst Workspace', show: ['data_analyst', 'super_admin'].includes(role) },
    { to: '/lead-settings', label: 'Lead Settings', show: ['data_analyst', 'super_admin'].includes(role) },
    { to: '/agent-dash', label: 'Agent Board', show: ['super_admin'].includes(role) },
    { to: '/agent-pipeline', label: 'Pipeline', show: ['agent', 'super_admin'].includes(role) },
    { to: '/manager-dash', label: 'Manager', show: ['manager', 'super_admin'].includes(role) },
    { to: '/team-lead-dash', label: 'Team Lead', show: ['team_lead', 'manager', 'super_admin'].includes(role) },
    { to: '/team-lead-settings', label: 'Settings', show: ['team_lead'].includes(role) },
    { to: '/admin-conversion', label: 'Product Conversion', show: ['super_admin'].includes(role) },
    { to: '/analyst-dash', label: 'Analyst Workspace', show: ['data_analyst'].includes(role) },
    { to: '/analyst-overview', label: 'Analyst Overview', show: ['data_analyst'].includes(role) },
    { to: '/analyst-agent-performance', label: 'Agent Performance', show: ['data_analyst'].includes(role) },
    { to: '/lead-settings', label: 'Lead Settings', show: ['data_analyst'].includes(role) },
    { to: '/agent-dash', label: 'Agent Board', show: ['agent'].includes(role) },
    { to: '/agent-pipeline', label: 'Pipeline', show: ['agent'].includes(role) },
    { to: '/manager-dash', label: 'Manager', show: ['manager'].includes(role) },
    { to: '/team-lead-dash', label: 'Team Lead', show: ['team_lead', 'manager'].includes(role) },
    { to: '/team-lead-conversion', label: 'Data Conversion', show: ['team_lead'].includes(role) },
    { to: '/team-lead-settings', label: 'Settings', show: ['team_lead'].includes(role) },
    { to: '/admin-settings', label: 'Settings', show: ['super_admin'].includes(role) },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Lead Distribution Workspace</h1>
              <p className="text-sm text-slate-500">Upload, assign, and track cold-calling lead activity.</p>
            </div>
            <div className="flex items-center space-x-4">
              {user && (
                <span className="text-sm text-slate-600">
                  Logged in as <strong>{user.email}</strong> ({role})
                </span>
              )}
              <button
                onClick={handleLogout}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 transition"
              >
                Logout
              </button>
            </div>
          </div>

          <nav className="flex flex-wrap gap-2">
            {links
              .filter((link) => link.show)
              .map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                >
                  {link.label}
                </Link>
              ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
