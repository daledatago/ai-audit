// Workspace types
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'in_progress' | 'completed';
  documentCount: number;
  interviewCount: number;
}

export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
}

// Document types
export interface Document {
  id: string;
  workspaceId: string;
  filename: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface UploadDocumentRequest {
  file: File;
  workspaceId: string;
}

// Interview types
export interface Interview {
  id: string;
  workspaceId: string;
  title: string;
  participantName?: string;
  participantRole?: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  createdAt: string;
  completedAt?: string;
}

export interface CreateInterviewRequest {
  workspaceId: string;
  title: string;
  participantName?: string;
  participantRole?: string;
}

export interface InterviewQuestion {
  id: string;
  text: string;
  category: string;
  order: number;
}

export interface InterviewResponse {
  questionId: string;
  answer: string;
  notes?: string;
}

// Pipeline types
export interface PipelineStage {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface Pipeline {
  workspaceId: string;
  stages: PipelineStage[];
  overallProgress: number;
  status: 'idle' | 'running' | 'completed' | 'failed';
}

// Export types
export interface ExportOption {
  id: string;
  name: string;
  format: 'pdf' | 'docx' | 'xlsx' | 'json';
  description: string;
}

export interface ExportRequest {
  workspaceId: string;
  format: 'pdf' | 'docx' | 'xlsx' | 'json';
  sections?: string[];
}

export interface Export {
  id: string;
  workspaceId: string;
  format: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  downloadUrl?: string;
  createdAt: string;
  completedAt?: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, string>;
}
