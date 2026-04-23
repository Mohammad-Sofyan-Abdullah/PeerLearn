import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  MoreVertical,
  Edit3,
  Trash2,
  FileText,
  Sparkles,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { chatAPI } from '../utils/api';
import { useSocket } from '../contexts/SocketContext';
// import { useAuth } from '../contexts/AuthContext'; // Removed unused import
import LoadingSpinner from './LoadingSpinner';
import toast from 'react-hot-toast';
import Button from './Button';

const ChatInterface = ({ room, classroom, user }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [showMessageMenu, setShowMessageMenu] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState('');
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();
  const { socket, connected, joinRoom, leaveRoom } = useSocket();

  // Fix 2: Join the socket room when this component mounts / room changes.
  // The cleanup function leaves the room so broadcasts from the old room
  // don't fire while the user is looking at a different room.
  const roomId = room.id || room._id;
  useEffect(() => {
    if (!roomId) return;
    joinRoom(roomId);
    return () => {
      leaveRoom();
    };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch messages
  const { data: initialMessages = [], isLoading } = useQuery(
    ['messages', roomId],
    () => chatAPI.getMessages(roomId),
    {
      select: (response) => response.data,
      enabled: !!roomId,
    }
  );

  // Fix 4 (Part A): sendMessageMutation — remove the optimistic append from onSuccess.
  // The socket 'new_message' event for OTHER users will handle their update.
  // For the SENDER, we append the authoritative HTTP response here — single source of truth.
  const sendMessageMutation = useMutation(
    ({ roomId: rId, content }) => chatAPI.sendMessage(rId, content),
    {
      onSuccess: (response) => {
        // Inject sender_name so the message renders correctly without a refetch
        const savedMessage = {
          ...response.data,
          sender_name: user?.name || 'Unknown',
        };
        setMessages(prev => [...prev, savedMessage]);
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.detail;
        if (typeof errorMessage === 'string') {
          toast.error(errorMessage);
        } else if (Array.isArray(errorMessage)) {
          const messages = errorMessage.map(err => err.msg || JSON.stringify(err)).join(', ');
          toast.error(messages);
        } else {
          toast.error('Failed to send message');
        }
      },
    }
  );

  // Edit message mutation
  const editMessageMutation = useMutation(
    ({ messageId, content }) => chatAPI.editMessage(messageId, content),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['messages', roomId]);
        setEditingMessage(null);
        setEditContent('');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.detail;
        if (typeof errorMessage === 'string') {
          toast.error(errorMessage);
        } else if (Array.isArray(errorMessage)) {
          const messages = errorMessage.map(err => err.msg || JSON.stringify(err)).join(', ');
          toast.error(messages);
        } else {
          toast.error('Failed to edit message');
        }
      },
    }
  );

  // Delete message mutation
  const deleteMessageMutation = useMutation(chatAPI.deleteMessage, {
    onSuccess: () => {
      queryClient.invalidateQueries(['messages', roomId]);
      setShowMessageMenu(null);
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.detail;
      if (typeof errorMessage === 'string') {
        toast.error(errorMessage);
      } else if (Array.isArray(errorMessage)) {
        const messages = errorMessage.map(err => err.msg || JSON.stringify(err)).join(', ');
        toast.error(messages);
      } else {
        toast.error('Failed to delete message');
      }
    },
  });

  // Summarize chat mutation
  const summarizeMutation = useMutation(
    () => chatAPI.summarizeChat(room.id || room._id),
    {
      onSuccess: (response) => {
        setSummary(response.data.summary);
        setIsLoadingSummary(false);
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.detail;
        if (typeof errorMessage === 'string') {
          toast.error(errorMessage);
        } else if (Array.isArray(errorMessage)) {
          const messages = errorMessage.map(err => err.msg || JSON.stringify(err)).join(', ');
          toast.error(messages);
        } else {
          toast.error('Failed to generate summary');
        }
        setIsLoadingSummary(false);
      },
    }
  );

  // Update messages when initial data loads
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [JSON.stringify(initialMessages)]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fix 4 (Part B): Socket event listeners.
  // The new_message handler now SKIPS messages sent by the current user
  // because the sender already appended the authoritative copy in sendMessageMutation.onSuccess.
  // Without this guard the sender sees every message twice.
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data) => {
      // Normalise the socket payload so it matches the HTTP fetch shape
      const incomingMsg = normaliseSocketMessage(data);
      const senderId = String(incomingMsg.sender_id || '');
      const currentUserId = String(user?.id || user?._id || user?.user_id || '');
      // Skip if the current user sent this — they already have it from onSuccess
      if (currentUserId && senderId === currentUserId) return;
      setMessages(prev => [...prev, incomingMsg]);
    };

    const handleMessageEdited = (data) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === data.message.id || msg._id === data.message._id ? data.message : msg
        )
      );
    };

    const handleMessageDeleted = (data) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === data.message_id || msg._id === data.message_id
            ? { ...msg, deleted: true }
            : msg
        )
      );
    };

    socket.on('new_message', handleNewMessage);
    socket.on('message_edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('message_edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
    };
  }, [socket, user?.id, user?._id]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim() || !connected) return;

    sendMessageMutation.mutate({
      roomId,
      content: message.trim(),
    });
    setMessage('');
  };

  const handleEditMessage = (msg) => {
    setEditingMessage(msg);
    setEditContent(msg.content);
    setShowMessageMenu(null);
  };

  const handleSaveEdit = () => {
    if (!editContent.trim() || !editingMessage) return;
    editMessageMutation.mutate({
      messageId: editingMessage._id || editingMessage.id,
      content: editContent.trim(),
    });
  };

  const handleDeleteMessage = (messageId) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      deleteMessageMutation.mutate(messageId);
    }
  };

  const handleGenerateSummary = () => {
    setIsLoadingSummary(true);
    setShowSummary(true);
    summarizeMutation.mutate();
  };

  const canEditMessage = (msg) => {
    return msg.sender_id === user?.id && !msg.deleted;
  };

  const canDeleteMessage = (msg) => {
    return msg.sender_id === user?.id && !msg.deleted;
  };

  const safeText = (val) => {
    if (val === null || val === undefined) return '';
    const t = typeof val;
    if (t === 'string' || t === 'number' || t === 'boolean') return String(val);
    try {
      return JSON.stringify(val);
    } catch (e) {
      return String(val);
    }
  };

  /**
   * Returns a reliable stable string ID for a message object.
   * FastAPI serialises with _id (alias), so msg.id is often undefined.
   * Always prefer _id, fall back to id.
   */
  const msgKey = (msg) => String(msg?._id || msg?.id || '');

  /**
   * Normalise a raw socket payload so it has exactly the same shape
   * as a message returned by GET /rooms/{room_id}/messages.
   * The socket handler in chat.py emits { message: {...}, sender_name, sender_avatar }.
   * We pull sender_name/avatar into the message object so rendering logic can access it.
   */
  const normaliseSocketMessage = (payload) => {
    const msg = payload.message || payload;
    return {
      ...msg,
      sender_name: payload.sender_name || msg.sender_name || 'Unknown',
      sender_avatar: payload.sender_avatar || msg.sender_avatar || null,
    };
  };

  // Helper to determine if a message belongs to the current user
  const isOwnMessage = (msg) => {
    const senderId = String(msg?.sender_id || '');
    // Try all possible ID fields — /auth/me Pydantic serialisation may vary
    const userId = String(user?.id || user?._id || user?.user_id || '');
    return senderId === userId && userId !== '';
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Room header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div>
          <h2 className="text-lg font-medium text-gray-900">{room.name}</h2>
          {room.description && (
            <p className="text-sm text-gray-600">{room.description}</p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleGenerateSummary}
            disabled={isLoadingSummary}
            variant="outline"
            size="sm"
            isLoading={isLoadingSummary}
            leftIcon={!isLoadingSummary && <Sparkles className="h-4 w-4" />}
          >
            Summarize
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No messages yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Start the conversation by sending a message below
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const own = isOwnMessage(msg);
            return (
              <div key={msg._id || msg.id} className={`flex w-full mb-2 ${own ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md ${own ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!own && (
                    <span className="text-xs text-gray-500 mb-1 ml-1">
                      {msg.sender_name || 'Unknown'}
                    </span>
                  )}
                  <div className={`px-4 py-2 rounded-2xl ${own ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-900 rounded-bl-none'}`}>
                    <p className="text-sm">{msg.content}</p>
                  </div>
                  <span className={`text-xs mt-1 text-gray-400 ${own ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={connected ? "Type a message..." : "Connecting..."}
            disabled={!connected}
            className="input flex-1"
          />
          <Button
            type="submit"
            disabled={!message.trim() || !connected || sendMessageMutation.isLoading}
            isLoading={sendMessageMutation.isLoading}
            size="md"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Summary modal */}
      <AnimatePresence>
        {showSummary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto"
          >
            <div className="flex min-h-screen items-center justify-center p-4">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowSummary(false)} />
              <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Chat Summary</h3>
                    <Button
                      onClick={() => setShowSummary(false)}
                      variant="ghost"
                      className="text-gray-400 hover:text-gray-600 h-auto p-1"
                    >
                      ×
                    </Button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {isLoadingSummary ? (
                      <div className="flex items-center justify-center py-8">
                        <LoadingSpinner size="lg" />
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none">
                        <p className="whitespace-pre-wrap">{summary}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatInterface;


