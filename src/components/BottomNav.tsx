import { NavLink, useLocation } from "react-router-dom";
import { MessageSquare, Users, Search, User, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Chats", icon: MessageSquare, exact: true },
  { to: "/rooms", label: "Rooms", icon: Users },
  { to: "/search", label: "Search", icon: Search },
  { to: "/me", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: Settings },
];

export const BottomNav = () => {
  const { pathname } = useLocation();
  // Hide on chat conversation routes (immersive view)
  if (pathname.startsWith("/chat/") || pathname.startsWith("/room/")) return null;

  return (
    <nav
      className="glass fixed bottom-3 left-1/2 z-30 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-center justify-around rounded-3xl px-2 py-1.5"
      aria-label="Primary"
    >
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.exact}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            <Icon className="h-5 w-5" />
            <span>{it.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};
