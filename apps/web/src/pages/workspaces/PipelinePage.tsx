import { useParams } from 'react-router-dom';
import { WorkspaceLayout } from '@/components/layout/WorkspaceLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/hooks/useWorkspaces';
import { usePipeline, useStartPipeline, useCancelPipeline } from '@/hooks/usePipeline';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { toast } from '@/hooks/use-toast';
import { 
  Play, 
  Square, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Loader2,
  GitBranch,
  FileSearch,
  Brain,
  BarChart3,
  FileText
} from 'lucide-react';

const PIPELINE_ICONS: Record<string, React.ElementType> = {
  'document_extraction': FileSearch,
  'data_analysis': BarChart3,
  'ai_assessment': Brain,
  'report_generation': FileText,
};

export function PipelinePage() {
  const { id } = useParams<{ id: string }>();
  const { data: workspace } = useWorkspace(id!);
  const { data: pipeline, isLoading, error, refetch } = usePipeline(id!);
  const startPipeline = useStartPipeline();
  const cancelPipeline = useCancelPipeline();

  const handleStart = async () => {
    try {
      await startPipeline.mutateAsync(id!);
      toast({
        title: 'Pipeline Started',
        description: 'The analysis pipeline has been initiated.',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to start pipeline',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = async () => {
    try {
      await cancelPipeline.mutateAsync(id!);
      toast({
        title: 'Pipeline Cancelled',
        description: 'The analysis pipeline has been stopped.',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to cancel pipeline',
        variant: 'destructive',
      });
    }
  };

  const getStageStatus = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          icon: CheckCircle2,
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          badge: 'bg-green-500/10 text-green-500 border-green-500/20',
        };
      case 'running':
        return {
          icon: Loader2,
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/10',
          badge: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
          animate: true,
        };
      case 'failed':
        return {
          icon: AlertCircle,
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
          badge: 'bg-destructive/10 text-destructive border-destructive/20',
        };
      default:
        return {
          icon: Clock,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted',
          badge: 'bg-muted text-muted-foreground',
        };
    }
  };

  const pipelineData = pipeline?.data;
  const isRunning = pipelineData?.status === 'running';
  const isCompleted = pipelineData?.status === 'completed';
  const isFailed = pipelineData?.status === 'failed';

  return (
    <WorkspaceLayout workspaceName={workspace?.data?.name}>
      <div className="space-y-6">
        {/* Pipeline Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  Analysis Pipeline
                </CardTitle>
                <CardDescription>
                  Process documents and interviews through AI analysis
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {isRunning ? (
                  <Button
                    variant="destructive"
                    onClick={handleCancel}
                    disabled={cancelPipeline.isPending}
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                ) : (
                  <Button
                    onClick={handleStart}
                    disabled={startPipeline.isPending || isCompleted}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {isCompleted ? 'Re-run Pipeline' : 'Start Pipeline'}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && <LoadingState message="Loading pipeline status..." />}

            {error && (
              <ErrorState
                message={error instanceof Error ? error.message : 'Failed to load pipeline'}
                onRetry={refetch}
              />
            )}

            {!isLoading && !error && pipelineData && (
              <div className="space-y-6">
                {/* Overall Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Overall Progress</span>
                    <span className="font-medium">{pipelineData.overallProgress}%</span>
                  </div>
                  <Progress value={pipelineData.overallProgress} className="h-2" />
                </div>

                {/* Pipeline Stages */}
                <div className="space-y-4">
                  {pipelineData.stages.map((stage, index) => {
                    const status = getStageStatus(stage.status);
                    const StageIcon = PIPELINE_ICONS[stage.id] || GitBranch;
                    const StatusIcon = status.icon;

                    return (
                      <div
                        key={stage.id}
                        className={`relative p-4 rounded-lg border transition-all ${
                          stage.status === 'running'
                            ? 'border-blue-500/50 bg-blue-500/5'
                            : stage.status === 'completed'
                            ? 'border-green-500/30 bg-green-500/5'
                            : stage.status === 'failed'
                            ? 'border-destructive/50 bg-destructive/5'
                            : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${status.bgColor}`}>
                              <StageIcon className={`h-5 w-5 ${status.color}`} />
                            </div>
                            <div>
                              <p className="font-medium">{stage.name}</p>
                              {stage.status === 'running' && (
                                <p className="text-sm text-muted-foreground">
                                  Processing... {stage.progress}%
                                </p>
                              )}
                              {stage.status === 'completed' && stage.completedAt && (
                                <p className="text-sm text-muted-foreground">
                                  Completed {new Date(stage.completedAt).toLocaleTimeString()}
                                </p>
                              )}
                              {stage.status === 'failed' && stage.error && (
                                <p className="text-sm text-destructive">{stage.error}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={status.badge}>
                              <StatusIcon
                                className={`h-3 w-3 mr-1 ${status.animate ? 'animate-spin' : ''}`}
                              />
                              {stage.status.charAt(0).toUpperCase() + stage.status.slice(1)}
                            </Badge>
                          </div>
                        </div>

                        {stage.status === 'running' && (
                          <div className="mt-3">
                            <Progress value={stage.progress} className="h-1" />
                          </div>
                        )}

                        {/* Connector line */}
                        {index < pipelineData.stages.length - 1 && (
                          <div className="absolute left-7 -bottom-4 h-4 w-0.5 bg-border" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!isLoading && !error && !pipelineData && (
              <div className="text-center py-8 text-muted-foreground">
                <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Pipeline not yet initialized</p>
                <p className="text-sm mt-1">
                  Upload documents and complete interviews first
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </WorkspaceLayout>
  );
}
