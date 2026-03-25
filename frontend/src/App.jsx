import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AgentDashboard from './pages/AgentDashboard';
import AnalystDashboard from './pages/AnalystDashboard';
import AnalystDatasetPage from './pages/AnalystDatasetPage';
import DashboardHome from './pages/DashboardHome';
import LeadSettingsPage from './pages/LeadSettingsPage';
import LoginPage from './pages/LoginPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import NotFoundPage from './pages/NotFoundPage';
import ProtectedRoute from './routes/ProtectedRoute';
import RoleProtectedRoute from './routes/RoleProtectedRoute';
import PublicRoute from './routes/PublicRoute';
import PersistLogin from './components/PersistLogin';
import MainLayout from './layouts/MainLayout';

const TeamLeadDash = () => <div><h2 className="text-2xl font-bold text-purple-700">Team Lead Zone</h2><p>Team management tools here.</p></div>;
const ManagerDash = () => <div><h2 className="text-2xl font-bold text-blue-700">Manager Zone</h2><p>Managers and above can see this.</p></div>;

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
              
              <Route path="/dashboard" element={<DashboardHome />} />
              
              <Route element={<RoleProtectedRoute allowedRoles={['super_admin']} />}>
                <Route path="/admin-dash" element={<AnalystDashboard />} />
              </Route>
              
              <Route element={<RoleProtectedRoute allowedRoles={['data_analyst', 'super_admin']} />}>
                <Route path="/analyst-dash" element={<AnalystDashboard />} />
                <Route path="/analyst-dash/:batchId" element={<AnalystDatasetPage />} />
                <Route path="/lead-settings" element={<LeadSettingsPage />} />
              </Route>

              <Route element={<RoleProtectedRoute allowedRoles={['team_lead', 'manager', 'super_admin']} />}>
                <Route path="/team-lead-dash" element={<TeamLeadDash />} />
              </Route>

              <Route element={<RoleProtectedRoute allowedRoles={['manager', 'super_admin']} />}>
                <Route path="/manager-dash" element={<ManagerDash />} />
              </Route>

              <Route element={<RoleProtectedRoute allowedRoles={['agent', 'super_admin']} />}>
                <Route path="/agent-dash" element={<AgentDashboard />} />
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
