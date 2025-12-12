
import React, { useEffect, useState, useRef } from 'react';
import { db } from '../services/database';
import { ProntuarioStatus, Movimentacao } from '../types';
import { FolderOpen, Archive, Activity, TrendingUp, Clock, Search, Plus, FileInput, ArrowRight, MapPin, Download, Filter } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // --- STATE ---
  const [stats, setStats] = useState({
    total: 0,
    inCirculation: 0,
    inactive: 0,
    movementsTodayTotal: 0,
    movementsTodayUnique: 0
  });
  
  // Controls
  const [activeMetric, setActiveMetric] = useState<'total' | 'unique'>('total');
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({
      start: new Date(new Date().setDate(new Date().getDate() - 6)).toISOString().split('T')[0], // 7 days ago
      end: new Date().toISOString().split('T')[0] // Today
  });

  const [sectorDistribution, setSectorDistribution] = useState<{name: string, value: number}[]>([]);
  const [movementTrend, setMovementTrend] = useState<{date: string, count: number}[]>([]);
  const [recentActivity, setRecentActivity] = useState<Movimentacao[]>([]);

  useEffect(() => {
    const prontuarios = db.getProntuarios();
    const movements = db.getMovimentacoes();
    
    const todayISO = new Date().toISOString().split('T')[0];

    // 1. Basic Stats Logic
    const total = prontuarios.length;
    
    // In Circulation
    const inCirculation = prontuarios.filter(p => 
        p.status === ProntuarioStatus.ATIVO && 
        p.local_atual !== 'Arquivo' && 
        p.local_atual !== 'Arquivo Morto'
    ).length;

    // Inactive
    const inactive = prontuarios.filter(p => 
        p.status === ProntuarioStatus.DESATIVADO || 
        p.local_atual === 'Arquivo Morto'
    ).length;
    
    // Movements Today Logic
    const todayMovs = movements.filter(m => m.data_hora.startsWith(todayISO));
    const uniqueToday = new Set(todayMovs.map(m => m.numero_prontuario)).size;
    
    setStats({
      total,
      inCirculation,
      inactive,
      movementsTodayTotal: todayMovs.length,
      movementsTodayUnique: uniqueToday
    });

    // 2. Sector Distribution (Pie Chart)
    const locMap = prontuarios.reduce((acc, curr) => {
      if (curr.local_atual !== 'Arquivo Morto' && curr.status === ProntuarioStatus.ATIVO) {
          acc[curr.local_atual] = (acc[curr.local_atual] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const pieData = Object.entries(locMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    
    setSectorDistribution(pieData);

    // 3. Movement Trend (Custom Date Range + Active Metric)
    generateTrendData(movements, dateRange.start, dateRange.end, activeMetric);

    // 4. Recent Activity
    const sortedMovs = [...movements].sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime()).slice(0, 5);
    setRecentActivity(sortedMovs);

  }, [dateRange, activeMetric]); // Re-run when range or metric changes

  const generateTrendData = (movements: Movimentacao[], start: string, end: string, metric: 'total' | 'unique') => {
      const startDate = new Date(start);
      const endDate = new Date(end);
      const data = [];

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          const daysMovs = movements.filter(m => m.data_hora.startsWith(dateStr));
          
          let count = 0;
          if (metric === 'total') {
              count = daysMovs.length;
          } else {
              count = new Set(daysMovs.map(m => m.numero_prontuario)).size;
          }

          data.push({
              date: dateStr.split('-').slice(1).reverse().join('/'), // DD/MM
              count: count
          });
      }
      setMovementTrend(data);
  };

  const handleDownloadChart = () => {
      if (chartContainerRef.current) {
          const svg = chartContainerRef.current.querySelector('svg');
          if (svg) {
              // Get SVG data
              const svgData = new XMLSerializer().serializeToString(svg);
              // Create canvas
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const img = new Image();
              
              // Get dimensions from SVG or container
              const width = svg.clientWidth || 600;
              const height = svg.clientHeight || 300;
              canvas.width = width;
              canvas.height = height;

              // SVG to Base64
              const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
              const url = URL.createObjectURL(svgBlob);

              img.onload = () => {
                  if (ctx) {
                      // Draw white background
                      ctx.fillStyle = '#ffffff';
                      ctx.fillRect(0, 0, width, height);
                      // Draw image
                      ctx.drawImage(img, 0, 0);
                      // Download
                      const pngUrl = canvas.toDataURL('image/png');
                      const link = document.createElement('a');
                      link.download = 'grafico_movimentacao.png';
                      link.href = pngUrl;
                      link.click();
                      URL.revokeObjectURL(url);
                  }
              };
              img.src = url;
          }
      }
  };

  // Professional Palette
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e'];

  const StatCard = ({ title, value, icon: Icon, colorClass, bgClass, subtext, children }: any) => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-start justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1 z-10 relative">{title}</p>
        <h3 className="text-3xl font-bold text-slate-800 dark:text-white z-10 relative">{value}</h3>
        {subtext && <p className="text-xs text-slate-400 mt-1 z-10 relative">{subtext}</p>}
        {children}
      </div>
      <div className={`p-3 rounded-lg ${bgClass} ${colorClass} z-10 relative`}>
        <Icon size={24} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-8 h-full flex flex-col overflow-y-auto">
      {/* 1. KEY METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
        <StatCard 
            title="Total de Prontuários" 
            value={stats.total} 
            icon={FolderOpen} 
            bgClass="bg-blue-50 dark:bg-blue-900/20" 
            colorClass="text-blue-600 dark:text-blue-400" 
        />
        <StatCard 
            title="Em Circulação" 
            value={stats.inCirculation} 
            icon={Activity} 
            bgClass="bg-green-50 dark:bg-green-900/20" 
            colorClass="text-green-600 dark:text-green-400" 
            subtext="Fora do Arquivo"
        />
        <StatCard 
            title="Inativos/Arquivo Morto" 
            value={stats.inactive} 
            icon={Archive} 
            bgClass="bg-slate-100 dark:bg-slate-700" 
            colorClass="text-slate-600 dark:text-slate-400" 
        />
        {/* DYNAMIC CARD */}
        <StatCard 
            title={activeMetric === 'total' ? "Movimentações (Total)" : "Prontuários Movimentados"}
            value={activeMetric === 'total' ? stats.movementsTodayTotal : stats.movementsTodayUnique} 
            icon={TrendingUp} 
            bgClass="bg-purple-50 dark:bg-purple-900/20" 
            colorClass="text-purple-600 dark:text-purple-400" 
        >
            <div className="absolute bottom-2 left-4 right-0 flex gap-2 pt-2">
                <button 
                    onClick={() => setActiveMetric('total')}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${activeMetric === 'total' ? 'bg-purple-600 text-white border-purple-600' : 'bg-transparent text-slate-400 border-slate-300'}`}
                >
                    Total
                </button>
                <button 
                    onClick={() => setActiveMetric('unique')}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${activeMetric === 'unique' ? 'bg-purple-600 text-white border-purple-600' : 'bg-transparent text-slate-400 border-slate-300'}`}
                >
                    Únicos
                </button>
            </div>
        </StatCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
          {/* 2. ACTIVITY CHART WITH DATE RANGE */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                 <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                     <Activity size={20} className="text-hospital-600"/> 
                     Tendência ({activeMetric === 'total' ? 'Total' : 'Únicos'})
                 </h3>
                 <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                     <input 
                        type="date" 
                        value={dateRange.start} 
                        onChange={(e) => setDateRange({...dateRange, start: e.target.value})} 
                        className="bg-transparent text-xs font-medium text-slate-600 dark:text-slate-300 outline-none"
                     />
                     <span className="text-slate-400 text-xs">-</span>
                     <input 
                        type="date" 
                        value={dateRange.end} 
                        onChange={(e) => setDateRange({...dateRange, end: e.target.value})} 
                        className="bg-transparent text-xs font-medium text-slate-600 dark:text-slate-300 outline-none"
                     />
                     <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                     <button onClick={handleDownloadChart} className="text-slate-400 hover:text-hospital-600 transition-colors p-1" title="Baixar Gráfico (PNG)">
                         <Download size={14}/>
                     </button>
                 </div>
             </div>
             
             <div className="h-64" ref={chartContainerRef}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={movementTrend}>
                        <defs>
                            <linearGradient id="colorMovs" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={activeMetric === 'total' ? "#307ecc" : "#8b5cf6"} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={activeMetric === 'total' ? "#307ecc" : "#8b5cf6"} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <RechartsTooltip 
                            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="count" 
                            stroke={activeMetric === 'total' ? "#307ecc" : "#8b5cf6"} 
                            strokeWidth={3} 
                            fillOpacity={1} 
                            fill="url(#colorMovs)" 
                            name={activeMetric === 'total' ? "Movimentações" : "Prontuários Únicos"}
                            label={{ position: 'top', fill: '#94a3b8', fontSize: 11 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* 3. SECTOR DISTRIBUTION (PIE CHART) */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
             <h3 className="font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2"><MapPin size={20} className="text-hospital-600"/> Distribuição por Setor</h3>
             <p className="text-xs text-slate-500 mb-4">Prontuários Ativos</p>
             <div className="flex-1 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={sectorDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                        >
                            {sectorDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                            ))}
                        </Pie>
                        <RechartsTooltip 
                            contentStyle={{borderRadius: '8px', border: 'none', backgroundColor: '#1e293b', color: '#fff'}}
                            itemStyle={{color: '#fff'}}
                        />
                        <Legend 
                            layout="horizontal" 
                            verticalAlign="bottom" 
                            align="center"
                            wrapperStyle={{fontSize: '10px', paddingTop: '10px'}}
                        />
                    </PieChart>
                </ResponsiveContainer>
             </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[300px]">
          {/* 4. RECENT ACTIVITY LIST */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden h-full">
             <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Clock size={20} className="text-hospital-600"/> Atividades Recentes</h3>
                <button onClick={() => navigate('/history')} className="text-xs font-bold text-hospital-600 hover:text-hospital-800 flex items-center gap-1">Ver Tudo <ArrowRight size={12}/></button>
             </div>
             <div className="flex-1 overflow-auto divide-y divide-slate-100 dark:divide-slate-700">
                {recentActivity.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">Nenhuma atividade recente.</div>
                ) : (
                    recentActivity.map(mov => (
                        <div key={mov.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs border border-blue-100 dark:border-blue-800 shrink-0">
                                    {mov.usuario_responsavel.substring(0,2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{mov.nome_paciente}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                                        <span className="font-mono">{mov.numero_prontuario}</span>
                                        <span>•</span>
                                        <span className="truncate">{mov.origem} &rarr; <strong>{mov.destino}</strong></span>
                                    </p>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{new Date(mov.data_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                <p className="text-[10px] text-slate-400">{new Date(mov.data_hora).toLocaleDateString()}</p>
                            </div>
                        </div>
                    ))
                )}
             </div>
          </div>

          {/* 5. QUICK ACTIONS */}
          <div className="bg-gradient-to-br from-hospital-600 to-hospital-800 rounded-xl shadow-lg text-white p-6 flex flex-col justify-between h-full">
              <div>
                  <h3 className="text-xl font-bold mb-2">Acesso Rápido</h3>
                  <p className="text-hospital-100 text-sm mb-6">Selecione uma tarefa comum para iniciar.</p>
                  
                  <div className="space-y-3">
                      <button onClick={() => navigate('/search')} className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm p-4 rounded-lg flex items-center gap-3 transition-colors border border-white/10 text-left">
                          <Search size={22} className="text-hospital-200"/>
                          <span className="font-medium text-sm">Consultar Prontuário</span>
                      </button>
                      <button onClick={() => navigate('/register')} className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm p-4 rounded-lg flex items-center gap-3 transition-colors border border-white/10 text-left">
                          <Plus size={22} className="text-hospital-200"/>
                          <span className="font-medium text-sm">Novo Cadastro</span>
                      </button>
                      <button onClick={() => navigate('/import')} className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm p-4 rounded-lg flex items-center gap-3 transition-colors border border-white/10 text-left">
                          <FileInput size={22} className="text-hospital-200"/>
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
