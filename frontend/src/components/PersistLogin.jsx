import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { fetchMe, logoutLocally, refreshToken, restoreAuthFromStorage } from '../features/auth/authSlice.js';
import { getAuthToken } from '../utils/localStorage.js';

const PersistLogin = () => {
  const [isLoading, setIsLoading] = useState(true);
  const dispatch = useDispatch();

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const token = getAuthToken();

      try {
        if (token) {
          dispatch(restoreAuthFromStorage());
          await dispatch(fetchMe()).unwrap();
        } else {
          await dispatch(refreshToken()).unwrap();
          await dispatch(fetchMe()).unwrap();
        }
      } catch (error) {
        try {
          await dispatch(refreshToken()).unwrap();
          await dispatch(fetchMe()).unwrap();
        } catch (refreshError) {
          dispatch(
            logoutLocally({
              notice: 'Your session expired. Please log in again.',
            })
          );
        }
      }

      if (isMounted) setIsLoading(false);
    };

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, [dispatch]); // Run exactly once on mount

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <svg className="animate-spin h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  return <Outlet />;
};

export default PersistLogin;
