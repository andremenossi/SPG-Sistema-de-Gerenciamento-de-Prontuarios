
import React, { useState, useEffect } from 'react';
import { AgendaItem, ProntuarioStatus, AgendaHistory } from '../types';
import { db } from '../services/database';
import { Upload, FileSpreadsheet, Check, AlertTriangle, AlertCircle, Calendar, Trash2, Edit3, X, ArrowLeft } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ImportAgendaProps {
  userLogin: string;
}

const ImportAgenda: React.FC<ImportAgendaProps> = ({ userLogin }) => {
  const [step, setStep] = useState<1 | 2>(1); // 1=Dashboard, 2=Review
  
  const [drafts, setDrafts] = useState<AgendaHistory[]>([]);
  const [processedHistory, setProcessedHistory] = useState<AgendaHistory[]>([]);
  
  // Review State
  const [activeDraft, setActiveDraft] = useState<AgendaHistory | null>(null);
  const [reviewItems, setReviewItems] = useState<AgendaItem[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  
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

  const handleSelectAll = (checked: boolean) => {
      setSelectAll(checked);
      setReviewItems(prev => prev.map(i => ({...i, selecionado: checked})));
  };

  // --- PARSING HELPERS ---
  const parseAgeToYears = (ageStr: string): number => {
      if (!ageStr) return 0;
      const str = String(ageStr).toLowerCase();
      
      const yearsMatch = str.match(/(\d+)\s*ano/);
      if (yearsMatch) {
          return parseInt(yearsMatch[1]);
      }
      
      if (str.includes('mes') || str.includes('dias') || str.includes('dia')) {
          return 0;
      }

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
            const exists = drafts.find(d => d.nome_medico === draft.doc && d.data_agenda === draft.date) || 
                           processedHistory.find(h => h.nome_medico === draft.doc && h.data_agenda === draft.date);
            
            if (!exists) {
                const newDraft: AgendaHistory = {
                    id: crypto.randomUUID(),
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
            }
        });

        refreshLists();
        if (addedCount > 0) alert(`${addedCount} agenda(s) importada(s) como Rascunho!`);
        else alert("Agenda(s) duplicada(s) ou já importadas.");

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
      setStep(2);
  };

  const handleItemChange = (id: string, field: keyof AgendaItem, val: any) => {
      let value = val;
      if (field === 'idade') value = Math.max(0, parseInt(val) || 0);
      if (field === 'numero_prontuario') value = String(val).replace(/\D/g, '');
      if (field === 'nome_paciente') value = String(val).toUpperCase().replace(/[^A-ZÀ-ÖØ-Þ\s]/g, '');
      setReviewItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const initiateProcessing = () => {
      const itemsToProcess = reviewItems.filter(i => i.selecionado);
      if (itemsToProcess.length === 0) { alert("Nenhum prontuário selecionado."); return; }

      // CRITICAL FIX: Only block if BOTH Name and Number are missing.
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

      alert(`Processamento Concluído!\nNovos Cadastros: ${created}\nMovimentações: ${moved}`);
      setStep(1);
      refreshLists();
  };

  const viewProcessed = (h: AgendaHistory) => {
      setActiveDraft(h);
      setReviewItems(h.items);
      setStep(2);
  };

  return (
    <div className="w-full space-y-8 pb-12 h-full flex flex-col">
      {step === 1 && (
        <div className="flex-1 overflow-y-auto">
            <div className="bg-white dark:bg-slate-700 p-8 rounded-xl shadow border-2 border-dashed border-slate-300 dark:border-slate-500 text-center flex flex-col items-center mb-8">
                <FileSpreadsheet size={40} className="mx-auto text-slate-400 mb-3"/>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Carregar Nova Agenda</h3>
                <p className="text-sm text-slate-500 mb-6 max-w-md">Importe o arquivo Excel (.xlsx) gerado pelo sistema.</p>
                <label className="bg-hospital-600 hover:bg-hospital-700 text-white px-6 py-3 rounded-xl cursor-pointer font-bold inline-flex items-center gap-2 hover:-translate-y-1 transition-transform shadow-lg">
                    <Upload size={18} /> Selecionar Excel
                    <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
                </label>
            </div>

            {drafts.length > 0 && (
                <div className="mb-8">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><Edit3 size={20}/> Rascunhos Pendentes</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {drafts.map(d => (
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

            <div>
                 <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><Calendar size={20}/> Agendas Processadas</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                     {processedHistory.map(h => (
                         <div key={h.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 p-4 rounded-xl opacity-75 hover:opacity-100 transition-opacity cursor-pointer relative group" onClick={() => viewProcessed(h)}>
                             <div className="flex justify-between mb-2">
                                 <span className="font-bold text-slate-800 dark:text-white truncate">{h.nome_medico}</span>
                             </div>
                             <div className="text-xs text-slate-500 font-medium">Data: {h.data_agenda || '-'}</div>
                             <div className="text-xs text-slate-500">{h.total_pacientes} pacientes</div>
                             <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteTargetId(h.id); }} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1" title="Excluir"><Trash2 size={14}/></button>
                         </div>
                     ))}
                 </div>
            </div>
        </div>
      )}

      {step === 2 && activeDraft && (
          <div className="w-full h-full flex flex-col">
               <div className="mb-4 shrink-0">
                   <button onClick={() => {setStep(1); setActiveDraft(null)}} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 font-bold hover:bg-hospital-600 hover:text-white hover:border-hospital-600 transition-all shadow-sm group">
                       <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform"/> Voltar
                   </button>
               </div>

               <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-600 flex flex-col flex-1 w-full overflow-hidden">
                   <div className="p-4 border-b dark:border-slate-600 flex justify-between items-center shrink-0 bg-slate-50 dark:bg-slate-900">
                       <div>
                           <h3 className="font-bold text-lg dark:text-white">Agenda: {activeDraft.nome_medico}</h3>
                           <p className="text-sm text-slate-500">Data Agenda: {activeDraft.data_agenda || '-'}</p>
                       </div>
                       <div className="flex gap-3">
                           {activeDraft.status === 'draft' && (
                               <button onClick={initiateProcessing} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 shadow flex items-center gap-2"><Check size={18}/> Processar Agenda</button>
                           )}
                       </div>
                   </div>
                   <div className="flex-1 overflow-auto p-4">
                       <table className="w-full text-left text-sm">
                           <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 font-bold text-slate-600 dark:text-slate-400 z-10 shadow-sm">
                               <tr>
                                   <th className="p-3 w-10 text-center">
                                       {activeDraft.status === 'draft' && (
                                           <input type="checkbox" checked={selectAll} onChange={(e) => handleSelectAll(e.target.checked)} className="w-4 h-4" />
                                       )}
                                   </th>
                                   <th className="p-3">Horário</th>
                                   <th className="p-3">Prontuário (Editável)</th>
                                   <th className="p-3">Paciente (Editável)</th>
                                   <th className="p-3">Idade</th>
                                   <th className="p-3">Sexo</th>
                                   <th className="p-3">Status</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                               {reviewItems.map(item => (
                                   <tr key={item.id} className={`${item.selecionado ? 'bg-blue-50 dark:bg-blue-900/20' : ''} hover:bg-slate-50 dark:hover:bg-slate-700`}>
                                       <td className="p-3 text-center">
                                           {activeDraft.status === 'draft' ? (
                                               <input type="checkbox" checked={item.selecionado} onChange={(e) => handleItemChange(item.id, 'selecionado', e.target.checked)} className="w-4 h-4" />
                                           ) : (item.selecionado ? <Check size={16} className="text-green-600 mx-auto"/> : <X size={16} className="text-slate-300 mx-auto"/>)}
                                       </td>
                                       <td className="p-3 font-mono dark:text-slate-300">{item.horario}</td>
                                       <td className="p-3">
                                           {activeDraft.status === 'draft' ? (
                                              <input type="text" value={item.numero_prontuario} onChange={(e) => handleItemChange(item.id, 'numero_prontuario', e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded p-1.5 w-24 text-center dark:bg-slate-900 dark:text-white" />
                                           ) : item.numero_prontuario}
                                       </td>
                                       <td className="p-3">
                                           {activeDraft.status === 'draft' ? (
                                               <input type="text" value={item.nome_paciente} onChange={(e) => handleItemChange(item.id, 'nome_paciente', e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded p-1.5 w-full dark:bg-slate-900 dark:text-white" />
                                           ) : item.nome_paciente}
                                       </td>
                                       <td className="p-3">
                                           {activeDraft.status === 'draft' ? (
                                               <input type="number" value={item.idade} onChange={(e) => handleItemChange(item.id, 'idade', e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded p-1.5 w-16 text-center dark:bg-slate-900 dark:text-white" />
                                           ) : item.idade}
                                       </td>
                                       <td className="p-3">
                                            {activeDraft.status === 'draft' ? (
                                               <select value={item.sexo || 'O'} onChange={(e) => handleItemChange(item.id, 'sexo', e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded p-1.5 dark:bg-slate-900 dark:text-white">
                                                   <option value="M">M</option>
                                                   <option value="F">F</option>
                                                   <option value="O">O</option>
                                               </select>
                                           ) : (item.sexo || 'O')}
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
