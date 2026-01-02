import { ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppLayout } from './AppLayout';
import { 
  LayoutDashboard, 
  Upload, 
  MessageSquare, 
  GitBranch, 
  Download 
} from 'lucide-react';

interface WorkspaceLayoutProps {
  children: ReactNode;
  workspaceName?: string;
}

export function WorkspaceLayout({ children, workspaceName }: WorkspaceLayoutProps) {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();

  const tabs = [
    { value: 'overview', href: `/workspaces/${id}`, icon: LayoutDashboard, label: 'Overview' },
    { value: 'upload', href: `/workspaces/${id}/upload`, icon: Upload, label: 'Upload' },
    { value: 'interview', href: `/workspaces/${id}/interview/new`, icon: MessageSquare, label: 'Interview' },
    { value: 'pipeline', href: `/workspaces/${id}/pipeline`, icon: GitBranch, label: 'Pipeline' },
    { value: 'exports', href: `/workspaces/${id}/exports`, icon: Download, label: 'Exports' },
  ];

  const getCurrentTab = () => {
    const path = location.pathname;
    if (path.includes('/upload')) return 'upload';
    if (path.includes('/interview')) return 'interview';
    if (path.includes('/pipeline')) return 'pipeline';
    if (path.includes('/exports')) return 'exports';
    return 'overview';
  };

  return (
    <AppLayout 
      title={workspaceName || 'Workspace'} 
      showBack 
      backHref="/workspaces"
    >
      <div className="space-y-6">
        {/* Workspace tabs */}
        <Tabs value={getCurrentTab()} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto">
            {tabs.map(({ value, href, icon: Icon, label }) => (
              <TabsTrigger key={value} value={value} asChild>
                <Link to={href} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Tab content */}
        {children}
      </div>
    </AppLayout>
  );
}
