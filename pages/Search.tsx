
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { db } from '../services/database';
import { Search as SearchIcon, MapPin, User, ArrowUp, ArrowDown, X, Clock, Edit, Trash2, AlertTriangle, Calendar as CalendarIcon, ArrowLeftRight, CheckSquare, Layers, HelpCircle, ChevronDown, Loader2, ArrowLeft } from 'lucide-react';
import { Prontuario, ProntuarioStatus } from '../types';

interface SearchProps {
  userLogin?: string;
}

type SortKey = keyof Prontuario | 'nascimento';

const Search: React.FC<SearchProps> = ({ userLogin }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateSearch, setDateSearch] = useState('');
  const [prontuarios, setProntuarios] = useState<Prontuario[]>([]);
  const [config, setConfig] = useState(db.getConfig());
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [destinations, setDestinations] = useState<string[]>([]);
  
  // Refs for Focus
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingProntuario, setEditingProntuario] = useState<Prontuario | null>(null);

  // Delete State
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Prontuario | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  // MOVEMENT MODAL STATE
  const [isMoving, setIsMoving] = useState(false);
  const [movingProntuario, setMovingProntuario] = useState<Prontuario | null>(null);
  const [moveDestino, setMoveDestino] = useState('');
  const [moveMessage, setMoveMessage] = useState('');
  const [moveTab, setMoveTab] = useState<'move' | 'correct'>('move');

  // MULTI-SELECTION STATE
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Sort state
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'ultima_movimentacao', direction: 'desc' });

  useEffect(() => {
    // Session in sessionStorage
    const session = sessionStorage.getItem('sgp_session');
    if (session) setCurrentUser(JSON.parse(session));
    setConfig(db.getConfig());
    setDestinations(db.getDestinations());
    refreshData();
  }, []);

  const refreshData = () => {
    setProntuarios(db.getProntuarios());
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    searchInputRef.current?.focus();
  };

  const handleSort = (key: SortKey) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Helper for accent insensitive search
  const normalizeText = (text: string) => {
      return text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...prontuarios];
    
    // Filter first
    if (searchTerm) {
      const lower = normalizeText(searchTerm);
      result = result.filter(p => 
        normalizeText(p.numero_prontuario).includes(lower) || 
        normalizeText(p.nome_paciente).includes(lower) ||
        normalizeText(p.local_atual).includes(lower)
      );
    }
    if (dateSearch) {
       const searchClean = dateSearch.replace(/\//g, '').trim(); 
       result = result.filter(p => {
          if (!p.data_nascimento) return false;
          const pDateClean = p.data_nascimento.replace(/\//g, '');
          const effectiveSearch = searchClean.replace(/^0+/, ''); 
          return pDateClean.includes(effectiveSearch);
       });
    }

    // Sort second
    result.sort((a, b) => {
      let valA: any;
      let valB: any;
      switch(sortConfig.key) {
        case 'nome_paciente': valA = a.nome_paciente.toLowerCase(); valB = b.nome_paciente.toLowerCase(); break;
        case 'numero_prontuario': valA = parseInt(a.numero_prontuario) || a.numero_prontuario; valB = parseInt(b.numero_prontuario) || b.numero_prontuario; break;
        case 'idade': valA = a.idade; valB = b.idade; break;
        case 'local_atual': valA = a.local_atual.toLowerCase(); valB = b.local_atual.toLowerCase(); break;
        case 'status': valA = a.status.toLowerCase(); valB = b.status.toLowerCase(); break;
        case 'nascimento': valA = a.data_nascimento || ''; valB = b.data_nascimento || ''; break;
        case 'ultima_movimentacao': valA = a.ultima_movimentacao || ''; valB = b.ultima_movimentacao || ''; break;
        default: return 0;
      }
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [searchTerm, dateSearch, sortConfig, prontuarios]);

  // Apply Pagination Limit (Slice)
  const displayedItems = useMemo(() => {
      const limit = config.maxRowsSearch !== undefined ? config.maxRowsSearch : 20;
      if (limit === 0) return filteredAndSorted; // 0 = No limit
      return filteredAndSorted.slice(0, limit);
  }, [filteredAndSorted, config.maxRowsSearch]);

  const initiateDelete = (p: Prontuario, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(p);
    setDeleteConfirmation('');
    setIsDeleting(true);
  };

  const confirmDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteTarget && deleteConfirmation.toLowerCase() === 'sim, excluir') {
      db.deleteProntuario(deleteTarget.id);
      refreshData();
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const openEditModal = (p: Prontuario, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProntuario({...p});
    setIsEditing(true);
  };

  const handleEditAgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!editingProntuario) return;
      const val = e.target.value.replace(/\D/g, '');
      setEditingProntuario(prev => {
          if (!prev) return null;
          let newDate = prev.data_nascimento;
          if (val) {
              const year = new Date().getFullYear() - parseInt(val);
              newDate = `00/00/${year}`;
          } else {
              newDate = '';
          }
          return { ...prev, idade: val as any, data_nascimento: newDate };
      });
  };

  const handleEditDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!editingProntuario) return;
      let val = e.target.value.replace(/\D/g, '');
      if (val.length > 8) val = val.slice(0, 8);
      let formatted = val;
      if (val.length >= 5) formatted = val.slice(0, 2) + '/' + val.slice(2, 4) + '/' + val.slice(4);
      else if (val.length >= 3) formatted = val.slice(0, 2) + '/' + val.slice(2);
      
      let newAge = editingProntuario.idade;
      if (val.length === 8) {
          const year = parseInt(val.slice(4));
          const currentYear = new Date().getFullYear();
          if (year > 1900 && year <= currentYear) newAge = currentYear - year;
      }
      setEditingProntuario({...editingProntuario, data_nascimento: formatted, idade: newAge});
  };
  
  const handleEditCalendarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (editingProntuario && e.target.value) {
          const [y, m, d] = e.target.value.split('-');
          const currentYear = new Date().getFullYear();
          const newAge = currentYear - parseInt(y);
          setEditingProntuario({...editingProntuario, data_nascimento: `${d}/${m}/${y}`, idade: newAge});
      }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProntuario) {
       // Validation Check with Admin Bypass
       const isAdmin = currentUser?.tipo === 'admin';
       const canBypass = isAdmin && config.adminCanBypassRequiredFields;
       
       // Note: Even editing, bypass should allow saving empty fields if admin + bypass is enabled
       if (!canBypass) {
           if (!editingProntuario.numero_prontuario) return alert("Número obrigatório");
           if (!editingProntuario.nome_paciente) return alert("Nome obrigatório");
           if (editingProntuario.idade === undefined || editingProntuario.idade === null || String(editingProntuario.idade).trim() === '') return alert("Idade obrigatória");
           if (!editingProntuario.sexo || editingProntuario.sexo === 'O') return alert("Sexo obrigatório");
           if (!editingProntuario.data_nascimento) return alert("Nascimento obrigatório");
       } else {
           // Normalization for data consistency even with bypass
           if (!editingProntuario.sexo) editingProntuario.sexo = 'O';
           if (!editingProntuario.data_nascimento) editingProntuario.data_nascimento = '00/00/0000';
           if (editingProntuario.idade === undefined) editingProntuario.idade = 0;
       }
       
       setIsSaving(true);
       setTimeout(() => {
           try {
             db.updateProntuario(editingProntuario);
             refreshData();
             setIsEditing(false);
           } catch (error: any) {
             alert(error.message);
           } finally {
             setIsSaving(false);
           }
       }, 500);
    }
  };

  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(!isMultiSelectMode);
    setSelectedIds(new Set());
  };

  const toggleSelectRow = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleBulkMove = () => {
    if (selectedIds.size === 0) return;
    const firstId = Array.from(selectedIds)[0];
    const firstP = prontuarios.find(p => p.id === firstId);
    if (firstP) openMovementModal(firstP); 
  };

  const openMovementModal = (p: Prontuario) => {
     setMovingProntuario(p);
     setMoveDestino(destinations[0] || '');
     setMoveMessage('');
     setMoveTab('move');
     setIsMoving(true);
  };

  const confirmMovement = (e: React.FormEvent) => {
     e.preventDefault();
     if (!movingProntuario || !userLogin) return;

     if (isMultiSelectMode && selectedIds.size > 0) {
        if (moveTab === 'correct') {
            setMoveMessage('Correção não permitida em massa. Use Movimentar.');
            return;
        }
        try {
            const idsToMove = Array.from(selectedIds);
            let movedCount = 0;
            let ignoredCount = 0;

            idsToMove.forEach(id => {
                const p = prontuarios.find(pr => pr.id === id);
                if (p) {
                    if (p.local_atual === moveDestino) {
                        ignoredCount++;
                    } else {
                        db.addMovimentacao({
                            numero_prontuario: p.numero_prontuario,
                            nome_paciente: p.nome_paciente,
                            idade: p.idade,
                            origem: p.local_atual,
                            destino: moveDestino,
                            usuario_responsavel: userLogin
                        });
                        movedCount++;
                    }
                }
            });
            refreshData();
            setMoveMessage(`${movedCount} prontuários movimentados! (${ignoredCount} ignorados)`);
            
            setTimeout(() => { 
                setSelectedIds(new Set());
                setIsMoving(false); 
                setMoveMessage(''); 
            }, 2000);
        } catch(err) {
            setMoveMessage('Erro ao movimentar em massa.');
        }
        return;
     }

     if (moveTab === 'move') {
         if (movingProntuario.local_atual === moveDestino) {
            setMoveMessage('O prontuário já está neste local.');
            return;
         }
         try {
            db.addMovimentacao({
                numero_prontuario: movingProntuario.numero_prontuario,
                nome_paciente: movingProntuario.nome_paciente, 
                idade: movingProntuario.idade,
                origem: movingProntuario.local_atual,
                destino: moveDestino,
                usuario_responsavel: userLogin
            });
            refreshData();
            setMoveMessage('Movimentação registrada!');
            setTimeout(() => { setIsMoving(false); setMoveMessage(''); }, 1000);
         } catch(err) {
            setMoveMessage('Erro ao movimentar.');
         }
     } else {
         if (movingProntuario.local_atual === moveDestino) {
             setMoveMessage('O destino é o mesmo do atual.');
             return;
         }
         try {
             db.correctProntuarioLocation(movingProntuario.numero_prontuario, moveDestino, userLogin, false);
             refreshData();
             setMoveMessage('Local corrigido com sucesso!');
             setTimeout(() => { setIsMoving(false); setMoveMessage(''); }, 1000);
         } catch (err) {
             setMoveMessage('Erro ao corrigir.');
         }
     }
  };

  const cancelMovement = () => {
      setIsMoving(false);
      setMoveMessage('');
  };

  const handleDateTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, ''); 
    if (val.length > 8) val = val.slice(0, 8);
    if (val.length >= 5) {
        val = val.slice(0, 2) + '/' + val.slice(2, 4) + '/' + val.slice(4);
    } else if (val.length >= 3) {
        val = val.slice(0, 2) + '/' + val.slice(2);
    }
    setDateSearch(val);
  };
  const handleCalendarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value) {
          const [y, m, d] = e.target.value.split('-');
          setDateSearch(`${d}/${m}/${y}`);
      }
  };

  const canEdit = currentUser?.tipo === 'admin' || config.permissions.commonCanEditProntuario;
  const canDelete = currentUser?.tipo === 'admin' || config.permissions.commonCanDeleteProntuario;

  const SortIcon = ({ colKey }: { colKey: SortKey }) => {
    if (sortConfig.key !== colKey) return <div className="w-4 h-4 ml-1"></div>;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-hospital-600" /> : <ArrowDown size={14} className="ml-1 text-hospital-600" />;
  };

  const Header = ({ label, colKey, className = "" }: { label: string, colKey: SortKey, className?: string }) => (
    <th className={`px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors select-none group ${className}`} onClick={() => handleSort(colKey)}>
      <div className="flex items-center">{label}<SortIcon colKey={colKey} /></div>
    </th>
  );

  return (
    <div className="h-full flex flex-col gap-4">
      {/* 1. SEARCH BAR (FIXED) */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 shrink-0">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-grow-[2] w-full">
            <input ref={searchInputRef} type="text" className="w-full pl-4 pr-10 py-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-hospital-500 outline-none transition-all" placeholder="Buscar por número, nome do paciente ou setor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            {searchTerm && <button onClick={handleClearSearch} className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={18} /></button>}
          </div>
          <div className="relative flex-grow-[1] w-full">
             <div className="relative w-full">
                <input type="text" value={dateSearch} onChange={handleDateTextChange} className="w-full pl-4 pr-10 py-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-hospital-500 outline-none transition-all text-slate-600 dark:text-slate-300 relative z-10 bg-transparent" placeholder="Data (DD/MM/AAAA)" maxLength={10} />
                <div className="absolute right-3 top-3.5 z-20 flex items-center">
                    {dateSearch && <button onClick={() => setDateSearch('')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 mr-2"><X size={18} /></button>}
                    <div className="relative w-5 h-5">
                       <CalendarIcon size={20} className="text-slate-400 dark:text-slate-500" />
                       <input type="date" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleCalendarPick} tabIndex={-1} />
                    </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* 2. MIDDLE ROW: MULTI-SELECT TOOLBAR (FIXED) */}
      <div className="flex items-center h-12 gap-4 shrink-0">
          <div className="flex items-center gap-2 group relative">
             <button onClick={toggleMultiSelectMode} className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-bold text-sm shadow-sm transition-all ${isMultiSelectMode ? 'bg-hospital-600 text-white border-hospital-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                <CheckSquare size={16} /> Multi-Seleção
             </button>
             {/* CUSTOM TOOLTIP */}
             <div className="relative group/tooltip">
                <HelpCircle size={18} className="text-slate-400 dark:text-slate-500 cursor-help" />
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 w-64 p-3 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-50">
                    Ative a Multi-Seleção para movimentar mais de um prontuário para o mesmo destino.
                    <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                </div>
             </div>
          </div>
          
          {isMultiSelectMode && (
             <div className="flex-1 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg px-4 py-2 flex items-center gap-4 animate-in fade-in slide-in-from-left-2">
                 <div className="flex items-center gap-3">
                     <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-700">
                        {selectedIds.size}
                     </span>
                     <span className="text-sm font-medium text-indigo-800 dark:text-indigo-200">Selecionados</span>
                 </div>
                 <div className="h-4 w-px bg-indigo-200 dark:bg-indigo-700 mx-2"></div>
                 <button onClick={handleBulkMove} disabled={selectedIds.size === 0} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-md text-sm font-bold shadow-sm transition-all">
                    <ArrowLeftRight size={14} /> Mover
                 </button>
                 {selectedIds.size > 0 && (
                    <button onClick={() => setSelectedIds(new Set())} className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 uppercase tracking-wide opacity-75 hover:opacity-100">
                        Limpar
                    </button>
                 )}
             </div>
          )}
      </div>

      {/* 3. TABLE CONTAINER (SCROLLABLE) */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="overflow-auto h-full">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 shadow-sm">
              <tr>
                <th className={`bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 transition-all duration-300 ease-in-out overflow-hidden ${isMultiSelectMode ? 'w-12 px-6 py-4 opacity-100' : 'w-0 px-0 py-0 opacity-0'}`}></th>
                <Header label="Data/Hora" colKey="ultima_movimentacao" className="w-48"/>
                <Header label="Prontuário" colKey="numero_prontuario" />
                <Header label="Paciente" colKey="nome_paciente" />
                <Header label="Idade / Nasc." colKey="idade" />
                <Header label="Local Atual" colKey="local_atual" />
                <Header label="Situação" colKey="status" />
                {(canEdit || canDelete) && <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-left">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
              {displayedItems.map(p => (
                <tr key={p.id} onClick={() => isMultiSelectMode ? toggleSelectRow(p.id) : openMovementModal(p)} className={`hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group cursor-pointer ${isMultiSelectMode && selectedIds.has(p.id) ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                  <td className={`border-b border-slate-100 dark:border-slate-700 transition-all duration-300 ease-in-out overflow-hidden ${isMultiSelectMode ? 'px-6 py-4 opacity-100' : 'px-0 py-0 opacity-0 w-0'}`}>
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedIds.has(p.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                          {selectedIds.has(p.id) && <CheckSquare size={14} />}
                      </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center gap-2 text-hospital-600 dark:text-hospital-400 font-medium text-sm"><Clock size={16} />{p.ultima_movimentacao ? new Date(p.ultima_movimentacao).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'}) : '-'}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium text-lg text-slate-900 dark:text-white">{p.numero_prontuario}</span>
                        {p.volumes && p.volumes !== '1 Volume' && (
                            <div className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 mt-1">
                                <Layers size={12} />
                                <span>{p.volumes}</span>
                            </div>
                        )}
                      </div>
                  </td>
                  <td className="px-6 py-4"><div className="font-medium text-slate-900 dark:text-white text-lg">{p.nome_paciente}</div><div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">{p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Feminino' : 'Outro'} {p.volumes && p.volumes !== '1 Volume' && <span className="text-transparent">.</span> /* Spacer */}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium"><User size={16} className="text-slate-400"/><span>{p.idade} Anos</span></div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-6 mt-0.5">Nasc: {p.data_nascimento || '00/00/0000'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="flex flex-col">{p.local_anterior && p.local_anterior !== p.local_atual && <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1 opacity-90 font-medium">{p.local_anterior} <span>&rarr;</span></div>}<div className="flex items-center gap-2"><MapPin size={16} className="text-hospital-500"/><span className="font-bold text-slate-700 dark:text-slate-200">{p.local_atual}</span></div></div></td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold ${p.status === ProntuarioStatus.ATIVO ? 'bg-green-100 text-green-700' : p.status === ProntuarioStatus.DESATIVADO ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                       <span className={`w-2 h-2 rounded-full ${p.status === ProntuarioStatus.ATIVO ? 'bg-green-500' : p.status === ProntuarioStatus.DESATIVADO ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
                       {p.status}
                    </span>
                  </td>
                  {(canEdit || canDelete) && (
                    <td className="px-6 py-4 text-left" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-start gap-2">
                        {canEdit && <button onClick={(e) => openEditModal(p, e)} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-hospital-600 hover:bg-hospital-50 dark:hover:bg-hospital-900/30 rounded transition-colors" title="Editar Dados"><Edit size={16} /></button>}
                        {canDelete && <button onClick={(e) => initiateDelete(p, e)} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors" title="Excluir Registro"><Trash2 size={16} /></button>}
                        </div>
                    </td>
                  )}
                </tr>
              ))}
              {displayedItems.length === 0 && (
                  <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-slate-400">Nenhum prontuário encontrado.</td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER INFO - Shows limit info */}
      <div className="text-xs text-slate-400 dark:text-slate-500 text-right px-2">
          Exibindo {displayedItems.length} de {filteredAndSorted.length} registros (Limite: {config.maxRowsSearch !== undefined && config.maxRowsSearch > 0 ? config.maxRowsSearch : 'Sem Limite'})
      </div>

      {/* FULL EDIT MODAL */}
      {isEditing && editingProntuario && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[55] p-4" onClick={() => setIsEditing(false)}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
               <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-hospital-50 dark:bg-slate-900">
                  <h3 className="font-bold text-hospital-800 dark:text-hospital-400 flex items-center gap-2 text-lg"><Edit size={20}/> Editar Dados Pessoais</h3>
                  <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={20}/></button>
               </div>
               <form onSubmit={handleSaveEdit} className="p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-5">
                     <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase">Número *</label>
                        <input required={!config.adminCanBypassRequiredFields} type="text" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm dark:bg-slate-900 dark:text-white" value={editingProntuario.numero_prontuario} onChange={e => setEditingProntuario({...editingProntuario, numero_prontuario: e.target.value.replace(/\D/g, '')})} />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase">Nome Completo *</label>
                        <input required={!config.adminCanBypassRequiredFields} type="text" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm dark:bg-slate-900 dark:text-white" value={editingProntuario.nome_paciente} onChange={e => setEditingProntuario({...editingProntuario, nome_paciente: e.target.value.toUpperCase().replace(/[^A-ZÀ-ÖØ-Þ\s]/g, '')})} />
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase">Situação</label>
                        <select className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm bg-white dark:bg-slate-900 dark:text-white" value={editingProntuario.status} onChange={e => setEditingProntuario({...editingProntuario, status: e.target.value as ProntuarioStatus})}>
                            <option value={ProntuarioStatus.ATIVO}>Ativo</option>
                            <option value={ProntuarioStatus.DESATIVADO}>Desativado</option>
                            <option value={ProntuarioStatus.PERDIDO}>Perdido</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase">Volumes</label>
                        <select className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm bg-white dark:bg-slate-900 dark:text-white" value={editingProntuario.volumes || ''} onChange={e => setEditingProntuario({...editingProntuario, volumes: e.target.value})}>
                            {config.volumeOptions.map(vol => <option key={vol} value={vol}>{vol}</option>)}
                        </select>
                      </div>
                  </div>
                  <div className="grid grid-cols-3 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase">Idade *</label>
                        <input type="text" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm dark:bg-slate-900 dark:text-white" value={editingProntuario.idade} onChange={handleEditAgeChange} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase">Sexo *</label>
                        <select className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 text-sm bg-white dark:bg-slate-900 dark:text-white" value={editingProntuario.sexo || 'O'} onChange={e => setEditingProntuario({...editingProntuario, sexo: e.target.value})}>
                            <option value="O">Outro</option>
                            <option value="M">Masculino</option>
                            <option value="F">Feminino</option>
                        </select>
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase">Nascimento *</label>
                         <div className="relative">
                            <input type="text" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 pr-10 text-sm dark:bg-slate-900 dark:text-white" value={editingProntuario.data_nascimento} onChange={handleEditDateChange} maxLength={10} placeholder="DD/MM/AAAA" />
                            <div className="absolute right-3 top-2.5 z-20">
                                <CalendarIcon size={18} className="text-slate-400 cursor-pointer" />
                                <input type="date" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleEditCalendarPick} tabIndex={-1} />
                            </div>
                         </div>
                      </div>
                  </div>
                  <div className="pt-4 flex gap-3">
                     <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-2.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg border border-transparent">Cancelar</button>
                     <button type="submit" disabled={isSaving} className="flex-1 py-2.5 bg-hospital-600 hover:bg-hospital-700 disabled:opacity-70 text-white rounded-lg font-bold shadow-md flex items-center justify-center gap-2">
                         {isSaving ? <><Loader2 size={18} className="animate-spin"/> Salvando...</> : 'Salvar Alterações'}
                     </button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {/* Movement Modal (RICH VISUAL RESTORED) */}
      {isMoving && movingProntuario && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[45] p-4" onClick={cancelMovement}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
               <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-hospital-50 dark:bg-slate-900">
                  <h3 className="font-bold text-hospital-800 dark:text-hospital-400 flex items-center gap-2 text-lg"><ArrowLeft size={20}/> {isMultiSelectMode ? 'Movimentação em Massa' : 'Registrar Movimentação'}</h3>
                  <button onClick={cancelMovement} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={20}/></button>
               </div>
               
               {!(isMultiSelectMode && selectedIds.size > 0) && (
                   <div className="flex border-b border-slate-200 dark:border-slate-600">
                       <button onClick={() => setMoveTab('move')} className={`flex-1 py-3 text-sm font-bold uppercase ${moveTab === 'move' ? 'bg-white dark:bg-slate-800 text-hospital-600 border-b-2 border-hospital-600' : 'bg-slate-50 dark:bg-slate-900 text-slate-500'}`}>Movimentar</button>
                       <button onClick={() => setMoveTab('correct')} className={`flex-1 py-3 text-sm font-bold uppercase ${moveTab === 'correct' ? 'bg-white dark:bg-slate-800 text-amber-600 border-b-2 border-amber-600' : 'bg-slate-50 dark:bg-slate-900 text-slate-500'}`}>Corrigir Local</button>
                   </div>
               )}

               <div className="p-6">
                  {moveMessage && <div className="mb-4 p-3 rounded text-sm font-bold text-center bg-slate-100 text-slate-700">{moveMessage}</div>}
                  
                  {!(isMultiSelectMode && selectedIds.size > 0) && (
                      <div className="mb-6 flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700">
                           <div>
                               <p className="text-2xl font-bold text-slate-800 dark:text-white">{movingProntuario.numero_prontuario}</p>
                               <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{movingProntuario.nome_paciente}</p>
                           </div>
                           <div className="text-right">
                               <p className="text-xs text-slate-400 uppercase font-bold mb-1">Local Atual</p>
                               <div className="flex items-center gap-2 text-hospital-600 dark:text-hospital-400 font-bold">
                                   <MapPin size={18}/> {movingProntuario.local_atual}
                               </div>
                           </div>
                      </div>
                  )}

                  <form onSubmit={confirmMovement} className="space-y-6">
                     <div className="relative">
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 uppercase tracking-wider">{moveTab === 'correct' ? 'Corrigir Para:' : 'Selecione o Destino:'}</label>
                        <div className="relative">
                            <select className="w-full border border-slate-300 dark:border-slate-600 rounded-xl p-4 text-lg bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-hospital-500 outline-none appearance-none" value={moveDestino} onChange={e => setMoveDestino(e.target.value)}>
                                {destinations.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20}/>
                        </div>
                     </div>
                     
                     {moveTab === 'correct' ? (
                         <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded text-xs text-amber-700 dark:text-amber-300 mb-2 border border-amber-100 dark:border-amber-800 flex items-start gap-2">
                             <AlertTriangle size={14} className="mt-0.5 shrink-0"/>
                             <p>Atenção: A correção altera o local atual do prontuário. Use apenas para corrigir erros de lançamento.</p>
                         </div>
                     ) : (
                         !(isMultiSelectMode && selectedIds.size > 0) && (
                             <div className="flex items-center justify-center gap-4 text-slate-400 py-2">
                                 <span className="font-bold text-slate-500 dark:text-slate-300">{movingProntuario.local_atual}</span>
                                 <ArrowLeftRight size={24} className="text-hospital-500 animate-pulse"/>
                                 <span className="font-bold text-hospital-600 dark:text-hospital-400 text-lg">{moveDestino}</span>
                             </div>
                         )
                     )}

                     <div className="flex gap-3 pt-2">
                        <button type="button" onClick={cancelMovement} className="flex-1 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                        <button type="submit" className={`flex-1 text-white font-bold py-3 rounded-xl shadow-lg transition-transform hover:-translate-y-0.5 ${moveTab === 'correct' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-hospital-600 hover:bg-hospital-700'}`}>
                            {moveTab === 'correct' ? 'Salvar Correção' : 'Confirmar'}
                        </button>
                     </div>
                  </form>
               </div>
            </div>
        </div>
      )}
      
      {/* Delete Modal */}
      {isDeleting && deleteTarget && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDeleteTarget(null)}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-6 border border-slate-200 dark:border-slate-700 flex flex-col items-center" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mb-4"><Trash2 size={24} /></div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 text-center">Excluir Prontuário</h3>
              <p className="text-sm text-slate-500 dark:text-slate-300 mb-4 text-center">Esta ação exclui permanentemente o cadastro do paciente do sistema.</p>
              <form onSubmit={confirmDelete} className="w-full">
                 <input type="text" className="w-full border p-2 mb-4 rounded dark:bg-slate-900 dark:text-white dark:border-slate-600" value={deleteConfirmation} onChange={e => setDeleteConfirmation(e.target.value)} placeholder="Sim, excluir" />
                 <div className="flex gap-2">
                    <button type="button" onClick={() => setDeleteTarget(null)} className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 dark:text-white rounded">Cancelar</button>
                    <button type="submit" disabled={deleteConfirmation.toLowerCase() !== 'sim, excluir'} className="flex-1 py-2 bg-red-600 text-white rounded disabled:opacity-50">Excluir</button>
                 </div>
              </form>
            </div>
         </div>
      )}
    </div>
  );
};

export default Search;
