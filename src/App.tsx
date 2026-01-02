import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Pages
import { WorkspacesListPage } from "./pages/workspaces/WorkspacesListPage";
import { WorkspaceDetailPage } from "./pages/workspaces/WorkspaceDetailPage";
import { UploadPage } from "./pages/workspaces/UploadPage";
import { InterviewPage } from "./pages/workspaces/InterviewPage";
import { PipelinePage } from "./pages/workspaces/PipelinePage";
import { ExportsPage } from "./pages/workspaces/ExportsPage";

// QueryClient with retry and refetch settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Redirect root to workspaces */}
          <Route path="/" element={<Navigate to="/workspaces" replace />} />
          
          {/* Workspace routes */}
          <Route path="/workspaces" element={<WorkspacesListPage />} />
          <Route path="/workspaces/:id" element={<WorkspaceDetailPage />} />
          <Route path="/workspaces/:id/upload" element={<UploadPage />} />
          <Route path="/workspaces/:id/interview/new" element={<InterviewPage />} />
          <Route path="/workspaces/:id/pipeline" element={<PipelinePage />} />
          <Route path="/workspaces/:id/exports" element={<ExportsPage />} />
          
          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/workspaces" replace />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
