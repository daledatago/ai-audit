import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { exportsApi } from '@/lib/api';
import type { ExportRequest } from '@/types';

export function useExports(workspaceId: string) {
  return useQuery({
    queryKey: ['exports', workspaceId],
    queryFn: () => exportsApi.list(workspaceId),
    enabled: !!workspaceId,
  });
}

export function useCreateExport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ExportRequest) => exportsApi.create(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['exports', variables.workspaceId] });
    },
  });
}

export function useDownloadExport() {
  return useMutation({
    mutationFn: ({ workspaceId, exportId }: { workspaceId: string; exportId: string }) =>
      exportsApi.download(workspaceId, exportId),
    onSuccess: (blob, variables) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `export-${variables.exportId}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
}
