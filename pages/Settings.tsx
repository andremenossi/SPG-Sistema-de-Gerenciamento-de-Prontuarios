
import React, { useState, useEffect } from 'react';
import { db } from '../services/database';
import { User, UserType, SystemConfig } from '../types';
import { Save, User as UserIcon, Lock, Plus, Trash2, X, Edit2, Check, Settings as SettingsIcon, Layers, ArrowUp, ArrowDown, ArrowUpDown, Map, Clock } from 'lucide-react';

const Settings: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  // Destinations
  const [destinations, setDestinations] = useState<string[]>([]);
  const [newDest, setNewDest] = useState('');
  const [editingDest, setEditingDest] = useState<{original: string, current: string} | null>(null);

  // Deletion State
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null); 
  
  // Volumes
  const [newVolume, setNewVolume] = useState('');
  const [deleteVolumeTarget, setDeleteVolumeTarget] = useState<string | null>(null);

  // System Config
  const [config, setConfig] = useState<SystemConfig>(db.getConfig());

  useEffect(() => {
    const session = localStorage.getItem('sgp_session');
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
    const updatedUser = { 
      ...currentUser, 
      nome: name, 
      ...(password ? { senha_hash: password } : {}) 
    };
    db.updateUser(updatedUser);
    localStorage.setItem('sgp_session', JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
    setPassword('');
    alert('Perfil atualizado com sucesso!');
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

  const sortAlphabetically = (list: string[]) => {
      return [...list].sort((a, b) => a.localeCompare(b));
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
  
  const sortDestinations = () => {
      const updated = sortAlphabetically(destinations);
      setDestinations(updated);
      db.saveDestinations(updated);
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

  const sortVolumes = () => {
      const updated = sortAlphabetically(config.volumeOptions);
      const newConfig = { ...config, volumeOptions: updated };
      setConfig(newConfig);
      db.saveConfig(newConfig);
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

  if (!currentUser) return <div>Carregando...</div>;

  const isAdmin = currentUser.tipo === UserType.ADMIN;
  const canManageDestinations = isAdmin || config.permissions.commonCanManageDestinations;
  const canManageVolumes = isAdmin || config.permissions.commonCanManageVolumes;
  const canManageRetention = isAdmin || config.permissions.commonCanManageRetention;

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
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nova Senha</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="********" className="w-full px-4 py-2 border border-slate-300 dark:border-slate-500 rounded-lg focus:ring-2 focus:ring-hospital-500 dark:bg-slate-800 dark:text-white"/>
            </div>
            <button type="submit" className="flex items-center gap-2 bg-hospital-600 hover:bg-hospital-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"><Save size={18} /> Salvar Alterações</button>
          </form>
        </div>
      </div>

      {/* 2. Destinations */}
      {canManageDestinations && (
        <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-200 dark:border-slate-600 overflow-hidden w-full">
          <div className="p-6 border-b border-slate-100 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Map className="text-purple-600 dark:text-purple-400" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Gerenciar Destinos / Setores</h3>
            </div>
            <button onClick={sortDestinations} className="text-xs bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:text-white px-2 py-1 rounded flex items-center gap-1"><ArrowUpDown size={12}/> Ordenar A-Z</button>
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
                      <h3 className="font-bold text-slate-800 dark:text-slate-100">Gerenciar Opções de Volumes</h3>
                  </div>
                  <button onClick={sortVolumes} className="text-xs bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:text-white px-2 py-1 rounded flex items-center gap-1"><ArrowUpDown size={12}/> Ordenar A-Z</button>
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

      {/* 4. Agenda History Retention (New) */}
      {canManageRetention && (
          <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-200 dark:border-slate-600 overflow-hidden w-full">
              <div className="p-6 border-b border-slate-100 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex items-center gap-3">
                  <Clock className="text-emerald-600 dark:text-emerald-400" />
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">Retenção de Histórico de Agendas</h3>
              </div>
              <div className="p-8">
                  <p className="text-sm text-slate-500 dark:text-slate-300 mb-4">
                      Defina por quanto tempo as agendas processadas serão mantidas no histórico antes de serem excluídas automaticamente.
                  </p>
                  <div className="flex items-center gap-4">
                      <select 
                          className="px-4 py-2 border border-slate-300 dark:border-slate-500 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:text-white"
                          value={config.agendaHistoryRetentionDays || 0}
                          onChange={(e) => handleRetentionChange(parseInt(e.target.value))}
                      >
                          <option value={0}>Nunca excluir (Manter para sempre)</option>
                          <option value={7}>7 dias</option>
                          <option value={15}>15 dias</option>
                          <option value={30}>30 dias</option>
                          <option value={60}>60 dias</option>
                          <option value={90}>90 dias (3 meses)</option>
                          <option value={180}>180 dias (6 meses)</option>
                          <option value={365}>365 dias (1 ano)</option>
                      </select>
                      <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                          {config.agendaHistoryRetentionDays === 0 ? "O histórico não será apagado automaticamente." : `Agendas com mais de ${config.agendaHistoryRetentionDays} dias serão removidas.`}
                      </span>
                  </div>
              </div>
          </div>
      )}

      {/* 5. Access Control */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-200 dark:border-slate-600 overflow-hidden w-full">
          <div className="p-6 border-b border-slate-100 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex items-center gap-3">
            <Lock className="text-red-600 dark:text-red-400" />
            <h3 className="font-bold text-slate-800 dark:text-slate-100">Controle de Permissões (Usuários Comuns)</h3>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
             <div>
                <h5 className="font-bold text-slate-500 dark:text-slate-400 text-xs uppercase mb-4 tracking-wider">Acesso a Módulos</h5>
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
                </div>
             </div>
             <div>
                <h5 className="font-bold text-slate-500 dark:text-slate-400 text-xs uppercase mb-4 tracking-wider">Dados</h5>
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
