import api, { crud, apiUtils, APIError } from "./api.js";

/**
 * Knowledge base service for document management and search
 */
export class KnowledgeService {
  constructor() {
    this.baseEndpoint = "/knowledge";
    this.uploadEndpoint = "/upload";
    this.supportedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/markdown",
      "application/msword",
    ];
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
  }

  // Validate file before upload
  validateFile(file) {
    if (!file) {
      throw new APIError("No file provided", 400);
    }

    if (file.size > this.maxFileSize) {
      throw new APIError(
        `File too large. Maximum size is ${this.maxFileSize / 1024 / 1024}MB`,
        400
      );
    }

    if (!this.supportedTypes.includes(file.type)) {
      throw new APIError(
        `Unsupported file type. Supported types: ${this.supportedTypes.join(
          ", "
        )}`,
        400
      );
    }

    return true;
  }

  // Get all documents
  async getDocuments(params = {}) {
    try {
      const queryParams = {
        limit: params.limit || 50,
        offset: params.offset || 0,
        sortBy: params.sortBy || "updatedAt",
        sortOrder: params.sortOrder || "desc",
        status: params.status,
        type: params.type,
        ...params,
      };

      const response = await crud.get(
        `${this.baseEndpoint}/documents`,
        queryParams
      );
      return response;
    } catch (error) {
      console.error("Error fetching documents:", error);
      throw new APIError("Failed to fetch documents", error.status, error.data);
    }
  }

  // Get single document
  async getDocument(documentId) {
    try {
      if (!documentId) {
        throw new APIError("Document ID is required", 400);
      }

      const response = await crud.get(
        `${this.baseEndpoint}/documents/${documentId}`
      );
      return response;
    } catch (error) {
      console.error("Error fetching document:", error);
      throw new APIError("Failed to fetch document", error.status, error.data);
    }
  }

  // Upload document
  async uploadDocument(file, options = {}) {
    try {
      // Validate file
      this.validateFile(file);

      const formData = new FormData();
      formData.append("document", file);

      // Add metadata
      if (options.title) {
        formData.append("title", options.title);
      }
      if (options.description) {
        formData.append("description", options.description);
      }
      if (options.tags) {
        formData.append("tags", JSON.stringify(options.tags));
      }
      if (options.metadata) {
        formData.append("metadata", JSON.stringify(options.metadata));
      }

      const response = await api.post(
        `${this.baseEndpoint}${this.uploadEndpoint}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            if (options.onProgress) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              options.onProgress(percentCompleted);
            }
          },
          signal: options.signal,
        }
      );

      return response.data;
    } catch (error) {
      console.error("Error uploading document:", error);
      throw new APIError("Failed to upload document", error.status, error.data);
    }
  }

  // Update document metadata
  async updateDocument(documentId, data) {
    try {
      if (!documentId) {
        throw new APIError("Document ID is required", 400);
      }

      const response = await crud.put(
        `${this.baseEndpoint}/documents/${documentId}`,
        data
      );
      return response;
    } catch (error) {
      console.error("Error updating document:", error);
      throw new APIError("Failed to update document", error.status, error.data);
    }
  }

  // Delete document
  async deleteDocument(documentId) {
    try {
      if (!documentId) {
        throw new APIError("Document ID is required", 400);
      }

      const response = await crud.delete(
        `${this.baseEndpoint}/documents/${documentId}`
      );
      return response;
    } catch (error) {
      console.error("Error deleting document:", error);
      throw new APIError("Failed to delete document", error.status, error.data);
    }
  }

  // Search documents
  async searchDocuments(query, options = {}) {
    try {
      if (!query) {
        return { results: [], total: 0 };
      }

      const searchParams = {
        q: query,
        limit: options.limit || 20,
        offset: options.offset || 0,
        threshold: options.threshold || 0.7,
        includeContent: options.includeContent || false,
        includeMetadata: options.includeMetadata || true,
        ...options,
      };

      const response = await crud.get(
        `${this.baseEndpoint}/search`,
        searchParams
      );
      return response;
    } catch (error) {
      console.error("Error searching documents:", error);
      throw new APIError(
        "Failed to search documents",
        error.status,
        error.data
      );
    }
  }

  // Get document chunks
  async getDocumentChunks(documentId, params = {}) {
    try {
      if (!documentId) {
        throw new APIError("Document ID is required", 400);
      }

      const queryParams = {
        limit: params.limit || 50,
        offset: params.offset || 0,
        includeEmbeddings: params.includeEmbeddings || false,
        ...params,
      };

      const response = await crud.get(
        `${this.baseEndpoint}/documents/${documentId}/chunks`,
        queryParams
      );
      return response;
    } catch (error) {
      console.error("Error fetching document chunks:", error);
      throw new APIError(
        "Failed to fetch document chunks",
        error.status,
        error.data
      );
    }
  }

  // Get processing status
  async getProcessingStatus(documentId) {
    try {
      if (!documentId) {
        throw new APIError("Document ID is required", 400);
      }

      const response = await crud.get(
        `${this.baseEndpoint}/documents/${documentId}/status`
      );
      return response;
    } catch (error) {
      console.error("Error fetching processing status:", error);
      throw new APIError(
        "Failed to fetch processing status",
        error.status,
        error.data
      );
    }
  }

  // Reprocess document
  async reprocessDocument(documentId, options = {}) {
    try {
      if (!documentId) {
        throw new APIError("Document ID is required", 400);
      }

      const response = await crud.post(
        `${this.baseEndpoint}/documents/${documentId}/reprocess`,
        options
      );
      return response;
    } catch (error) {
      console.error("Error reprocessing document:", error);
      throw new APIError(
        "Failed to reprocess document",
        error.status,
        error.data
      );
    }
  }

  // Get knowledge base statistics
  async getStats() {
    try {
      const response = await crud.get(`${this.baseEndpoint}/stats`);
      return response;
    } catch (error) {
      console.error("Error fetching knowledge base stats:", error);
      throw new APIError(
        "Failed to fetch knowledge base statistics",
        error.status,
        error.data
      );
    }
  }

  // Download document
  async downloadDocument(documentId) {
    try {
      if (!documentId) {
        throw new APIError("Document ID is required", 400);
      }

      const document = await this.getDocument(documentId);
      const filename = document.originalName || `document_${documentId}`;

      const response = await apiUtils.downloadFile(
        `${this.baseEndpoint}/documents/${documentId}/download`,
        filename
      );

      return response;
    } catch (error) {
      console.error("Error downloading document:", error);
      throw new APIError(
        "Failed to download document",
        error.status,
        error.data
      );
    }
  }

  // Bulk operations
  async bulkDeleteDocuments(documentIds) {
    try {
      if (!documentIds || documentIds.length === 0) {
        throw new APIError("Document IDs are required", 400);
      }

      const response = await crud.post(
        `${this.baseEndpoint}/documents/bulk-delete`,
        {
          documentIds,
        }
      );

      return response;
    } catch (error) {
      console.error("Error bulk deleting documents:", error);
      throw new APIError(
        "Failed to bulk delete documents",
        error.status,
        error.data
      );
    }
  }

  // Bulk reprocess documents
  async bulkReprocessDocuments(documentIds) {
    try {
      if (!documentIds || documentIds.length === 0) {
        throw new APIError("Document IDs are required", 400);
      }

      const response = await crud.post(
        `${this.baseEndpoint}/documents/bulk-reprocess`,
        {
          documentIds,
        }
      );

      return response;
    } catch (error) {
      console.error("Error bulk reprocessing documents:", error);
      throw new APIError(
        "Failed to bulk reprocess documents",
        error.status,
        error.data
      );
    }
  }

  // Export knowledge base
  async exportKnowledgeBase(format = "json") {
    try {
      const validFormats = ["json", "csv", "xlsx"];
      if (!validFormats.includes(format)) {
        throw new APIError(
          `Invalid format. Supported formats: ${validFormats.join(", ")}`,
          400
        );
      }

      const response = await apiUtils.downloadFile(
        `${this.baseEndpoint}/export?format=${format}`,
        `knowledge_base.${format}`
      );

      return response;
    } catch (error) {
      console.error("Error exporting knowledge base:", error);
      throw new APIError(
        "Failed to export knowledge base",
        error.status,
        error.data
      );
    }
  }

  // Import knowledge base
  async importKnowledgeBase(file, options = {}) {
    try {
      this.validateFile(file);

      const formData = new FormData();
      formData.append("file", file);

      if (options.overwrite) {
        formData.append("overwrite", "true");
      }
      if (options.skipErrors) {
        formData.append("skipErrors", "true");
      }

      const response = await api.post(`${this.baseEndpoint}/import`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          if (options.onProgress) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            options.onProgress(percentCompleted);
          }
        },
      });

      return response.data;
    } catch (error) {
      console.error("Error importing knowledge base:", error);
      throw new APIError(
        "Failed to import knowledge base",
        error.status,
        error.data
      );
    }
  }

  // Get similar documents
  async getSimilarDocuments(documentId, options = {}) {
    try {
      if (!documentId) {
        throw new APIError("Document ID is required", 400);
      }

      const params = {
        limit: options.limit || 10,
        threshold: options.threshold || 0.8,
        includeContent: options.includeContent || false,
        ...options,
      };

      const response = await crud.get(
        `${this.baseEndpoint}/documents/${documentId}/similar`,
        params
      );
      return response;
    } catch (error) {
      console.error("Error fetching similar documents:", error);
      throw new APIError(
        "Failed to fetch similar documents",
        error.status,
        error.data
      );
    }
  }

  // Get document tags
  async getDocumentTags() {
    try {
      const response = await crud.get(`${this.baseEndpoint}/tags`);
      return response;
    } catch (error) {
      console.error("Error fetching document tags:", error);
      throw new APIError(
        "Failed to fetch document tags",
        error.status,
        error.data
      );
    }
  }

  // Create or update tag
  async updateTag(tagName, data) {
    try {
      if (!tagName) {
        throw new APIError("Tag name is required", 400);
      }

      const response = await crud.put(
        `${this.baseEndpoint}/tags/${tagName}`,
        data
      );
      return response;
    } catch (error) {
      console.error("Error updating tag:", error);
      throw new APIError("Failed to update tag", error.status, error.data);
    }
  }

  // Delete tag
  async deleteTag(tagName) {
    try {
      if (!tagName) {
        throw new APIError("Tag name is required", 400);
      }

      const response = await crud.delete(
        `${this.baseEndpoint}/tags/${tagName}`
      );
      return response;
    } catch (error) {
      console.error("Error deleting tag:", error);
      throw new APIError("Failed to delete tag", error.status, error.data);
    }
  }

  // Advanced search with filters
  async advancedSearch(query, filters = {}) {
    try {
      if (!query) {
        return { results: [], total: 0 };
      }

      const searchParams = {
        q: query,
        limit: filters.limit || 20,
        offset: filters.offset || 0,
        threshold: filters.threshold || 0.7,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        fileTypes: filters.fileTypes,
        tags: filters.tags,
        status: filters.status,
        sortBy: filters.sortBy || "relevance",
        sortOrder: filters.sortOrder || "desc",
        includeContent: filters.includeContent || false,
        includeHighlights: filters.includeHighlights || true,
        ...filters,
      };

      const response = await crud.get(
        `${this.baseEndpoint}/search/advanced`,
        searchParams
      );
      return response;
    } catch (error) {
      console.error("Error performing advanced search:", error);
      throw new APIError(
        "Failed to perform advanced search",
        error.status,
        error.data
      );
    }
  }

  // Get search suggestions
  async getSearchSuggestions(query, limit = 5) {
    try {
      if (!query || query.length < 2) {
        return { suggestions: [] };
      }

      const response = await crud.get(
        `${this.baseEndpoint}/search/suggestions`,
        {
          q: query,
          limit,
        }
      );

      return response;
    } catch (error) {
      console.error("Error fetching search suggestions:", error);
      throw new APIError(
        "Failed to fetch search suggestions",
        error.status,
        error.data
      );
    }
  }

  // Get document analytics
  async getDocumentAnalytics(documentId) {
    try {
      if (!documentId) {
        throw new APIError("Document ID is required", 400);
      }

      const response = await crud.get(
        `${this.baseEndpoint}/documents/${documentId}/analytics`
      );
      return response;
    } catch (error) {
      console.error("Error fetching document analytics:", error);
      throw new APIError(
        "Failed to fetch document analytics",
        error.status,
        error.data
      );
    }
  }

  // Get knowledge base analytics
  async getKnowledgeBaseAnalytics(period = "30d") {
    try {
      const response = await crud.get(`${this.baseEndpoint}/analytics`, {
        period,
      });
      return response;
    } catch (error) {
      console.error("Error fetching knowledge base analytics:", error);
      throw new APIError(
        "Failed to fetch knowledge base analytics",
        error.status,
        error.data
      );
    }
  }

  // Optimize knowledge base
  async optimizeKnowledgeBase() {
    try {
      const response = await crud.post(`${this.baseEndpoint}/optimize`);
      return response;
    } catch (error) {
      console.error("Error optimizing knowledge base:", error);
      throw new APIError(
        "Failed to optimize knowledge base",
        error.status,
        error.data
      );
    }
  }

  // Health check for knowledge base
  async healthCheck() {
    try {
      const response = await crud.get(`${this.baseEndpoint}/health`);
      return response;
    } catch (error) {
      console.error("Error checking knowledge base health:", error);
      throw new APIError(
        "Failed to check knowledge base health",
        error.status,
        error.data
      );
    }
  }

  // Get file type information
  getFileTypeInfo(file) {
    return {
      type: file.type,
      size: file.size,
      name: file.name,
      extension: file.name.split(".").pop()?.toLowerCase(),
      isSupported: this.supportedTypes.includes(file.type),
      sizeFormatted: this.formatFileSize(file.size),
    };
  }

  // Format file size
  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}

// Create singleton instance
const knowledgeService = new KnowledgeService();

// Export both the class and the instance
export { knowledgeService };
export default knowledgeService;
