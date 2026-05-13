import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { motion } from 'framer-motion';
import {
  Plus,
  Users,
  BookOpen,
  TrendingUp,
  Search,
  Copy,
  Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { classroomsAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';
import CreateClassroomModal from '../components/CreateClassroomModal';
import JoinClassroomModal from '../components/JoinClassroomModal';
import toast from 'react-hot-toast';

const DashboardPage = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);

  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch classrooms
  const { data: classrooms = [], isLoading } = useQuery(
    'classrooms',
    classroomsAPI.getClassrooms,
    {
      select: (response) => response.data,
    }
  );

  // Listen for classroom_added and classroom_removed events
  useEffect(() => {
    if (!socket) return;

    const handleClassroomAdded = (data) => {
      console.log('Added to classroom (socket):', data);
      toast.success(`You've been added to ${data.classroom_name}!`);
      queryClient.invalidateQueries('classrooms');
    };

    const handleClassroomRemoved = (data) => {
      console.log('Removed from classroom:', data);
      toast.error(`You've been removed from ${data.classroom_name}`);
      queryClient.invalidateQueries('classrooms');
    };

    socket.on('classroom_added', handleClassroomAdded);
    socket.on('added_to_classroom', handleClassroomAdded);
    socket.on('classroom_removed', handleClassroomRemoved);

    return () => {
      socket.off('classroom_added', handleClassroomAdded);
      socket.off('added_to_classroom', handleClassroomAdded);
      socket.off('classroom_removed', handleClassroomRemoved);
    };
  }, [socket, queryClient]);

  // Also listen via window CustomEvent (dispatched by SocketContext as a bridge)
  useEffect(() => {
    const handleClassroomAdded = (e) => {
      console.log('New classroom added (window event):', e.detail);
      queryClient.invalidateQueries('classrooms');
      toast.success(`You've been added to ${e.detail.classroom_name}!`);
    };
    window.addEventListener('classroom_added', handleClassroomAdded);
    return () => window.removeEventListener('classroom_added', handleClassroomAdded);
  }, [queryClient]);

  // Filter classrooms based on search
  const filteredClassrooms = classrooms.filter(classroom =>
    classroom.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    classroom.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const copyInviteCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const stats = [
    {
      name: 'Total Classrooms',
      value: classrooms.length,
      icon: BookOpen,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      name: 'Learning Streak',
      value: user?.learning_streaks || 0,
      icon: TrendingUp,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      name: 'Friends',
      value: user?.friends?.length || 0,
      icon: Users,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Ready to continue your learning journey?
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={() => setShowJoinModal(true)}
          >
            Join Classroom
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => setShowCreateModal(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Create Classroom
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="card"
            >
              <div className="card-content mt-5">
                <div className="flex items-center">
                  <div className={`flex-shrink-0 p-3 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.name}</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stat.value}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Search and Classrooms */}
      <div className="card">
        <div className="card-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Your Classrooms</h3>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search classrooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10 w-full sm:w-64"
              />
            </div>
          </div>
        </div>
        <div className="card-content">
          {filteredClassrooms.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No classrooms</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {searchQuery ? 'No classrooms match your search.' : 'Get started by creating a new classroom.'}
              </p>
              {!searchQuery && (
                <div className="mt-6">
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    leftIcon={<Plus className="h-4 w-4" />}
                  >
                    Create your first classroom
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredClassrooms.map((classroom, index) => (
                <motion.div
                  key={classroom.id || classroom._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:shadow-md dark:hover:shadow-gray-900/40 transition-shadow cursor-pointer"
                  onClick={() => navigate(`/classroom/${classroom.id || classroom._id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                        {classroom.name}
                      </h4>
                      {classroom.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {classroom.description}
                        </p>
                      )}
                      <div className="flex items-center text-xs text-gray-500 dark:text-gray-500">
                        <Users className="h-4 w-4 mr-1" />
                        {classroom.members?.length || 0} members
                      </div>
                    </div>
                    {(classroom.admin_id) === (user?.id || user?._id) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyInviteCode(classroom.invite_code);
                        }}
                        className="ml-2 p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                        title="Copy invite code"
                      >
                        {copiedCode === classroom.invite_code ? (
                          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      Created {new Date(classroom.created_at).toLocaleDateString()}
                    </span>
                    {(classroom.admin_id) === (user?.id || user?._id) && (
                      <span className="badge-primary text-xs">Admin</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateClassroomModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {showJoinModal && (
        <JoinClassroomModal
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
        />
      )}
    </div>
  );
};

export default DashboardPage;
