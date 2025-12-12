
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Search from './pages/Search';
import History from './pages/History';
import ImportAgenda from './pages/ImportAgenda';
import Register from './pages/Register';
import UsersPage from './pages/Users';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { User, UserType } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check session in sessionStorage (clears on close)
    const stored = sessionStorage.getItem('sgp_session');
    if (stored) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
    sessionStorage.setItem('sgp_session', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('sgp_session');
  };

  if (loading) return null;

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <HashRouter>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/search" element={<Search userLogin={user.login} />} />
          <Route path="/register" element={<Register />} />
          <Route path="/history" element={<History />} />
          <Route path="/import" element={<ImportAgenda userLogin={user.login} />} />
          <Route path="/settings" element={<Settings />} />
          <Route 
            path="/users" 
            element={user.tipo === UserType.ADMIN ? <UsersPage /> : <Navigate to="/" />} 
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}

export default App;
