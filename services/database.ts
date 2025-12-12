
import { User, Prontuario, Movimentacao, UserType, ProntuarioStatus, SystemConfig, AgendaHistory } from '../types';

const DB_KEYS = {
  USERS: 'sgp_users',
  PRONTUARIOS: 'sgp_prontuarios',
  MOVIMENTACOES: 'sgp_movimentacoes',
  DESTINATIONS: 'sgp_destinations',
  CONFIG: 'sgp_config',
  AGENDA_HISTORY: 'sgp_agenda_history'
};

class DatabaseService {
  constructor() {
    this.init();
  }

  private init() {
    // Seed Users
    if (!localStorage.getItem(DB_KEYS.USERS)) {
      const defaultAdmin: User = {
        id: 1,
        nome: 'Administrador',
        login: 'admin',
        senha_hash: 'admin123',
        tipo: UserType.ADMIN
      };
      localStorage.setItem(DB_KEYS.USERS, JSON.stringify([defaultAdmin]));
    }

    // Seed Destinations
    if (!localStorage.getItem(DB_KEYS.DESTINATIONS)) {
      const defaultDest = [
        'Ambulatório', 'Internação', 'Faturamento', 'Arquivo',
        'Recepção', 'Autorização', 'Estatística',
        'Auditoria', 'Outros', 'Arquivo Morto'
      ];
      localStorage.setItem(DB_KEYS.DESTINATIONS, JSON.stringify(defaultDest));
    }

    // Seed Config
    const storedConfig = localStorage.getItem(DB_KEYS.CONFIG);
    const defaultConfig: SystemConfig = {
      permissions: { 
        commonCanViewHistory: true, 
        commonCanImportAgenda: true,
        commonCanEditProntuario: false,
        commonCanDeleteProntuario: false,
        commonCanManageDestinations: false,
        commonCanManageVolumes: false,
        commonCanManageRetention: false,
        commonCanCustomizeVisuals: false,
        commonCanManagePageLimit: false
      },
      volumeOptions: ['1 Volume', '2 Volumes', '3 Volumes', '4 Volumes', 'Caixa Arquivo'],
      agendaHistoryRetentionDays: 0, // 0 = Nunca excluir
      adminCanBypassRequiredFields: false,
      maxRowsSearch: 20,
      maxRowsHistory: 20
    };

    if (!storedConfig) {
      localStorage.setItem(DB_KEYS.CONFIG, JSON.stringify(defaultConfig));
    } else {
      // Migration for new fields
      const parsed = JSON.parse(storedConfig);
      if (!parsed.volumeOptions) parsed.volumeOptions = defaultConfig.volumeOptions;
      if (parsed.permissions.commonCanManageVolumes === undefined) parsed.permissions.commonCanManageVolumes = false;
      if (parsed.permissions.commonCanManageRetention === undefined) parsed.permissions.commonCanManageRetention = false;
      if (parsed.permissions.commonCanCustomizeVisuals === undefined) parsed.permissions.commonCanCustomizeVisuals = false;
      if (parsed.permissions.commonCanManagePageLimit === undefined) parsed.permissions.commonCanManagePageLimit = false;
      if (parsed.agendaHistoryRetentionDays === undefined) parsed.agendaHistoryRetentionDays = 0;
      if (parsed.adminCanBypassRequiredFields === undefined) parsed.adminCanBypassRequiredFields = false;
      
      // Migrate old single maxRowsPerPage to split fields
      if (parsed.maxRowsSearch === undefined) {
          parsed.maxRowsSearch = parsed.maxRowsPerPage !== undefined ? parsed.maxRowsPerPage : 20;
      }
      if (parsed.maxRowsHistory === undefined) {
          parsed.maxRowsHistory = parsed.maxRowsPerPage !== undefined ? parsed.maxRowsPerPage : 20;
      }
      if ('maxRowsPerPage' in parsed) delete parsed.maxRowsPerPage;
      
      // Remove old requiredFields if present
      if ('requiredFields' in parsed) delete parsed.requiredFields;
      if ('commonCanManageRequiredFields' in parsed.permissions) delete parsed.permissions.commonCanManageRequiredFields;

      localStorage.setItem(DB_KEYS.CONFIG, JSON.stringify(parsed));
    }

    // Seed Prontuarios
    if (!localStorage.getItem(DB_KEYS.PRONTUARIOS)) {
      localStorage.setItem(DB_KEYS.PRONTUARIOS, JSON.stringify([]));
    }

    if (!localStorage.getItem(DB_KEYS.MOVIMENTACOES)) {
      localStorage.setItem(DB_KEYS.MOVIMENTACOES, JSON.stringify([]));
    }
    
    if (!localStorage.getItem(DB_KEYS.AGENDA_HISTORY)) {
      localStorage.setItem(DB_KEYS.AGENDA_HISTORY, JSON.stringify([]));
    }

    // --- AUTO CLEANUP AGENDA HISTORY ---
    this.cleanupAgendaHistory();
  }

  private cleanupAgendaHistory() {
      const config = this.getConfig();
      const retentionDays = config.agendaHistoryRetentionDays;
      
      if (retentionDays && retentionDays > 0) {
          const list = this.getAgendaHistory();
          const today = new Date();
          const cutoffDate = new Date(today);
          cutoffDate.setDate(today.getDate() - retentionDays);

          const filtered = list.filter(item => {
              // Keep drafts always
              if (item.status === 'draft') return true;
              
              // Check processed date
              const itemDate = new Date(item.data_importacao);
              return itemDate >= cutoffDate;
          });

          if (filtered.length !== list.length) {
              console.log(`Auto-cleaning: Removed ${list.length - filtered.length} old agenda records.`);
              localStorage.setItem(DB_KEYS.AGENDA_HISTORY, JSON.stringify(filtered));
          }
      }
  }

  // --- Config ---
  getConfig(): SystemConfig {
    const stored = localStorage.getItem(DB_KEYS.CONFIG);
    if (stored) return JSON.parse(stored);
    return {
        permissions: { 
            commonCanViewHistory: true, 
            commonCanImportAgenda: true,
            commonCanEditProntuario: false,
            commonCanDeleteProntuario: false,
            commonCanManageDestinations: false,
            commonCanManageVolumes: false,
            commonCanManageRetention: false,
            commonCanCustomizeVisuals: false,
            commonCanManagePageLimit: false
        },
        volumeOptions: ['1 Volume', '2 Volumes', '3 Volumes', '4 Volumes'],
        agendaHistoryRetentionDays: 0,
        adminCanBypassRequiredFields: false,
        maxRowsSearch: 20,
        maxRowsHistory: 20
    };
  }

  saveConfig(config: SystemConfig): void {
    localStorage.setItem(DB_KEYS.CONFIG, JSON.stringify(config));
  }

  // --- Users ---
  getUsers(): User[] {
    return JSON.parse(localStorage.getItem(DB_KEYS.USERS) || '[]');
  }

  addUser(user: Omit<User, 'id'>): void {
    const users = this.getUsers();
    const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
    users.push({ ...user, id: newId });
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
  }

  updateUser(updatedUser: User): void {
    const users = this.getUsers().map(u => u.id === updatedUser.id ? updatedUser : u);
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
  }

  deleteUser(id: number): void {
    let users = this.getUsers();
    users = users.filter(u => u.id !== id);
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
  }

  // --- Destinations ---
  getDestinations(): string[] {
    return JSON.parse(localStorage.getItem(DB_KEYS.DESTINATIONS) || '[]');
  }

  saveDestinations(dests: string[]): void {
    localStorage.setItem(DB_KEYS.DESTINATIONS, JSON.stringify(dests));
  }

  // --- Prontuarios ---
  getProntuarios(): Prontuario[] {
    return JSON.parse(localStorage.getItem(DB_KEYS.PRONTUARIOS) || '[]');
  }

  getProntuarioByNumber(num: string): Prontuario | undefined {
    if (!num || String(num).trim() === '') return undefined;
    return this.getProntuarios().find(p => String(p.numero_prontuario) === String(num));
  }

  getProntuarioByName(name: string): Prontuario | undefined {
    if (!name || name.trim() === '') return undefined;
    const cleanName = name.trim().toUpperCase();
    return this.getProntuarios().find(p => p.nome_paciente.toUpperCase() === cleanName);
  }

  addProntuario(p: Omit<Prontuario, 'id'>): void {
    const list = this.getProntuarios();
    
    // Only check duplicates if number is provided
    if (p.numero_prontuario && p.numero_prontuario.trim() !== '') {
        if (list.some(existing => existing.numero_prontuario === p.numero_prontuario)) {
            throw new Error("Número de prontuário já existe.");
        }
    }
    
    const newId = list.length > 0 ? Math.max(...list.map(i => i.id)) + 1 : 1;
    
    const config = this.getConfig();
    const defaultVol = p.volumes || (config.volumeOptions && config.volumeOptions[0]) || '1 Volume';

    list.push({ 
      ...p, 
      id: newId, 
      nome_paciente: p.nome_paciente.trim().toUpperCase(), 
      volumes: defaultVol, 
      ultima_movimentacao: new Date().toISOString() 
    });
    localStorage.setItem(DB_KEYS.PRONTUARIOS, JSON.stringify(list));
  }

  updateProntuario(updated: Prontuario): void {
    const list = this.getProntuarios();
    const idx = list.findIndex(p => p.id === updated.id);
    if (idx !== -1) {
      if (updated.numero_prontuario && updated.numero_prontuario.trim() !== '') {
          const duplicate = list.find(p => p.numero_prontuario === updated.numero_prontuario && p.id !== updated.id);
          if (duplicate) throw new Error("Já existe outro prontuário com este número.");
      }
      
      list[idx] = updated;
      localStorage.setItem(DB_KEYS.PRONTUARIOS, JSON.stringify(list));
    }
  }

  deleteProntuario(id: number): void {
    let list = this.getProntuarios();
    list = list.filter(p => p.id !== id);
    localStorage.setItem(DB_KEYS.PRONTUARIOS, JSON.stringify(list));
  }

  updateProntuarioLocation(numero: string, novoLocal: string, nomeFallback?: string): void {
    const list = this.getProntuarios();
    let idx = -1;

    // 1. Try to find by Number first
    if (numero && String(numero).trim() !== '') {
        idx = list.findIndex(p => String(p.numero_prontuario) === String(numero));
    }

    // 2. Fallback: If number empty or not found, try by Name
    if (idx === -1 && nomeFallback && nomeFallback.trim() !== '') {
        const cleanName = nomeFallback.trim().toUpperCase();
        idx = list.findIndex(p => p.nome_paciente.toUpperCase() === cleanName);
    }

    if (idx !== -1) {
      // Logic for preserving 'local_anterior' if new location is same as current.
      // This allows multiple agendas to be processed without overwriting the original "Source"
      if (list[idx].local_atual !== novoLocal) {
          list[idx].local_anterior = list[idx].local_atual;
          list[idx].local_atual = novoLocal;
      }
      // Always update timestamp to reflect activity
      list[idx].ultima_movimentacao = new Date().toISOString();
      localStorage.setItem(DB_KEYS.PRONTUARIOS, JSON.stringify(list));
    }
  }

  correctProntuarioLocation(numero: string, novoLocal: string, usuario: string, isDeletion: boolean = false): void {
    const list = this.getProntuarios();
    const idx = list.findIndex(p => p.numero_prontuario === numero);
    
    if (idx !== -1) {
      const oldLocal = list[idx].local_atual;
      if (isDeletion) {
         if (list[idx].local_anterior) {
             list[idx].local_atual = list[idx].local_anterior!;
         }
      } else {
         list[idx].local_atual = novoLocal;
      }
      list[idx].ultima_movimentacao = new Date().toISOString();
      localStorage.setItem(DB_KEYS.PRONTUARIOS, JSON.stringify(list));

      this.addHistoryLog({
        numero_prontuario: list[idx].numero_prontuario,
        nome_paciente: list[idx].nome_paciente,
        idade: list[idx].idade,
        origem: oldLocal, 
        destino: isDeletion ? (list[idx].local_anterior || oldLocal) : novoLocal, 
        usuario_responsavel: usuario,
        observacao: isDeletion ? 'Exclusão da movimentação' : 'Correção Manual (Editado)'
      });
    }
  }

  // --- Movimentacoes ---
  getMovimentacoes(): Movimentacao[] {
    return JSON.parse(localStorage.getItem(DB_KEYS.MOVIMENTACOES) || '[]');
  }

  private addHistoryLog(mov: Omit<Movimentacao, 'id' | 'data_hora'>) {
    const list = this.getMovimentacoes();
    const newId = list.length > 0 ? Math.max(...list.map(i => i.id)) + 1 : 1;
    const newMov: Movimentacao = {
      ...mov,
      id: newId,
      data_hora: new Date().toISOString()
    };
    list.push(newMov);
    localStorage.setItem(DB_KEYS.MOVIMENTACOES, JSON.stringify(list));
  }

  addMovimentacao(mov: Omit<Movimentacao, 'id' | 'data_hora'>): void {
    this.addHistoryLog(mov);
    // Updated to use Name as fallback for location update
    this.updateProntuarioLocation(mov.numero_prontuario, mov.destino, mov.nome_paciente);
  }

  // --- Agenda History ---
  getAgendaHistory(): AgendaHistory[] {
      return JSON.parse(localStorage.getItem(DB_KEYS.AGENDA_HISTORY) || '[]');
  }

  getAgendaDrafts(): AgendaHistory[] {
      return this.getAgendaHistory().filter(a => a.status === 'draft');
  }
  
  getAgendaProcessed(): AgendaHistory[] {
      return this.getAgendaHistory().filter(a => a.status === 'processed');
  }

  addAgendaHistory(agenda: AgendaHistory): void {
      const list = this.getAgendaHistory();
      list.push(agenda);
      localStorage.setItem(DB_KEYS.AGENDA_HISTORY, JSON.stringify(list));
  }

  updateAgendaHistory(agenda: AgendaHistory): void {
      const list = this.getAgendaHistory();
      const idx = list.findIndex(a => a.id === agenda.id);
      if (idx !== -1) {
          list[idx] = agenda;
          localStorage.setItem(DB_KEYS.AGENDA_HISTORY, JSON.stringify(list));
      }
  }

  deleteAgendaHistory(id: string): void {
      let list = this.getAgendaHistory();
      list = list.filter(a => a.id !== id);
      localStorage.setItem(DB_KEYS.AGENDA_HISTORY, JSON.stringify(list));
  }
}

export const db = new DatabaseService();
