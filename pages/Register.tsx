
import React, { useState, useEffect } from 'react';
import { db } from '../services/database';
import { ProntuarioStatus } from '../types';
import { FileSpreadsheet, Upload, CheckCircle, AlertTriangle, Calendar as CalendarIcon, Save, Eraser, Info } from 'lucide-react';
import * as XLSX from 'xlsx';

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

  // --- BULK STATE ---
  const [bulkData, setBulkData] = useState<any[]>([]);
  const [bulkPreview, setBulkPreview] = useState<any[]>([]);

  useEffect(() => {
    setDestinations(db.getDestinations());
    const loadedConfig = db.getConfig();
    setConfig(loadedConfig);
    // Set default volume
    if (loadedConfig.volumeOptions && loadedConfig.volumeOptions.length > 0) {
        setNewP(prev => ({ ...prev, volumes: loadedConfig.volumeOptions[0] }));
    }
  }, []);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;
     const reader = new FileReader();
     reader.onload = (evt) => {
         try {
             const wb = XLSX.read(evt.target?.result, { type: 'array' });
             const ws = wb.Sheets[wb.SheetNames[0]];
             const jsonData = XLSX.utils.sheet_to_json(ws);
             const normalized = jsonData.map((row: any) => ({
                 numero: row['Numero'] || row['Prontuario'] || '',
                 nome: String(row['Nome'] || '').toUpperCase(),
                 idade: row['Idade'] || 0,
                 sexo: row['Sexo'] || 'O'
             })).filter(r => r.numero && r.nome);
             setBulkData(normalized);
             setBulkPreview(normalized.slice(0, 10));
         } catch(e) { alert("Erro ao ler arquivo"); }
     };
     reader.readAsArrayBuffer(file);
  };

  const processBulkImport = () => {
      let count = 0;
      bulkData.forEach(item => {
          if (!db.getProntuarioByNumber(item.numero)) {
              let nasc = '00/00/0000';
              if (item.idade) nasc = `00/00/${new Date().getFullYear() - parseInt(item.idade)}`;
              db.addProntuario({
                  numero_prontuario: String(item.numero),
                  nome_paciente: item.nome,
                  idade: parseInt(item.idade) || 0,
                  sexo: 'O',
                  data_nascimento: nasc,
                  status: ProntuarioStatus.ATIVO,
                  local_atual: 'Arquivo',
                  local_anterior: 'Arquivo',
                  volumes: config.volumeOptions[0] || '1 Volume'
              });
              count++;
          }
      });
      alert(`Importados: ${count}`);
      setBulkData([]);
      setBulkPreview([]);
  };

  const inputClass = "w-full border border-slate-300 dark:border-slate-600 bg-slate-50 focus:bg-white dark:bg-slate-950 dark:focus:bg-slate-900 rounded-lg p-3 text-sm dark:text-white transition-colors focus:ring-2 focus:ring-hospital-500 outline-none placeholder-slate-400";

  return (
    <div className="w-full">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-200 dark:border-slate-600 overflow-hidden">
        <div className="flex border-b border-slate-200 dark:border-slate-600">
           <button onClick={() => setActiveTab('manual')} className={`flex-1 py-4 text-sm font-bold uppercase ${activeTab === 'manual' ? 'bg-hospital-50 text-hospital-600 border-b-2 border-hospital-600' : 'text-slate-500'}`}>Cadastro Manual</button>
           <button onClick={() => setActiveTab('bulk')} className={`flex-1 py-4 text-sm font-bold uppercase ${activeTab === 'bulk' ? 'bg-hospital-50 text-hospital-600 border-b-2 border-hospital-600' : 'text-slate-500'}`}>Importar Planilha</button>
        </div>

        <div className="p-8">
            {message && <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{message.type === 'success' ? <CheckCircle size={20}/> : <AlertTriangle size={20}/>}{message.text}</div>}

            {activeTab === 'manual' && (
                <form onSubmit={handleManualSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 uppercase">Número *</label>
                            <input required type="text" className={inputClass} value={newP.numero} onChange={handleNumberChange} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 uppercase">Nome Completo *</label>
                            <input required type="text" className={inputClass} value={newP.nome} onChange={handleNameChange} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                         <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 uppercase">Local Inicial *</label>
                            <select className={inputClass} value={newP.local} onChange={handleLocalChange}>
                                {destinations.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 uppercase">Situação *</label>
                            <select className={inputClass} value={newP.status} onChange={e => setNewP({...newP, status: e.target.value as ProntuarioStatus})}>
                                <option value={ProntuarioStatus.ATIVO}>Ativo</option>
                                <option value={ProntuarioStatus.DESATIVADO}>Desativado</option>
                                <option value={ProntuarioStatus.PERDIDO}>Perdido</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 uppercase">Volumes *</label>
                            <select className={inputClass} value={newP.volumes} onChange={e => setNewP({...newP, volumes: e.target.value})}>
                                {config.volumeOptions.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 uppercase">Idade *</label>
                            <input type="text" className={inputClass} value={newP.idade} onChange={handleAgeChange} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 uppercase">Sexo *</label>
                            <select className={inputClass} value={newP.sexo} onChange={e => setNewP({...newP, sexo: e.target.value})}>
                                <option value="O">Outro</option>
                                <option value="M">Masculino</option>
                                <option value="F">Feminino</option>
                            </select>
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 uppercase">Nascimento *</label>
                           <div className="relative">
                              <input type="text" placeholder="DD/MM/AAAA" className={`${inputClass} pr-10`} value={newP.nascimento} onChange={handleDateTextChange} maxLength={10} />
                              <div className="absolute right-3 top-3 z-20">
                                  <CalendarIcon size={18} className="text-slate-400 cursor-pointer" />
                                  <input type="date" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleCalendarPick} tabIndex={-1} />
                              </div>
                           </div>
                        </div>
                    </div>
                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={resetForm} className="px-6 py-4 bg-slate-200 hover:bg-slate-300 rounded-xl font-bold flex items-center justify-center gap-2 text-slate-600"><Eraser size={20}/> Limpar</button>
                        <button type="submit" className="flex-1 bg-hospital-600 hover:bg-hospital-700 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2"><Save size={20}/> Cadastrar Prontuário</button>
                    </div>
                </form>
            )}

            {activeTab === 'bulk' && (
                <div className="space-y-6 text-center">
                    {!bulkData.length ? (
                        <div className="border-2 border-dashed border-slate-300 p-10 bg-slate-50 rounded-xl flex flex-col items-center">
                            <FileSpreadsheet size={48} className="text-slate-400 mb-4"/>
                            
                            <div className="text-sm text-slate-500 max-w-lg mb-6 space-y-2">
                                <p className="font-bold text-slate-700">Instruções para Importação:</p>
                                <p>O arquivo Excel (.xlsx) deve conter um cabeçalho na primeira linha.</p>
                                <div className="bg-white p-3 rounded border border-slate-200 text-left">
                                   <p className="font-semibold text-xs uppercase mb-1">Colunas Obrigatórias:</p>
                                   <ul className="list-disc list-inside text-xs mb-2">
                                      <li><strong>Numero</strong> (ou Prontuario)</li>
                                      <li><strong>Nome</strong> (Nome do Paciente)</li>
                                   </ul>
                                   <p className="font-semibold text-xs uppercase mb-1">Opcionais:</p>
                                   <ul className="list-disc list-inside text-xs">
                                      <li><strong>Idade</strong> (Numérico)</li>
                                      <li><strong>Sexo</strong> (M ou F)</li>
                                   </ul>
                                </div>
                            </div>

                            <label className="bg-hospital-600 hover:bg-hospital-700 text-white px-8 py-4 rounded-xl cursor-pointer hover:-translate-y-1 shadow-lg font-bold inline-flex items-center gap-3 transition-transform">
                                <Upload size={20} /> Carregar Planilha
                                <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
                            </label>
                        </div>
                    ) : (
                        <div className="text-left">
                            <h4 className="font-bold text-slate-700 mb-4">{bulkData.length} registros encontrados</h4>
                            <div className="max-h-96 overflow-y-auto border rounded bg-white">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-200 sticky top-0"><tr><th className="p-2">Nº</th><th className="p-2">Nome</th></tr></thead>
                                    <tbody>{bulkPreview.map((r,i) => <tr key={i}><td>{r.numero}</td><td>{r.nome}</td></tr>)}</tbody>
                                </table>
                            </div>
                            <button onClick={processBulkImport} className="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg font-bold">Confirmar</button>
                            <button onClick={() => {setBulkData([]); setBulkPreview([])}} className="ml-4 text-red-500 underline">Cancelar</button>
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Register;
