import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Servers from "./pages/Servers";
import ServerDetail from "./pages/ServerDetail";
import HetznerServerDetail from "./pages/HetznerServerDetail";
import HetznerServers from "./pages/HetznerServers";
import Customers from "./pages/Customers";
import NotFound from "./pages/NotFound";
import Domains from "./pages/Domains";
import DomainsDNS from "./pages/DomainsDNS";
import Settings from "./pages/Settings";
import HelperScripts from "./pages/HelperScripts";
import Mail from "./pages/Mail";
import Auth from "./pages/Auth";
import Websites from "./pages/Websites";
import WebsiteDetail from "./pages/WebsiteDetail";
import { AdminSetup } from "./components/AdminSetup";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="rexcloud-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin-setup" element={<AdminSetup />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <SidebarProvider>
                    <div className="flex min-h-screen w-full bg-background">
                      <AppSidebar />
                      <div className="flex flex-1 flex-col">
                        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
                          <SidebarTrigger />
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold text-foreground">RexCloud</span>
                            <span className="text-sm text-muted-foreground">Management</span>
                          </div>
                          <div className="flex-1" />
                          <div className="flex items-center gap-4">
                            <ThemeToggle />
                          </div>
                        </header>
                        <Routes>
                          <Route path="/" element={<Index />} />
                          <Route path="/servers" element={<Servers />} />
                          <Route path="/server/:node" element={<ServerDetail />} />
                          <Route path="/hetzner" element={<HetznerServers />} />
                          <Route path="/hetzner-server/:serverId" element={<HetznerServerDetail />} />
                          <Route path="/helper-scripts" element={<HelperScripts />} />
                          <Route path="/customers" element={<Customers />} />
                          <Route path="/domains" element={<Domains />} />
                          <Route path="/domains/dns" element={<DomainsDNS />} />
                          <Route path="/domains/transfers" element={<NotFound />} />
                          <Route path="/mail" element={<Mail />} />
                          <Route path="/websites" element={<Websites />} />
                          <Route path="/websites/:serverId/:websiteId" element={<WebsiteDetail />} />
                          <Route path="/monitoring/*" element={<NotFound />} />
                          <Route path="/support/*" element={<NotFound />} />
                          <Route path="/settings" element={<Settings />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </div>
                    </div>
                  </SidebarProvider>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
