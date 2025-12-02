import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, Search, History, FileInput, Users, LogOut, Settings, Sun, Moon, RotateCw, UserPlus } from 'lucide-react';
import { User, UserType } from '../types';
import { db } from '../services/database';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [config, setConfig] = useState(db.getConfig());

  useEffect(() => {
    // Theme
    const savedTheme = localStorage.getItem('sgp_theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
    // Config
    setConfig(db.getConfig());
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('sgp_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('sgp_theme', 'light');
    }
  };

  const reloadPage = () => {
    window.location.reload();
  };

  if (!user) return <>{children}</>;

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
      isActive 
        ? 'bg-hospital-600 text-white shadow-md' 
        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;
  
  // Permissions Check
  const canViewHistory = user.tipo === UserType.ADMIN || config.permissions.commonCanViewHistory;
  const canImport = user.tipo === UserType.ADMIN || config.permissions.commonCanImportAgenda;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 transition-colors overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 dark:bg-slate-950 text-white flex flex-col shadow-xl flex-shrink-0 border-r border-slate-800">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          {/* Logo Pequeno SGP (CSS PURO) */}
          <div className="w-8 h-8 bg-hospital-600 rounded flex items-center justify-center font-bold text-white shadow-lg shrink-0 select-none border border-hospital-500">
             SGP
          </div>
          <div className="overflow-hidden">
            <h1 className="text-lg font-bold tracking-tight text-white whitespace-nowrap">SGP HEPP</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest truncate">Gestão Hospitalar</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Principal</div>
          <NavLink to="/" className={navItemClass}><LayoutDashboard size={18} /> Dashboard</NavLink>
          <NavLink to="/search" className={navItemClass}><Search size={18} /> Consulta & Movimentação</NavLink>
          <NavLink to="/register" className={navItemClass}><UserPlus size={18} /> Novo Cadastro</NavLink>

          <div className="mt-6 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Gestão</div>
          {canViewHistory && (
             <NavLink to="/history" className={navItemClass}><History size={18} /> Histórico</NavLink>
          )}
          {canImport && (
             <NavLink to="/import" className={navItemClass}><FileInput size={18} /> Importar Agenda</NavLink>
          )}

          <div className="mt-6 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sistema</div>
          {user.tipo === UserType.ADMIN && (
            <NavLink to="/users" className={navItemClass}><Users size={18} /> Usuários</NavLink>
          )}
          <NavLink to="/settings" className={navItemClass}><Settings size={18} /> Configurações</NavLink>
        </nav>

        {/* Compact Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-hospital-600 flex items-center justify-center text-xs font-bold uppercase text-white shadow-lg border-2 border-slate-800">{user.nome.charAt(0)}</div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate text-white">{user.nome}</p>
              <p className="text-[10px] text-slate-400 truncate capitalize">{user.tipo}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-2">
             <button onClick={toggleTheme} title={isDarkMode ? "Modo Claro" : "Modo Escuro"} className="col-span-1 flex items-center justify-center p-2 text-slate-400 hover:text-yellow-400 hover:bg-slate-800 rounded-lg transition-colors border border-slate-800 bg-slate-900">
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
             </button>
             <button onClick={reloadPage} title="Recarregar Sistema" className="col-span-2 flex items-center justify-center gap-2 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-800 bg-slate-900 text-xs font-medium">
                 <RotateCw size={16} /> Recarregar
             </button>
          </div>

          <button onClick={onLogout} className="flex items-center justify-center gap-2 w-full p-2 text-xs font-bold text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-all border border-transparent group">
             <LogOut size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-slate-50 dark:bg-slate-900 flex flex-col transition-colors relative overflow-hidden">
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-4 sticky top-0 z-10 flex justify-between items-center shadow-sm shrink-0">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">
            {location.pathname === '/' && 'Visão Geral'}
            {location.pathname === '/search' && 'Consulta & Movimentação'}
            {location.pathname === '/register' && 'Novo Cadastro de Prontuários'}
            {location.pathname === '/history' && 'Histórico de Movimentações'}
            {location.pathname === '/import' && 'Importar Agenda Diária'}
            {location.pathname === '/users' && 'Gerenciar Usuários'}
            {location.pathname === '/settings' && 'Configurações do Sistema'}
          </h2>
          <div className="text-sm text-slate-500 dark:text-slate-400 font-medium hidden md:block">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </header>
        
        {/* Content Container - overflow-hidden here allows children to manage scroll */}
        <div className="flex-1 overflow-hidden p-8 flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;