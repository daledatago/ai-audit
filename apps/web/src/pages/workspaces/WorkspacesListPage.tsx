import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useWorkspaces, useCreateWorkspace } from '@/hooks/useWorkspaces';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, FolderKanban, FileText, MessageSquare, ArrowRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export function WorkspacesListPage() {
  const { data, isLoading, error, refetch } = useWorkspaces();
  const createWorkspace = useCreateWorkspace();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState({ name: '', description: '' });

  const handleCreateWorkspace = async () => {
    if (!newWorkspace.name.trim()) {
      toast({
        title: 'Error',
        description: 'Workspace name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createWorkspace.mutateAsync(newWorkspace);
      toast({
        title: 'Success',
        description: 'Workspace created successfully',
      });
      setIsDialogOpen(false);
      setNewWorkspace({ name: '', description: '' });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to create workspace',
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'in_progress':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <AppLayout
      title="Workspaces"
      actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Workspace
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Workspace</DialogTitle>
              <DialogDescription>
                Create a new workspace to organize your AI readiness audit.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Q1 2024 Audit"
                  value={newWorkspace.name}
                  onChange={(e) =>
                    setNewWorkspace((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the purpose of this workspace..."
                  value={newWorkspace.description}
                  onChange={(e) =>
                    setNewWorkspace((prev) => ({ ...prev, description: e.target.value }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateWorkspace} disabled={createWorkspace.isPending}>
                {createWorkspace.isPending ? 'Creating...' : 'Create Workspace'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {isLoading && <LoadingState message="Loading workspaces..." />}

      {error && (
        <ErrorState
          message={error instanceof Error ? error.message : 'Failed to load workspaces'}
          onRetry={refetch}
        />
      )}

      {!isLoading && !error && (!data?.data || data.data.length === 0) && (
        <EmptyState
          icon={<FolderKanban className="h-12 w-12" />}
          title="No workspaces yet"
          description="Create your first workspace to start your AI readiness audit."
          action={
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Workspace
            </Button>
          }
        />
      )}

      {data?.data && data.data.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.data.map((workspace) => (
            <Link key={workspace.id} to={`/workspaces/${workspace.id}`}>
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{workspace.name}</CardTitle>
                    <Badge className={getStatusColor(workspace.status)}>
                      {workspace.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  {workspace.description && (
                    <CardDescription className="line-clamp-2">
                      {workspace.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        {workspace.documentCount} docs
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" />
                        {workspace.interviewCount} interviews
                      </span>
                    </div>
                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
