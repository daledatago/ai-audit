import { useParams, Link } from 'react-router-dom';
import { WorkspaceLayout } from '@/components/layout/WorkspaceLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useWorkspace } from '@/hooks/useWorkspaces';
import { useDocuments } from '@/hooks/useDocuments';
import { useInterviews } from '@/hooks/useInterviews';
import { usePipeline } from '@/hooks/usePipeline';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { 
  Upload, 
  MessageSquare, 
  GitBranch, 
  Download,
  CheckCircle2,
  Circle,
  ArrowRight
} from 'lucide-react';

export function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: workspace, isLoading, error, refetch } = useWorkspace(id!);
  const { data: documents } = useDocuments(id!);
  const { data: interviews } = useInterviews(id!);
  const { data: pipeline } = usePipeline(id!);

  if (isLoading) {
    return (
      <WorkspaceLayout>
        <LoadingState message="Loading workspace..." />
      </WorkspaceLayout>
    );
  }

  if (error) {
    return (
      <WorkspaceLayout>
        <ErrorState
          message={error instanceof Error ? error.message : 'Failed to load workspace'}
          onRetry={refetch}
        />
      </WorkspaceLayout>
    );
  }

  const workspaceData = workspace?.data;
  const documentCount = documents?.data?.length || 0;
  const interviewCount = interviews?.data?.length || 0;
  const pipelineStatus = pipeline?.data?.status || 'idle';
  const pipelineProgress = pipeline?.data?.overallProgress || 0;

  const steps = [
    {
      title: 'Upload Documents',
      description: 'Upload documentation for analysis',
      icon: Upload,
      href: `/workspaces/${id}/upload`,
      count: documentCount,
      completed: documentCount > 0,
    },
    {
      title: 'Conduct Interviews',
      description: 'Gather stakeholder insights',
      icon: MessageSquare,
      href: `/workspaces/${id}/interview/new`,
      count: interviewCount,
      completed: interviewCount > 0,
    },
    {
      title: 'Run Analysis',
      description: 'Process through AI pipeline',
      icon: GitBranch,
      href: `/workspaces/${id}/pipeline`,
      status: pipelineStatus,
      completed: pipelineStatus === 'completed',
    },
    {
      title: 'Export Reports',
      description: 'Download audit reports',
      icon: Download,
      href: `/workspaces/${id}/exports`,
      completed: pipelineStatus === 'completed',
    },
  ];

  const completedSteps = steps.filter((s) => s.completed).length;
  const overallProgress = (completedSteps / steps.length) * 100;

  return (
    <WorkspaceLayout workspaceName={workspaceData?.name}>
      <div className="space-y-6">
        {/* Overall Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Progress</CardTitle>
            <CardDescription>
              {completedSteps} of {steps.length} steps completed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={overallProgress} className="h-2" />
          </CardContent>
        </Card>

        {/* Steps Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Card
                key={step.title}
                className={`transition-all ${
                  step.completed
                    ? 'border-green-500/30 bg-green-500/5'
                    : 'hover:border-primary/50'
                }`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          step.completed
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{step.title}</CardTitle>
                        <CardDescription>{step.description}</CardDescription>
                      </div>
                    </div>
                    {step.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    {'count' in step && (
                      <span className="text-sm text-muted-foreground">
                        {step.count} {step.count === 1 ? 'item' : 'items'}
                      </span>
                    )}
                    {'status' in step && (
                      <span className="text-sm text-muted-foreground capitalize">
                        Status: {step.status}
                      </span>
                    )}
                    <Button variant="outline" size="sm" asChild>
                      <Link to={step.href}>
                        {step.completed ? 'View' : 'Start'}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </WorkspaceLayout>
  );
}
