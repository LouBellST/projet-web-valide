import { useState, useEffect } from 'react';

/**
 * Fonction pour décoder et vérifier le JWT
 */
function decodeToken(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Erreur décodage token:', error);
    return null;
  }
}

/**
 * Hook personnalisé pour gérer l'authentification
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const isTokenExpired = (token) => {
    if (!token) return true;
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    const expirationTime = decoded.exp * 1000; // exp est en secondes
    return Date.now() >= expirationTime;
  };

  // Fonction pour charger l'état depuis localStorage
  const loadAuthState = () => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      if (isTokenExpired(storedToken)) {
        console.log('Token expiré, déconnexion');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      } else {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } else {
      setToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    loadAuthState();
    setLoading(false);

    const handleStorageChange = (e) => {
      if (e.key === 'token' || e.key === 'user') {
        loadAuthState();
      }
    };

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

  useEffect(() => {
    if (!token) return;

    const checkTokenExpiry = () => {
      if (isTokenExpired(token)) {
        console.log('Token expiré lors de la vérification régulière');
        logout();
      }
    };

    const interval = setInterval(checkTokenExpiry, 60000);

    return () => clearInterval(interval);
  }, [token]);

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
    
    window.dispatchEvent(new Event('auth-change'));
  };

  return {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!user && !!token && !isTokenExpired(token)
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