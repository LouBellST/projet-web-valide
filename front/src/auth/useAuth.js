import { useState, useEffect } from 'react';

/**
 * Hook personnalisé pour gérer l'authentification
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fonction pour charger l'état depuis localStorage
  const loadAuthState = () => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    } else {
      setToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    // Charger l'état initial
    loadAuthState();
    setLoading(false);

    // Écouter les changements de storage (pour sync entre onglets)
    const handleStorageChange = (e) => {
      if (e.key === 'token' || e.key === 'user') {
        loadAuthState();
      }
    };

    // Écouter un événement custom pour les changements dans le même onglet
    const handleAuthChange = () => {
      loadAuthState();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-change', handleAuthChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-change', handleAuthChange);
    };
  }, []);

  const login = (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setToken(token);
    setUser(user);
    
    // Déclencher l'événement custom pour notifier les autres composants
    window.dispatchEvent(new Event('auth-change'));
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    
    // Déclencher l'événement custom pour notifier les autres composants
    window.dispatchEvent(new Event('auth-change'));
  };

  const isAuthenticated = () => {
    return !!token && !!user;
  };

  return {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: isAuthenticated()
  };
}

/**
 * Helper pour faire des requêtes authentifiées
 */
export function authFetch(url, options = {}) {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
}