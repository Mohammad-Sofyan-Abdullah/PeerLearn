import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, 
  User, 
  LogOut, 
  Menu, 
  X,
  MessageSquare,
  BookOpen,
  DollarSign,
  Star,
  Calendar,
  ShoppingBag,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useTheme } from '../contexts/ThemeContext';
import { messagesAPI } from '../utils/api';

const TeacherLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const previousUnreadCount = useRef(-1);

  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  const { data: unreadCount = 0 } = useQuery(
    'unread-messages-count-teacher',
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
    { name: 'Dashboard',          href: '/teacher/dashboard',    icon: Home        },
    { name: 'My Profile',         href: '/teacher/profile/edit', icon: User        },
    { name: 'Messages',           href: '/teacher/messages',      icon: MessageSquare },
    { name: 'Sessions',           href: '/teacher/sessions',      icon: Calendar    },
    { name: 'Marketplace',        href: '/teacher/marketplace',   icon: ShoppingBag },
    { name: 'Research & Planning',href: '/teacher/research',      icon: BookOpen    },
    { name: 'Earnings',           href: '/teacher/earnings',      icon: DollarSign  },
    { name: 'Reviews',            href: '/teacher/reviews',       icon: Star        },
  ];

  const isActive = (path) => location.pathname === path;

  const getNotificationCount = (itemName) => {
    if (itemName === 'Messages') return unreadCount;
    return 0;
  };

  const NavLink = ({ item, onClick }) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        to={item.href}
        onClick={onClick}
        className={`
          flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors
          ${active
            ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
          }
        `}
      >
        <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
        {item.name}
        {getNotificationCount(item.name) > 0 && (
          <span className="ml-auto inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {getNotificationCount(item.name)}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className={`bg-gray-50 dark:bg-gray-950 ${(location.pathname === '/teacher/research' || location.pathname.startsWith('/teacher/messages/')) ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      {/* Mobile sidebar overlay */}
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
              className="fixed inset-y-0 left-0 flex flex-col w-64 bg-white dark:bg-gray-900 shadow-xl"
            >
              {/* Mobile sidebar header */}
              <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700/60">
                <h1 className="text-xl font-bold text-indigo-600 dark:text-indigo-400">PeerLearn Teacher</h1>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                {navigation.map((item) => (
                  <NavLink key={item.name} item={item} onClick={() => setSidebarOpen(false)} />
                ))}
              </nav>

              {/* Mobile sidebar footer */}
              <div className="border-t border-gray-200 dark:border-gray-700/60 p-4 space-y-3">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    {user?.avatar ? (
                      <img className="h-10 w-10 rounded-full object-cover" src={user.avatar} alt={user?.name} />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                          {user?.name?.charAt(0)?.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="ml-3 flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 truncate">Teacher Account</p>
                  </div>
                </div>

                {/* Connection status */}
                <div className="flex items-center px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className={`h-2 w-2 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-gray-600 dark:text-gray-400">{connected ? 'Connected' : 'Disconnected'}</span>
                </div>

                {/* Dark mode toggle */}
                <button
                  onClick={toggleTheme}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={isDark ? 'sun' : 'moon'}
                      initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                      animate={{ rotate: 0, opacity: 1, scale: 1 }}
                      exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                      transition={{ duration: 0.2 }}
                      className="mr-3"
                    >
                      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </motion.div>
                  </AnimatePresence>
                  {isDark ? 'Light Mode' : 'Dark Mode'}
                </button>

                <button
                  onClick={handleLogout}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  Logout
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:border-r lg:border-gray-200 dark:lg:border-gray-700/60 lg:bg-white dark:lg:bg-gray-900">
        {/* Logo */}
        <div className="flex items-center h-16 px-6 border-b border-gray-200 dark:border-gray-700/60">
          <h1 className="text-xl font-bold text-indigo-600 dark:text-indigo-400">PeerLearn Teacher</h1>
        </div>
        
        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => (
            <NavLink key={item.name} item={item} />
          ))}
        </nav>

        {/* Desktop sidebar footer */}
        <div className="border-t border-gray-200 dark:border-gray-700/60 p-4 space-y-3">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {user?.avatar ? (
                <img className="h-10 w-10 rounded-full object-cover" src={user.avatar} alt={user?.name} />
              ) : (
                <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                    {user?.name?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 truncate">Teacher Account</p>
            </div>
          </div>
          
          {/* Connection Status */}
          <div className="flex items-center px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className={`h-2 w-2 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-gray-600 dark:text-gray-400">{connected ? 'Connected' : 'Disconnected'}</span>
          </div>

          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={isDark ? 'sun' : 'moon'}
                initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.2 }}
                className="mr-3"
              >
                {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </motion.div>
            </AnimatePresence>
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Logout
          </button>
        </div>
      </div>

      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between h-16 px-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700/60">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <Menu className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-bold text-indigo-600 dark:text-indigo-400">PeerLearn Teacher</h1>
        {/* Dark mode toggle in mobile header */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
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
      </div>

      {/* Main content */}
      <div className={`lg:pl-64 ${(location.pathname === '/teacher/research' || location.pathname.startsWith('/teacher/messages/')) ? 'h-full flex flex-col' : ''}`}>
        <main className={(location.pathname === '/teacher/research' || location.pathname.startsWith('/teacher/messages/')) ? 'h-full flex flex-col overflow-hidden' : 'min-h-screen'}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default TeacherLayout;
