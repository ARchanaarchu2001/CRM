import React, { useState } from 'react';
import { LuSearch, LuUser, LuChevronRight } from 'react-icons/lu';

const UserReportList = ({ users, selectedUserId, onSelectUser }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter((user) =>
    user.agentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.teamName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="p-4 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Users</h2>
        <div className="relative">
          <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search users..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredUsers.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-500">No users found.</div>
        ) : (
          filteredUsers.map((user) => (
            <button
              key={user.agentId}
              onClick={() => onSelectUser(user.agentId)}
              className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 group ${
                selectedUserId === user.agentId
                  ? 'bg-indigo-50 border border-indigo-100 shadow-sm'
                  : 'hover:bg-slate-50 border border-transparent'
              }`}
            >
              <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                selectedUserId === user.agentId ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
              }`}>
                {user.profilePhoto ? (
                  <img src={user.profilePhoto} alt={user.agentName} className="h-full w-full rounded-full object-cover" />
                ) : (
                  <LuUser className="text-lg" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold truncate ${selectedUserId === user.agentId ? 'text-indigo-900' : 'text-slate-700'}`}>
                  {user.agentName}
                </p>
                <p className="text-xs text-slate-500 truncate">{user.teamName}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-xs font-bold ${selectedUserId === user.agentId ? 'text-indigo-600' : 'text-slate-900'}`}>
                  {user.submissions} Sub
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  {user.dials > 0 ? ((user.submissions / user.dials) * 100).toFixed(1) : 0}% Conv
                </p>
              </div>
              <LuChevronRight className={`text-slate-300 transition-transform ${selectedUserId === user.agentId ? 'translate-x-1 text-indigo-400' : ''}`} />
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default UserReportList;
