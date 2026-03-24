import React from 'react';
import { useNavigate } from 'react-router-dom';

const UnauthorizedPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50">
      <h1 className="text-6xl font-bold text-red-500">403</h1>
      <h2 className="mt-4 text-2xl font-semibold text-gray-800">Access Denied</h2>
      <p className="mt-2 text-gray-600">You do not have permission to view this page.</p>
      <button 
        onClick={() => navigate(-1)} 
        className="mt-6 rounded bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700 transition"
      >
        Go Back
      </button>
    </div>
  );
};

export default UnauthorizedPage;
