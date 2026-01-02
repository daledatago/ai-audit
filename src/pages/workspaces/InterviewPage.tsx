import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { WorkspaceLayout } from '@/components/layout/WorkspaceLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/hooks/useWorkspaces';
import { useInterviews, useCreateInterview } from '@/hooks/useInterviews';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from '@/hooks/use-toast';
import { 
  MessageSquare, 
  Plus, 
  User, 
  Briefcase,
  CheckCircle2,
  Clock,
  Play
} from 'lucide-react';

export function InterviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: workspace } = useWorkspace(id!);
  const { data: interviews, isLoading, error, refetch } = useInterviews(id!);
  const createInterview = useCreateInterview();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    participantName: '',
    participantRole: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast({
        title: 'Error',
        description: 'Interview title is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await createInterview.mutateAsync({
        workspaceId: id!,
        ...formData,
      });
      toast({
        title: 'Success',
        description: 'Interview created successfully',
      });
      setShowForm(false);
      setFormData({ title: '', participantName: '', participantRole: '' });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to create interview',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            <Play className="h-3 w-3 mr-1" />
            In Progress
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Scheduled
          </Badge>
        );
    }
  };

  return (
    <WorkspaceLayout workspaceName={workspace?.data?.name}>
      <div className="space-y-6">
        {/* New Interview Form */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>New Interview</CardTitle>
                <CardDescription>
                  Create a new stakeholder interview session
                </CardDescription>
              </div>
              {!showForm && (
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Interview
                </Button>
              )}
            </div>
          </CardHeader>
          {showForm && (
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Interview Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Technical Lead Assessment"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, title: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="participantName">Participant Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="participantName"
                        className="pl-10"
                        placeholder="John Doe"
                        value={formData.participantName}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            participantName: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="participantRole">Role</Label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="participantRole"
                        className="pl-10"
                        placeholder="CTO"
                        value={formData.participantRole}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            participantRole: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createInterview.isPending}>
                    {createInterview.isPending ? 'Creating...' : 'Start Interview'}
                  </Button>
                </div>
              </form>
            </CardContent>
          )}
        </Card>

        {/* Interviews List */}
        <Card>
          <CardHeader>
            <CardTitle>Interview Sessions</CardTitle>
            <CardDescription>
              {interviews?.data?.length || 0} interviews conducted
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && <LoadingState message="Loading interviews..." />}

            {error && (
              <ErrorState
                message={error instanceof Error ? error.message : 'Failed to load interviews'}
                onRetry={refetch}
              />
            )}

            {!isLoading && !error && (!interviews?.data || interviews.data.length === 0) && (
              <EmptyState
                icon={<MessageSquare className="h-12 w-12" />}
                title="No interviews yet"
                description="Create your first interview session to gather stakeholder insights."
                action={
                  <Button onClick={() => setShowForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Interview
                  </Button>
                }
              />
            )}

            {interviews?.data && interviews.data.length > 0 && (
              <div className="space-y-3">
                {interviews.data.map((interview) => (
                  <div
                    key={interview.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-full bg-primary/10">
                        <MessageSquare className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{interview.title}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {interview.participantName && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {interview.participantName}
                            </span>
                          )}
                          {interview.participantRole && (
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              {interview.participantRole}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(interview.status)}
                      <Button variant="outline" size="sm">
                        {interview.status === 'completed' ? 'View' : 'Continue'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </WorkspaceLayout>
  );
}
