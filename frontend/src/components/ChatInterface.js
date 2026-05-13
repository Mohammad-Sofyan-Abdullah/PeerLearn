import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  MoreVertical,
  Edit3,
  Trash2,
  FileText,
  Sparkles,
  Loader2,
  Paperclip,
  Mic,
  Square,
  Download,
  X,
  Youtube,
  PlayCircle,
  BookOpen,
  Layers,
  Bot,
  Share2,
  ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { youtubeAPI, notesAPI } from '../utils/api';
import { format } from 'date-fns';
import { chatAPI } from '../utils/api';
import { useSocket } from '../contexts/SocketContext';
import LoadingSpinner from './LoadingSpinner';
import MarkdownRenderer from './MarkdownRenderer';
import toast from 'react-hot-toast';
import Button from './Button';

const BACKEND_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const MAX_RECORDING_SECONDS = 300; // 5 minutes

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

// ─── Component ──────────────────────────────────────────────────────────────

const ChatInterface = ({ room, classroom, user }) => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [showMessageMenu, setShowMessageMenu] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState('');
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  // File upload state
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();
  const { socket, connected, joinRoom, leaveRoom } = useSocket();

  const roomId = room.id || room._id;

  useEffect(() => {
    if (!roomId) return;
    joinRoom(roomId);
    return () => { leaveRoom(); };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Queries & Mutations ────────────────────────────────────────────────

  const { data: initialMessages = [], isLoading } = useQuery(
    ['messages', roomId],
    () => chatAPI.getMessages(roomId),
    {
      select: (response) => response.data,
      enabled: !!roomId,
    }
  );

  const sendMessageMutation = useMutation(
    (msgData) => chatAPI.sendMessage(roomId, msgData),
    {
      onSuccess: (response) => {
        const savedMessage = {
          ...response.data,
          sender_name: user?.name || 'Unknown',
        };
        setMessages(prev => [...prev, savedMessage]);
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.detail;
        if (typeof errorMessage === 'string') toast.error(errorMessage);
        else if (Array.isArray(errorMessage))
          toast.error(errorMessage.map(e => e.msg || JSON.stringify(e)).join(', '));
        else toast.error('Failed to send message');
      },
    }
  );

  const editMessageMutation = useMutation(
    ({ messageId, content }) => chatAPI.editMessage(messageId, content),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['messages', roomId]);
        setEditingMessage(null);
        setEditContent('');
      },
      onError: (error) => {
        const detail = error.response?.data?.detail;
        if (typeof detail === 'string') toast.error(detail);
        else toast.error('Failed to edit message');
      },
    }
  );

  const deleteMessageMutation = useMutation(chatAPI.deleteMessage, {
    onSuccess: () => {
      queryClient.invalidateQueries(['messages', roomId]);
      setShowMessageMenu(null);
    },
    onError: () => toast.error('Failed to delete message'),
  });

  const summarizeMutation = useMutation(
    () => chatAPI.summarizeChat(roomId),
    {
      onSuccess: (response) => {
        setSummary(response.data.summary);
        setIsLoadingSummary(false);
      },
      onError: () => {
        toast.error('Failed to generate summary');
        setIsLoadingSummary(false);
      },
    }
  );

  // ─── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    setMessages(initialMessages || []);
  }, [JSON.stringify(initialMessages)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data) => {
      const incomingMsg = normaliseSocketMessage(data);
      const senderId = String(incomingMsg.sender_id || '');
      const currentUserId = String(user?.id || user?._id || user?.user_id || '');
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
  }, [socket, user?.id, user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim() || !connected) return;
    sendMessageMutation.mutate({ content: message.trim() });
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
    if (window.confirm('Delete this message?')) {
      deleteMessageMutation.mutate(messageId);
    }
  };

  const handleGenerateSummary = () => {
    setIsLoadingSummary(true);
    setShowSummary(true);
    summarizeMutation.mutate();
  };

  // ─── File Upload ──────────────────────────────────────────────────────────

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset so same file can be re-selected

    setIsUploading(true);
    try {
      const response = await chatAPI.uploadFile(roomId, file);
      const { url, original_name, file_type, file_size } = response.data;
      sendMessageMutation.mutate({
        content: original_name,
        message_type: 'file',
        file_url: url,
        file_name: original_name,
        file_type,
        file_size,
      });
    } catch (err) {
      // Error toast is handled by the api interceptor
    } finally {
      setIsUploading(false);
    }
  }, [roomId, sendMessageMutation]);

  // ─── Voice Recording ──────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType === 'audio/webm' ? '.webm' : '.ogg';
        const audioFile = new File([audioBlob], `voice_${Date.now()}${ext}`, { type: mimeType });
        stream.getTracks().forEach(track => track.stop());
        await handleVoiceUpload(audioFile, mimeType);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(t => {
          if (t + 1 >= MAX_RECORDING_SECONDS) {
            stopRecording();
          }
          return t + 1;
        });
      }, 1000);
    } catch (err) {
      toast.error('Microphone access denied');
    }
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  }, [isRecording]);

  const handleVoiceUpload = useCallback(async (audioFile, mimeType) => {
    try {
      const durationSnapshot = recordingTime;
      const response = await chatAPI.uploadFile(roomId, audioFile);
      const { url, file_size } = response.data;
      sendMessageMutation.mutate({
        content: `Voice note (${formatDuration(durationSnapshot)})`,
        message_type: 'voice',
        file_url: url,
        file_name: audioFile.name,
        file_type: mimeType,
        file_size,
      });
    } catch (err) {
      toast.error('Failed to upload voice note');
    }
  }, [roomId, recordingTime, sendMessageMutation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Utilities ────────────────────────────────────────────────────────────

  const normaliseSocketMessage = (payload) => {
    const msg = payload.message || payload;
    return {
      ...msg,
      sender_name: payload.sender_name || msg.sender_name || 'Unknown',
      sender_avatar: payload.sender_avatar || msg.sender_avatar || null,
      message_type: msg.message_type || 'text',
      file_url: msg.file_url || null,
      file_name: msg.file_name || null,
      file_type: msg.file_type || null,
      file_size: msg.file_size || null,
    };
  };

  const isOwnMessage = (msg) => {
    const senderId = String(msg?.sender_id || '');
    const userId = String(user?.id || user?._id || user?.user_id || '');
    return senderId === userId && userId !== '';
  };

  const msgKey = (msg) => String(msg?._id || msg?.id || '');

  // ─── Message Content Renderer ─────────────────────────────────────────────

  const renderMessageContent = (msg, own) => {
    const type = msg.message_type || 'text';

    if (type === 'voice') {
      return (
        <div className={`flex items-center space-x-2 rounded-2xl p-2 mt-1 ${own ? 'bg-blue-500' : 'bg-gray-100'}`}>
          <Mic className={`h-4 w-4 flex-shrink-0 ${own ? 'text-white' : 'text-blue-500'}`} />
          <audio controls className="h-8 max-w-[180px]" style={{ filter: own ? 'invert(1)' : 'none' }}>
            <source src={`${BACKEND_URL}${msg.file_url}`} type={msg.file_type || 'audio/webm'} />
            Your browser does not support audio.
          </audio>
          <span className={`text-xs ${own ? 'text-blue-100' : 'text-gray-400'}`}>{msg.content}</span>
        </div>
      );
    }

    if (type === 'file') {
      const isImage = msg.file_type?.startsWith('image/');
      return (
        <div className="mt-1">
          {isImage ? (
            <a href={`${BACKEND_URL}${msg.file_url}`} target="_blank" rel="noopener noreferrer">
              <img
                src={`${BACKEND_URL}${msg.file_url}`}
                alt={msg.file_name}
                className="max-w-full rounded-lg max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </a>
          ) : (
            <div className="flex items-center space-x-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-2 max-w-xs">
              <FileText className="h-8 w-8 text-blue-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{msg.file_name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{formatFileSize(msg.file_size)}</p>
              </div>
              <a
                href={`${BACKEND_URL}${msg.file_url}`}
                download={msg.file_name}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex-shrink-0"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </a>
            </div>
          )}
        </div>
      );
    }

    if (msg.message_type === 'shared_content') {
      const renderSharedContent = (sharedContent) => {
        if (!sharedContent) return null;
        const contentType = sharedContent.content_type || sharedContent.contentType;
        const getContentStyle = () => {
          switch (contentType) {
            case 'youtube_summary':
            case 'youtube_video':
              return { icon: <Youtube className="w-4 h-4 text-red-500" />, bgColor: 'bg-red-50 dark:bg-red-900/20', borderColor: 'border-red-200 dark:border-red-800', label: 'YouTube Summary' };
            case 'youtube_session':
              return { icon: <PlayCircle className="w-4 h-4 text-red-600 dark:text-red-400" />, bgColor: 'bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/30 dark:to-orange-900/30', borderColor: 'border-red-300 dark:border-red-700', label: 'YouTube Session' };
            case 'document_session':
              return { icon: <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />, bgColor: 'bg-green-50 dark:bg-green-900/20', borderColor: 'border-green-200 dark:border-green-800', label: 'Document Session' };
            case 'document_quiz':
              return { icon: <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />, bgColor: 'bg-amber-50 dark:bg-amber-900/20', borderColor: 'border-amber-200 dark:border-amber-800', label: 'Document Quiz' };
            case 'flashcards':
              return { icon: <BookOpen className="w-4 h-4 text-purple-500" />, bgColor: 'bg-purple-50 dark:bg-purple-900/20', borderColor: 'border-purple-200 dark:border-purple-800', label: 'Flashcards' };
            case 'slides':
              return { icon: <Layers className="w-4 h-4 text-blue-500" />, bgColor: 'bg-blue-50 dark:bg-blue-900/20', borderColor: 'border-blue-200 dark:border-blue-800', label: 'Slides' };
            case 'notes':
              return { icon: <FileText className="w-4 h-4 text-green-500" />, bgColor: 'bg-green-50 dark:bg-green-900/20', borderColor: 'border-green-200 dark:border-green-800', label: 'Notes' };
            case 'ai_chat':
              return { icon: <Bot className="w-4 h-4 text-indigo-500" />, bgColor: 'bg-indigo-50 dark:bg-indigo-900/20', borderColor: 'border-indigo-200 dark:border-indigo-800', label: 'AI Chat' };
            default:
              return { icon: <Share2 className="w-4 h-4 text-gray-500" />, bgColor: 'bg-gray-50 dark:bg-gray-800', borderColor: 'border-gray-200 dark:border-gray-700', label: 'Shared Content' };
          }
        };

        const handleImportSession = async () => {
          if (!sharedContent.source_id) return toast.error('Session ID not available');
          try {
            toast.loading('Importing session...', { id: 'import-session' });
            const isDocumentSession = contentType === 'document_session' || contentType === 'document_quiz';
            const response = await (isDocumentSession ? notesAPI : youtubeAPI).importSession(sharedContent.source_id);
            toast.dismiss('import-session');
            const sessionId = response.data.already_owned ? sharedContent.source_id : response.data.session_id;
            const targetUrl = isDocumentSession ? `/notes/session/${sessionId}` : `/youtube-summarizer?session=${sessionId}`;
            if (response.data.already_owned) {
              toast.success('Opening your session...');
              navigate(targetUrl);
            } else if (response.data.already_imported || response.data.imported) {
              toast.success('Session imported! Opening...');
              navigate(targetUrl);
            }
          } catch (error) {
            toast.dismiss('import-session');
            toast.error('Failed to import session');
          }
        };

        const style = getContentStyle();

        return (
          <div className={`rounded-lg border ${style.borderColor} ${style.bgColor} p-3 max-w-xs mb-2`}>
            {sharedContent.preview_image_url && (
              <img src={sharedContent.preview_image_url} alt={sharedContent.title} className="w-full h-24 object-cover rounded-lg mb-2" onError={(e) => { e.target.style.display = 'none'; }} />
            )}
            <div className="flex items-center gap-2 mb-2">
              {style.icon}
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{style.label}</span>
            </div>
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-2 mb-1">{sharedContent.title}</h4>
            {sharedContent.description && <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 mb-2">{sharedContent.description}</p>}
            
            {(contentType === 'youtube_session' || contentType === 'document_session' || contentType === 'document_quiz') && sharedContent.source_id && (
              <Button onClick={handleImportSession} variant={contentType === 'youtube_session' ? 'danger' : 'primary'} className="w-full mt-2 justify-center" leftIcon={<Download className="w-4 h-4" />}>
                Import & Open
              </Button>
            )}
            {sharedContent.source_url && contentType !== 'youtube_session' && contentType !== 'document_session' && contentType !== 'document_quiz' && (
              <a href={sharedContent.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 mt-2">
                <ExternalLink className="w-3 h-3" /> View Original
              </a>
            )}
          </div>
        );
      };
      return (
        <div>
          {renderSharedContent(msg.shared_content)}
          {msg.content && <p className="text-sm whitespace-pre-wrap mt-1">{msg.content}</p>}
        </div>
      );
    }

    if (msg.is_ai_response || msg.message_type === 'ai_response' || msg.sender_id === 'AI') {
      return (
        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-purple-900/50 prose-pre:text-purple-100">
          <ReactMarkdown>{msg.content}</ReactMarkdown>
        </div>
      );
    }

    // Default: text
    return <p className="text-sm whitespace-pre-wrap">{msg.content}</p>;
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*,.pdf,.doc,.docx,.txt"
        className="hidden"
      />

      {/* Room header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">{room.name}</h2>
          {room.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400">{room.description}</p>
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
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No messages yet</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Start the conversation below</p>
          </div>
        ) : (
          messages.map((msg) => {
            const own = isOwnMessage(msg);
            return (
              <div key={msgKey(msg)} className={`flex w-full mb-2 ${own ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md ${own ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!own && (
                    <span className="text-xs text-gray-500 mb-1 ml-1 flex items-center gap-1">
                      {msg.is_ai_response || msg.message_type === 'ai_response' || msg.sender_id === 'AI' ? (
                        <>
                          <Bot className="w-3 h-3 text-purple-500" />
                          <span className="text-purple-600 dark:text-purple-400 font-medium">AI Assistant</span>
                        </>
                      ) : (
                        msg.sender_name || 'Unknown'
                      )}
                    </span>
                  )}

                  {msg.deleted ? (
                    <div className="px-4 py-2 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 italic text-sm">
                      This message was deleted
                    </div>
                  ) : (
                    <div className={`px-4 py-2 rounded-2xl ${
                      msg.is_ai_response || msg.message_type === 'ai_response' || msg.sender_id === 'AI'
                        ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-none border border-gray-200 dark:border-gray-700 shadow-sm'
                        : own
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-none'
                    }`}>
                      {renderMessageContent(msg, own)}
                    </div>
                  )}

                  <span className={`text-xs mt-1 text-gray-400 ${own ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {msg.edited && <span className="ml-1 italic">(edited)</span>}
                  </span>

                  {/* Message actions */}
                  {!msg.deleted && own && (
                    <div className="flex items-center space-x-1 mt-1">
                      <button
                        onClick={() => handleEditMessage(msg)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                        title="Edit"
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(msg._id || msg.id)}
                        className="text-xs text-gray-400 hover:text-red-500"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Edit bar */}
      {editingMessage && (
        <div className="px-4 py-2 border-t border-yellow-200 dark:border-yellow-900/40 bg-yellow-50 dark:bg-yellow-900/20 flex items-center space-x-2">
          <input
            type="text"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingMessage(null); }}
            className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            autoFocus
          />
          <button onClick={handleSaveEdit} className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
          <button onClick={() => setEditingMessage(null)} className="text-sm px-2 py-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Message input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">

          {/* File upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isRecording}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-40 transition-colors"
            title="Attach file"
          >
            {isUploading
              ? <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              : <Paperclip className="h-5 w-5" />
            }
          </button>

          {/* Voice note button / recording indicator */}
          {isRecording ? (
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-full">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm text-red-600 dark:text-red-400 font-medium tabular-nums">{formatDuration(recordingTime)}</span>
              <button
                type="button"
                onClick={stopRecording}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                title="Stop recording"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onMouseDown={startRecording}
              disabled={isUploading}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-40 transition-colors"
              title="Hold to record voice note"
            >
              <Mic className="h-5 w-5" />
            </button>
          )}

          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={connected ? 'Type a message...' : 'Connecting...'}
            disabled={!connected || isRecording}
            className="input flex-1"
          />

          <Button
            type="submit"
            disabled={!message.trim() || !connected || sendMessageMutation.isLoading || isRecording}
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
              <div className="fixed inset-0 bg-black bg-opacity-60" onClick={() => setShowSummary(false)} />
              <div className="relative bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Chat Summary</h3>
                    <button
                      onClick={() => setShowSummary(false)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {isLoadingSummary ? (
                      <div className="flex items-center justify-center py-8">
                        <LoadingSpinner size="lg" />
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none">
                        <MarkdownRenderer content={summary} />
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
