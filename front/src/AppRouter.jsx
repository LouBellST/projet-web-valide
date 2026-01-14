import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/useAuth';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import App from './App';
import Profile from './pages/Profile';

function ProtectedRoute({ children }) {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%'
            }}>
                <p>Chargement...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

function AppRouter() {
    return (
        <BrowserRouter>
            {/* La Navbar est toujours affichée */}
            <Navbar />

            {/* Wrapper pour le contenu avec classe app-content */}
            <div className="app-content">
                <Routes>
                    {/* Routes publiques */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />

                    {/* Routes protégées */}
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <App />
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

                    {/* Redirection par défaut */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
        </BrowserRouter>
    );
}

export default AppRouter;