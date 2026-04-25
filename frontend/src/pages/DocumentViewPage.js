import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Edit3,
  Download,
  Sparkles,
  Play,
  FileText,
  Clock,
  Calendar,
  Loader,
  Share2
} from 'lucide-react';
import { notesAPI } from '../utils/api';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import ShareNoteModal from '../components/ShareNoteModal';

const DocumentViewPage = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Fetch document
  const { data: document, isLoading, isError } = useQuery(
    ['document', documentId],
    () => notesAPI.getDocument(documentId).then(res => res.data),
    {
      onError: () => {
        toast.error('Failed to load document');
        navigate('/notes');
      }
    }
  );

  // Fetch sessions to check if an AI session already exists for this doc
  const { data: sessions = [] } = useQuery(
    ['documentSessions'],
    () => notesAPI.getSessions().then(res => res.data),
    { enabled: !!documentId }
  );

  const existingSession = sessions.find(
    s => s.document_id === documentId
  );

  // Create AI Session
  const createSessionMutation = useMutation(
    () => notesAPI.createSession(documentId),
    {
      onSuccess: (response) => {
        toast.success('AI Session created!');
        queryClient.invalidateQueries('documentSessions');
        navigate(`/notes/session/${response.data.id || response.data._id}`);
      },
      onError: () => toast.error('Failed to create AI session')
    }
  );

  // PDF Export
  const handleExport = useCallback(async () => {
    if (!document) return;
    setIsExporting(true);
    try {
      const response = await notesAPI.exportDocumentPdf(documentId);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `${document.title || 'document'}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded!');
    } catch (err) {
      toast.error('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  }, [document, documentId]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const wordCount = (html) => {
    if (!html) return 0;
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text ? text.split(' ').length : 0;
  };

  // Normalise legacy plain-text content (newlines) to HTML for display.
  // Documents saved before the HTML-storage fix used regex-stripped text with \n.
  // Documents saved after the fix store raw innerHTML with real tags.
  const normalizeContent = (content) => {
    if (!content) return '';
    // If content contains any HTML tag, treat it as HTML already
    if (/<[a-z][\s\S]*>/i.test(content)) return content;
    // Otherwise convert newlines to <br/> so paragraphs render correctly
    return content.replace(/\n/g, '<br/>');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isError || !document) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Document not found</h2>
          <button
            onClick={() => navigate('/notes')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Notes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Back + title */}
            <div className="flex items-center space-x-4 min-w-0">
              <button
                onClick={() => navigate('/notes')}
                className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back to Notes"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-gray-900 truncate">{document.title}</h1>
                <div className="flex items-center space-x-3 text-xs text-gray-500 mt-0.5">
                  <span className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(document.updated_at)}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>{wordCount(document.content)} words</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              {/* Share to room */}
              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors"
              >
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">Share</span>
              </button>

              {/* Download PDF */}
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors disabled:opacity-50"
              >
                {isExporting ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">PDF</span>
              </button>

              {/* AI Session */}
              {existingSession ? (
                <button
                  onClick={() => navigate(`/notes/session/${existingSession.id || existingSession._id}`)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 text-sm text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
                >
                  <Play className="h-4 w-4" />
                  <span>Open AI Session</span>
                </button>
              ) : (
                <button
                  onClick={() => createSessionMutation.mutate()}
                  disabled={createSessionMutation.isLoading}
                  className="flex items-center space-x-1.5 px-3 py-1.5 text-sm text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  {createSessionMutation.isLoading ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  <span>Start AI Session</span>
                </button>
              )}

              {/* Edit */}
              <button
                onClick={() => navigate(`/notes/editor/${documentId}`)}
                className="flex items-center space-x-1.5 px-4 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium"
              >
                <Edit3 className="h-4 w-4" />
                <span>Edit</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Document Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
        >
          {/* Document header */}
          <div className="px-10 pt-10 pb-6 border-b border-gray-100">
            <h2 className="text-3xl font-bold text-gray-900">{document.title}</h2>
          </div>

          {/* Prose body */}
          <div className="px-10 py-8">
            {document.content ? (
              <div
                className="prose prose-lg max-w-none text-gray-800 leading-relaxed"
                style={{
                  fontFamily: 'Inter, system-ui, sans-serif',
                  lineHeight: '1.75',
                }}
                dangerouslySetInnerHTML={{ __html: normalizeContent(document.content) }}
              />
            ) : (
              <div className="text-center py-16 text-gray-400">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-40" />
                <p className="text-lg">This document is empty.</p>
                <button
                  onClick={() => navigate(`/notes/editor/${documentId}`)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Start Writing
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <ShareNoteModal
          documentId={documentId}
          documentTitle={document.title}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};

export default DocumentViewPage;
