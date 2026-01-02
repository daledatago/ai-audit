import type {
  Workspace,
  CreateWorkspaceRequest,
  Document,
  Interview,
  CreateInterviewRequest,
  InterviewQuestion,
  InterviewResponse,
  Pipeline,
  Export,
  ExportRequest,
  ApiResponse,
  PaginatedResponse,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  if (!API_BASE_URL) {
    throw new ApiError(
      'API not configured. Set VITE_API_BASE_URL environment variable.',
      0
    );
  }

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  const response = await fetch(url, config);

  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    throw new ApiError(
      'API returned non-JSON response. Check VITE_API_BASE_URL configuration.',
      response.status
    );
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      data.message || 'An error occurred',
      response.status,
      data.code
    );
  }

  return data;
}

// Workspace API
export const workspacesApi = {
  list: () => request<PaginatedResponse<Workspace>>('/workspaces'),
  
  get: (id: string) => request<ApiResponse<Workspace>>(`/workspaces/${id}`),
  
  create: (data: CreateWorkspaceRequest) =>
    request<ApiResponse<Workspace>>('/workspaces', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: Partial<CreateWorkspaceRequest>) =>
    request<ApiResponse<Workspace>>(`/workspaces/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  
  delete: (id: string) =>
    request<ApiResponse<void>>(`/workspaces/${id}`, {
      method: 'DELETE',
    }),
};

// Documents API
export const documentsApi = {
  list: (workspaceId: string) =>
    request<PaginatedResponse<Document>>(`/workspaces/${workspaceId}/documents`),
  
  upload: async (workspaceId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(
      `${API_BASE_URL}/workspaces/${workspaceId}/documents`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(
        error.message || 'Upload failed',
        response.status
      );
    }

    return response.json() as Promise<ApiResponse<Document>>;
  },
  
  delete: (workspaceId: string, documentId: string) =>
    request<ApiResponse<void>>(
      `/workspaces/${workspaceId}/documents/${documentId}`,
      { method: 'DELETE' }
    ),
};

// Interviews API
export const interviewsApi = {
  list: (workspaceId: string) =>
    request<PaginatedResponse<Interview>>(`/workspaces/${workspaceId}/interviews`),
  
  get: (workspaceId: string, interviewId: string) =>
    request<ApiResponse<Interview>>(
      `/workspaces/${workspaceId}/interviews/${interviewId}`
    ),
  
  create: (data: CreateInterviewRequest) =>
    request<ApiResponse<Interview>>(
      `/workspaces/${data.workspaceId}/interviews`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),
  
  getQuestions: (workspaceId: string, interviewId: string) =>
    request<ApiResponse<InterviewQuestion[]>>(
      `/workspaces/${workspaceId}/interviews/${interviewId}/questions`
    ),
  
  submitResponses: (
    workspaceId: string,
    interviewId: string,
    responses: InterviewResponse[]
  ) =>
    request<ApiResponse<Interview>>(
      `/workspaces/${workspaceId}/interviews/${interviewId}/responses`,
      {
        method: 'POST',
        body: JSON.stringify({ responses }),
      }
    ),
};

// Pipeline API
export const pipelineApi = {
  get: (workspaceId: string) =>
    request<ApiResponse<Pipeline>>(`/workspaces/${workspaceId}/pipeline`),
  
  start: (workspaceId: string) =>
    request<ApiResponse<Pipeline>>(`/workspaces/${workspaceId}/pipeline/start`, {
      method: 'POST',
    }),
  
  cancel: (workspaceId: string) =>
    request<ApiResponse<Pipeline>>(`/workspaces/${workspaceId}/pipeline/cancel`, {
      method: 'POST',
    }),
};

// Exports API
export const exportsApi = {
  list: (workspaceId: string) =>
    request<PaginatedResponse<Export>>(`/workspaces/${workspaceId}/exports`),
  
  create: (data: ExportRequest) =>
    request<ApiResponse<Export>>(`/workspaces/${data.workspaceId}/exports`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  download: async (workspaceId: string, exportId: string) => {
    const response = await fetch(
      `${API_BASE_URL}/workspaces/${workspaceId}/exports/${exportId}/download`
    );
    
    if (!response.ok) {
      throw new ApiError('Download failed', response.status);
    }
    
    return response.blob();
  },
};

export { ApiError };
