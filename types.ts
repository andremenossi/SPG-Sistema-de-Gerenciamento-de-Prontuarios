
export enum UserType {
  ADMIN = 'admin',
  COMUM = 'comum'
}

export enum ProntuarioStatus {
  ATIVO = 'Ativo',
  DESATIVADO = 'Desativado',
  PERDIDO = 'Perdido'
}

export interface User {
  id: number;
  nome: string;
  login: string;
  senha_hash: string;
  tipo: UserType;
  theme?: 'light' | 'dark';
}

export interface Prontuario {
  id: number;
  numero_prontuario: string;
  nome_paciente: string;
  idade: number;
  sexo?: string; // 'M' | 'F' | 'Outro'
  data_nascimento?: string; // YYYY-MM-DD ou 00/00/0000
  volumes?: string; 
  status: ProntuarioStatus;
  local_atual: string;
  local_anterior?: string; 
  ultima_movimentacao?: string; // ISO Date String
}

export interface Movimentacao {
  id: number;
  numero_prontuario: string;
  nome_paciente: string;
  idade: number;
  origem: string;
  destino: string;
  data_hora: string;
  usuario_responsavel: string;
  observacao?: string;
}

export interface AgendaItem {
  id: string; 
  numero_prontuario: string;
  nome_paciente: string;
  idade?: number;
  sexo?: string;
  horario: string;
  medico: string;
  especialidade: string;
  selecionado: boolean;
  statusProcessamento?: 'pendente' | 'movido' | 'criado_e_movido' | 'erro' | 'ignorado';
}

export interface AgendaHistory {
  id: string;
  data_importacao: string; // ISO Date (Creation)
  data_agenda?: string; // Date extracted from Excel
  usuario: string;
  nome_medico: string;
  especialidade: string;
  total_pacientes: number;
  status: 'draft' | 'processed'; 
  items: AgendaItem[];
}

export interface SystemConfig {
  permissions: {
    commonCanViewHistory: boolean;
    commonCanImportAgenda: boolean;
    commonCanEditProntuario: boolean;
    commonCanDeleteProntuario: boolean;
    commonCanManageDestinations: boolean;
    commonCanManageVolumes: boolean;
    commonCanManageRetention: boolean;
  };
  volumeOptions: string[]; 
  agendaHistoryRetentionDays?: number; // Dias para manter histórico (0 ou null = infinito)
}
