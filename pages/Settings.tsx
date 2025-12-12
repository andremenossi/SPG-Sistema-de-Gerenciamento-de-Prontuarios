
import React, { useState, useEffect } from 'react';
import { db } from '../services/database';
import { User, UserType, SystemConfig } from '../types';
import { Save, User as UserIcon, Lock, Plus, Trash2, X, Edit2, Check, Layers, ArrowUp, ArrowDown, ArrowUpDown, Map, Clock, Eye, EyeOff, Image, Upload, ToggleLeft, ToggleRight, AlertTriangle, List, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const Settings: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Profile Form
  const [password, setPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [name, setName] = useState('');
  
  // Destinations
  const [destinations, setDestinations] = useState<string[]>([]);
  const [newDest, setNewDest] = useState('');
  const [editingDest, setEditingDest] = useState<{original: string, current: string} | null>(null);
  const [destSortDir, setDestSortDir] = useState<'asc' | 'desc'>('asc');

  // Deletion State
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null); 
  
  // Volumes
  const [newVolume, setNewVolume] = useState('');
  const [deleteVolumeTarget, setDeleteVolumeTarget] = useState<string | null>(null);
  const [volSortDir, setVolSortDir] = useState<'asc' | 'desc'>('asc');

  // System Config
  const [config, setConfig] = useState<SystemConfig>(db.getConfig());

  useEffect(() => {
    // Session is now in sessionStorage
    const session = sessionStorage.getItem('sgp_session');
    if (session) {
      const u = JSON.parse(session);
      setCurrentUser(u);
      setName(u.nome);
    }
    loadDestinations();
    setConfig(db.getConfig());
  }, []);

  const loadDestinations = () => {
    setDestinations([...db.getDestinations()]);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    // Password Validation
    if (password) {
        if (password.length < 5) {
            alert("A nova senha deve ter no mínimo 5 caracteres.");
            return;
        }

        if (currentUser.tipo !== UserType.ADMIN) {
            if (!oldPassword) {
                alert("Para alterar a senha, você deve informar a senha antiga.");
                return;
            }
            if (oldPassword !== currentUser.senha_hash) {
                alert("A senha antiga está incorreta.");
                return;
            }
        }
    }

    const updatedUser = { 
      ...currentUser, 
      nome: name, 
      ...(password ? { senha_hash: password } : {}) 
    };
    db.updateUser(updatedUser);
    sessionStorage.setItem('sgp_session', JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
    
    setPassword('');
    setOldPassword('');
    alert('Perfil atualizado com sucesso!');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
              if (evt.target?.result) {
                  localStorage.setItem(key, evt.target.result as string);
                  window.location.reload(); // Force reload to apply changes
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const resetImage = (key: string) => {
      localStorage.removeItem(key);
      window.location.reload();
  };

  // --- LIST MANIPULATION ---
  const moveItem = (list: string[], index: number, direction: 'up' | 'down') => {
    const newList = [...list];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newList.length) {
      [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    }
    return newList;
  };

  // --- Destinations ---
  const handleAddDestination = () => {
    const val = newDest.trim();
    if (val && !destinations.includes(val)) {
      const updated = [...destinations, val];
      setDestinations(updated);
      db.saveDestinations(updated);
      setNewDest('');
    }
  };

  const confirmDeleteDestination = () => {
    if (deleteTarget) {
      const updated = destinations.filter(d => d !== deleteTarget);
      setDestinations(updated);
      db.saveDestinations(updated);
      setDeleteTarget(null);
    }
  };

  const startEditDest = (dest: string) => {
    setEditingDest({ original: dest, current: dest });
  };

  const saveEditDest = () => {
    if (editingDest && editingDest.current.trim() !== '') {
       const updated = destinations.map(d => d === editingDest.original ? editingDest.current.trim() : d);
       setDestinations(updated);
       db.saveDestinations(updated);
       setEditingDest(null);
    }
  };

  const moveDestination = (index: number, direction: 'up' | 'down') => {
      const updated = moveItem(destinations, index, direction);
      setDestinations(updated);
      db.saveDestinations(updated);
  };
  
  const toggleSortDestinations = () => {
      const newDir = destSortDir === 'asc' ? 'desc' : 'asc';
      const updated = [...destinations].sort((a, b) => {
          return newDir === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
      });
      setDestinations(updated);
      db.saveDestinations(updated);
      setDestSortDir(newDir);
  };

  // --- Volumes ---
  const handleAddVolume = () => {
      const val = newVolume.trim();
      if (val && !config.volumeOptions.includes(val)) {
          const updated = [...config.volumeOptions, val];
          const newConfig = { ...config, volumeOptions: updated };
          setConfig(newConfig);
          db.saveConfig(newConfig);
          setNewVolume('');
      }
  };

  const confirmDeleteVolume = () => {
      if (deleteVolumeTarget) {
          const updated = config.volumeOptions.filter(v => v !== deleteVolumeTarget);
          const newConfig = { ...config, volumeOptions: updated };
          setConfig(newConfig);
          db.saveConfig(newConfig);
          setDeleteVolumeTarget(null);
      }
  };
  
  const moveVolume = (index: number, direction: 'up' | 'down') => {
      const updated = moveItem(config.volumeOptions, index, direction);
      const newConfig = { ...config, volumeOptions: updated };
      setConfig(newConfig);
      db.saveConfig(newConfig);
  };

  const toggleSortVolumes = () => {
      const newDir = volSortDir === 'asc' ? 'desc' : 'asc';
      const updated = [...config.volumeOptions].sort((a, b) => {
          return newDir === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
      });
      const newConfig = { ...config, volumeOptions: updated };
      setConfig(newConfig);
      db.saveConfig(newConfig);
      setVolSortDir(newDir);
  };

  // --- Config Permissions & Retention ---
  const handleConfigChange = (section: 'permissions', key: string, value: boolean) => {
    const newConfig = {
      ...config,
      [section]: {
        ...config[section],
        [key]: value
      }
    };
    setConfig(newConfig);
    db.saveConfig(newConfig);
  };

  const handleRetentionChange = (days: number) => {
      const newConfig = { ...config, agendaHistoryRetentionDays: days };
      setConfig(newConfig);
      db.saveConfig(newConfig);
  };

  const handleLimitChange = (field: 'maxRowsSearch' | 'maxRowsHistory', rows: number) => {
      const newConfig = { ...config, [field]: rows };
      setConfig(newConfig);
      db.saveConfig(newConfig);
  };

  const handleBypassChange = (val: boolean) => {
      const newConfig = { ...config, adminCanBypassRequiredFields: val };
      setConfig(newConfig);
      db.saveConfig(newConfig);
  };

  const handleExportProntuarios = () => {
      const allData = db.getProntuarios();
      const exportData = allData.map(p => ({
          'N° de Prontuário': p.numero_prontuario,
          'Nome': p.nome_paciente,
          'Idade': p.idade,
          'Data de Nascimento': p.data_nascimento,
          'Sexo': p.sexo,
          'Local Atual': p.local_atual,
          'Situação': p.status,
          'Volumes': p.volumes
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Prontuários");
      XLSX.writeFile(wb, "SGP_Todos_Prontuarios.xlsx");
  };

  if (!currentUser) return <div>Carregando...</div>;

  const isAdmin = currentUser.tipo === UserType.ADMIN;
  const canCustomizeVisuals = isAdmin || config.permissions.commonCanCustomizeVisuals;
  const canManageDestinations = isAdmin || config.permissions.commonCanManageDestinations;
  const canManageVolumes = isAdmin || config.permissions.commonCanManageVolumes;
  
  // Independent Checks for Data Config Block
  const canManageRetention = isAdmin || config.permissions.commonCanManageRetention;
  const canManagePageLimit = isAdmin || config.permissions.commonCanManagePageLimit;
  const canViewDataConfig = canManageRetention || canManagePageLimit;
  
  const customLogo = localStorage.getItem('sgp_custom_logo');
  const customBg = localStorage.getItem('sgp_custom_bg');

  return (
    <div className="w-full space-y-8 pb-12 overflow-y-auto h-full pr-2">
      {/* 1. Profile */}
      <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-200 dark:border-slate-600 overflow-hidden w-full">
        <div className="p-6 border-b border-slate-100 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex items-center gap-3">
          <UserIcon className="text-hospital-600 dark:text-hospital-400" />
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Meu Perfil</h3>
        </div>
        <div className="p-8">
          <form onSubmit={handleSaveProfile} className="space-y-6 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome Completo</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-500 rounded-lg focus:ring-2 focus:ring-hospital-500 dark:bg-slate-800 dark:text-white"/>
            </div>
            
            <div className="pt-2 border-t border-slate-100 dark:border-slate-600">
                <p className="text-xs font-bold text-slate-400 uppercase mb-3">Segurança</p>
                
                {/* Old Password Field (Only if not Admin) */}
                {currentUser.tipo !== UserType.ADMIN && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Senha Antiga <span className="text-xs text-slate-400 font-normal">(Obrigatório para trocar senha)</span></label>
                        <div className="relative">
                            <input type={showOldPassword ? "text" : "password"} value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-500 rounded-lg focus:ring-2 focus:ring-hospital-500 dark:bg-slate-800 dark:text-white pr-10"/>
                             <button type="button" onClick={() => setShowOldPassword(!showOldPassword)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                {showOldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nova Senha</label>
                    <div className="relative">
                        <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="********" className="w-full px-4 py-2 border border-slate-300 dark:border-slate-500 rounded-lg focus:ring-2 focus:ring-hospital-500 dark:bg-slate-800 dark:text-white pr-10"/>
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    {password && password.length < 5 && <p className="text-xs text-red-500 mt-1">Mínimo de 5 caracteres.</p>}
                </div>
            </div>

            <button type="submit" className="flex items-center gap-2 bg-hospital-600 hover:bg-hospital-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"><Save size={18} /> Salvar Alterações</button>
          </form>
        </div>
      </div>

      {/* EXPORT DATA */}
      <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-200 dark:border-slate-600 overflow-hidden w-full">
          <div className="p-6 border-b border-slate-100 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex items-center gap-3">
              <Download className="text-green-600 dark:text-green-400" />
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Exportar Dados</h3>
          </div>
          <div className="p-8">
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Gere um arquivo Excel contendo todos os prontuários cadastrados atualmente no sistema.</p>
              <button onClick={handleExportProntuarios} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-bold shadow transition-all hover:-translate-y-0.5">
                  <Download size={18}/> Baixar Excel Completo
              </button>
          </div>
      </div>

      {/* CUSTOM IMAGES */}
      {canCustomizeVisuals && (
        <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-200 dark:border-slate-600 overflow-hidden w-full">
            <div className="p-6 border-b border-slate-100 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex items-center gap-3">
                <Image className="text-orange-600 dark:text-orange-400" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Personalização Visual</h3>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">Logo do Hospital</h4>
                    <p className="text-xs text-slate-500 mb-4">Logotipo no menu de Login.</p>
                    
                    {/* PREVIEW */}
                    {customLogo && (
                        <div className="mb-4 p-4 border border-dashed border-slate-300 rounded-lg bg-slate-50 dark:bg-slate-800 flex justify-center">
                            <img src={customLogo} alt="Logo Preview" className="h-16 object-contain" />
                        </div>
                    )}

                    <div className="flex gap-2 items-center">
                        <label className="flex items-center gap-2 bg-hospital-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-hospital-700 text-sm font-bold">
                            <Upload size={16}/> Enviar Logo
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'sgp_custom_logo')} />
                        </label>
                        {customLogo && <button onClick={() => resetImage('sgp_custom_logo')} className="text-red-500 hover:underline text-xs">Remover</button>}
                    </div>
                </div>
                <div>
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">Imagem de Fundo (Login)</h4>
                    <p className="text-xs text-slate-500 mb-4">Fundo da tela de login.</p>
                    
                    {/* PREVIEW */}
                    {customBg && (
                        <div className="mb-4 p-4 border border-dashed border-slate-300 rounded-lg bg-slate-50 dark:bg-slate-800 flex justify-center">
                            <img src={customBg} alt="Background Preview" className="h-16 w-full object-cover rounded" />
                        </div>
                    )}

                    <div className="flex gap-2 items-center">
                        <label className="flex items-center gap-2 bg-hospital-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-hospital-700 text-sm font-bold">
                            <Upload size={16}/> Enviar Fundo
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'sgp_custom_bg')} />
                        </label>
                        {customBg && <button onClick={() => resetImage('sgp_custom_bg')} className="text-red-500 hover:underline text-xs">Remover</button>}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* 2. Destinations */}
      {canManageDestinations && (
        <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-200 dark:border-slate-600 overflow-hidden w-full">
          <div className="p-6 border-b border-slate-100 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Map className="text-purple-600 dark:text-purple-400" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Destinos / Setores</h3>
            </div>
            <button onClick={toggleSortDestinations} className="text-xs bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:text-white px-3 py-1.5 rounded flex items-center gap-2 transition-colors">
                <ArrowUpDown size={12}/> 
                <span>Ordenar {destSortDir === 'asc' ? 'A-Z' : 'Z-A'}</span>
            </button>
          </div>
          <div className="p-8">
            <div className="flex gap-2 mb-6 relative max-w-lg">
              <input type="text" value={newDest} onChange={e => setNewDest(e.target.value)} placeholder="Novo destino (ex: Raio-X)" className="flex-1 px-4 py-2 pr-10 border border-slate-300 dark:border-slate-500 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-slate-800 dark:text-white"/>
               {newDest && <button onClick={() => setNewDest('')} className="absolute right-32 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={18} /></button>}
              <button type="button" onClick={handleAddDestination} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"><Plus size={18} /> Adicionar</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {destinations.map((dest, index) => (
                <div key={`${dest}-${index}`} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-3 py-2 rounded-lg group">
                  <div className="flex items-center gap-1">
                      <div className="flex flex-col gap-0.5 mr-2 opacity-50 hover:opacity-100">
                          <button onClick={() => moveDestination(index, 'up')} disabled={index === 0} className="hover:text-purple-600 disabled:opacity-30"><ArrowUp size={10}/></button>
                          <button onClick={() => moveDestination(index, 'down')} disabled={index === destinations.length - 1} className="hover:text-purple-600 disabled:opacity-30"><ArrowDown size={10}/></button>
                      </div>
                      {editingDest?.original === dest ? (
                         <div className="flex items-center gap-1 flex-1">
                            <input autoFocus type="text" className="w-full text-sm bg-white dark:bg-slate-700 border border-purple-300 rounded px-1 py-0.5 outline-none dark:text-white" value={editingDest.current} onChange={(e) => setEditingDest({...editingDest, current: e.target.value})}/>
                            <button type="button" onClick={saveEditDest} className="text-green-600 dark:text-green-400 p-1 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"><Check size={16}/></button>
                            <button type="button" onClick={() => setEditingDest(null)} className="text-red-500 dark:text-red-400 p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"><X size={16}/></button>
                         </div>
                      ) : (
                         <span className="text-slate-700 dark:text-slate-200 text-sm font-medium pl-1">{dest}</span>
                      )}
                  </div>
                  
                  {!editingDest || editingDest.original !== dest ? (
                    <div className="flex items-center gap-1">
                       <button type="button" onClick={() => startEditDest(dest)} className="text-slate-400 hover:text-blue-500 dark:hover:text-blue-300 p-1.5 rounded" title="Editar"><Edit2 size={15} /></button>
                       <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteTarget(dest); }} className="text-slate-400 hover:text-red-500 dark:hover:text-red-300 p-1.5 rounded" title="Remover"><Trash2 size={15} /></button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Manage Volume Options */}
      {canManageVolumes && (
          <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-200 dark:border-slate-600 overflow-hidden w-full">
              <div className="p-6 border-b border-slate-100 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <Layers className="text-blue-600 dark:text-blue-400" />
                      <h3 className="font-bold text-slate-800 dark:text-slate-100">Opções de Volumes</h3>
                  </div>
                  <button onClick={toggleSortVolumes} className="text-xs bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:text-white px-3 py-1.5 rounded flex items-center gap-2 transition-colors">
                      <ArrowUpDown size={12}/> 
                      <span>Ordenar {volSortDir === 'asc' ? 'A-Z' : 'Z-A'}</span>
                  </button>
              </div>
              <div className="p-8">
                  <div className="flex gap-2 mb-6 max-w-lg">
                      <input type="text" value={newVolume} onChange={e => setNewVolume(e.target.value)} placeholder="Nova opção (ex: Caixa Box)" className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-white"/>
                      <button type="button" onClick={handleAddVolume} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"><Plus size={18} /> Adicionar</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {config.volumeOptions.map((vol, index) => (
                          <div key={index} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-3 py-2 rounded-lg">
                              <div className="flex items-center gap-2">
                                  <div className="flex flex-col gap-0.5 opacity-50 hover:opacity-100">
                                      <button onClick={() => moveVolume(index, 'up')} disabled={index === 0} className="hover:text-blue-600 disabled:opacity-30"><ArrowUp size={10}/></button>
                                      <button onClick={() => moveVolume(index, 'down')} disabled={index === config.volumeOptions.length - 1} className="hover:text-blue-600 disabled:opacity-30"><ArrowDown size={10}/></button>
                                  </div>
                                  <span className="text-slate-700 dark:text-slate-200 text-sm font-medium pl-1">{vol}</span>
                              </div>
                              <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteVolumeTarget(vol); }} className="text-slate-400 hover:text-red-500 dark:hover:text-red-300 p-1.5 rounded" title="Remover"><Trash2 size={15} /></button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* 4. Agenda History Retention & Page Limits */}
      {canViewDataConfig && (
          <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-200 dark:border-slate-600 overflow-hidden w-full">
              <div className="p-6 border-b border-slate-100 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex items-center gap-3">
                  <Clock className="text-emerald-600 dark:text-emerald-400" />
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">Configurações de Dados</h3>
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Retention */}
                  {canManageRetention && (
                      <div>
                          <h5 className="font-bold text-slate-700 dark:text-slate-300 mb-2">Retenção de Histórico</h5>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">As agendas processadas serão excluídas automaticamente após:</p>
                          <select 
                              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-500 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:text-white"
                              value={config.agendaHistoryRetentionDays || 0}
                              onChange={(e) => handleRetentionChange(parseInt(e.target.value))}
                          >
                              <option value={0}>Nunca excluir</option>
                              <option value={7}>7 dias</option>
                              <option value={15}>15 dias</option>
                              <option value={30}>30 dias</option>
                              <option value={60}>60 dias</option>
                              <option value={90}>90 dias</option>
                              <option value={365}>1 ano</option>
                          </select>
                      </div>
                  )}

                  {/* Pagination Limits */}
                  {canManagePageLimit && (
                      <div className="space-y-4">
                          <h5 className="font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2"><List size={16}/> Limite de Listagem</h5>
                          <div>
                              <p className="text-xs font-bold text-slate-500 mb-1">Tela de Consulta</p>
                              <select 
                                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-500 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:text-white"
                                  value={config.maxRowsSearch !== undefined ? config.maxRowsSearch : 20}
                                  onChange={(e) => handleLimitChange('maxRowsSearch', parseInt(e.target.value))}
                              >
                                  <option value={0}>Mostrar Tudo (Sem Limite)</option>
                                  <option value={10}>10 registros</option>
                                  <option value={20}>20 registros (Padrão)</option>
                                  <option value={30}>30 registros</option>
                                  <option value={50}>50 registros</option>
                                  <option value={100}>100 registros</option>
                              </select>
                          </div>
                          <div>
                              <p className="text-xs font-bold text-slate-500 mb-1">Tela de Histórico</p>
                              <select 
                                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-500 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:text-white"
                                  value={config.maxRowsHistory !== undefined ? config.maxRowsHistory : 20}
                                  onChange={(e) => handleLimitChange('maxRowsHistory', parseInt(e.target.value))}
                              >
                                  <option value={0}>Mostrar Tudo (Sem Limite)</option>
                                  <option value={10}>10 registros</option>
                                  <option value={20}>20 registros (Padrão)</option>
                                  <option value={30}>30 registros</option>
                                  <option value={50}>50 registros</option>
                                  <option value={100}>100 registros</option>
                              </select>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* 5. Access Control */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-200 dark:border-slate-600 overflow-hidden w-full">
          <div className="p-6 border-b border-slate-100 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex items-center gap-3">
            <Lock className="text-red-600 dark:text-red-400" />
            <h3 className="font-bold text-slate-800 dark:text-slate-100">Controle de Permissões</h3>
          </div>
          <div className="p-8">
              
             {/* Admin Config Section */}
             <div className="mb-8 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                 <h5 className="font-bold text-yellow-800 dark:text-yellow-400 text-sm uppercase mb-4 tracking-wider flex items-center gap-2">
                     <AlertTriangle size={16}/> Permissões Administrativas
                 </h5>
                 <label className="flex items-center gap-3 cursor-pointer select-none">
                     <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                         <input type="checkbox" className="peer absolute opacity-0 w-0 h-0" checked={config.adminCanBypassRequiredFields} onChange={(e) => handleBypassChange(e.target.checked)}/>
                         <span className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-slate-300 dark:bg-slate-600 rounded-full transition-all duration-300 before:content-[''] before:absolute before:w-4 before:h-4 before:bottom-1 before:left-1 before:bg-white before:rounded-full before:transition-all peer-checked:bg-yellow-500 peer-checked:before:translate-x-6`}></span>
                     </div>
                     <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Permitir que Admins salvem dados incompletos (Bypass)</span>
                 </label>
                 <p className="text-xs text-slate-500 mt-2 ml-14">Se ativo, administradores poderão salvar ou editar prontuários mesmo se campos obrigatórios estiverem vazios.</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                 <div>
                    <h5 className="font-bold text-slate-500 dark:text-slate-400 text-xs uppercase mb-4 tracking-wider">Acesso Comum (Módulos)</h5>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input type="checkbox" className="w-5 h-5 rounded text-red-600 focus:ring-red-500" checked={config.permissions.commonCanViewHistory} onChange={(e) => handleConfigChange('permissions', 'commonCanViewHistory', e.target.checked)}/>
                        <span className="text-sm text-slate-700 dark:text-slate-300">Visualizar Histórico</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input type="checkbox" className="w-5 h-5 rounded text-red-600 focus:ring-red-500" checked={config.permissions.commonCanImportAgenda} onChange={(e) => handleConfigChange('permissions', 'commonCanImportAgenda', e.target.checked)}/>
                        <span className="text-sm text-slate-700 dark:text-slate-300">Importar Agenda</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input type="checkbox" className="w-5 h-5 rounded text-red-600 focus:ring-red-500" checked={config.permissions.commonCanCustomizeVisuals} onChange={(e) => handleConfigChange('permissions', 'commonCanCustomizeVisuals', e.target.checked)}/>
                        <span className="text-sm text-slate-700 dark:text-slate-300">Personalizar Visual (Logo/Fundo)</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input type="checkbox" className="w-5 h-5 rounded text-red-600 focus:ring-red-500" checked={config.permissions.commonCanManageDestinations} onChange={(e) => handleConfigChange('permissions', 'commonCanManageDestinations', e.target.checked)}/>
                        <span className="text-sm text-slate-700 dark:text-slate-300">Gerenciar Destinos</span>
                      </label>
                       <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input type="checkbox" className="w-5 h-5 rounded text-red-600 focus:ring-red-500" checked={config.permissions.commonCanManageVolumes} onChange={(e) => handleConfigChange('permissions', 'commonCanManageVolumes', e.target.checked)}/>
                        <span className="text-sm text-slate-700 dark:text-slate-300">Gerenciar Opções de Volumes</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input type="checkbox" className="w-5 h-5 rounded text-red-600 focus:ring-red-500" checked={config.permissions.commonCanManageRetention} onChange={(e) => handleConfigChange('permissions', 'commonCanManageRetention', e.target.checked)}/>
                        <span className="text-sm text-slate-700 dark:text-slate-300">Gerenciar Retenção de Histórico</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input type="checkbox" className="w-5 h-5 rounded text-red-600 focus:ring-red-500" checked={config.permissions.commonCanManagePageLimit} onChange={(e) => handleConfigChange('permissions', 'commonCanManagePageLimit', e.target.checked)}/>
                        <span className="text-sm text-slate-700 dark:text-slate-300">Gerenciar Limite de Listagem</span>
                      </label>
                    </div>
                 </div>
                 <div>
                    <h5 className="font-bold text-slate-500 dark:text-slate-400 text-xs uppercase mb-4 tracking-wider">Acesso Comum (Dados)</h5>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input type="checkbox" className="w-5 h-5 rounded text-red-600 focus:ring-red-500" checked={config.permissions.commonCanEditProntuario} onChange={(e) => handleConfigChange('permissions', 'commonCanEditProntuario', e.target.checked)}/>
                        <span className="text-sm text-slate-700 dark:text-slate-300">Editar Prontuários</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input type="checkbox" className="w-5 h-5 rounded text-red-600 focus:ring-red-500" checked={config.permissions.commonCanDeleteProntuario} onChange={(e) => handleConfigChange('permissions', 'commonCanDeleteProntuario', e.target.checked)}/>
                        <span className="text-sm text-slate-700 dark:text-slate-300">Excluir Prontuários</span>
                      </label>
                    </div>
                 </div>
              </div>
          </div>
        </div>
      )}

      {/* Delete Dest Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setDeleteTarget(null)}>
           <div className="bg-white dark:bg-slate-700 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-6 border border-slate-200 dark:border-slate-600" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Excluir Setor?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-300 mb-6">Deseja realmente remover <strong>{deleteTarget}</strong>?</p>
              <div className="flex gap-3">
                 <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg">Cancelar</button>
                 <button onClick={confirmDeleteDestination} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">Excluir</button>
              </div>
           </div>
        </div>
      )}

      {/* Delete Volume Modal */}
      {deleteVolumeTarget && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setDeleteVolumeTarget(null)}>
              <div className="bg-white dark:bg-slate-700 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-6 border border-slate-200 dark:border-slate-600" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Excluir Opção?</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-300 mb-6">Deseja remover <strong>{deleteVolumeTarget}</strong>?</p>
                  <div className="flex gap-3">
                      <button onClick={() => setDeleteVolumeTarget(null)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg">Cancelar</button>
                      <button onClick={confirmDeleteVolume} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">Excluir</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Settings;
