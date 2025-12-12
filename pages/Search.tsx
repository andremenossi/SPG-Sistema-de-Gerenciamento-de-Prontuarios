
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
        case 'numero_prontuario': valA = parseInt(a.numero_prontuario) || a.numero_pr