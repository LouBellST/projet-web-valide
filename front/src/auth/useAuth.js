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

  // ← NOUVELLE FONCTION : Login avec appel API
  const login = async (email, password) => {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Si erreur, throw pour que le composant Login puisse catcher
      throw new Error(data.error || 'Erreur de connexion');
    }

    // Si succès, sauvegarder le token et l'user
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    
    // Déclencher l'événement custom pour notifier les autres composants
    window.dispatchEvent(new Event('auth-change'));

    return data;
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