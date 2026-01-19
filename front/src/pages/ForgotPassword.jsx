import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/ForgotPassword.css';

function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(true);
            } else {
                setError(data.error || 'Erreur lors de l\'envoi');
            }
        } catch (err) {
            setError('Erreur de connexion au serveur');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="forgot-password-container">
                <div className="forgot-password-card">
                    <div className="success-icon">✅</div>
                    <h1>Email envoyé !</h1>
                    <p className="success-message">
                        Si un compte existe avec cette adresse email, vous recevrez un lien de réinitialisation dans quelques instants.
                    </p>
                    <p className="info-message">
                        Vérifiez votre boîte de réception et vos spams.
                    </p>
                    <button
                        className="btn-primary"
                        onClick={() => navigate('/login')}
                    >
                        Retour à la connexion
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="forgot-password-container">
            <div className="forgot-password-card">
                <h1>Mot de passe oublié</h1>
                <p className="subtitle">
                    Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
                </p>

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="votre@email.com"
                            required
                            disabled={loading}
                            autoFocus
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={loading}
                    >
                        {loading ? 'Envoi...' : 'Envoyer le lien'}
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

export default ForgotPassword;