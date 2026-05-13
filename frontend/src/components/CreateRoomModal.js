import React, { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Sparkles } from 'lucide-react';
import { classroomsAPI } from '../utils/api';
import toast from 'react-hot-toast';
import Button from './Button';

const CreateRoomModal = ({ isOpen, onClose, classroomId }) => {
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const queryClient = useQueryClient();

  const createRoomMutation = useMutation(
    (roomData) => classroomsAPI.createRoom(classroomId, roomData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['rooms', classroomId]);
        toast.success('Room created successfully!');
        onClose();
        setFormData({ name: '', description: '' });
      },
      onError: (error) => {
        const msg = error.response?.data?.detail;
        if (typeof msg === 'string') toast.error(msg);
        else if (Array.isArray(msg)) toast.error(msg.map(e => e.msg || JSON.stringify(e)).join(', '));
        else toast.error('Failed to create room');
      },
    }
  );

  const getSuggestionsMutation = useMutation(
    (subject) => classroomsAPI.suggestRoomNames('Classroom', subject),
    {
      onSuccess: (response) => { setSuggestions(response.data.suggestions); setIsLoadingSuggestions(false); },
      onError: () => setIsLoadingSuggestions(false),
    }
  );

  const handleChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('Please enter a room name'); return; }
    createRoomMutation.mutate(formData);
  };

  const handleGetSuggestions = () => {
    if (!formData.name.trim()) { toast.error('Please enter a subject first'); return; }
    setIsLoadingSuggestions(true);
    setShowSuggestions(true);
    getSuggestionsMutation.mutate(formData.name);
  };

  const selectSuggestion = (suggestion) => { setFormData({ ...formData, name: suggestion }); setShowSuggestions(false); };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-60 transition-opacity"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="relative transform overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-md border border-gray-100 dark:border-gray-700"
          >
            <div className="px-6 pt-6 pb-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-primary-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Room</h3>
                </div>
                <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Room Name
                  </label>
                  <input
                    type="text" name="name" id="name" required
                    value={formData.name} onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="e.g., Math Discussion, Physics Help"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    name="description" id="description" rows="2"
                    value={formData.description} onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="Describe what this room is for..."
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                  <Button type="submit" disabled={createRoomMutation.isLoading} isLoading={createRoomMutation.isLoading}
                    leftIcon={!createRoomMutation.isLoading && <MessageSquare className="h-4 w-4" />}>
                    Create Room
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};

export default CreateRoomModal;
