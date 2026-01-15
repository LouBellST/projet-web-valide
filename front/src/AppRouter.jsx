import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/useAuth';
import Login from './pages/Login';
import Register from './pages/Register';
import Feed from './pages/Feed';
import TagFeed from './pages/TagFeed';
import Profile from './pages/Profile';
import Navbar from './components/Navbar';
import PublicProfile from './pages/PublicProfile';

function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                fontSize: '1.2rem',
                color: '#666'
            }}>
                Chargement...
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return (
        <>
            <Navbar />
            {children}
        </>
    );
}

function PublicRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                fontSize: '1.2rem',
                color: '#666'
            }}>
                Chargement...
            </div>
        );
    }

    if (user) {
        return <Navigate to="/" replace />;
    }

    return children;
}

function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Routes publiques */}
                <Route
                    path="/login"
                    element={
                        <PublicRoute>
                            <Login />
                        </PublicRoute>
                    }
                />
                <Route
                    path="/register"
                    element={
                        <PublicRoute>
                            <Register />
                        </PublicRoute>
                    }
                />

                {/* Routes protégées */}
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <Feed />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/profile"
                    element={
                        <ProtectedRoute>
                            <Profile />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/tags/:tag"
                    element={
                        <ProtectedRoute>
                            <TagFeed />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/user/:userId"
                    element={
                        <ProtectedRoute>
                            <PublicProfile />
                        </ProtectedRoute>
                    }
                />

                {/* Redirection par défaut */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default AppRouter;