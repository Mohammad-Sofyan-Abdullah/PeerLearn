import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Save,
  Bold,
  Italic,
  Underline,
  MessageSquare,
  Send,
  Loader,
  FileText,
  Sparkles,
  Undo,
  Redo,
  Highlighter,
  Trash2,
  RefreshCw,
  Camera,
  Share2,
  Eye
} from 'lucide-react';
import { notesAPI } from '../utils/api';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import ShareNoteModal from '../components/ShareNoteModal';
import MarkdownRenderer from '../components/MarkdownRenderer';

const DocumentEditorPage = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const editorRef = useRef(null);
  const broadcastTimerRef = useRef(null);
  const { joinDocument, leaveDocument, broadcastDocumentUpdate } = useSocket();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [fontSize, setFontSize] = useState('16');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Simple undo/redo state
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Fetch document
  const { data: noteDocument, isLoading } = useQuery(
    ['document', documentId],
    () => notesAPI.getDocument(documentId).then(res => res.data),
    {
      onSuccess: (data) => {
        setTitle(data.title);
        setContent(data.content || '');
        setUndoStack([data.content || '']);
        // NOTE: innerHTML is set via the useEffect below to avoid
        // overwriting user edits on every react-query refetch.
      },
      onError: () => {
        toast.error('Failed to load document');
        navigate('/notes');
      }
    }
  );

  // Populate editor ONLY when it is empty (first load or empty state).
  // This prevents save-triggered invalidateQueries refetches from
  // overwriting content the user is actively editing.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !noteDocument?.content) return;
    if (editor.innerHTML === '' || editor.innerHTML === '<br>') {
      editor.innerHTML = noteDocument.content;
    }
  }, [noteDocument?.content]);

  // Join/leave document socket room for collaborative editing
  useEffect(() => {
    if (documentId) {
      joinDocument(documentId);
    }
    return () => {
      if (documentId) leaveDocument(documentId);
      if (broadcastTimerRef.current) clearTimeout(broadcastTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  // Listen for remote document updates (sent by other collaborators)
  useEffect(() => {
    const handleRemoteUpdate = (e) => {
      const { document_id, html } = e.detail || {};
      if (document_id !== documentId || !editorRef.current) return;

      // Save and restore cursor position (best-effort for last-write-wins)
      const sel = window.getSelection();
      let savedRange = null;
      if (sel && sel.rangeCount > 0) {
        savedRange = sel.getRangeAt(0).cloneRange();
      }

      editorRef.current.innerHTML = html;
      setContent(html);

      // Try to restore cursor
      if (savedRange) {
        try {
          sel.removeAllRanges();
          sel.addRange(savedRange);
        } catch (_) { /* ignore if node no longer exists */ }
      }
    };
    window.addEventListener('remote_document_update', handleRemoteUpdate);
    return () => window.removeEventListener('remote_document_update', handleRemoteUpdate);
  }, [documentId]);

  // Fetch chat history
  const { data: chatData } = useQuery(
    ['document-chat', documentId],
    () => notesAPI.getChatHistory(documentId).then(res => res.data),
    {
      onSuccess: (data) => {
        setChatHistory(data.chat_history || []);
      },
      enabled: !!documentId
    }
  );

  // Update document mutation
  const updateDocumentMutation = useMutation(
    (updateData) => notesAPI.updateDocument(documentId, updateData),
    {
      onSuccess: () => {
        toast.success('Document saved');
        setHasUnsavedChanges(false);
        queryClient.invalidateQueries(['document', documentId]);
      },
      onError: () => toast.error('Failed to save document')
    }
  );

  // Reprocess OCR mutation
  const reprocessOCRMutation = useMutation(
    () => notesAPI.reprocessWithOCR(documentId),
    {
      onSuccess: (response) => {
        toast.success('Document reprocessed with OCR successfully');
        queryClient.invalidateQueries(['document', documentId]);
        // Refresh the page to show updated content
        window.location.reload();
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.detail || 'Failed to reprocess document';
        toast.error(errorMessage);
      }
    }
  );
  const deleteDocumentMutation = useMutation(
    () => notesAPI.deleteDocument(documentId),
    {
      onSuccess: () => {
        toast.success('Document deleted');
        navigate('/notes');
      },
      onError: () => toast.error('Failed to delete document')
    }
  );

  // Chat mutation
  const chatMutation = useMutation(
    (message) => notesAPI.chatWithDocument(documentId, message),
    {
      onSuccess: (response) => {
        const newMessage = response.data;
        setChatHistory(prev => [...prev, newMessage]);
        setChatMessage('');
        queryClient.invalidateQueries(['document-chat', documentId]);
      },
      onError: () => toast.error('Failed to send message')
    }
  );

  // Generate notes mutation
  const generateNotesMutation = useMutation(
    (prompt) => notesAPI.generateNotes(documentId, prompt),
    {
      onSuccess: (response) => {
        const generatedNotes = response.data.notes;
        insertHtmlAtCursor(markdownToHtml(generatedNotes));
        toast.success('Notes generated and inserted');
      },
      onError: () => toast.error('Failed to generate notes')
    }
  );

  // Save to undo stack
  const saveToUndoStack = useCallback(() => {
    setUndoStack(prev => {
      const newStack = [...prev];
      if (newStack[newStack.length - 1] !== content) {
        newStack.push(content);
        return newStack.slice(-20);
      }
      return newStack;
    });
    setRedoStack([]);
  }, [content]);

  // Handle content change
  const handleContentChange = useCallback((newContent) => {
    setContent(newContent);
    setHasUnsavedChanges(true);
  }, []);

  // Rich text formatting with execCommand
  const applyFormatting = useCallback((command, value = null) => {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) {
      toast.error('Please select text to format');
      return;
    }

    saveToUndoStack();

    try {
      // Do NOT call editor.focus() here — it would clear the text selection
      document.execCommand(command, false, value);

      // Update content state
      handleContentChange(editor.innerHTML);

    } catch (error) {
      console.error('Formatting error:', error);
      // Fallback to manual formatting
      applyManualFormatting(command, value);
    }
  }, [saveToUndoStack, handleContentChange]);

  // Manual formatting fallback
  const applyManualFormatting = useCallback((command, value) => {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    try {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      
      if (!selectedText) return;

      let element;
      switch (command) {
        case 'bold':
          element = document.createElement('strong');
          break;
        case 'italic':
          element = document.createElement('em');
          break;
        case 'underline':
          element = document.createElement('u');
          break;
        case 'hiliteColor':
          element = document.createElement('mark');
          if (value) element.style.backgroundColor = value;
          break;
        case 'fontName':
          element = document.createElement('span');
          if (value) element.style.fontFamily = value;
          break;
        case 'fontSize':
          element = document.createElement('span');
          if (value) {
            const sizeMap = { 1: '12px', 2: '14px', 3: '16px', 4: '18px', 5: '20px', 6: '24px', 7: '28px' };
            element.style.fontSize = sizeMap[value] || '16px';
          }
          break;
        default:
          return;
      }

      const fragment = range.extractContents();
      element.appendChild(fragment);
      range.insertNode(element);

      // Clear selection
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.setStartAfter(element);
      newRange.collapse(true);
      selection.addRange(newRange);

      handleContentChange(editor.innerHTML);
    } catch (error) {
      console.error('Manual formatting error:', error);
    }
  }, [handleContentChange]);

  const handleBold = useCallback(() => {
    applyFormatting('bold');
  }, [applyFormatting]);

  const handleItalic = useCallback(() => {
    applyFormatting('italic');
  }, [applyFormatting]);

  const handleUnderline = useCallback(() => {
    applyFormatting('underline');
  }, [applyFormatting]);

  const handleHighlight = useCallback(() => {
    applyFormatting('hiliteColor', '#ffff00');
  }, [applyFormatting]);

  // Undo function
  const handleUndo = useCallback(() => {
    if (undoStack.length > 1) {
      const currentContent = undoStack[undoStack.length - 1];
      const previousContent = undoStack[undoStack.length - 2];
      
      setRedoStack(prev => [...prev, currentContent]);
      setUndoStack(prev => prev.slice(0, -1));
      
      setContent(previousContent);
      setHasUnsavedChanges(true);
      
      if (editorRef.current) {
        editorRef.current.innerHTML = previousContent;
      }
    }
  }, [undoStack]);

  // Redo function
  const handleRedo = useCallback(() => {
    if (redoStack.length > 0) {
      const nextContent = redoStack[redoStack.length - 1];
      
      setUndoStack(prev => [...prev, content]);
      setRedoStack(prev => prev.slice(0, -1));
      
      setContent(nextContent);
      setHasUnsavedChanges(true);
      
      if (editorRef.current) {
        editorRef.current.innerHTML = nextContent;
      }
    }
  }, [redoStack, content]);

  // Save function
  const handleSave = useCallback(() => {
    // Store the raw HTML directly — preserves all rich formatting
    const rawHtml = editorRef.current ? editorRef.current.innerHTML : content;

    updateDocumentMutation.mutate({
      title: title.trim(),
      content: rawHtml
    });
  }, [title, content, updateDocumentMutation]);

  // Delete function
  const handleDelete = useCallback(() => {
    if (window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      deleteDocumentMutation.mutate();
    }
  }, [deleteDocumentMutation]);

  // Convert markdown to HTML for insertion into the contentEditable editor
  const markdownToHtml = useCallback((markdown) => {
    if (!markdown) return '';
    let html = markdown;

    // Strip wrapping ```html ... ``` or ``` ... ``` code fences the AI sometimes adds
    html = html.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/, '');

    // Already looks like HTML — return as-is
    if (/^\s*<[a-z]/i.test(html)) return html;

    // Headers (must run before bold/italic so ## isn't eaten mid-line)
    html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:1.1rem;font-weight:700;margin:1rem 0 0.4rem">$1</h3>');
    html = html.replace(/^## (.+)$/gm,  '<h2 style="font-size:1.25rem;font-weight:700;margin:1.2rem 0 0.5rem">$1</h2>');
    html = html.replace(/^# (.+)$/gm,   '<h1 style="font-size:1.5rem;font-weight:700;margin:1.4rem 0 0.6rem">$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Collect consecutive list items into a single <ul>
    const lines = html.split('\n');
    const out = [];
    let inList = false;
    for (const line of lines) {
      const bulletMatch = line.match(/^[-*+]\s+(.+)$/);
      const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
      if (bulletMatch) {
        if (!inList) { out.push('<ul style="list-style:disc;padding-left:1.5rem;margin:0.5rem 0">'); inList = 'ul'; }
        out.push(`<li>${bulletMatch[1]}</li>`);
      } else if (orderedMatch) {
        if (!inList) { out.push('<ol style="list-style:decimal;padding-left:1.5rem;margin:0.5rem 0">'); inList = 'ol'; }
        out.push(`<li>${orderedMatch[1]}</li>`);
      } else {
        if (inList) { out.push(`</${inList}>`); inList = false; }
        out.push(line);
      }
    }
    if (inList) out.push(`</${inList}>`);
    html = out.join('\n');

    // Wrap remaining plain-text lines (not already wrapped in a block element) in <p>
    html = html.replace(
      /^(?!\s*<[huo]|\s*<li|\s*<\/|\s*$)(.+)$/gm,
      '<p style="margin:0.4rem 0">$1</p>'
    );

    // Double newlines between blocks
    html = html.replace(/\n{2,}/g, '\n');

    return html;
  }, []);

  // Insert HTML into the contentEditable editor at the current cursor position
  const insertHtmlAtCursor = useCallback((html) => {
    saveToUndoStack();
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();

    const divider = '<hr style="border:none;border-top:1px solid #e5e7eb;margin:1rem 0"/>';
    const payload = divider + html;

    // execCommand('insertHTML') inserts real DOM nodes at the cursor
    const success = document.execCommand('insertHTML', false, payload);

    if (!success) {
      // Fallback: append to end
      editor.innerHTML += payload;
    }

    handleContentChange(editor.innerHTML);
  }, [saveToUndoStack, handleContentChange]);

  // Insert plain text at cursor (kept for other callers)
  const insertTextAtCursor = useCallback((text) => {
    saveToUndoStack();
    
    const editor = editorRef.current;
    if (editor) {
      editor.focus();
      
      const selection = window.getSelection();
      let range;
      
      if (selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
      } else {
        range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
      }
      
      // Create text node
      const textNode = document.createTextNode('\n\n' + text + '\n\n');
      range.insertNode(textNode);
      
      // Move cursor after inserted text
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
      
      handleContentChange(editor.innerHTML);
    }
  }, [saveToUndoStack, handleContentChange]);

  // Handle editor input — update state and broadcast to collaborators
  const handleEditorInput = useCallback(() => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      handleContentChange(html);

      // Debounced broadcast (300 ms)
      if (broadcastTimerRef.current) clearTimeout(broadcastTimerRef.current);
      broadcastTimerRef.current = setTimeout(() => {
        broadcastDocumentUpdate(documentId, html);
      }, 300);
    }
  }, [handleContentChange, broadcastDocumentUpdate, documentId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'z':
            if (e.shiftKey) {
              e.preventDefault();
              handleRedo();
            } else {
              e.preventDefault();
              handleUndo();
            }
            break;
          case 'y':
            e.preventDefault();
            handleRedo();
            break;
          case 's':
            e.preventDefault();
            handleSave();
            break;
          case 'b':
            e.preventDefault();
            handleBold();
            break;
          case 'i':
            e.preventDefault();
            handleItalic();
            break;
          case 'u':
            e.preventDefault();
            handleUnderline();
            break;
          case 'h':
            e.preventDefault();
            handleHighlight();
            break;
          default:
            break;
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleUndo, handleRedo, handleSave, handleBold, handleItalic, handleUnderline, handleHighlight]);

  // Save to undo stack when content changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveToUndoStack();
    }, 1000);
    return () => clearTimeout(timer);
  }, [content, saveToUndoStack]);

  // Handle chat submit
  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    
    chatMutation.mutate(chatMessage.trim());
  };

  // Handle quick prompts
  const handleQuickPrompt = (prompt) => {
    generateNotesMutation.mutate(prompt);
  };

  const quickPrompts = [
    "Make notes from this document",
    "Summarize the key points",
    "Create bullet-point notes",
    "Extract important definitions",
    "Generate study questions"
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
      {/* Main Editor Area */}
      <div className={`flex-1 flex flex-col ${isChatOpen ? 'mr-80' : ''} transition-all duration-300`}>
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/notes')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="text-lg font-medium bg-transparent border-none outline-none focus:bg-gray-50 dark:focus:bg-gray-800 px-2 py-1 rounded text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="Document title..."
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Undo/Redo Controls */}
              <div className="flex items-center space-x-1 border-r border-gray-200 dark:border-gray-700 pr-4">
                <button
                  onClick={handleUndo}
                  disabled={undoStack.length <= 1}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo className="h-4 w-4" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo className="h-4 w-4" />
                </button>
              </div>
              
              {/* Formatting Controls */}
              <div className="flex items-center space-x-1 border-r border-gray-200 dark:border-gray-700 pr-4">
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleBold}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                  title="Bold (Ctrl+B)"
                >
                  <Bold className="h-4 w-4" />
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleItalic}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                  title="Italic (Ctrl+I)"
                >
                  <Italic className="h-4 w-4" />
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleUnderline}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                  title="Underline (Ctrl+U)"
                >
                  <Underline className="h-4 w-4" />
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleHighlight}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                  title="Highlight (Ctrl+H)"
                >
                  <Highlighter className="h-4 w-4" />
                </button>
              </div>
              
              {/* Font Controls */}
              <div className="flex items-center space-x-2 border-r border-gray-200 dark:border-gray-700 pr-4">
                <select
                  value={fontSize}
                  onMouseDown={(e) => e.preventDefault()}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFontSize(value);
                    const selection = window.getSelection();
                    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                      const sizeMap = { '12': 1, '14': 2, '16': 3, '18': 4, '20': 5, '24': 6 };
                      applyFormatting('fontSize', sizeMap[value] || 3);
                    } else if (editorRef.current) {
                      editorRef.current.style.fontSize = `${value}px`;
                    }
                  }}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="12">12px</option>
                  <option value="14">14px</option>
                  <option value="16">16px</option>
                  <option value="18">18px</option>
                  <option value="20">20px</option>
                  <option value="24">24px</option>
                </select>
                <select
                  value={fontFamily}
                  onMouseDown={(e) => e.preventDefault()}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFontFamily(value);
                    const selection = window.getSelection();
                    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                      applyFormatting('fontName', value);
                    } else if (editorRef.current) {
                      editorRef.current.style.fontFamily = value;
                    }
                  }}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="Inter">Inter</option>
                  <option value="Arial">Arial</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Roboto">Roboto</option>
                </select>
              </div>
              
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`p-2 rounded transition-colors ${
                  isChatOpen ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                title="Toggle AI Chat"
              >
                <MessageSquare className="h-5 w-5" />
              </button>

              {/* View button — only shown to the document owner */}
              {noteDocument && String(noteDocument.user_id) === String(user?.id) && (
                <button
                  onClick={() => navigate(`/notes/view/${documentId}`)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors text-gray-600 dark:text-gray-400"
                  title="View document"
                >
                  <Eye className="h-5 w-5" />
                </button>
              )}

              <button
                onClick={() => setShowShareModal(true)}
                className="p-2 hover:bg-indigo-100 text-indigo-600 rounded transition-colors"
                title="Share to classroom room"
              >
                <Share2 className="h-5 w-5" />
              </button>
              
              {/* OCR Reprocess Button - Show for images, videos, or failed extractions */}
              {noteDocument && (
                (noteDocument.file_name && (
                  /\.(jpg|jpeg|png|bmp|tiff|tif|webp|gif|mp4|avi|mov|mkv|wmv|flv|webm|m4v)$/i.test(noteDocument.file_name) ||
                  noteDocument.extraction_method?.includes('failed') ||
                  noteDocument.content?.includes('extraction failed')
                )) && (
                  <button
                    onClick={() => reprocessOCRMutation.mutate()}
                    disabled={reprocessOCRMutation.isLoading}
                    className="p-2 hover:bg-green-100 text-green-600 rounded transition-colors disabled:opacity-50"
                    title="Reprocess with OCR"
                  >
                    {reprocessOCRMutation.isLoading ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </button>
                )
              )}
              
              <button
                onClick={handleDelete}
                disabled={deleteDocumentMutation.isLoading}
                className="p-2 hover:bg-red-100 text-red-600 rounded transition-colors disabled:opacity-50"
                title="Delete Document"
              >
                {deleteDocumentMutation.isLoading ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
              
              <button
                onClick={handleSave}
                disabled={updateDocumentMutation.isLoading}
                className="flex items-center space-x-2 px-3 py-2 rounded transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {updateDocumentMutation.isLoading ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>

        {/* Rich Text Editor */}
        <div className="flex-1 p-0 sm:p-4 flex flex-col">
          <div className="w-full h-full flex flex-col">
            <div className="bg-white dark:bg-gray-900 rounded-none sm:rounded-lg border-0 sm:border border-gray-200 dark:border-gray-800 shadow-sm flex-1 flex flex-col">
              <div
                ref={editorRef}
                contentEditable
                onInput={handleEditorInput}
                className="w-full flex-1 min-h-[600px] p-6 sm:p-10 bg-white dark:bg-gray-900 sm:rounded-lg border-none resize-none outline-none focus:ring-0 focus:outline-none"
                style={{
                  fontSize: `${fontSize}px`,
                  fontFamily: fontFamily,
                  lineHeight: '1.6',
                  color: undefined
                }}
                spellCheck="true"
                suppressContentEditableWarning={true}
                data-placeholder="Start writing your document..."
              />
            </div>
            
            {/* Status Bar */}
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center space-x-4">
                <span>{editorRef.current ? editorRef.current.textContent.length : 0} characters</span>
                <span>{editorRef.current ? editorRef.current.textContent.split(/\s+/).filter(word => word.length > 0).length : 0} words</span>
                <span>Undo: {undoStack.length - 1}</span>
                <span>Redo: {redoStack.length}</span>
              </div>
              <div className="flex items-center space-x-2">
                {hasUnsavedChanges && (
                  <span className="text-orange-500">Unsaved changes</span>
                )}
                <span>Select text and use formatting buttons • Rich text editor</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Chat Sidebar */}
      {isChatOpen && (
        <motion.div
          initial={{ x: 320 }}
          animate={{ x: 0 }}
          exit={{ x: 320 }}
          className="fixed right-0 top-0 h-full w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col"
        >
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <h3 className="font-medium text-gray-900 dark:text-white">AI Assistant</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Ask questions or request notes generation
            </p>
          </div>

          {/* Quick Prompts */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Actions</h4>
            <div className="space-y-2">
              {quickPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickPrompt(prompt)}
                  disabled={generateNotesMutation.isLoading}
                  className="w-full text-left text-sm p-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded transition-colors disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatHistory.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No conversation yet</p>
                <p className="text-xs">Ask a question to get started</p>
              </div>
            ) : (
              chatHistory.map((chat, index) => (
                <div key={index} className="space-y-2">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <p className="text-sm text-blue-900 dark:text-blue-300">{chat.message}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <MarkdownRenderer content={chat.response} />
                  </div>
                </div>
              ))
            )}
            
            {(chatMutation.isLoading || generateNotesMutation.isLoading) && (
              <div className="flex items-center space-x-2 text-gray-500">
                <Loader className="h-4 w-4 animate-spin" />
                <span className="text-sm">
                  {generateNotesMutation.isLoading ? 'Generating notes...' : 'Thinking...'}
                </span>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <form onSubmit={handleChatSubmit} className="flex space-x-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Ask about your document..."
                className="flex-1 input text-sm"
                disabled={chatMutation.isLoading}
              />
              <button
                type="submit"
                disabled={!chatMessage.trim() || chatMutation.isLoading}
                className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </motion.div>
      )}

      {/* Share to Room Modal */}
      {showShareModal && (
        <ShareNoteModal
          documentId={documentId}
          documentTitle={title}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};

export default DocumentEditorPage;