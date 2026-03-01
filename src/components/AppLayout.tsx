import { Outlet } from "react-router-dom";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingBasket, ClipboardList, LogOut, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/dispensa", label: "Dispensa", icon: ShoppingBasket },
  { to: "/estoque", label: "Estoque", icon: ClipboardList },
];

const AppLayout = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between bg-sidebar px-4 py-3 md:hidden">
        <span className="text-lg font-bold text-sidebar-primary-foreground">🥫 PantryFlow</span>
        <button onClick={() => setOpen(!open)} className="text-sidebar-foreground p-1">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Mobile slide-over nav */}
      {open && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-foreground/40" />
          <nav
            className="absolute top-[52px] left-0 right-0 bg-sidebar p-3 space-y-1 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 w-full"
            >
              <LogOut className="h-5 w-5" />
              Sair
            </button>
          </nav>
        </div>
      )}

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-64 min-h-screen bg-sidebar text-sidebar-foreground flex-col fixed">
          <div className="p-6">
            <h1 className="text-xl font-bold text-sidebar-primary-foreground tracking-tight">🥫 PantryFlow</h1>
            <p className="text-xs text-sidebar-foreground/60 mt-1">Controle de Dispensa</p>
          </div>
          <nav className="flex-1 px-3 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-3 border-t border-sidebar-border">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 w-full"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </aside>

        <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
