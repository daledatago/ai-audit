import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { WorkspaceLayout } from '@/components/layout/WorkspaceLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useWorkspace } from '@/hooks/useWorkspaces';
import { useExports, useCreateExport, useDownloadExport } from '@/hooks/useExports';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from '@/hooks/use-toast';
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  FileJson,
  File,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle
} from 'lucide-react';

const EXPORT_FORMATS = [
  {
    id: 'pdf',
    name: 'PDF Report',
    description: 'Comprehensive audit report in PDF format',
    icon: FileText,
  },
  {
    id: 'docx',
    name: 'Word Document',
    description: 'Editable report in Microsoft Word format',
    icon: File,
  },
  {
    id: 'xlsx',
    name: 'Excel Spreadsheet',
    description: 'Data and metrics in spreadsheet format',
    icon: FileSpreadsheet,
  },
  {
    id: 'json',
    name: 'JSON Data',
    description: 'Raw data export for integration',
    icon: FileJson,
  },
] as const;

export function ExportsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: workspace } = useWorkspace(id!);
  const { data: exports, isLoading, error, refetch } = useExports(id!);
  const createExport = useCreateExport();
  const downloadExport = useDownloadExport();

  const [selectedFormat, setSelectedFormat] = useState<string>('pdf');

  const handleCreateExport = async () => {
    try {
      await createExport.mutateAsync({
        workspaceId: id!,
        format: selectedFormat as 'pdf' | 'docx' | 'xlsx' | 'json',
      });
      toast({
        title: 'Export Started',
        description: 'Your report is being generated.',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to create export',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = async (exportId: string) => {
    try {
      await downloadExport.mutateAsync({ workspaceId: id!, exportId });
      toast({
        title: 'Download Started',
        description: 'Your file is being downloaded.',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to download export',
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
            Ready
          </Badge>
        );
      case 'generating':
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Generating
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

  const getFormatIcon = (format: string) => {
    const formatConfig = EXPORT_FORMATS.find((f) => f.id === format);
    const Icon = formatConfig?.icon || FileText;
    return <Icon className="h-5 w-5" />;
  };

  return (
    <WorkspaceLayout workspaceName={workspace?.data?.name}>
      <div className="space-y-6">
        {/* Create Export */}
        <Card>
          <CardHeader>
            <CardTitle>Generate Export</CardTitle>
            <CardDescription>
              Create a new report export in your preferred format
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup
              value={selectedFormat}
              onValueChange={setSelectedFormat}
              className="grid gap-3 sm:grid-cols-2"
            >
              {EXPORT_FORMATS.map((format) => {
                const Icon = format.icon;
                return (
                  <div key={format.id}>
                    <RadioGroupItem
                      value={format.id}
                      id={format.id}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={format.id}
                      className="flex items-start gap-3 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <div className="p-2 rounded-lg bg-muted">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{format.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format.description}
                        </p>
                      </div>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>

            <Button
              onClick={handleCreateExport}
              disabled={createExport.isPending}
              className="w-full sm:w-auto"
            >
              {createExport.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Generate Export
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Export History */}
        <Card>
          <CardHeader>
            <CardTitle>Export History</CardTitle>
            <CardDescription>
              {exports?.data?.length || 0} exports generated
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && <LoadingState message="Loading exports..." />}

            {error && (
              <ErrorState
                message={error instanceof Error ? error.message : 'Failed to load exports'}
                onRetry={refetch}
              />
            )}

            {!isLoading && !error && (!exports?.data || exports.data.length === 0) && (
              <EmptyState
                icon={<Download className="h-12 w-12" />}
                title="No exports yet"
                description="Generate your first export to download audit reports."
              />
            )}

            {exports?.data && exports.data.length > 0 && (
              <div className="space-y-3">
                {exports.data.map((exportItem) => (
                  <div
                    key={exportItem.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        {getFormatIcon(exportItem.format)}
                      </div>
                      <div>
                        <p className="font-medium">
                          {exportItem.format.toUpperCase()} Export
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Created {new Date(exportItem.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(exportItem.status)}
                      {exportItem.status === 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(exportItem.id)}
                          disabled={downloadExport.isPending}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      )}
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
