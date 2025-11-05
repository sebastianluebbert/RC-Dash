import { NavLink, useLocation, Link } from "react-router-dom";
import {
  Server,
  Globe,
  Activity,
  AlertTriangle,
  Settings,
  LifeBuoy,
  FileText,
  Users,
  CreditCard,
  Database,
  PackagePlus,
  Mail,
  LogOut,
  Globe as WebIcon,
} from "lucide-react";
import rexcloudLogo from "@/assets/rexcloud-logo.png";
import proxmoxFavicon from "@/assets/proxmox-favicon.png";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface ServerData {
  id: string;
  vmid: number;
  name: string;
  node: string;
  type: 'qemu' | 'lxc';
  status: string;
}

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Activity,
  },
  {
    title: "Websites",
    url: "/websites",
    icon: WebIcon,
  },
  {
    title: "Helper Scripts",
    url: "/helper-scripts",
    icon: PackagePlus,
  },
  {
    title: "Domains",
    icon: Globe,
    items: [
      { title: "Übersicht", url: "/domains" },
      { title: "DNS-Verwaltung", url: "/domains/dns" },
      { title: "Transfers", url: "/domains/transfers" },
    ],
  },
  {
    title: "Mail",
    url: "/mail",
    icon: Mail,
  },
  {
    title: "Monitoring",
    icon: Activity,
    items: [
      { title: "Health Status", url: "/monitoring/health" },
      { title: "Performance", url: "/monitoring/performance" },
      { title: "Logs", url: "/monitoring/logs" },
    ],
  },
  {
    title: "Support",
    icon: LifeBuoy,
    items: [
      { title: "Tickets", url: "/support/tickets" },
      { title: "Dokumentation", url: "/support/docs" },
    ],
  },
];

const bottomItems = [
  {
    title: "Einstellungen",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const { user, signOut } = useAuth();

  const { data: servers } = useQuery({
    queryKey: ['servers'],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxmox-resources`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.servers as ServerData[];
    },
  });

  const isActive = (url: string) => location.pathname === url;
  const hasActiveChild = (items?: { url: string }[]) =>
    items?.some((item) => location.pathname.startsWith(item.url));
  
  // Check if any server detail page is active
  const isServerSectionActive = location.pathname.startsWith('/server/');
  
  // Extract unique nodes from servers
  const nodes = Array.from(new Set(servers?.map(s => s.node) || []));

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-6">
        <Link to="/" className="flex items-center justify-center">
          <img 
            src={rexcloudLogo} 
            alt="RexCloud Logo" 
            className="h-12 w-auto object-contain hover:opacity-80 transition-opacity cursor-pointer"
          />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Hauptmenü</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {/* Dashboard */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/')} className="py-3 px-4">
                  <NavLink to="/">
                    <Activity className="h-5 w-5" />
                    <span className="text-base">Dashboard</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Websites */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/websites')} className="py-3 px-4">
                  <NavLink to="/websites">
                    <WebIcon className="h-5 w-5" />
                    <span className="text-base">Websites</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Helper Scripts */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/helper-scripts')} className="py-3 px-4">
                  <NavLink to="/helper-scripts">
                    <PackagePlus className="h-5 w-5" />
                    <span className="text-base">Helper Scripts</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Server Menu with dynamic server list */}
              <Collapsible
                defaultOpen={isServerSectionActive}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      className={`py-3 px-4 ${isServerSectionActive ? "bg-sidebar-accent" : ""}`}
                    >
                      <Server className="h-5 w-5" />
                      <span className="text-base">Server</span>
                      <ChevronDown className="ml-auto h-5 w-5 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {/* All Servers Link */}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={location.pathname === '/servers'}
                        >
                          <NavLink to="/servers">
                            <span className="text-base">Alle Server</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      
                      {/* Separator */}
                      {nodes && nodes.length > 0 && (
                        <SidebarSeparator className="my-2" />
                      )}
                      
                      {/* Individual Nodes */}
                      {nodes?.map((node) => (
                        <SidebarMenuSubItem key={node}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={location.pathname === `/server/${node}`}
                          >
                            <NavLink to={`/server/${node}`} className="flex items-center gap-2">
                              <img 
                                src={proxmoxFavicon} 
                                alt="Proxmox" 
                                className="h-4 w-4 object-contain"
                              />
                              <span className="text-sm truncate">
                                {node}
                              </span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Other menu items */}
              {menuItems.slice(2).map((item) =>
                item.items ? (
                  <Collapsible
                    key={item.title}
                    defaultOpen={hasActiveChild(item.items)}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          className={`py-3 px-4 ${hasActiveChild(item.items) ? "bg-sidebar-accent" : ""}`}
                        >
                          <item.icon className="h-5 w-5" />
                          <span className="text-base">{item.title}</span>
                          <ChevronDown className="ml-auto h-5 w-5 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isActive(subItem.url)}
                              >
                                <NavLink to={subItem.url}>
                                  <span className="text-base">{subItem.title}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} className="py-3 px-4">
                      <NavLink to={item.url}>
                        <item.icon className="h-5 w-5" />
                        <span className="text-base">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {bottomItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} className="py-3 px-4">
                    <NavLink to={item.url}>
                      <item.icon className="h-5 w-5" />
                      <span className="text-base">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              
              {user && (
                <>
                  <SidebarMenuItem>
                    <div className="px-4 py-2 text-xs text-muted-foreground truncate">
                      {user.email}
                    </div>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={signOut} className="py-3 px-4 w-full">
                      <LogOut className="h-5 w-5" />
                      <span className="text-base">Abmelden</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
