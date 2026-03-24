import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import NotFoundPage from './pages/NotFoundPage';
import ProtectedRoute from './routes/ProtectedRoute';
import RoleProtectedRoute from './routes/RoleProtectedRoute';
import PublicRoute from './routes/PublicRoute';
import PersistLogin from './components/PersistLogin';
import MainLayout from './layouts/MainLayout';

// Target Dashboards
const GenericDashboard = () => <div><h2 className="text-2xl font-bold">Standard Dashboard</h2><p>Welcome to the generic landing area.</p></div>;
const SuperAdminDash = () => <div><h2 className="text-2xl font-bold text-indigo-700">Super Admin Zone</h2><p>Only Super Admins can see this.</p></div>;
const DataAnalystDash = () => <div><h2 className="text-2xl font-bold text-green-700">Data Analyst Zone</h2><p>Data Analytics reporting area.</p></div>;
const TeamLeadDash = () => <div><h2 className="text-2xl font-bold text-purple-700">Team Lead Zone</h2><p>Team management tools here.</p></div>;
const ManagerDash = () => <div><h2 className="text-2xl font-bold text-blue-700">Manager Zone</h2><p>Managers and above can see this.</p></div>;
const AgentDash = () => <div><h2 className="text-2xl font-bold text-gray-700">Agent Details</h2><p>Agent level generic access.</p></div>;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route element={<PublicRoute />}>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        
        {/* Protected Flow: Persist Login -> Check JWT -> Load Layout */}
        <Route element={<PersistLogin />}>
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              
              <Route path="/dashboard" element={<GenericDashboard />} />
              
              <Route element={<RoleProtectedRoute allowedRoles={['super_admin']} />}>
                <Route path="/admin-dash" element={<SuperAdminDash />} />
              </Route>
              
              <Route element={<RoleProtectedRoute allowedRoles={['data_analyst', 'super_admin']} />}>
                <Route path="/analyst-dash" element={<DataAnalystDash />} />
              </Route>

              <Route element={<RoleProtectedRoute allowedRoles={['team_lead', 'manager', 'super_admin']} />}>
                <Route path="/team-lead-dash" element={<TeamLeadDash />} />
              </Route>

              <Route element={<RoleProtectedRoute allowedRoles={['manager', 'super_admin']} />}>
                <Route path="/manager-dash" element={<ManagerDash />} />
              </Route>

              <Route element={<RoleProtectedRoute allowedRoles={['agent', 'team_lead', 'manager', 'data_analyst', 'super_admin']} />}>
                <Route path="/agent-dash" element={<AgentDash />} />
              </Route>

            </Route>
          </Route>
        </Route>
        
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
