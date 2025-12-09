import React, { useState, useEffect } from 'react';
import { db } from '../services/database';
import { ProntuarioStatus } from '../types';
import { FileSpreadsheet, Upload, CheckCircle, AlertTriangle, Calendar as CalendarIcon, Save, Eraser, Info, ArrowLeft, Trash2, Check, AlertCircle, Loader2, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';

// Separate interface for Bulk Import Items to match the Table Structure
interface BulkImportDraft {
  id: string;
  fileName: string;
  totalItems: number;
  items: BulkImportItem[];
}

interface BulkImportItem {
  id: string;
  numero: string;
  nome: string;
  idade: string;
  sexo: string;
  local: string;
  status: string;
  volumes: string;
  selecionado: boolean;
}

const Register: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'manual' | 'bulk'>('manual');
  const [destinations, setDestinations] = useState<string[]>([]);
  const [config, setConfig] = useState(db.getConfig());

  // --- MANUAL STATE ---
  const initialFormState = { 
    numero: '', 
    nome: '', 
    idade: '', 
    sexo: 'O', 
    nascimento: '', 
    local: 'Arquivo', 
    status: ProntuarioStatus.ATIVO,
    volumes: '' 
  };
  
  const [newP, setNewP] = useState(initialFormState);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // --- BULK STATE (Mimicking ImportAgenda) ---
  const [bulkDrafts, setBulkDrafts] = useState<BulkImportDraft[]>([]);
  const [activeDraft, setActiveDraft] = useState<BulkImportDraft | null>(null);
  const [reviewItems, setReviewItems] = useState<BulkImportItem[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deleteDraftId, setDeleteDraftId] = useState<string | null>(null);

  useEffect(() => {
    setDestinations(db.getDestinations());
    const loadedConfig = db.getConfig();
    setConfig(loadedConfig);
    // Set default volume
    if (loadedConfig.volumeOptions && loadedConfig.volumeOptions.length > 0) {
        setNewP(prev => ({ ...prev, volumes: loadedConfig.volumeOptions[0] }));
    }
  }, []);

  // --- MANUAL HANDLERS ---
  const resetForm = () => {
    setNewP({
        ...initialFormState,
        volumes: config.volumeOptions[0] || ''
    });
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, ''); 
    setNewP(prev => ({ ...prev, numero: val }));
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-ZÀ-ÖØ-Þ\s]/g, ''); 
    setNewP(prev => ({ ...prev, nome: val }));
  };

  const handleLocalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setNewP(prev => ({
        ...prev,
        local: val,
        status: val === 'Arquivo Morto' ? ProntuarioStatus.DESATIVADO : prev.status
    }));
  };

  const handleAgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setNewP(prev => {
      let newState = { ...prev, idade: val };
      if (val) {
        const ageNum = parseInt(val);
        const currentYear = new Date().getFullYear();
        const birthYear = currentYear - ageNum;
        newState.nascimento = `00/00/${birthYear}`;
      } else if (prev.nascimento.startsWith('00/00/')) {
        newState.nascimento = '';
      }
      return newState;
    });
  };

  const handleDateTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.slice(0, 8);
    let formattedDate = val;
    if (val.length >= 5) formattedDate = val.slice(0, 2) + '/' + val.slice(2, 4) + '/' + val.slice(4);
    else if (val.length >= 3) formattedDate = val.slice(0, 2) + '/' + val.slice(2);
    
    let newAge = newP.idade;
    if (val.length === 8) {
        const year = parseInt(val.slice(4));
        const currentYear = new Date().getFullYear();
        if (year > 1900 && year <= currentYear) newAge = (currentYear - year).toString();
    }
    setNewP({ ...newP, nascimento: formattedDate, idade: newAge });
  };

  const handleCalendarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
        const [y, m, d] = e.target.value.split('-');
        const currentYear = new Date().getFullYear();
        const newAge = (currentYear - parseInt(y)).toString();
        setNewP({ ...newP, nascimento: `${d}/${m}/${y}`, idade: newAge });
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const exists = db.getProntuarioByNumber(newP.numero);
    if (exists) {
        setMessage({type: 'error', text: `O Prontuário #${newP.numero} já está cadastrado.`});
        return;
    }

    if (!newP.idade) { setMessage({type: 'error', text: 'Idade obrigatória.'}); return; }
    if (!newP.sexo) { setMessage({type: 'error', text: 'Sexo obrigatório.'}); return; }
    if (!newP.nascimento) { setMessage({type: 'error', text: 'Nascimento obrigatório.'}); return; }

    try {
      db.addProntuario({
        numero_prontuario: newP.numero,
        nome_paciente: newP.nome,
        idade: parseInt(newP.idade) || 0,
        sexo: newP.sexo,
        data_nascimento: newP.nascimento || '00/00/0000',
        status: newP.status,
        local_atual: newP.local,
        local_anterior: newP.local,
        volumes: newP.volumes
      });
      setMessage({type: 'success', text: 'Prontuário cadastrado!'});
      resetForm();
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({type: 'error', text: err.message});
    }
  };

  // --- BULK HELPERS ---
  const normalizeKey = (key: string) => key ? key.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;
     const reader = new FileReader();
     reader.onload = (evt) => {
         try {
             const wb = XLSX.read(evt.target?.result, { type: 'array' });
             const ws = wb.Sheets[wb.SheetNames[0]];
             const rawData = XLSX.utils.sheet_to_json(ws);
             
             // Aliases
             const idAliases = ['numero', 'prontuario', 'matricula', 'codigo'];
             const nameAliases = ['nome', 'paciente', 'usuario'];
             const ageAliases = ['idade', 'anos'];
             const sexAliases = ['sexo', 'genero'];
             const localAliases = ['local', 'setor', 'origem'];
             const statusAliases = ['situacao', 'status', 'estado'];
             const volAliases = ['volumes', 'volume'];

             const parsedItems: BulkImportItem[] = rawData.map((row: any) => {
                 let numero = '';
                 let nome = '';
                 let idade = '';
                 let sexo = 'O';
                 let local = 'Arquivo';
                 let status = ProntuarioStatus.ATIVO;
                 let volumes = '1 Volume';

                 // Iterate keys to find matches
                 Object.keys(row).forEach(key => {
                     const norm = normalizeKey(key);
                     const val = row[key];

                     if (idAliases.some(alias => norm.includes(alias))) numero = String(val).replace(/\D/g, ''); // Fix: Clean number immediately
                     else if (nameAliases.some(alias => norm.includes(alias))) nome = String(val).toUpperCase().replace(/[^A-ZÀ-ÖØ-Þ\s]/g, ''); // Fix: Clean name immediately
                     else if (ageAliases.some(alias => norm === alias)) idade = String(Math.max(0, parseInt(String(val)) || 0)); // Fix: No negative age
                     else if (sexAliases.some(alias => norm === alias)) {
                         const s = String(val).toUpperCase();
                         if (s.startsWith('M')) sexo = 'M';
                         else if (s.startsWith('F')) sexo = 'F';
                     }
                     else if (localAliases.some(alias => norm.includes(alias))) local = String(val);
                     else if (statusAliases.some(alias => norm.includes(alias))) {
                         // Simple status mapping
                         const s = String(val).toLowerCase();
                         if (s.includes('desativado') || s.includes('morto')) status = ProntuarioStatus.DESATIVADO;
                         else if (s.includes('perdido')) status = ProntuarioStatus.PERDIDO;
                     }
                     else if (volAliases.some(alias => norm.includes(alias))) volumes = String(val);
                 });

                 return {
                     id: crypto.randomUUID(),
                     numero,
                     nome,
                     idade,
                     sexo,
                     local,
                     status,
                     volumes,
                     selecionado: true
                 };
             }).filter(r => r.numero || r.nome); // Filter completely empty rows

             if (parsedItems.length === 0) {
                 alert("Nenhuma coluna válida identificada. Verifique o cabeçalho (Numero, Nome, Idade).");
                 return;
             }

             const newDraft: BulkImportDraft = {
                 id: crypto.randomUUID(),
                 fileName: file.name,
                 totalItems: parsedItems.length,
                 items: parsedItems
             };

             setBulkDrafts(prev => [...prev, newDraft]);
             e.target.value = ''; // Reset input

         } catch(e) { alert("Erro ao ler arquivo"); }
     };
     reader.readAsArrayBuffer(file);
  };

  const openDraft = (draft: BulkImportDraft) => {
      setActiveDraft(draft);
      setReviewItems(draft.items);
      setSelectAll(true);
  };

  const confirmDeleteDraft = () => {
      if (deleteDraftId) {
        setBulkDrafts(prev => prev.filter(d => d.id !== deleteDraftId));
        if (activeDraft?.id === deleteDraftId) setActiveDraft(null);
        setDeleteDraftId(null);
      }
  };

  const handleReviewItemChange = (id: string, field: keyof BulkImportItem, val: any) => {
      // Validate inputs strictly
      let finalVal = val;
      
      if (field === 'numero') {
         // Only digits allowed
         finalVal = String(val).replace(/\D/g, '');
      } else if (field === 'idade') {
         // No negative numbers, must be integer
         finalVal = String(Math.max(0, parseInt(val) || 0));
      } else if (field === 'nome') {
         // Uppercase, no symbols allowed except basic name chars
         finalVal = String(val).toUpperCase().replace(/[^A-ZÀ-ÖØ-Þ\s]/g, '');
      }

      setReviewItems(prev => prev.map(i => i.id === id ? { ...i, [field]: finalVal } : i));
  };

  const toggleSelectAll = (checked: boolean) => {
      setSelectAll(checked);
      setReviewItems(prev => prev.map(i => ({...i, selecionado: checked})));
  };

  const processBatch = () => {
      const toProcess = reviewItems.filter(i => i.selecionado);
      if (toProcess.length === 0) { alert("Nenhum item selecionado."); return; }
      
      // Validation Check
      const missingMandatory = toProcess.find(i => !i.numero || !i.nome || !i.idade);
      if (missingMandatory) {
          alert(`Erro: O paciente "${missingMandatory.nome || 'Sem Nome'}" (Nº ${missingMandatory.numero}) está faltando dados obrigatórios (Número, Nome ou Idade).`);
          return;
      }

      setIsProcessing(true);

      setTimeout(() => {
          let count = 0;
          let duplicates = 0;
          const currentYear = new Date().getFullYear();

          toProcess.forEach(item => {
              if (db.getProntuarioByNumber(item.numero)) {
                  duplicates++;
                  return;
              }

              let nasc = '00/00/0000';
              if (item.idade) {
                  const age = parseInt(item.idade);
                  if (!isNaN(age)) {
                      nasc = `00/00/${currentYear - age}`;
                  }
              }

              try {
                  db.addProntuario({
                      numero_prontuario: String(item.numero),
                      nome_paciente: item.nome.toUpperCase(),
                      idade: parseInt(item.idade) || 0,
                      sexo: item.sexo,
                      data_nascimento: nasc,
                      status: item.status as ProntuarioStatus,
                      local_atual: item.local,
                      volumes: item.volumes
                  });
                  count++;
              } catch (e) { console.error(e); }
          });

          setIsProcessing(false);
          alert(`Importação Concluída!\nCadastrados: ${count}\nDuplicados Ignorados: ${duplicates}`);
          
          // Remove processed draft
          setBulkDrafts(prev => prev.filter(d => d.id !== activeDraft?.id));
          setActiveDraft(null);

      }, 100);
  };

  return (
    <div className="w-full h-full flex flex-col pb-6">
      
      {/* GLOBAL PROCESSING OVERLAY */}
      {isProcessing && (
          <div className="fixed inset-0 z-[110] bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center">
              <Loader2 size={48} className="text-hospital-600 animate-spin mb-4"/>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Processando Cadastro...</h3>
          </div>
      )}

      {/* HEADER TABS */}
      <div className="flex gap-4 mb-8 shrink-0">
        <button 
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-4 rounded-xl border-2 flex items-center justify-center gap-3 font-bold transition-all ${activeTab === 'manual' ? 'border-hospital-500 bg-hospital-50 text-hospital-700 dark:bg-slate-800 dark:text-hospital-400' : 'border-slate-200 bg-white text-slate-500 hover:border-hospital-200 dark:bg-slate-800 dark:border-slate-700'}`}
        >
            <Save size={20} /> Cadastro Manual
        </button>
        <button 
            onClick={() => setActiveTab('bulk')}
            className={`flex-1 py-4 rounded-xl border-2 flex items-center justify-center gap-3 font-bold transition-all ${activeTab === 'bulk' ? 'border-hospital-500 bg-hospital-50 text-hospital-700 dark:bg-slate-800 dark:text-hospital-400' : 'border-slate-200 bg-white text-slate-500 hover:border-hospital-200 dark:bg-slate-800 dark:border-slate-700'}`}
        >
            <FileSpreadsheet size={20} /> Importar Planilha
        </button>
      </div>

      {/* --- MANUAL FORM --- */}
      {activeTab === 'manual' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-600 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                <div>
                   <h3 className="text-lg font-bold text-slate-800 dark:text-white">Novo Prontuário</h3>
                   <p className="text-xs text-slate-500 dark:text-slate-400">Preencha os campos obrigatórios (*)</p>
                </div>
            </div>
            
            <form onSubmit={handleManualSubmit} className="p-8">
                {message && (
                    <div className={`p-4 rounded-lg mb-6 flex items-center gap-3 ${message.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                        {message.type === 'success' ? <CheckCircle size={20}/> : <AlertTriangle size={20}/>}
                        <span className="font-bold">{message.text}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* LEFT COL (Numero, Data, Idade/Sexo) */}
                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Número do Prontuário *</label>
                            <input 
                                type="text" 
                                required
                                value={newP.numero}
                                onChange={handleNumberChange}
                                className="w-full text-2xl font-bold text-slate-800 dark:text-white border-b-2 border-slate-200 dark:border-slate-600 focus:border-hospital-500 dark:focus:border-hospital-500 outline-none py-2 px-2 bg-transparent transition-colors placeholder:text-slate-300"
                                placeholder="000000"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Data de Nascimento *</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    required
                                    value={newP.nascimento}
                                    onChange={handleDateTextChange}
                                    maxLength={10}
                                    className="w-full text-lg text-slate-800 dark:text-white border-b-2 border-slate-200 dark:border-slate-600 focus:border-hospital-500 dark:focus:border-hospital-500 outline-none py-2 px-2 bg-transparent transition-colors pr-8"
                                    placeholder="DD/MM/AAAA"
                                />
                                <div className="absolute right-0 top-2 cursor-pointer">
                                    <CalendarIcon size={20} className="text-slate-400"/>
                                    <input type="date" onChange={handleCalendarPick} className="absolute inset-0 opacity-0 cursor-pointer" tabIndex={-1}/>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Idade *</label>
                                <input 
                                    type="text" 
                                    required
                                    value={newP.idade}
                                    onChange={handleAgeChange}
                                    className="w-full text-lg text-slate-800 dark:text-white border-b-2 border-slate-200 dark:border-slate-600 focus:border-hospital-500 dark:focus:border-hospital-500 outline-none py-2 px-2 bg-transparent transition-colors"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Sexo *</label>
                                <div className="relative">
                                    <select 
                                        value={newP.sexo} 
                                        onChange={(e) => setNewP({...newP, sexo: e.target.value})}
                                        className="w-full text-lg text-slate-800 dark:text-white border-b-2 border-slate-200 dark:border-slate-600 focus:border-hospital-500 dark:focus:border-hospital-500 outline-none py-2 px-2 bg-transparent transition-colors appearance-none"
                                    >
                                        <option value="O">Outro</option>
                                        <option value="M">Masculino</option>
                                        <option value="F">Feminino</option>
                                    </select>
                                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COL (Nome, Volumes, Local/Situacao) */}
                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Nome Completo *</label>
                            <input 
                                type="text" 
                                required
                                value={newP.nome}
                                onChange={handleNameChange}
                                className="w-full text-lg font-medium text-slate-800 dark:text-white border-b-2 border-slate-200 dark:border-slate-600 focus:border-hospital-500 dark:focus:border-hospital-500 outline-none py-2 px-2 bg-transparent transition-colors uppercase placeholder:text-slate-300"
                                placeholder="NOME DO PACIENTE"
                            />
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Volumes</label>
                             <div className="relative">
                                 <select 
                                    value={newP.volumes} 
                                    onChange={(e) => setNewP({...newP, volumes: e.target.value})}
                                    className="w-full text-lg text-slate-800 dark:text-white border-b-2 border-slate-200 dark:border-slate-600 focus:border-hospital-500 dark:focus:border-hospital-500 outline-none py-2 px-2 bg-transparent transition-colors appearance-none"
                                 >
                                     {config.volumeOptions.map(vol => <option key={vol} value={vol}>{vol}</option>)}
                                 </select>
                                 <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                             </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Local Inicial</label>
                                <div className="relative">
                                    <select 
                                        value={newP.local}
                                        onChange={handleLocalChange}
                                        className="w-full text-lg text-slate-800 dark:text-white border-b-2 border-slate-200 dark:border-slate-600 focus:border-hospital-500 dark:focus:border-hospital-500 outline-none py-2 px-2 bg-transparent transition-colors appearance-none"
                                    >
                                        {destinations.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Situação</label>
                                <div className="relative">
                                    <select 
                                        value={newP.status}
                                        onChange={(e) => setNewP({...newP, status: e.target.value as ProntuarioStatus})}
                                        className="w-full text-lg text-slate-800 dark:text-white border-b-2 border-slate-200 dark:border-slate-600 focus:border-hospital-500 dark:focus:border-hospital-500 outline-none py-2 px-2 bg-transparent transition-colors appearance-none"
                                    >
                                        <option value={ProntuarioStatus.ATIVO}>Ativo</option>
                                        <option value={ProntuarioStatus.DESATIVADO}>Desativado</option>
                                        <option value={ProntuarioStatus.PERDIDO}>Perdido</option>
                                    </select>
                                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-700">
                    <button type="button" onClick={resetForm} className="px-6 py-3 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold flex items-center gap-2 transition-colors">
                        <Eraser size={18} /> Limpar
                    </button>
                    <button type="submit" className="px-8 py-3 rounded-lg bg-hospital-600 hover:bg-hospital-700 text-white font-bold flex items-center gap-2 shadow-lg hover:-translate-y-0.5 transition-all">
                        <Save size={18} /> Cadastrar Prontuário
                    </button>
                </div>
            </form>
        </div>
      )}

      {/* --- BULK IMPORT --- */}
      {activeTab === 'bulk' && !activeDraft && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
               {/* UPLOAD BOX */}
                <div className="bg-white dark:bg-slate-700 p-8 rounded-xl shadow border-2 border-dashed border-slate-300 dark:border-slate-500 text-center flex flex-col items-center mb-8">
                    <FileSpreadsheet size={40} className="mx-auto text-slate-400 mb-3"/>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Importar Múltiplos Prontuários</h3>
                    <p className="text-sm text-slate-500 mb-6 max-w-md">O arquivo deve conter as colunas: <strong>Número, Nome, Idade</strong> (Obrigatórios).<br/>Opcionais: Sexo, Local, Situação, Volumes.</p>
                    <label className="bg-hospital-600 hover:bg-hospital-700 text-white px-6 py-3 rounded-xl cursor-pointer font-bold inline-flex items-center gap-2 hover:-translate-y-1 transition-transform shadow-lg">
                        <Upload size={18} /> Selecionar Excel
                        <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
                    </label>
                </div>

                {/* DRAFTS */}
                {bulkDrafts.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {bulkDrafts.map(draft => (
                            <div key={draft.id} className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 p-4 rounded-xl flex justify-between items-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDraft(draft)}>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><FileSpreadsheet size={16}/> {draft.fileName}</h4>
                                    <span className="text-xs text-slate-500">{draft.totalItems} registros identificados</span>
                                </div>
                                <div className="flex gap-2">
                                    <button className="bg-hospital-600 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-hospital-700">Revisar</button>
                                    <button onClick={(e) => { e.stopPropagation(); setDeleteDraftId(draft.id); }} className="text-red-500 hover:bg-red-100 p-1.5 rounded" title="Excluir"><Trash2 size={16}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
          </div>
      )}

      {/* --- BULK REVIEW --- */}
      {activeTab === 'bulk' && activeDraft && (
          <div className="w-full h-full flex flex-col animate-in fade-in slide-in-from-right-4">
               <div className="mb-4 shrink-0 flex justify-between items-center">
                   <button onClick={() => setActiveDraft(null)} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 font-bold hover:bg-hospital-600 hover:text-white hover:border-hospital-600 transition-all shadow-sm group">
                       <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform"/> Voltar
                   </button>
                   <button onClick={processBatch} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 shadow flex items-center gap-2">
                       <Check size={18}/> Processar {reviewItems.filter(i => i.selecionado).length} Itens
                   </button>
               </div>

               <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-600 flex flex-col flex-1 overflow-hidden">
                   <div className="p-4 border-b dark:border-slate-600 bg-slate-50 dark:bg-slate-900">
                       <h3 className="font-bold text-lg dark:text-white flex items-center gap-2"><FileSpreadsheet size={20}/> Revisão: {activeDraft.fileName}</h3>
                       <p className="text-xs text-slate-500">Verifique os dados antes de confirmar o cadastro.</p>
                   </div>
                   <div className="flex-1 overflow-auto p-4">
                       <table className="w-full text-left text-sm">
                           <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 font-bold text-slate-600 dark:text-slate-400 z-10 shadow-sm">
                               <tr>
                                   <th className="p-3 w-10 text-center">
                                       <input type="checkbox" checked={selectAll} onChange={(e) => toggleSelectAll(e.target.checked)} className="w-4 h-4" />
                                   </th>
                                   <th className="p-3">Número *</th>
                                   <th className="p-3">Nome do Paciente *</th>
                                   <th className="p-3 w-20">Idade *</th>
                                   <th className="p-3 w-24">Sexo</th>
                                   <th className="p-3">Local</th>
                                   <th className="p-3">Situação</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                               {reviewItems.map(item => (
                                   <tr key={item.id} className={`${item.selecionado ? 'bg-blue-50 dark:bg-blue-900/20' : 'opacity-60'} hover:bg-slate-50 dark:hover:bg-slate-700`}>
                                       <td className="p-3 text-center">
                                           <input type="checkbox" checked={item.selecionado} onChange={(e) => handleReviewItemChange(item.id, 'selecionado', e.target.checked)} className="w-4 h-4" />
                                       </td>
                                       <td className="p-3">
                                           <input type="text" value={item.numero} onChange={(e) => handleReviewItemChange(item.id, 'numero', e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded p-1.5 w-full dark:bg-slate-900 dark:text-white" />
                                       </td>
                                       <td className="p-3">
                                           <input type="text" value={item.nome} onChange={(e) => handleReviewItemChange(item.id, 'nome', e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded p-1.5 w-full dark:bg-slate-900 dark:text-white" />
                                       </td>
                                       <td className="p-3">
                                           <input type="number" value={item.idade} onChange={(e) => handleReviewItemChange(item.id, 'idade', e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded p-1.5 w-full text-center dark:bg-slate-900 dark:text-white" />
                                       </td>
                                       <td className="p-3">
                                            <select value={item.sexo || 'O'} onChange={(e) => handleReviewItemChange(item.id, 'sexo', e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded p-1.5 w-full dark:bg-slate-900 dark:text-white">
                                                <option value="M">Masculino</option>
                                                <option value="F">Feminino</option>
                                                <option value="O">Outro</option>
                                            </select>
                                       </td>
                                       <td className="p-3">
                                            <select value={item.local} onChange={(e) => handleReviewItemChange(item.id, 'local', e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded p-1.5 w-full dark:bg-slate-900 dark:text-white">
                                                {destinations.map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                       </td>
                                       <td className="p-3">
                                            <select value={item.status} onChange={(e) => handleReviewItemChange(item.id, 'status', e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded p-1.5 w-full dark:bg-slate-900 dark:text-white">
                                                <option value={ProntuarioStatus.ATIVO}>Ativo</option>
                                                <option value={ProntuarioStatus.DESATIVADO}>Desativado</option>
                                                <option value={ProntuarioStatus.PERDIDO}>Perdido</option>
                                            </select>
                                       </td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   </div>
               </div>
          </div>
      )}

      {/* DELETE DRAFT MODAL */}
      {deleteDraftId && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setDeleteDraftId(null)}>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl max-w-sm border border-slate-200 dark:border-slate-600 shadow-2xl flex flex-col items-center text-center" onClick={e => e.stopPropagation()}>
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mb-4"><Trash2 size={24} /></div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Descartar Planilha?</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-300 mb-6">Esta planilha pendente será removida e não será processada.</p>
                  <div className="flex gap-3 w-full">
                      <button type="button" onClick={() => setDeleteDraftId(null)} className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 dark:text-white rounded hover:bg-slate-300">Cancelar</button>
                      <button type="button" onClick={confirmDeleteDraft} className="flex-1 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700">Excluir</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default Register;