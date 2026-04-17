import React, { useEffect, useMemo } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '../features/auth/authSlice.js';
import { connectSocket, disconnectSocket, registerSocketPresence } from '../utils/socketClient.js';
import UserAvatar from '../components/UserAvatar.jsx';

const MainLayout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role } = useSelector((state) => state.auth);

  useEffect(() => {
    if (!user?._id) return;

    connectSocket();
    registerSocketPresence(user);

    return () => {
      disconnectSocket();
    };
  }, [user]);

  const handleLogout = async () => {
    disconnectSocket();
    await dispatch(logoutUser());
    navigate('/login');
  };

  const handleNavClick = (event, targetPath) => {
    if (!targetPath) {
      return;
    }

    if (role === 'agent' && /\/agent-dash\/[^/]+$/.test(location.pathname)) {
      event.preventDefault();
      window.location.assign(targetPath);
      return;
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const welcomeContent = useMemo(() => {
   const getDisplayName = () => {
  switch (role) {
    case 'super_admin':
      return 'Admin';

    case 'data_analyst':
      return 'Analyst'; // 👈 or 'Data Analyst' if you prefer

    case 'team_lead':
      return 'Team Lead';

    case 'manager':
      return 'Manager';

    case 'agent':
      return user?.fullName?.split(' ')[0] || '';

    default:
      return user?.fullName?.split(' ')[0] || '';
  }
};

const firstName = getDisplayName();

    switch (role) {
     case 'super_admin':
  return {
    title: `${getGreeting()}${firstName ? `, ${firstName}` : ''} 👋`,
    subtitle: 'Manage teams, monitor performance, and oversee system operations.',
    badge: 'Admin',
  };

      case 'team_lead':
        return {
          title: `${getGreeting()}${firstName ? `, ${firstName}` : ''} 👋`,
          subtitle: 'Track your agents, manage leads, and drive team performance.',
          badge: 'Team Lead',
        };

      case 'agent':
        return {
          title: `${getGreeting()}${firstName ? `, ${firstName}` : ''} 👋`,
          subtitle: 'Focus on your leads, update progress, and hit your targets.',
          badge: 'Agent',
        };

      case 'data_analyst':
        return {
          title: `${getGreeting()}${firstName ? `, ${firstName}` : ''} 👋`,
          subtitle: 'Analyze lead data, track trends, and generate insights.',
          badge: 'Data Analyst',
        };

      case 'manager':
        return {
          title: `${getGreeting()}${firstName ? `, ${firstName}` : ''} 👋`,
          subtitle: 'Monitor team performance, review activity, and support delivery.',
          badge: 'Manager',
        };

      default:
        return {
          title: `${getGreeting()}${firstName ? `, ${firstName}` : ''} 👋`,
          subtitle: 'Welcome back to your workspace.',
          badge: role || 'User',
        };
    }
  }, [role, user]);

  const links = [
    {
      to:
        role === 'agent'
          ? '/agent-dash'
          : role === 'data_analyst'
            ? '/analyst-dash'
            : '/dashboard',
      label: 'Home',
      show: true,
    },
    { to: '/admin-dash', label: 'Admin Dashboard', show: false },

    { to: '/analyst-dash', label: 'Analyst Workspace', show: false },
    { to: '/analyst-overview', label: 'Analyst Overview', show: ['data_analyst'].includes(role) },
    { to: '/analyst-reports', label: 'Advanced Reports', show: ['data_analyst', 'super_admin'].includes(role) },
    { to: '/analyst-saved-reports', label: 'Saved Reports', show: ['data_analyst', 'super_admin'].includes(role) },
    { to: '/analyst-agent-performance', label: 'Agent Performance', show: ['data_analyst'].includes(role) },
    { to: '/lead-settings', label: 'Lead Settings', show: ['data_analyst'].includes(role) },
    { to: '/analyst-settings', label: 'Settings', show: ['data_analyst'].includes(role) },

    { to: '/agent-pipeline', label: 'Pipeline', show: ['agent'].includes(role) },
    { to: '/agent-settings', label: 'Settings', show: ['agent'].includes(role) },

    { to: '/manager-dash', label: 'Manager', show: ['manager'].includes(role) },

    { to: '/team-lead-dash', label: 'Team Lead', show: ['manager'].includes(role) },
    { to: '/team-lead-conversion', label: 'Data Conversion', show: ['team_lead'].includes(role) },
    { to: '/team-lead-settings', label: 'Settings', show: ['team_lead'].includes(role) },

    { to: '/admin-conversion', label: 'Product Conversion', show: ['super_admin'].includes(role) },
    { to: '/admin-settings', label: 'Settings', show: ['super_admin'].includes(role) },
  ];

  const isWideTablePage =
    /\/agent-dash\/[^/]+$/.test(location.pathname) ||
    /\/agent-queue\/[^/]+$/.test(location.pathname) ||
    /\/analyst-dash\/[^/]+$/.test(location.pathname) ||
    /\/team-lead\/agents\/[^/]+\/batches\/[^/]+$/.test(location.pathname) ||
    /\/analyst\/agents\/[^/]+\/batches\/[^/]+$/.test(location.pathname) ||
    /\/team-lead\/agents\/[^/]+\/queue\/[^/]+$/.test(location.pathname);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <UserAvatar
                src={user?.profilePhoto}
                alt={user?.fullName || 'User avatar'}
                className="h-14 w-14 rounded-full border border-slate-200 object-cover shadow-sm"
              />
              <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900">{welcomeContent.title}</h1>
                {/* <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  {welcomeContent.badge}
                </span> */}
              </div>
              <p className="mt-1 text-sm text-slate-500">{welcomeContent.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {user && (
                <span className="text-sm text-slate-600">
                  Logged in as <strong>{user.email}</strong>
                </span>
              )}
              <button
                onClick={handleLogout}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white transition hover:bg-red-700"
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
                  onClick={(event) => handleNavClick(event, link.to)}
                  className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                >
                  {link.label}
                </Link>
              ))}
          </nav>
        </div>
      </header>

      <main className={`flex-1 w-full p-4 sm:p-5 lg:p-6 ${isWideTablePage ? 'max-w-none' : 'mx-auto max-w-7xl'}`}>
        <div key={location.pathname} className="min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
