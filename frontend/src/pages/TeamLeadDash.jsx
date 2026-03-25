import React, { useState } from 'react';
import AgentList from '../components/users/AgentList';
import CreateAgentForm from '../components/users/CreateAgentForm';

const TeamLeadDash = () => {
  // Toggle state to dynamically show/hide the creation form within the dashboard
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6">
      {/* Dashboard Header with Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Team Lead Workspace</h1>
          <p className="mt-1 text-sm text-slate-500">Oversee your assigned agents, manage resources, and track progress.</p>
        </div>
        
        {/* The Add Agent Button Requested */}
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            showCreateForm 
              ? 'bg-slate-500 hover:bg-slate-600 focus:ring-slate-500' // Cancel mode styling
              : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500' // Primary add mode styling
          }`}
        >
          {showCreateForm ? (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel Creation
            </>
          ) : (
            <>
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add New Agent
            </>
          )}
        </button>
      </div>

      {/* Conditionally reveal the CreateAgentForm based on button click */}
      {showCreateForm && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300 ease-out mb-8">
          <CreateAgentForm />
        </div>
      )}

      {/* Always display the existing list of agents below */}
      <AgentList />
      
    </div>
  );
};

export default TeamLeadDash;
