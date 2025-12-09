import React, { useEffect, useState } from 'react';
import { db } from '../services/database';
import { ProntuarioStatus, Movimentacao } from '../types';
import { FolderOpen, Archive, Activity, TrendingUp, Clock, Search, Plus, FileInput, ArrowRight, MapPin } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    dead: 0,
    movementsToday: 0
  });
  const [topLocations, setTopLocations] = useState<{name: string, value: number}[]>([]);
  const [movementTrend, setMovementTrend] = useState<{date: string, count: number}[]>([]);
  const [recentActivity, setRecentActivity] = useState<Movimentacao[]>([]);

  useEffect(() => {
    const prontuarios = db.getProntuarios();
    const movements = db.getMovimentacoes();
    
    const todayISO = new Date().toISOString().split('T')[0];

    // 1. Basic Stats
    const total = prontuarios.length;
    const active = prontuarios.filter(p => p.status === ProntuarioStatus.ATIVO).length;
    const dead = prontuarios.filter(p => p.local_atual === 'Arquivo Morto' || p.status === ProntuarioStatus.DESATIVADO).length;
    
    // Movements Today
    const todayMovs = movements.filter(m => m.data_hora.startsWith(todayISO));
    
    setStats({
      total,
      active,
      dead,
      movementsToday: todayMovs.length
    });

    // 2. Top Locations (Exclude Archive/Dead)
    const locMap = prontuarios.reduce((acc, curr) => {
      if (curr.local_atual !== 'Arquivo Morto' && curr.local_atual !== 'Arquivo') {
          acc[curr.local_atual] = (acc[curr.local_atual] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const sortedLocs = Object.entries(locMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5
    
    setTopLocations(sortedLocs);

    // 3. Movement Trend (Last 7 Days)
    const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i)); // 6 days ago to today
        return d.toISOString().split('T')[0];
    });

    const trendData = last7Days.map(date => {
        return {
            date: date.split('-').slice(1).reverse().join('/'), // Format MM/DD to DD/MM
            count: movements.filter(m => m.data_hora.startsWith(date)).length
        };
    });
    setMovementTrend(trendData);

    // 4. Recent Activity
    const sortedMovs = [...movements].sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime()).slice(0, 5);
    setRecentActivity(sortedMovs);

  }, []);

  const COLORS = ['#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7'];

  const StatCard = ({ title, value, icon: Icon, colorClass, bgClass, subtext }: any) => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-start justify-between hover:shadow-md transition-shadow">
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{value}</h3>
        {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
      </div>
      <div className={`p-3 rounded-lg ${bgClass} ${colorClass}`}>
        <Icon size={24} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-8">
      {/* 1. KEY METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
            title="Total de Prontuários" 
            value={stats.total} 
            icon={FolderOpen} 
            bgClass="bg-blue-50 dark:bg-blue-900/20" 
            colorClass="text-blue-600 dark:text-blue-400" 
        />
        <StatCard 
            title="Em Circulação" 
            value={stats.active} 
            icon={Activity} 
            bgClass="bg-green-50 dark:bg-green-900/20" 
            colorClass="text-green-600 dark:text-green-400" 
            subtext="Fora do Arquivo"
        />
        <StatCard 
            title="Arquivados/Inativos" 
            value={stats.dead} 
            icon={Archive} 
            bgClass="bg-slate-100 dark:bg-slate-700" 
            colorClass="text-slate-600 dark:text-slate-400" 
        />
        <StatCard 
            title="Movimentações Hoje" 
            value={stats.movementsToday} 
            icon={TrendingUp} 
            bgClass="bg-purple-50 dark:bg-purple-900/20" 
            colorClass="text-purple-600 dark:text-purple-400" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 2. ACTIVITY CHART */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
             <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Activity size={20} className="text-hospital-600"/> Tendência de Movimentação (7 Dias)</h3>
             <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={movementTrend}>
                        <defs>
                            <linearGradient id="colorMovs" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#307ecc" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#307ecc" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <RechartsTooltip 
                            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                        />
                        <Area type="monotone" dataKey="count" stroke="#307ecc" strokeWidth={3} fillOpacity={1} fill="url(#colorMovs)" />
                    </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* 3. TOP LOCATIONS */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
             <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><MapPin size={20} className="text-hospital-600"/> Top 5 Setores</h3>
             <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topLocations} layout="vertical" margin={{left: 0, right: 20}}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{fill: '#64748b', fontSize: 11, fontWeight: 'bold'}} axisLine={false} tickLine={false}/>
                        <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px'}}/>
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                            {topLocations.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
             </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 4. RECENT ACTIVITY LIST */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
             <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Clock size={20} className="text-hospital-600"/> Atividades Recentes</h3>
                <button onClick={() => navigate('/history')} className="text-xs font-bold text-hospital-600 hover:text-hospital-800 flex items-center gap-1">Ver Tudo <ArrowRight size={12}/></button>
             </div>
             <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {recentActivity.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">Nenhuma atividade recente.</div>
                ) : (
                    recentActivity.map(mov => (
                        <div key={mov.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs border border-blue-100 dark:border-blue-800">
                                    {mov.usuario_responsavel.substring(0,2).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white">{mov.nome_paciente}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                        <span className="font-mono">{mov.numero_prontuario}</span>
                                        <span>•</span>
                                        <span>{mov.origem} &rarr; <strong>{mov.destino}</strong></span>
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{new Date(mov.data_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                <p className="text-[10px] text-slate-400">{new Date(mov.data_hora).toLocaleDateString()}</p>
                            </div>
                        </div>
                    ))
                )}
             </div>
          </div>

          {/* 5. QUICK ACTIONS */}
          <div className="bg-gradient-to-br from-hospital-600 to-hospital-800 rounded-xl shadow-lg text-white p-6 flex flex-col justify-between">
              <div>
                  <h3 className="text-xl font-bold mb-2">Acesso Rápido</h3>
                  <p className="text-hospital-100 text-sm mb-6">Selecione uma tarefa comum para iniciar.</p>
                  
                  <div className="space-y-3">
                      <button onClick={() => navigate('/search')} className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm p-3 rounded-lg flex items-center gap-3 transition-colors border border-white/10 text-left">
                          <Search size={20} className="text-hospital-200"/>
                          <span className="font-medium text-sm">Consultar Prontuário</span>
                      </button>
                      <button onClick={() => navigate('/register')} className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm p-3 rounded-lg flex items-center gap-3 transition-colors border border-white/10 text-left">
                          <Plus size={20} className="text-hospital-200"/>
                          <span className="font-medium text-sm">Novo Cadastro</span>
                      </button>
                      <button onClick={() => navigate('/import')} className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm p-3 rounded-lg flex items-center gap-3 transition-colors border border-white/10 text-left">
                          <FileInput size={20} className="text-hospital-200"/>
                          <span className="font-medium text-sm">Importar Agenda</span>
                      </button>
                  </div>
              </div>
              <div className="mt-6 pt-6 border-t border-white/20 text-xs text-hospital-200 text-center">
                  SGP Hospitalar v1.0
              </div>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;