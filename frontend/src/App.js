import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleProtectedRoute from './components/RoleProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';
import TeacherLayout from './components/TeacherLayout';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ClassroomPage from './pages/ClassroomPage';
import ProfilePage from './pages/ProfilePage';
import FriendsPage from './pages/FriendsPage';

import MessagesPage from './pages/MessagesPage';
import ConversationsListPage from './pages/ConversationsListPage';
import YouTubeSummarizerLayout from './pages/YouTubeSummarizerLayout';
import MarketplacePage from './pages/MarketplacePage';
import NotesPage from './pages/NotesPage';
import DocumentEditorPage from './pages/DocumentEditorPage';
import DocumentViewPage from './pages/DocumentViewPage';
import DocumentSessionPage from './pages/DocumentSessionPage';
import TeacherRegisterPage from './pages/TeacherRegisterPage';
import TeacherProfileSetupPage from './pages/TeacherProfileSetupPage';
import TeacherDashboardPage from './pages/TeacherDashboardPage';
import TeachersDiscoveryPage from './pages/TeachersDiscoveryPage';
import TeacherProfileViewPage from './pages/TeacherProfileViewPage';
import MyHireRequestsPage from './pages/MyHireRequestsPage';
import TeacherSessionsPage from './pages/TeacherSessionsPage';
import TeacherReviewsPage from './pages/TeacherReviewsPage';
import StudentSessionsPage from './pages/StudentSessionsPage';
import TeacherResearchPage from './pages/TeacherResearchPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import ResourcesPage from './pages/ResourcesPage';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SocketProvider>
          <Router>
            <div className="App">
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/* Admin routes — separate auth, separate token */}
                <Route path="/admin/login" element={<AdminLoginPage />} />
                <Route path="/admin/dashboard" element={
                  <AdminRoute>
                    <AdminDashboardPage />
                  </AdminRoute>
                } />
                <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

                {/* Protected routes */}
                <Route path="/teacher/register" element={<TeacherRegisterPage />} />

                {/* Teacher Setup (Protected) */}
                <Route path="/teacher/profile-setup" element={
                  <ProtectedRoute>
                    <RoleProtectedRoute allowedRole="teacher">
                      <TeacherProfileSetupPage />
                    </RoleProtectedRoute>
                  </ProtectedRoute>
                } />

                {/* Teacher Routes with Teacher Layout */}
                <Route path="/teacher" element={
                  <ProtectedRoute>
                    <RoleProtectedRoute allowedRole="teacher">
                      <TeacherLayout />
                    </RoleProtectedRoute>
                  </ProtectedRoute>
                }>
                  <Route index element={<Navigate to="/teacher/dashboard" replace />} />
                  <Route path="dashboard" element={<TeacherDashboardPage />} />
                  <Route path="profile/edit" element={<TeacherProfileSetupPage />} />
                  <Route path="messages" element={<ConversationsListPage />} />
                  <Route path="messages/:friendId" element={<MessagesPage />} />
                  <Route path="sessions" element={<TeacherSessionsPage />} />
                  <Route path="marketplace" element={<MarketplacePage />} />
                  <Route path="earnings" element={<TeacherDashboardPage />} />
                  <Route path="reviews" element={<TeacherReviewsPage />} />
                  <Route path="research" element={<TeacherResearchPage />} />
                </Route>

                {/* Student Routes with Student Layout */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <RoleProtectedRoute allowedRole="student">
                      <Layout />
                    </RoleProtectedRoute>
                  </ProtectedRoute>
                }>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="notes" element={<NotesPage />} />
                  {/* New view/editor routes */}
                  <Route path="notes/view/:documentId" element={<DocumentViewPage />} />
                  <Route path="notes/editor/:documentId" element={<DocumentEditorPage />} />
                  {/* Legacy route — redirect to view */}
                  <Route path="notes/:documentId" element={<DocumentViewPage />} />
                  <Route path="notes/session/:sessionId" element={<DocumentSessionPage />} />
                  <Route path="marketplace" element={<MarketplacePage />} />
                  <Route path="classroom/:id" element={<ClassroomPage />} />
                  <Route path="youtube-summarizer" element={<YouTubeSummarizerLayout />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="/friends" element={<FriendsPage />} />
                  <Route path="messages" element={<ConversationsListPage />} />
                  <Route path="messages/:friendId" element={<MessagesPage />} />

                  {/* Teacher Discovery - accessible to students */}
                  <Route path="teachers" element={<TeachersDiscoveryPage />} />
                  <Route path="teachers/:teacherId" element={<TeacherProfileViewPage />} />
                  <Route path="my-hire-requests" element={<MyHireRequestsPage />} />
                  <Route path="my-sessions" element={<StudentSessionsPage />} />
                  <Route path="resources" element={<ResourcesPage />} />
                </Route>

                {/* Catch all route */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>

              {/* Toast notifications */}
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                  },
                  success: {
                    duration: 3000,
                    iconTheme: {
                      primary: '#22c55e',
                      secondary: '#fff',
                    },
                  },
                  error: {
                    duration: 5000,
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#fff',
                    },
                  },
                }}
              />
            </div>
          </Router>
          </SocketProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

