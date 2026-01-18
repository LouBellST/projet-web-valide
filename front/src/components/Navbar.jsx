import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import '../styles/Navbar.css';

function Navbar() {
    const navigate = useNavigate();
    const { user, isAuthenticated, logout } = useAuth();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Fonction pour obtenir l'URL complète de la photo
    const getPhotoUrl = (photoPath) => {
        if (!photoPath) return null;
        // Si le chemin commence par /uploads, ajouter /users devant
        if (photoPath.startsWith('/uploads/')) {
            return `/users${photoPath}`;
        }
        return photoPath;
    };

    const photoUrl = user?.photo ? getPhotoUrl(user.photo) : null;

    return (
        <nav className="navbar">
            <div className="navbar-container">
                <div className="navbar-logo">
                    <button onClick={() => navigate('/')} className="logo-button">
                        Lemauvaiscoin
                    </button>
                </div>

                {isAuthenticated ? (
                    <div className="navbar-user">
                        <button onClick={() => navigate('/profile')} className="profile-button">
                            {photoUrl ? (
                                <img
                                    src={photoUrl}
                                    alt="Profile"
                                    className="profile-avatar"
                                    onError={(e) => {
                                        // En cas d'erreur, afficher le placeholder
                                        e.target.style.display = 'none';
                                        const placeholder = e.target.nextSibling;
                                        if (placeholder) {
                                            placeholder.style.display = 'flex';
                                        }
                                    }}
                                />
                            ) : null}
                            {(!photoUrl || !user?.photo) && (
                                <div className="profile-avatar-placeholder">
                                    {user?.prenom?.[0] || 'U'}{user?.nom?.[0] || 'N'}
                                </div>
                            )}
                            <span className="user-name">
                                {user?.prenom || user?.nom
                                    ? `${user.prenom} ${user.nom}`.trim()
                                    : user?.email}
                            </span>
                        </button>
                        <button onClick={handleLogout} className="logout-button">
                            Déconnexion
                        </button>
                    </div>
                ) : (
                    <div className="navbar-auth-links">
                        <button onClick={() => navigate('/login')} className="login-link">
                            Connexion
                        </button>
                        <button onClick={() => navigate('/register')} className="register-link">
                            Inscription
                        </button>
                    </div>
                )}
            </div>
        </nav>
    );
}

export default Navbar;