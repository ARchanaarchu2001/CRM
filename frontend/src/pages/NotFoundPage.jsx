import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50">
      <h1 className="text-6xl font-bold text-gray-400">404</h1>
      <h2 className="mt-4 text-2xl font-semibold text-gray-800">Page Not Found</h2>
      <p className="mt-2 text-gray-600">The requested URL was not found on this server.</p>
      <button 
        onClick={() => navigate('/')} 
        className="mt-6 rounded bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700 transition"
      >
        Return Home
      </button>
    </div>
  );
};

export default NotFoundPage;
