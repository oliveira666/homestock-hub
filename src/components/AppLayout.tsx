import { useState } from "react";
import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import { Menu } from "lucide-react";

const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      <div className="hidden md:flex">
        <AppSidebar />
      </div>

      {/* Sidebar mobile (drawer) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setSidebarOpen(false)}>
          <div className="absolute left-0 top-0 h-full w-64 bg-white shadow-md p-4">
            <AppSidebar />
          </div>
        </div>
      )}

      {/* Conteúdo principal */}
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        {/* Botão hamburger apenas mobile */}
        <button
          className="md:hidden mb-4 p-2 rounded bg-gray-200"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu />
        </button>

        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;