import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Calendar,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  MapPinned,
  PlusCircle,
  Send,
  Users2,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import logo from "@/assets/unla-logo.svg";
import { useCan } from "@/hooks/useCan";
import type { Action, Subject } from "@/libs/ability";

interface NavigationItem {
  label: string;
  to: string;
  icon: LucideIcon;
  badge?: string;
  /** Mismo chequeo CASL que la ruta (app/routes.tsx); sin él, el ítem es visible para todos */
  requires?: [Action, Subject];
  /** Oculta el ítem si el usuario sí tiene este permiso */
  hiddenIf?: [Action, Subject];
}

const primaryNavigation: NavigationItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Calendario", to: "/calendar", icon: Calendar, requires: ["read", "Event"] },
  { label: "Eventos", to: "/events", icon: ListChecks, requires: ["read", "Event"] },
  {
    label: "Nuevo evento",
    to: "/events/new",
    icon: PlusCircle,
    badge: "NEW",
    requires: ["create", "Event"],
  },
  {
    // USUARIO no crea eventos: pide una solicitud por el formulario público
    label: "Solicitar evento",
    to: "/solicitud",
    icon: Send,
    requires: ["request:create", "EventRequest"],
    hiddenIf: ["create", "Event"],
  },
  {
    label: "Solicitudes",
    to: "/solicitudes",
    icon: ClipboardList,
    requires: ["read", "PublicRequest"],
  },
];

const catalogsNavigation: NavigationItem[] = [
  { label: "Espacios", to: "/catalog/spaces", icon: Building2, requires: ["manageCatalogs", "Space"] },
  { label: "Departamentos", to: "/catalog/departments", icon: MapPinned, requires: ["manageCatalogs", "Space"] },
];

const adminNavigation: NavigationItem[] = [
  { label: "Usuarios & Roles", to: "/admin/users", icon: Users2, requires: ["manage", "User"] },
];

interface AppSidebarProps {
  variant?: "desktop" | "drawer";
  className?: string;
}

export default function AppSidebar({
  variant = "desktop",
  className,
}: AppSidebarProps) {
  const can = useCan();
  const visible = (items: NavigationItem[]) =>
    items.filter(
      (item) =>
        (!item.requires || can(...item.requires)) &&
        !(item.hiddenIf && can(...item.hiddenIf)),
    );
  const primaryItems = visible(primaryNavigation);
  const catalogItems = visible(catalogsNavigation);
  const adminItems = visible(adminNavigation);
  const year = new Date().getFullYear();

  return (
    <aside
      className={cn(
        "w-72 flex-col border-r border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950",
        variant === "desktop" ? "hidden lg:flex" : "flex",
        className,
      )}
    >
      <div className="flex items-center gap-3 px-6 py-5">
        <img
          src={logo}
          alt="Universidad Nacional de Lanús"
          className="h-9 w-9 rounded-lg object-contain"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            Gestión de Eventos
          </p>
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
            UNLa
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4">
        <div className="space-y-8 pb-8">
          <SidebarSection title="Menu" items={primaryItems} />
          {catalogItems.length > 0 ? <SidebarSection title="Catálogos" items={catalogItems} /> : null}
          {adminItems.length > 0 ? <SidebarSection title="Administración" items={adminItems} /> : null}
        </div>
      </ScrollArea>

      <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-5 text-xs text-slate-400 dark:text-slate-500">
        © {year} UNLa
      </div>
    </aside>
  );
}

interface SidebarSectionProps {
  title: string;
  items: NavigationItem[];
}

function SidebarSection({ title, items }: SidebarSectionProps) {
  return (
    <section>
      <p className="px-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
        {title}
      </p>
      <div className="mt-3 space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100",
                isActive && "bg-slate-900/5 text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100",
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0 opacity-80 transition-opacity group-hover:opacity-100" />
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge ? (
              <Badge variant="success" className="text-[10px]">
                {item.badge}
              </Badge>
            ) : null}
          </NavLink>
        ))}
      </div>
    </section>
  );
}
