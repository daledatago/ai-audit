import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { WorkspaceLayout } from '@/components/layout/WorkspaceLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/hooks/useWorkspaces';
import { useDocuments, useUploadDocument, useDeleteDocument } from '@/hooks/useDocuments';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from '@/hooks/use-toast';
import { 
  Upload, 
  FileText, 
  X, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Loader2 
} from 'lucide-react';

export function UploadPage() {
  const { id } = useParams<{ id: string }>();
  const { data: workspace } = useWorkspace(id!);
  const { data: documents, isLoading, error, refetch } = useDocuments(id!);
  const uploadDocument = useUploadDocument();
  const deleteDocument = useDeleteDocument();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        try {
          await uploadDocument.mutateAsync({ workspaceId: id!, file });
          toast({
            title: 'Success',
            description: `${file.name} uploaded successfully`,
          });
        } catch (err) {
          toast({
            title: 'Error',
            description: `Failed to upload ${file.name}`,
            variant: 'destructive',
          });
        }
      }
    },
    [id, uploadDocument]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        try {
          await uploadDocument.mutateAsync({ workspaceId: id!, file });
          toast({
            title: 'Success',
            description: `${file.name} uploaded successfully`,
          });
        } catch (err) {
          toast({
            title: 'Error',
            description: `Failed to upload ${file.name}`,
            variant: 'destructive',
          });
        }
      }
      e.target.value = '';
    },
    [id, uploadDocument]
  );

  const handleDelete = async (documentId: string, filename: string) => {
    try {
      await deleteDocument.mutateAsync({ workspaceId: id!, documentId });
      toast({
        title: 'Success',
        description: `${filename} deleted`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to delete document',
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
            Processed
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <WorkspaceLayout workspaceName={workspace?.data?.name}>
      <div className="space-y-6">
        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Documents</CardTitle>
            <CardDescription>
              Upload documentation for AI readiness analysis. Supported formats: PDF, DOCX, TXT, MD
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-1">
                Drop files here or click to upload
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                PDF, DOCX, TXT, or Markdown files up to 50MB
              </p>
              <Button asChild disabled={uploadDocument.isPending}>
                <label className="cursor-pointer">
                  {uploadDocument.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Select Files
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    accept=".pdf,.docx,.doc,.txt,.md"
                    onChange={handleFileSelect}
                    disabled={uploadDocument.isPending}
                  />
                </label>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Documents</CardTitle>
            <CardDescription>
              {documents?.data?.length || 0} documents uploaded
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && <LoadingState message="Loading documents..." />}

            {error && (
              <ErrorState
                message={error instanceof Error ? error.message : 'Failed to load documents'}
                onRetry={refetch}
              />
            )}

            {!isLoading && !error && (!documents?.data || documents.data.length === 0) && (
              <EmptyState
                icon={<FileText className="h-12 w-12" />}
                title="No documents uploaded"
                description="Upload your first document to start the analysis."
              />
            )}

            {documents?.data && documents.data.length > 0 && (
              <div className="space-y-2">
                {documents.data.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{doc.filename}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(doc.fileSize)} • Uploaded{' '}
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(doc.status)}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(doc.id, doc.filename)}
                        disabled={deleteDocument.isPending}
                      >
                        <X className="h-4 w-4" />
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
