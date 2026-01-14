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

    return (
        <nav className="navbar">
            <div className="navbar-container">
                <div className="navbar-logo">
                    <a href="/">Mon Application</a>
                </div>

                {isAuthenticated ? (
                    <div className="navbar-user">
                        <span className="user-name">
                            {user?.prenom || user?.nom
                                ? `${user.prenom} ${user.nom}`.trim()
                                : user?.email}
                        </span>
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