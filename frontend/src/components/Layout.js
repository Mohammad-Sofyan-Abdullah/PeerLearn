import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from 'react-query';
import {
  Home,
  Users,
  User,
  LogOut,
  Menu,
  X,
  MessageSquare,
  BookOpen,
  UserCheck,
  Youtube,
  ShoppingBag,
  Calendar,
  Library,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useTheme } from '../contexts/ThemeContext';
import { friendsAPI, messagesAPI } from '../utils/api';
import LoadingSpinner from './LoadingSpinner';
import Button from './Button';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, isLoading } = useAuth();
  const { connected } = useSocket();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isImmersive = location.pathname.includes('/notes/session') || location.pathname === '/youtube-summarizer';
  const isFullHeight = isImmersive || location.pathname.startsWith('/messages/') || location.pathname.startsWith('/classroom/') || location.pathname.startsWith('/resources');
  const isFullWidth = location.pathname === '/marketplace' || location.pathname.startsWith('/notes');

  // Fetch friend requests count
  const { data: friendRequests = [] } = useQuery(
    'friend-requests-count',
    () => friendsAPI.getFriendRequests().then(res => res.data),
    {
      refetchInterval: 30000,
      enabled: !!user
    }
  );

  const previousUnreadCount = useRef(-1);

  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  const { data: unreadCount = 0 } = useQuery(
    'unread-messages-count',
    async () => {
      try {
        const res = await messagesAPI.getConversations();
        const count = res.data.reduce((total, conv) => total + (conv.unread_count || 0), 0);
        
        // Show desktop notification if count increases
        if (count > previousUnreadCount.current && previousUnreadCount.current !== -1) {
          if ('Notification' in window && Notification.permission === 'granted') {
             const conversationsWithUnread = res.data.filter(c => c.unread_count > 0);
             if (conversationsWithUnread.length > 0) {
                // Get the conversation with the most recent updated_at
                conversationsWithUnread.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
                const latest = conversationsWithUnread[0];
                new Notification(`New message from ${latest.other_user.full_name}`, {
                   body: latest.last_message_content || 'You have a new message',
                   icon: '/favicon.ico'
                });
             }
          }
        }
        previousUnreadCount.current = count;
        return count;
      } catch (err) {
        return 0;
      }
    },
    {
      refetchInterval: 5000,
      enabled: !!user
    }
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Notes', href: '/notes', icon: BookOpen },
    { name: 'Marketplace', href: '/marketplace', icon: ShoppingBag },
    { name: 'Find Teachers', href: '/teachers', icon: UserCheck },
    { name: 'My Sessions', href: '/my-sessions', icon: Calendar },
    { name: 'Messages', href: '/messages', icon: MessageSquare },
    { name: 'YouTube Summarizer', href: '/youtube-summarizer', icon: Youtube },
    { name: 'Resources', href: '/resources', icon: Library },
    { name: 'Friends', href: '/friends', icon: Users },
    { name: 'Profile', href: '/profile', icon: User },
  ];

  const isActive = (path) => location.pathname === path;

  const getNotificationCount = (itemName) => {
    if (itemName === 'Messages') return unreadCount;
    if (itemName === 'Friend Requests') return friendRequests.length;
    return 0;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className={`bg-gray-50 dark:bg-gray-950 ${isFullHeight ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      {/* Mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            <div className="fixed inset-0 bg-gray-600/75 dark:bg-gray-900/80" onClick={() => setSidebarOpen(false)} />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="relative flex w-full max-w-xs flex-1 flex-col bg-white dark:bg-gray-900 shadow-xl"
            >
              <div className="absolute top-0 right-0 -mr-12 pt-2">
                <button
                  type="button"
                  className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="h-6 w-6 text-white" />
                </button>
              </div>
              <div className="flex flex-shrink-0 items-center px-4 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <BookOpen className="h-8 w-8 text-primary-600" />
                  <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">PeerLearn</span>
                </div>
              </div>
              <div className="mt-5 h-0 flex-1 overflow-y-auto">
                <nav className="space-y-1 px-2">
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.name}
                        onClick={() => {
                          navigate(item.href);
                          setSidebarOpen(false);
                        }}
                        className={`${isActive(item.href)
                          ? 'bg-primary-100 text-primary-900 dark:bg-primary-900/30 dark:text-primary-300'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                          } group flex w-full items-center rounded-md px-2 py-2 text-base font-medium relative transition-colors`}
                      >
                        <Icon className="mr-4 h-6 w-6 flex-shrink-0" />
                        {item.name}
                        {getNotificationCount(item.name) > 0 && (
                          <span className="ml-auto inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                            {getNotificationCount(item.name)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-white dark:bg-gray-900 shadow-lg dark:shadow-gray-900/50 border-r border-gray-200 dark:border-gray-700/60">
          <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
            <div className="flex flex-shrink-0 items-center px-4 pb-3 border-b border-gray-200 dark:border-gray-700/60">
              <div className="flex items-center">
                <BookOpen className="h-8 w-8 text-primary-600" />
                <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">PeerLearn</span>
              </div>
            </div>
            <nav className="mt-5 flex-1 space-y-1 px-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => navigate(item.href)}
                    className={`${isActive(item.href)
                      ? 'bg-primary-100 text-primary-900 dark:bg-primary-900/30 dark:text-primary-300'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                      } group flex w-full items-center rounded-md px-2 py-2 text-sm font-medium relative transition-colors`}
                  >
                    <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                    {item.name}
                    {getNotificationCount(item.name) > 0 && (
                      <span className="ml-auto inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                        {getNotificationCount(item.name)}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
          {/* Sidebar footer: user info */}
          <div className="flex flex-shrink-0 border-t border-gray-200 dark:border-gray-700/60 p-4">
            <div className="flex items-center w-full">
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0">
                <span className="text-primary-600 dark:text-primary-400 font-semibold text-sm">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <div className="ml-2 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`lg:pl-64 flex flex-col ${isFullHeight ? 'h-full overflow-hidden' : 'flex-1 min-h-screen'}`}>
        {/* Top navigation */}
        <div className="sticky top-0 z-10 flex h-16 flex-shrink-0 bg-white dark:bg-gray-900 shadow dark:shadow-gray-900/50 border-b border-gray-200 dark:border-gray-700/60">
          <button
            type="button"
            className="border-r border-gray-200 dark:border-gray-700/60 px-4 text-gray-500 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex flex-1 justify-between px-4">
            <div className="flex flex-1">
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center">
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {location.pathname === '/dashboard' && 'Dashboard'}
                    {location.pathname.startsWith('/classroom/') && 'Classroom'}
                    {location.pathname === '/youtube-summarizer' && 'YouTube Summarizer'}
                    {location.pathname === '/friends' && 'Friends'}
                    {location.pathname === '/friend-requests' && 'Friend Requests'}
                    {location.pathname === '/profile' && 'Profile'}
                    {location.pathname === '/notes' && 'Notes'}
                    {location.pathname === '/marketplace' && 'Marketplace'}
                    {location.pathname === '/teachers' && 'Find Teachers'}
                    {location.pathname === '/my-sessions' && 'My Sessions'}
                    {location.pathname === '/messages' && 'Messages'}
                    {location.pathname === '/resources' && 'Resources'}
                  </h1>
                </div>
                <div className="flex items-center space-x-3">
                  {/* Connection status */}
                  <div className="flex items-center space-x-1.5">
                    <div className={`h-2 w-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
                    <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
                      {connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>

                  {/* Dark mode toggle */}
                  <button
                    onClick={toggleTheme}
                    className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                    title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    aria-label="Toggle dark mode"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={isDark ? 'sun' : 'moon'}
                        initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                        animate={{ rotate: 0, opacity: 1, scale: 1 }}
                        exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                        transition={{ duration: 0.2 }}
                      >
                        {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                      </motion.div>
                    </AnimatePresence>
                  </button>

                  {/* Logout button */}
                  <Button
                    onClick={handleLogout}
                    variant="ghost"
                    leftIcon={<LogOut className="h-4 w-4" />}
                  >
                    <span className="hidden sm:inline">Logout</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className={`flex-1 flex flex-col ${isFullHeight ? 'overflow-hidden' : ''}`}>
          <div className={isFullHeight ? "flex-1 flex flex-col h-full min-h-0" : isFullWidth ? "" : "py-6"}>
            <div className={isFullHeight ? "flex-1 h-full min-h-0 relative" : isFullWidth ? "w-full" : "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"}>
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
