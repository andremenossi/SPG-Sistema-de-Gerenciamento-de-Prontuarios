import React, { useState, useEffect } from 'react';
import { AgendaItem, ProntuarioStatus, AgendaHistory } from '../types';
import { db } from '../services/database';
import { Upload, FileSpreadsheet, Check, AlertTriangle, AlertCircle, Calendar, Trash2, Edit, X, ArrowLeft, ArrowUp, ArrowDown, Eye, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ImportAgendaProps {
  userLogin: string;
}

type SortKey = 'data_agenda' | 'nome_medico';

const ImportAgenda: React.FC<ImportAgendaProps> = ({ userLogin }) => {
  const [step, setStep] = useState<1 | 2>(1); // 1=Dashboard, 2=Review
  
  const [drafts, setDrafts] = useState<AgendaHistory[]>([]);
  const [processedHistory, setProcessedHistory] = useState<AgendaHistory[]>([]);
  
  // Sort State - Independent
  const [draftSort, setDraftSort] = useState<{ key: SortKey, direction: 'asc' | 'desc' }>({ key: 'data_agenda', direction: 'desc' });
  const [processedSort, setProcessedSort] = useState<{ key: SortKey, direction: 'asc' | 'desc' }>({ key: 'data_agenda', direction: 'desc' });

  // Review/View State
  const [activeDraft, setActiveDraft] = useState<AgendaHistory | null>(null);
  const [reviewItems, setReviewItems] = useState<AgendaItem[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'read'>('edit');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Modals
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [conflictItems, setConflictItems] = useState<AgendaItem[]>([]);

  useEffect(() => {
    refreshLists();
  }, []);

  const refreshLists = () => {
    setDrafts(db.getAgendaDrafts());
    setProcessedHistory(db.getAgendaProcessed());
  };

  // --- Sorting Logic ---
  const toggleDraftSort = (key: SortKey) => {
      setDraftSort(current => ({
          key,
          direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
      }));
  };

  const toggleProcessedSort = (key: SortKey) => {
      setProcessedSort(current => ({
          key,
          direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
      }));
  };

  const getSortedList = (list: AgendaHistory[], config: { key: SortKey, direction: 'asc' | 'desc' }) => {
      return [...list].sort((a, b) => {
          let valA = a[config.key] || '';
          let valB = b[config.key] || '';
          
          if (config.key === 'data_agenda') {
              // Convert DD/MM/YYYY to YYYYMMDD for sorting
              const convert = (d: string) => d.split('/').reverse().join('');
              valA = convert(valA);
              valB = convert(valB);
          }

          if (valA < valB) return config.direction === 'asc' ? -1 : 1;
          if (valA > valB) return config.direction === 'asc' ? 1 : -1;
          return 0;
      });
  };

  const handleSelectAll = (checked: boolean) => {
      if (viewMode === 'read') return;
      setSelectAll(checked);
      setReviewItems(prev => prev.map(i => ({...i, selecionado: checked})));
  };

  // --- PARSING HELPERS ---
  const parseAgeToYears = (ageStr: string): number => {
      if (!ageStr) return 0;
      const str = String(ageStr).toLowerCase();
      const yearsMatch = str.match(/(\d+)\s*ano/);
      if (yearsMatch) return parseInt(yearsMatch[1]);
      if (str.includes('mes') || str.includes('dias') || str.includes('dia')) return 0;
      const num = parseInt(str);
      return isNaN(num) ? 0 : num;
  };

  // --- STEP 1: UPLOAD ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as string[][];

        const draftsFound: {doc: string, spec: string, date: string, items: AgendaItem[]}[] = [];
        let currentDoc = '', currentSpec = '', currentDate = '';
        let currentItems: AgendaItem[] = [];

        const flushDraft = () => {
             if (currentItems.length > 0) {
                 draftsFound.push({ doc: currentDoc, spec: currentSpec, date: currentDate, items: [...currentItems] });
                 currentItems = [];
             }
        };

        const timeRegex = /^\d{1,2}:\d{2}(:\d{2})?$/; 
        const prontuarioRegex = /(?:PRONTU[ÁA]RIO|PRONT|C[ÓO]DIGO|MATR[ÍI]CULA)\s*[:.]?\s*(\d+)/i;
        const garbageKeywords = ['AGENDAMENTO', 'ALTA', 'RETORNO', 'FALTOU', 'RESERVADO', 'BLOQUEADO', 'TELECONSULTA'];

        let sexColIdx = -1;
        for(let r=0; r<Math.min(rows.length, 20); r++) {
             rows[r].forEach((cell, idx) => {
                const c = String(cell).toUpperCase().trim();
                if (c === 'SEXO' || c === 'GENERO' || c === 'GÊNERO') sexColIdx = idx;
            });
        }

        for (let i = 0; i < rows.length; i++) {
            const rowStr = rows[i].join(' ').toUpperCase();
            
            if (rowStr.match(/(?:PROFISSIONAL|MEDICO|DR\.)/i)) {
                 flushDraft(); 
                 currentDoc = rowStr.split(':')[1]?.trim() || 'Médico Desconhecido';
                 currentSpec = ''; 
                 currentDate = ''; 
            }
            
            if (!currentSpec && rowStr.includes('ESPECIALIDADE')) currentSpec = rowStr.split(':')[1]?.trim() || '';
            if (!currentDate) {
                 const dMatch = rowStr.match(/DATA AGENDA:?\s*(\d{2}[-/]\d{2}[-/]\d{4})/i);
                 if (dMatch) currentDate = dMatch[1];
            }

            let timeIdx = -1;
            rows[i].forEach((cell, idx) => { if(timeRegex.test(cell.trim())) timeIdx = idx; });
            
            if (timeIdx !== -1) {
                const horario = rows[i][timeIdx].trim();
                let nome = '';
                
                for(let c=timeIdx+1; c<rows[i].length; c++) {
                    const val = rows[i][c];
                    if (val && val.length > 3 && isNaN(Number(val)) && !val.includes('AGENDA')) { 
                        nome = val.trim(); 
                        break; 
                    }
                }

                if (garbageKeywords.some(k => nome.toUpperCase().includes(k))) continue;

                if (nome) {
                    let idade = 0;
                    let prontuario = '';
                    let sexo = 'O';

                    rows[i].forEach(cell => {
                        const s = String(cell).toLowerCase();
                        if (s.includes('ano') || s.includes('mes') || s.includes('dia')) {
                             idade = parseAgeToYears(s);
                        }
                    });

                    if (sexColIdx !== -1 && rows[i][sexColIdx]) {
                        const s = String(rows[i][sexColIdx]).toUpperCase().trim();
                        if (s === 'M' || s.startsWith('MASC')) sexo = 'M';
                        else if (s === 'F' || s.startsWith('FEM')) sexo = 'F';
                    }

                    const checkProntuario = (str: string) => {
                        const match = str.match(prontuarioRegex);
                        return match ? match[1] : null;
                    };

                    prontuario = checkProntuario(rowStr) || '';
                    if (!prontuario && i+1 < rows.length) prontuario = checkProntuario(rows[i+1].join(' ').toUpperCase()) || '';
                    if (!prontuario && i+2 < rows.length) prontuario = checkProntuario(rows[i+2].join(' ').toUpperCase()) || '';

                    currentItems.push({
                        id: crypto.randomUUID(),
                        numero_prontuario: prontuario,
                        nome_paciente: nome,
                        idade: idade,
                        sexo: sexo,
                        horario: horario,
                        medico: currentDoc,
                        especialidade: currentSpec,
                        selecionado: true,
                        statusProcessamento: 'pendente'
                    });
                }
            }
        }
        flushDraft(); 

        if (draftsFound.length === 0) { alert("Nenhuma agenda identificada."); return; }

        let addedCount = 0;
        draftsFound.forEach(draft => {
            const newDraft: AgendaHistory = {
                id: crypto.randomUUID() + '-' + Date.now(),
                data_importacao: new Date().toISOString(),
                data_agenda: draft.date || new Date().toLocaleDateString('pt-BR'),
                usuario: userLogin,
                nome_medico: draft.doc,
                especialidade: draft.spec || 'Geral',
                total_pacientes: draft.items.length,
                status: 'draft',
                items: draft.items
            };
            db.addAgendaHistory(newDraft);
            addedCount++;
        });

        refreshLists();
        alert(`${addedCount} agenda(s) importada(s) como Rascunho!`);
        // Reset file input
        e.target.value = '';

      } catch (err) { alert("Erro ao ler arquivo."); }
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmDeleteHistory = () => {
      if (deleteTargetId) {
          db.deleteAgendaHistory(deleteTargetId);
          refreshLists();
          if (activeDraft?.id === deleteTargetId) { setStep(1); setActiveDraft(null); }
          setDeleteTargetId(null);
      }
  };

  const startReview = (draft: AgendaHistory) => {
      setActiveDraft(draft);
      setReviewItems(draft.items);
      setViewMode('edit');
      setStep(2);
  };

  const viewProcessed = (h: AgendaHistory, mode: 'read' | 'edit') => {
      setActiveDraft(h);
      setReviewItems(h.items);
      setViewMode(mode);
      setStep(2);
  };

  const handleItemChange = (id: string, field: keyof AgendaItem, val: any) => {
      if (viewMode === 'read') return;
      let value = val;
      if (field === 'idade') value = Math.max(0, parseInt(val) || 0);
      if (field === 'numero_prontuario') value = String(val).replace(/\D/g, '');
      if (field === 'nome_paciente') value = String(val).toUpperCase().replace(/[^A-ZÀ-ÖØ-Þ\s]/g, '');
      setReviewItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const initiateProcessing = () => {
      if (viewMode === 'read') return;
      
      const itemsToProcess = reviewItems.filter(i => i.selecionado);
      if (itemsToProcess.length === 0) { alert("Nenhum prontuário selecionado."); return; }

      const criticalMissing = itemsToProcess.some(i => !i.nome_paciente && !i.numero_prontuario);
      if (criticalMissing) { 
          alert("Existem prontuários selecionados sem Nome e sem Número. Remova a seleção deles para continuar."); 
          return; 
      }

      const missingNumber = itemsToProcess.some(i => !i.numero_prontuario);
      if (missingNumber) { setShowMissingModal(true); return; }

      checkConflicts(itemsToProcess);
  };

  const proceedFromMissing = () => {
      setShowMissingModal(false);
      checkConflicts(reviewItems.filter(i => i.selecionado));
  };

  const checkConflicts = (items: AgendaItem[]) => {
      const conflicts = items.filter(i => {
          if (!i.numero_prontuario) return false; 
          const p = db.getProntuarioByNumber(i.numero_prontuario);
          return p && p.local_atual !== 'Arquivo';
      });

      if (conflicts.length > 0) {
          setConflictItems(conflicts); 
          setShowConflictModal(true);
      } else {
          executeMovements();
      }
  };

  const confirmConflicts = () => {
      setShowConflictModal(false);
      executeMovements();
  };

  const executeMovements = () => {
      // 1. Set Loading
      setIsProcessing(true);

      // 2. Use setTimeout to allow UI render before heavy blocking logic
      setTimeout(() => {
          let created = 0, moved = 0;
          
          const finalItems = reviewItems.map(item => {
              if (!item.selecionado) {
                  return { ...item, statusProcessamento: 'ignorado' as any };
              }

              let resStatus: any = 'erro';
              const num = item.numero_prontuario || '';
              
              // 1. Try to find existing
              let p = db.getProntuarioByNumber(num);
              if (!p && !num) p = db.getProntuarioByName(item.nome_paciente); 

              // 2. If not found, CREATE (in Arquivo)
              if (!p) {
                   try {
                       const currentYear = new Date().getFullYear();
                       let nasc = `00/00/${currentYear}`; 
                       if (item.idade && item.idade > 0) {
                           const birthYear = currentYear - item.idade;
                           nasc = `00/00/${birthYear}`;
                       }
                       
                       db.addProntuario({
                           numero_prontuario: num,
                           nome_paciente: item.nome_paciente || 'PACIENTE SEM NOME',
                           idade: item.idade || 0,
                           sexo: item.sexo || 'O',
                           data_nascimento: nasc,
                           status: ProntuarioStatus.ATIVO,
                           local_atual: 'Arquivo', // Always born in Arquivo
                           volumes: '1 Volume'
                       });
                       created++;
                       resStatus = 'criado_e_movido'; 
                       
                       // Fetch again to get the object for movement
                       p = num ? db.getProntuarioByNumber(num) : db.getProntuarioByName(item.nome_paciente); 
                   } catch(e) { console.error(e); }
              }

              // 3. Move (Arquivo -> Ambulatório)
              if (p) {
                   try {
                       db.addMovimentacao({
                           numero_prontuario: p.numero_prontuario,
                           nome_paciente: p.nome_paciente,
                           idade: p.idade,
                           origem: p.local_atual,
                           destino: 'Ambulatório',
                           usuario_responsavel: userLogin,
                           observacao: `Agenda ${activeDraft?.nome_medico} (${activeDraft?.data_agenda})`
                       });
                       moved++;
                       if (resStatus === 'erro') resStatus = 'movido';
                   } catch (e) { console.error(e); }
              }

              return { ...item, statusProcessamento: resStatus };
          });

          if (activeDraft) {
              const updated: AgendaHistory = {
                  ...activeDraft,
                  status: 'processed',
                  items: finalItems
              };
              db.updateAgendaHistory(updated);
          }

          setIsProcessing(false);
          alert(`Processamento Concluído!\nNovos Cadastros: ${created}\nMovimentações: ${moved}`);
          setStep(1);
          refreshLists();
      }, 100); // 100ms delay to ensure Loader renders
  };

  const SortIcon = ({ config, colKey }: { config: { key: SortKey, direction: 'asc'|'desc' }, colKey: SortKey }) => {
      if (config.key !== colKey) return <span className="w-4 inline-block"></span>;
      return config.direction === 'asc' ? <ArrowUp size={14} className="ml-1"/> : <ArrowDown size={14} className="ml-1"/>;
  };

  return (
    <div className="w-full space-y-8 pb-12 h-full flex flex-col relative">
      
      {/* GLOBAL LOADING OVERLAY */}
      {isProcessing && (
        <div className="fixed inset-0 z-[110] bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <Loader2 size={48} className="text-hospital-600 animate-spin mb-4"/>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Processando Agenda...</h3>
            <p className="text-slate-500">Por favor, aguarde enquanto o sistema movimenta os prontuários.</p>
        </div>
      )}

      {step === 1 && (
        <div className="flex-1 overflow-y-auto">
            {/* UPLOAD BOX */}
            <div className="bg-white dark:bg-slate-700 p-8 rounded-xl shadow border-2 border-dashed border-slate-300 dark:border-slate-500 text-center flex flex-col items-center mb-8">
                <FileSpreadsheet size={40} className="mx-auto text-slate-400 mb-3"/>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Carregar Nova Agenda</h3>
                <p className="text-sm text-slate-500 mb-6 max-w-md">Importe o arquivo Excel (.xlsx) gerado pelo sistema.</p>
                <label className="bg-hospital-600 hover:bg-hospital-700 text-white px-6 py-3 rounded-xl cursor-pointer font-bold inline-flex items-center gap-2 hover:-translate-y-1 transition-transform shadow-lg">
                    <Upload size={18} /> Selecionar Excel
                    <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
                </label>
            </div>

            {/* DRAFTS LIST */}
            {drafts.length > 0 && (
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <AlertCircle size={20} className="text-yellow-600"/> Rascunhos Pendentes
                        </h3>
                        <div className="flex gap-2 text-xs">
                            <button onClick={() => toggleDraftSort('data_agenda')} className="flex items-center bg-white dark:bg-slate-800 px-2 py-1 rounded border dark:border-slate-600 dark:text-white hover:bg-slate-50">Data <SortIcon config={draftSort} colKey='data_agenda'/></button>
                            <button onClick={() => toggleDraftSort('nome_medico')} className="flex items-center bg-white dark:bg-slate-800 px-2 py-1 rounded border dark:border-slate-600 dark:text-white hover:bg-slate-50">Médico <SortIcon config={draftSort} colKey='nome_medico'/></button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {getSortedList(drafts, draftSort).map(d => (
                            <div key={d.id} className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 p-4 rounded-xl flex justify-between items-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => startReview(d)}>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200">{d.nome_medico}</h4>
                                    <span className="text-xs text-slate-500 font-medium block">Data: {d.data_agenda || '-'}</span>
                                    <span className="text-xs text-slate-500">{d.total_pacientes} pacientes</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={(e) => {e.stopPropagation(); startReview(d);}} className="bg-hospital-600 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-hospital-700">Revisar</button>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteTargetId(d.id); }} className="text-red-500 hover:bg-red-100 p-1.5 rounded" title="Excluir"><Trash2 size={16}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* PROCESSED LIST */}
            <div>
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"><Calendar size={20}/> Agendas Processadas</h3>
                     <div className="flex gap-2 text-xs">
                        <button onClick={() => toggleProcessedSort('data_agenda')} className="flex items-center bg-white dark:bg-slate-800 px-2 py-1 rounded border dark:border-slate-600 dark:text-white hover:bg-slate-50">Data <SortIcon config={processedSort} colKey='data_agenda'/></button>
                        <button onClick={() => toggleProcessedSort('nome_medico')} className="flex items-center bg-white dark:bg-slate-800 px-2 py-1 rounded border dark:border-slate-600 dark:text-white hover:bg-slate-50">Médico <SortIcon config={processedSort} colKey='nome_medico'/></button>
                     </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                     {getSortedList(processedHistory, processedSort).map(h => (
                         <div 
                             key={h.id} 
                             className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 p-4 rounded-xl hover:shadow-md transition-all cursor-pointer relative group flex flex-col justify-between" 
                             onClick={() => viewProcessed(h, 'read')}
                             title="Clique para visualizar"
                         >
                             <div>
                                <div className="flex justify-between mb-2">
                                    <span className="font-bold text-slate-800 dark:text-white truncate">{h.nome_medico}</span>
                                </div>
                                <div className="text-xs text-slate-500 font-medium">Data: {h.data_agenda || '-'}</div>
                                <div className="text-xs text-slate-500">{h.total_pacientes} pacientes</div>
                             </div>
                             
                             {/* MODIFIED FOOTER: REMOVED EYE, GROUPED EDIT & TRASH */}
                             <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-end items-center gap-1">
                                <button type="button" onClick={(e) => { e.stopPropagation(); viewProcessed(h, 'edit'); }} className="p-1.5 text-slate-400 hover:text-hospital-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded" title="Editar/Revisar">
                                   <Edit size={16}/>
                                </button>
                                <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteTargetId(h.id); }} className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded" title="Excluir"><Trash2 size={16}/></button>
                             </div>
                         </div>
                     ))}
                 </div>
            </div>
        </div>
      )}

      {/* STEP 2: DETAILS VIEW/EDIT */}
      {step === 2 && activeDraft && (
          <div className="w-full h-full flex flex-col">
               <div className="mb-4 shrink-0 flex justify-between items-center">
                   <button onClick={() => {setStep(1); setActiveDraft(null)}} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 font-bold hover:bg-hospital-600 hover:text-white hover:border-hospital-600 transition-all shadow-sm group">
                       <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform"/> Voltar
                   </button>
                   <div className="flex items-center gap-2">
                       {viewMode === 'read' ? (
                           <div className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded text-xs font-bold uppercase flex items-center gap-2">
                               <Eye size={14} /> Modo Leitura
                           </div>
                       ) : (
                           <div className="bg-hospital-100 text-hospital-700 px-3 py-1 rounded text-xs font-bold uppercase flex items-center gap-2">
                               <Edit size={14} /> Modo Edição
                           </div>
                       )}
                   </div>
               </div>

               <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-600 flex flex-col flex-1 w-full overflow-hidden">
                   <div className="p-4 border-b dark:border-slate-600 flex justify-between items-center shrink-0 bg-slate-50 dark:bg-slate-900">
                       <div>
                           <h3 className="font-bold text-lg dark:text-white">Agenda: {activeDraft.nome_medico}</h3>
                           <p className="text-sm text-slate-500">Data Agenda: {activeDraft.data_agenda || '-'}</p>
                       </div>
                       <div className="flex gap-3">
                           {viewMode === 'edit' && (
                               <button onClick={initiateProcessing} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 shadow flex items-center gap-2">
                                   <Check size={18}/> {activeDraft.status === 'draft' ? 'Processar Agenda' : 'Salvar Alterações'}
                               </button>
                           )}
                       </div>
                   </div>
                   <div className="flex-1 overflow-auto p-4">
                       <table className="w-full text-left text-sm">
                           <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 font-bold text-slate-600 dark:text-slate-400 z-10 shadow-sm">
                               <tr>
                                   <th className="p-3 w-10 text-center">
                                       <input type="checkbox" disabled={viewMode === 'read'} checked={selectAll} onChange={(e) => handleSelectAll(e.target.checked)} className="w-4 h-4 disabled:opacity-50" />
                                   </th>
                                   <th className="p-3">Horário</th>
                                   <th className="p-3">Prontuário {viewMode === 'edit' && '(Editável)'}</th>
                                   <th className="p-3">Paciente {viewMode === 'edit' && '(Editável)'}</th>
                                   <th className="p-3">Idade</th>
                                   <th className="p-3">Sexo</th>
                                   <th className="p-3">Status</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                               {reviewItems.map(item => (
                                   <tr key={item.id} className={`${item.selecionado ? 'bg-blue-50 dark:bg-blue-900/20' : ''} hover:bg-slate-50 dark:hover:bg-slate-700`}>
                                       <td className="p-3 text-center">
                                           <input type="checkbox" disabled={viewMode === 'read'} checked={item.selecionado} onChange={(e) => handleItemChange(item.id, 'selecionado', e.target.checked)} className="w-4 h-4 disabled:opacity-50" />
                                       </td>
                                       <td className="p-3 font-mono dark:text-slate-300">{item.horario}</td>
                                       <td className="p-3">
                                           {viewMode === 'edit' ? (
                                               <input type="text" value={item.numero_prontuario} onChange={(e) => handleItemChange(item.id, 'numero_prontuario', e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded p-1.5 w-24 text-center dark:bg-slate-900 dark:text-white" />
                                           ) : <span className="font-medium dark:text-white">{item.numero_prontuario || '-'}</span>}
                                       </td>
                                       <td className="p-3">
                                           {viewMode === 'edit' ? (
                                                <input type="text" value={item.nome_paciente} onChange={(e) => handleItemChange(item.id, 'nome_paciente', e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded p-1.5 w-full dark:bg-slate-900 dark:text-white" />
                                           ) : <span className="dark:text-white">{item.nome_paciente}</span>}
                                       </td>
                                       <td className="p-3">
                                           {viewMode === 'edit' ? (
                                                <input type="number" value={item.idade} onChange={(e) => handleItemChange(item.id, 'idade', e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded p-1.5 w-16 text-center dark:bg-slate-900 dark:text-white" />
                                           ) : <span>{item.idade}</span>}
                                       </td>
                                       <td className="p-3">
                                            {viewMode === 'edit' ? (
                                                <select value={item.sexo || 'O'} onChange={(e) => handleItemChange(item.id, 'sexo', e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded p-1.5 dark:bg-slate-900 dark:text-white">
                                                    <option value="M">M</option>
                                                    <option value="F">F</option>
                                                    <option value="O">O</option>
                                                </select>
                                            ) : <span>{item.sexo}</span>}
                                       </td>
                                       <td className="p-3 text-xs">
                                           {item.statusProcessamento === 'ignorado' ? <span className="text-slate-400 font-bold">Ignorado</span> :
                                            item.statusProcessamento === 'criado_e_movido' ? <span className="text-green-600 font-bold">Novo + Movido</span> :
                                            item.statusProcessamento === 'movido' ? <span className="text-blue-600 font-bold">Movido</span> :
                                            db.getProntuarioByNumber(item.numero_prontuario) ? <span className="text-slate-500 flex items-center gap-1">Cadastrado</span> : <span className="text-yellow-600 font-bold flex items-center gap-1">Novo</span>}
                                       </td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   </div>
              </div>
          </div>
      )}

      {/* MISSING DATA MODAL */}
      {showMissingModal && (
          <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] p-4">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl max-w-md border border-slate-200 dark:border-slate-600 shadow-2xl">
                  <h3 className="font-bold text-amber-600 mb-4 flex items-center gap-2"><AlertTriangle size={20}/> Dados Faltantes</h3>
                  <p className="text-slate-600 dark:text-slate-300 mb-4">Alguns prontuários <strong>selecionados</strong> estão sem número. O sistema irá cadastrá-los apenas com o nome e tentar movimentar.</p>
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setShowMissingModal(false)} className="px-4 py-2 border border-slate-300 rounded dark:text-white hover:bg-slate-50">Cancelar</button>
                      <button onClick={proceedFromMissing} className="px-4 py-2 bg-amber-600 text-white rounded font-bold hover:bg-amber-700">OK, Continuar</button>
                  </div>
              </div>
          </div>
      )}

      {/* CONFLICT MODAL */}
      {showConflictModal && (
          <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] p-4">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl max-w-md border border-slate-200 dark:border-slate-600 shadow-2xl">
                  <h3 className="font-bold text-red-600 mb-4 flex items-center gap-2"><AlertCircle size={20}/> Conflitos Detectados</h3>
                  <p className="text-slate-600 dark:text-slate-300 mb-4">Alguns pacientes selecionados já estão em outros setores (não no Arquivo). Mover para Ambulatório mesmo assim?</p>
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setShowConflictModal(false)} className="px-4 py-2 border border-slate-300 rounded dark:text-white hover:bg-slate-50">Cancelar</button>
                      <button onClick={confirmConflicts} className="px-4 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700">Sim, Mover</button>
                  </div>
              </div>
          </div>
      )}

      {/* DELETE MODAL */}
      {deleteTargetId && (
          <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] p-4" onClick={() => setDeleteTargetId(null)}>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl max-w-sm border border-slate-200 dark:border-slate-600 shadow-2xl flex flex-col items-center text-center" onClick={e => e.stopPropagation()}>
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mb-4"><Trash2 size={24} /></div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Excluir Agenda?</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-300 mb-6">Esta ação removerá este histórico permanentemente.</p>
                  <div className="flex gap-3 w-full">
                      <button type="button" onClick={() => setDeleteTargetId(null)} className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 dark:text-white rounded hover:bg-slate-300">Cancelar</button>
                      <button type="button" onClick={confirmDeleteHistory} className="flex-1 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700">Excluir</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ImportAgenda;