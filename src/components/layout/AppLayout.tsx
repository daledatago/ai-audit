import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  FolderKanban,
  Settings,
  HelpCircle,
  ChevronLeft
} from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  backHref?: string;
  actions?: ReactNode;
}

export function AppLayout({ 
  children, 
  title, 
  showBack, 
  backHref = '/workspaces',
  actions 
}: AppLayoutProps) {
  const location = useLocation();

  const navItems = [
    { href: '/workspaces', icon: FolderKanban, label: 'Workspaces' },
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/settings', icon: Settings, label: 'Settings' },
    { href: '/help', icon: HelpCircle, label: 'Help' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="flex items-center gap-4">
            {showBack && (
              <Button variant="ghost" size="icon" asChild>
                <Link to={backHref}>
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              </Button>
            )}
            <Link to="/" className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">AI</span>
              </div>
              <span className="font-semibold hidden sm:inline-block">AI Audit</span>
            </Link>
          </div>

          {title && (
            <div className="flex-1 flex justify-center">
              <h1 className="text-lg font-semibold">{title}</h1>
            </div>
          )}

          <nav className="ml-auto flex items-center gap-1">
            {navItems.map(({ href, icon: Icon, label }) => (
              <Button
                key={href}
                variant="ghost"
                size="sm"
                asChild
                className={cn(
                  'hidden sm:flex',
                  location.pathname.startsWith(href) && 'bg-accent'
                )}
              >
                <Link to={href}>
                  <Icon className="h-4 w-4 mr-2" />
                  {label}
                </Link>
              </Button>
            ))}
            {actions}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="container py-6">{children}</main>
    </div>
  );
}
