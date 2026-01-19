import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/useAuth';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Feed from './pages/Feed';
import TagFeed from './pages/TagFeed';
import Profile from './pages/Profile';
import Messages from './pages/Messages';
import Conversation from './pages/Conversation';
import Navbar from './components/Navbar';
import PublicProfile from './pages/PublicProfile';
import MessagesFloatingButton from './components/MessagesFloatingButton';


function ProtectedRoute({ children }) {
    const { user, loading, isAuthenticated } = useAuth();

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

    if (!user || !isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

function PublicRoute({ children }) {
    const { user, loading, isAuthenticated } = useAuth();

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

    if (user && isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    return children;
}

function ConditionalNavbar() {
    const { user } = useAuth();

    if (!user) {
        return null;
    }

    return <Navbar />;
}

function AppRouter() {
    const { user, isAuthenticated } = useAuth();

    return (
        <BrowserRouter>
            <ConditionalNavbar />

            {user && isAuthenticated && <MessagesFloatingButton />}

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

                <Route
                    path="/forgot-password"
                    element={
                        <PublicRoute>
                            <ForgotPassword />
                        </PublicRoute>
                    }
                />
                <Route
                    path="/reset-password"
                    element={
                        <PublicRoute>
                            <ResetPassword />
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
                    path="/user/:userId"
                    element={
                        <ProtectedRoute>
                            <PublicProfile />
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
                    path="/chat"
                    element={
                        <ProtectedRoute>
                            <Messages />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/chat/:conversationId"
                    element={
                        <ProtectedRoute>
                            <Conversation />
                        </ProtectedRoute>
                    }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default AppRouter;