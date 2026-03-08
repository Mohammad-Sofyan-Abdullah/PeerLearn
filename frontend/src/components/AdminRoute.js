import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Protects /admin/* routes.
 * Redirects to /admin/login if no admin token is stored.
 */
export default function AdminRoute({ children }) {
  const token = localStorage.getItem('admin_access_token');
  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}
