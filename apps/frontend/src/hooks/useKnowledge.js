import { useState, useCallback, useEffect, useRef } from 'react';
import { knowledgeService } from '../services/knowledge.service';

/**
 * Knowledge base management hook
 */
export const useKnowledge = () => {
  const [state, setState] = useState({
    documents: [],
    searchResults: [],
    isLoading: false,
    isUploading: false,
    isProcessing: false,
    error: null,
    uploadProgress: 0,
    processingStatus: null,
    searchQuery: '',
    selectedDocument: null,
    stats: {
      totalDocuments: 0,
      totalChunks: 0,
      totalSize: 0,
      lastUpdated: null,
    },
  });

  const uploadAbortControllerRef = useRef(null);

  // Load documents
  const loadDocuments = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const documents = await knowledgeService.getDocuments();
      const stats = await knowledgeService.getStats();
      
      setState(prev => ({
        ...prev,
        documents,
        stats,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false,
      }));
    }
  }, []);

  // Search documents
  const searchDocuments = useCallback(async (query, options = {}) => {
    if (!query.trim()) {
      setState(prev => ({ ...prev, searchResults: [], searchQuery: '' }));
      return;
    }

    try {
      setState(prev => ({ 
        ...prev, 
        isLoading: true, 
        searchQuery: query,
        error: null 
      }));
      
      const results = await knowledgeService.searchDocuments(query, options);
      
      setState(prev => ({
        ...prev,
        searchResults: results,
        isLoading: false,
      }));
      
      return results;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false,
        searchResults: [],
      }));
      throw error;
    }
  }, []);

  // Upload document
  const uploadDocument = useCallback(async (file, options = {}) => {
    try {
      // Validate file
      if (!file) {
        throw new Error('No file selected');
      }

      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new Error('File size too large (max 10MB)');
      }

      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/markdown',
      ];

      if (!allowedTypes.includes(file.type)) {
        throw new Error('Unsupported file type');
      }

      // Create abort controller for cancellation
      uploadAbortControllerRef.current = new AbortController();

      setState(prev => ({
        ...prev,
        isUploading: true,
        uploadProgress: 0,
        error: null,
      }));

      // Upload with progress tracking
      const response = await knowledgeService.uploadDocument(
        file,
        {
          ...options,
          signal: uploadAbortControllerRef.current.signal,
          onProgress: (progress) => {
            setState(prev => ({ ...prev, uploadProgress: progress }));
          },
        }
      );

      // Start processing
      setState(prev => ({
        ...prev,
        isUploading: false,
        isProcessing: true,
        processingStatus: 'Processing document...',
      }));

      // Wait for processing to complete
      await waitForProcessing(response.document._id);

      // Reload documents
      await loadDocuments();

      setState(prev => ({
        ...prev,
        isProcessing: false,
        processingStatus: null,
        uploadProgress: 0,
      }));

      return response.document;
    } catch (error) {
      if (error.name === 'AbortError') {
        setState(prev => ({
          ...prev,
          isUploading: false,
          isProcessing: false,
          uploadProgress: 0,
          processingStatus: null,
        }));
        return null;
      }

      setState(prev => ({
        ...prev,
        error: error.message,
        isUploading: false,
        isProcessing: false,
        uploadProgress: 0,
        processingStatus: null,
      }));
      throw error;
    }
  }, [loadDocuments]);

  // Cancel upload
  const cancelUpload = useCallback(() => {
    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
      uploadAbortControllerRef.current = null;
    }
  }, []);

  // Wait for document processing
  const waitForProcessing = useCallback(async (documentId, maxAttempts = 30) => {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const status = await knowledgeService.getProcessingStatus(documentId);
        
        setState(prev => ({
          ...prev,
          processingStatus: status.message,
        }));

        if (status.status === 'completed') {
          return status;
        }

        if (status.status === 'failed') {
          throw new Error(status.error || 'Document processing failed');
        }

        // Wait 2 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      } catch (error) {
        if (attempts >= maxAttempts - 1) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }
    }

    throw new Error('Document processing timeout');
  }, []);

  // Delete document
  const deleteDocument = useCallback(async (documentId) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      await knowledgeService.deleteDocument(documentId);
      
      setState(prev => ({
        ...prev,
        documents: prev.documents.filter(doc => doc._id !== documentId),
        selectedDocument: prev.selectedDocument?._id === documentId ? null : prev.selectedDocument,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false,
      }));
      throw error;
    }
  }, []);

  // Get document details
  const getDocumentDetails = useCallback(async (documentId) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const document = await knowledgeService.getDocument(documentId);
      
      setState(prev => ({
        ...prev,
        selectedDocument: document,
        isLoading: false,
      }));
      
      return document;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false,
      }));
      throw error;
    }
  }, []);

  // Update document metadata
  const updateDocument = useCallback(async (documentId, updates) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const updatedDocument = await knowledgeService.updateDocument(documentId, updates);
      
      setState(prev => ({
        ...prev,
        documents: prev.documents.map(doc =>
          doc._id === documentId ? updatedDocument : doc
        ),
        selectedDocument: prev.selectedDocument?._id === documentId
          ? updatedDocument
          : prev.selectedDocument,
        isLoading: false,
      }));
      
      return updatedDocument;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false,
      }));
      throw error;
    }
  }, []);

  // Get document chunks
  const getDocumentChunks = useCallback(async (documentId) => {
    try {
      const chunks = await knowledgeService.getDocumentChunks(documentId);
      return chunks;
    } catch (error) {
      setState(prev => ({ ...prev, error: error.message }));
      throw error;
    }
  }, []);

  // Reprocess document
  const reprocessDocument = useCallback(async (documentId) => {
    try {
      setState(prev => ({
        ...prev,
        isProcessing: true,
        processingStatus: 'Reprocessing document...',
        error: null,
      }));
      
      await knowledgeService.reprocessDocument(documentId);
      await waitForProcessing(documentId);
      await loadDocuments();
      
      setState(prev => ({
        ...prev,
        isProcessing: false,
        processingStatus: null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isProcessing: false,
        processingStatus: null,
      }));
      throw error;
    }
  }, [waitForProcessing, loadDocuments]);

  // Clear search
  const clearSearch = useCallback(() => {
    setState(prev => ({
      ...prev,
      searchResults: [],
      searchQuery: '',
    }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Get document by ID
  const getDocumentById = useCallback((documentId) => {
    return state.documents.find(doc => doc._id === documentId);
  }, [state.documents]);

  // Get documents by type
  const getDocumentsByType = useCallback((type) => {
    return state.documents.filter(doc => doc.type === type);
  }, [state.documents]);

  // Get documents by status
  const getDocumentsByStatus = useCallback((status) => {
    return state.documents.filter(doc => doc.status === status);
  }, [state.documents]);

  // Bulk operations
  const bulkDeleteDocuments = useCallback(async (documentIds) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      await knowledgeService.bulkDeleteDocuments(documentIds);
      
      setState(prev => ({
        ...prev,
        documents: prev.documents.filter(doc => !documentIds.includes(doc._id)),
        selectedDocument: documentIds.includes(prev.selectedDocument?._id) 
          ? null 
          : prev.selectedDocument,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false,
      }));
      throw error;
    }
  }, []);

  // Export knowledge base
  const exportKnowledgeBase = useCallback(async (format = 'json') => {
    try {
      const data = await knowledgeService.exportKnowledgeBase(format);
      return data;
    } catch (error) {
      setState(prev => ({ ...prev, error: error.message }));
      throw error;
    }
  }, []);

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (uploadAbortControllerRef.current) {
        uploadAbortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    loadDocuments,
    searchDocuments,
    uploadDocument,
    cancelUpload,
    deleteDocument,
    getDocumentDetails,
    updateDocument,
    getDocumentChunks,
    reprocessDocument,
    clearSearch,
    clearError,
    bulkDeleteDocuments,
    exportKnowledgeBase,
    
    // Utilities
    getDocumentById,
    getDocumentsByType,
    getDocumentsByStatus,
    
    // Computed values
    hasDocuments: state.documents.length > 0,
    hasSearchResults: state.searchResults.length > 0,
    isSearching: state.searchQuery.length > 0,
    canUpload: !state.isUploading && !state.isProcessing,
    processingDocuments: state.documents.filter(doc => doc.status === 'processing'),
    completedDocuments: state.documents.filter(doc => doc.status === 'completed'),
    failedDocuments: state.documents.filter(doc => doc.status === 'failed'),
  };
};

export default useKnowledge;