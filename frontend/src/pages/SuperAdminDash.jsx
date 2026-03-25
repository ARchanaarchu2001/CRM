import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getAllUsersForAdmin, deactivateUser, resetState } from '../features/users/userManagementSlice';
import CreateUserForm from '../components/users/CreateUserForm';

const SuperAdminDash = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const dispatch = useDispatch();
  const { users, isLoading, isError, message, isSuccess } = useSelector(
    (state) => state.userManagement || {}
  );
  
  const [deactivatingId, setDeactivatingId] = useState(null);

  useEffect(() => {
    dispatch(getAllUsersForAdmin());
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
    if (window.confirm(`Are you absolutely sure you want to deactivate ${name}?`)) {
      setDeactivatingId(id);
      await dispatch(deactivateUser(id));
      setDeactivatingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Super Admin Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Manage all system users entirely.</p>
        </div>
        
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            showCreateForm 
              ? 'bg-slate-500 hover:bg-slate-600 focus:ring-slate-500'
              : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
          }`}
        >
          {showCreateForm ? (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close Form
            </>
          ) : (
            <>
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Create New User
            </>
          )}
        </button>
      </div>

      {showCreateForm && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300 ease-out mb-8">
          <CreateUserForm />
        </div>
      )}

      {/* Global User List */}
      <div className="mx-auto rounded-xl bg-white p-6 shadow-md border border-slate-200">
        <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">All System Users</h2>
            <p className="text-sm text-slate-500">Complete directory of all registered personnel.</p>
          </div>
          <div className="text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            Total: {users?.length || 0}
          </div>
        </div>

        {isSuccess && message === 'User deactivated successfully' && (
          <div className="mb-6 rounded-md bg-green-50 p-4 border border-green-200">
            <p className="text-sm font-medium text-green-800">{message}</p>
          </div>
        )}

        {isError && message && (
          <div className="mb-6 rounded-md bg-red-50 p-4 border border-red-200">
            <p className="text-sm font-medium text-red-800">{message}</p>
          </div>
        )}

        {isLoading && !deactivatingId && !showCreateForm ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"></div>
          </div>
        ) : users?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <p className="font-medium text-slate-700">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase text-slate-700">
                <tr>
                  <th scope="col" className="px-6 py-3 font-semibold border-b border-slate-200 rounded-tl-lg">User</th>
                  <th scope="col" className="px-6 py-3 font-semibold border-b border-slate-200">Role</th>
                  <th scope="col" className="px-6 py-3 font-semibold border-b border-slate-200">Contact Details</th>
                  <th scope="col" className="px-6 py-3 font-semibold border-b border-slate-200">Status</th>
                  <th scope="col" className="px-6 py-3 font-semibold border-b border-slate-200 rounded-tr-lg text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((user) => (
                  <tr key={user._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.profilePhoto ? (
                          <img 
                            src={`/uploads/${user.profilePhoto}`} 
                            alt={user.fullName} 
                            className="h-10 w-10 rounded-full object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-700 font-bold border border-slate-300">
                            {user.fullName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="font-semibold text-slate-900">{user.fullName}</div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 border border-indigo-200 uppercase">
                        {user.role.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-slate-800">{user.email}</div>
                      {user.phoneNumber && <div className="text-xs text-slate-500 mt-0.5">{user.phoneNumber}</div>}
                    </td>

                    <td className="px-6 py-4">
                      {user.isActive && !user.isDeleted ? (
                        <span className="text-emerald-600 font-medium">Active</span>
                      ) : (
                        <span className="text-rose-600 font-medium">Inactive</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      {user.role !== 'super_admin' && ( // Prevent admin self-delete logic loop simply here
                        <button
                          onClick={() => handleDeactivate(user._id, user.fullName)}
                          disabled={deactivatingId === user._id}
                          className="inline-flex items-center justify-center rounded bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm border border-red-200 hover:bg-red-50 hover:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          {deactivatingId === user._id ? 'Removing...' : 'Deactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminDash;
