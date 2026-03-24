import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { refreshToken, fetchMe } from '../features/auth/authSlice.js';

const PersistLogin = () => {
  const [isLoading, setIsLoading] = useState(true);
  const { accessToken } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  useEffect(() => {
    let isMounted = true;

    const verifyRefreshToken = async () => {
      try {
        await dispatch(refreshToken()).unwrap();
        await dispatch(fetchMe()).unwrap();
      } catch (error) {
        // Fails silently if cookie doesn't exist or is expired - the ProtectedRoute will handle bumping them to /login
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    // If we have no accessToken in Redux memory but the user triggers a mount, we query the HTTPOnly Cookie implicitly over the interceptor
    if (!accessToken) {
      verifyRefreshToken();
    } else {
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [accessToken, dispatch]);

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
