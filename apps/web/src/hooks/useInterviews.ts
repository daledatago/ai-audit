import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { interviewsApi } from '@/lib/api';
import type { CreateInterviewRequest, InterviewResponse } from '@/types';

export function useInterviews(workspaceId: string) {
  return useQuery({
    queryKey: ['interviews', workspaceId],
    queryFn: () => interviewsApi.list(workspaceId),
    enabled: !!workspaceId,
  });
}

export function useInterview(workspaceId: string, interviewId: string) {
  return useQuery({
    queryKey: ['interviews', workspaceId, interviewId],
    queryFn: () => interviewsApi.get(workspaceId, interviewId),
    enabled: !!workspaceId && !!interviewId,
  });
}

export function useCreateInterview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateInterviewRequest) => interviewsApi.create(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['interviews', variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['workspaces', variables.workspaceId] });
    },
  });
}

export function useInterviewQuestions(workspaceId: string, interviewId: string) {
  return useQuery({
    queryKey: ['interviews', workspaceId, interviewId, 'questions'],
    queryFn: () => interviewsApi.getQuestions(workspaceId, interviewId),
    enabled: !!workspaceId && !!interviewId,
  });
}

export function useSubmitInterviewResponses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      interviewId,
      responses,
    }: {
      workspaceId: string;
      interviewId: string;
      responses: InterviewResponse[];
    }) => interviewsApi.submitResponses(workspaceId, interviewId, responses),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['interviews', variables.workspaceId, variables.interviewId],
      });
      queryClient.invalidateQueries({ queryKey: ['interviews', variables.workspaceId] });
    },
  });
}
