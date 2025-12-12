
import React, { useState } from 'react';
import { db } from '../services/database';
import { User } from '../types';
import { Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const users = db.getUsers();
    const user = users.find(u => u.login === login && u.senha_hash === password);

    if (user) {
      onLogin(user);
    } else {
      setError('Credenciais inválidas.');
    }
  };

  const bgImage = localStorage.getItem('sgp_custom_bg') || './background-login.jpg';
  const logoImage = localStorage.getItem('sgp_custom_logo') || './logo-hepp.png';

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-slate-200">
      
      {/* BACKGROUND IMAGE LAYER */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${bgImage}')` }}
      ></div>

      {/* GRADIENT OVERLAY LAYER */}
      {/* Gradiente branco de baixo (90%) para cima (transparente) */}
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-white via-white/70 to-transparent"></div>

      {/* CONTENT CARD */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden border border-white/50">
          
          {/* HEADER COM LOGO E TÍTULO */}
          <div className="pt-10 pb-6 px-8 text-center flex flex-col items-center">
            <div className="mb-4 h-24 flex items-center justify-center">
                <img 
                   src={logoImage}
                   alt="Logo HEPP" 
                   className="h-full w-auto object-contain drop-shadow-sm" 
                   onError={(e) => { 
                     e.currentTarget.style.display = 'none'; 
                   }}
                />
            </div>
            <h1 className="text-3xl font-bold text-hospital-600 tracking-tight">SGP HEPP</h1>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-1">Gestão de Prontuários</p>
          </div>
          
          {/* FORM */}
          <div className="px-8 pb-10">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 bg-red-50/80 backdrop-blur text-red-600 text-sm rounded-lg border border-red-100 text-center font-medium">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1 ml-1">Usuário</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-hospital-500 focus:border-hospital-500 transition-all outline-none bg-white/80 text-slate-800 placeholder-slate-400"
                  placeholder="Ex: admin"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1 ml-1">Senha</label>
                <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-hospital-500 focus:border-hospital-500 transition-all outline-none bg-white/80 pr-10 text-slate-800 placeholder-slate-400"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
              </div>
              
              <button
                type="submit"
                className="w-full bg-hospital-600 hover:bg-hospital-700 text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 mt-2"
              >
                Entrar
              </button>
            </form>
            
            <div className="mt-8 text-center text-[10px] text-slate-400 uppercase tracking-widest font-medium">
              © 2025 Hospital Estadual de Presidente Prudente
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
