import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/admin/login`, {
        email: form.email,
        password: form.password,
      });
      const { access_token, refresh_token, name } = res.data;
      localStorage.setItem('admin_access_token', access_token);
      localStorage.setItem('admin_refresh_token', refresh_token);
      localStorage.setItem('admin_name', name || 'Admin');
      toast.success(`Welcome back, ${name || 'Admin'}!`);
      navigate('/admin/dashboard');
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">Admin Portal</h1>
          <p className="text-gray-400 mt-1 text-sm">PeerLearn — Superuser Access</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Admin Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="admin@peerlearn.com"
                className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-3
                           focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500
                           placeholder-gray-500 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                placeholder="••••••••"
                className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-3
                           focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500
                           placeholder-gray-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed
                         text-white font-semibold py-3 rounded-xl transition duration-200 flex items-center
                         justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Authenticating…
                </>
              ) : (
                'Sign In as Admin'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-600">
            This portal is restricted to platform administrators only.
          </p>
        </div>
      </div>
    </div>
  );
}
