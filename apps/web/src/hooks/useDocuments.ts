import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '@/lib/api';

export function useDocuments(workspaceId: string) {
  return useQuery({
    queryKey: ['documents', workspaceId],
    queryFn: () => documentsApi.list(workspaceId),
    enabled: !!workspaceId,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceId, file }: { workspaceId: string; file: File }) =>
      documentsApi.upload(workspaceId, file),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['workspaces', variables.workspaceId] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceId, documentId }: { workspaceId: string; documentId: string }) =>
      documentsApi.delete(workspaceId, documentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['workspaces', variables.workspaceId] });
    },
  });
}
