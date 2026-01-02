import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pipelineApi } from '@/lib/api';

export function usePipeline(workspaceId: string) {
  return useQuery({
    queryKey: ['pipeline', workspaceId],
    queryFn: () => pipelineApi.get(workspaceId),
    enabled: !!workspaceId,
    refetchInterval: (query) => {
      // Poll every 5 seconds if pipeline is running
      const status = query.state.data?.data.status;
      return status === 'running' ? 5000 : false;
    },
  });
}

export function useStartPipeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workspaceId: string) => pipelineApi.start(workspaceId),
    onSuccess: (_, workspaceId) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', workspaceId] });
    },
  });
}

export function useCancelPipeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workspaceId: string) => pipelineApi.cancel(workspaceId),
    onSuccess: (_, workspaceId) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', workspaceId] });
    },
  });
}
