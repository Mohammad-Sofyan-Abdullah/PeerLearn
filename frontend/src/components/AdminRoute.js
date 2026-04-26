import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Protects /admin/* routes.
 * 1. Checks that admin_access_token exists in localStorage.
 * 2. Decodes the JWT payload (no signature verification — that happens on the backend).
 * 3. Verifies the token carries role:"admin" claim (added by /auth/admin/login).
 * 4. Checks client-side expiry and clears stale tokens automatically.
 */
export default function AdminRoute({ children }) {
  const token = localStorage.getItem('admin_access_token');

  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }

  try {
    // Decode JWT payload (base64url → JSON) — no crypto verification needed here,
    // every admin API call is gated by require_admin on the backend.
    const payload = JSON.parse(atob(token.split('.')[1]));

    // Verify the role claim added by the admin login endpoint
    if (payload.role !== 'admin') {
      localStorage.removeItem('admin_access_token');
      localStorage.removeItem('admin_refresh_token');
      localStorage.removeItem('admin_name');
      return <Navigate to="/admin/login" replace />;
    }

    // Client-side expiry check — prevents a confusing 401 flash on load
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('admin_access_token');
      localStorage.removeItem('admin_refresh_token');
      localStorage.removeItem('admin_name');
      return <Navigate to="/admin/login" replace />;
    }
  } catch {
    // Malformed token
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('admin_name');
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}
