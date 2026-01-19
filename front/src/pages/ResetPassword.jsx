import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../styles/ForgotPassword.css';

function ResetPassword() {
    const [searchParams] = useSearchParams();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    const token = searchParams.get('token');

    useEffect(() => {
        if (!token) {
            setError('Lien invalide ou expiré');
        }
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('Le mot de passe doit contenir au moins 6 caractères');
            return;
        }

        if (password !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/auth/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token,
                    newPassword: password
                })
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(true);
            } else {
                setError(data.error || 'Erreur lors de la réinitialisation');
            }
        } catch (err) {
            setError('Erreur de connexion au serveur');
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="reset-password-container">
                <div className="reset-password-card">
                    <div className="error-icon">❌</div>
                    <h1>Lien invalide</h1>
                    <p className="error-message">
                        Ce lien de réinitialisation est invalide ou a expiré.
                    </p>
                    <button
                        className="btn-primary"
                        onClick={() => navigate('/forgot-password')}
                    >
                        Demander un nouveau lien
                    </button>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="reset-password-container">
                <div className="reset-password-card">
                    <div className="success-icon">✅</div>
                    <h1>Mot de passe réinitialisé !</h1>
                    <p className="success-message">
                        Votre mot de passe a été modifié avec succès.
                    </p>
                    <button
                        className="btn-primary"
                        onClick={() => navigate('/login')}
                    >
                        Se connecter
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="reset-password-container">
            <div className="reset-password-card">
                <h1>Nouveau mot de passe</h1>
                <p className="subtitle">
                    Choisissez un nouveau mot de passe pour votre compte.
                </p>

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="password">Nouveau mot de passe</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            disabled={loading}
                            autoFocus
                            minLength={6}
                        />
                        <small>Au moins 6 caractères</small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirmer le mot de passe</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            disabled={loading}
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={loading}
                    >
                        {loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
                    </button>
                </form>

                <div className="back-link">
                    <button
                        type="button"
                        className="link-button"
                        onClick={() => navigate('/login')}
                        disabled={loading}
                    >
                        ← Retour à la connexion
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ResetPassword;