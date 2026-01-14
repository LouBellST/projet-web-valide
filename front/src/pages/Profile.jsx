import { useState, useEffect } from 'react';
import { useAuth } from '../auth/useAuth';
import { authFetch } from '../auth/useAuth';
import '../styles/Profile.css';

function Profile() {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState({
        prenom: '',
        nom: '',
        telephone: '',
        adressePostale: ''
    });
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        if (user?.id) {
            loadProfile();
        }
    }, [user]);

    const loadProfile = async () => {
        try {
            setLoading(true);
            setMessage({ type: '', text: '' });

            const response = await authFetch(`/users/users/${user.id}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erreur lors du chargement du profil');
            }

            const data = await response.json();
            setProfile(data);
            setFormData({
                prenom: data.prenom || '',
                nom: data.nom || '',
                telephone: data.telephone || '',
                adressePostale: data.adressePostale || ''
            });
        } catch (error) {
            console.error('Error loading profile:', error);
            setMessage({ type: 'error', text: error.message || 'Impossible de charger le profil' });
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        try {
            const response = await authFetch(`/users/users/${user.id}/profile`, {
                method: 'PATCH',
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erreur lors de la mise à jour');
            }

            const data = await response.json();
            setProfile(data.profile);
            setEditing(false);
            setMessage({ type: 'success', text: 'Profil mis à jour avec succès !' });

            // Mettre à jour le localStorage
            const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
            localStorage.setItem('user', JSON.stringify({
                ...storedUser,
                prenom: data.profile.prenom,
                nom: data.profile.nom
            }));

            window.dispatchEvent(new Event('auth-change'));
        } catch (error) {
            console.error('Error updating profile:', error);
            setMessage({ type: 'error', text: error.message || 'Erreur lors de la mise à jour' });
        }
    };

    const handlePhotoUpload = async () => {
        if (!photoFile) return;

        setMessage({ type: '', text: '' });

        try {
            const formData = new FormData();
            formData.append('photo', photoFile);

            const response = await fetch(`/users/users/${user.id}/photo`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erreur lors de l\'upload');
            }

            const data = await response.json();
            setProfile(data.profile);
            setPhotoFile(null);
            setPhotoPreview(null);
            setMessage({ type: 'success', text: 'Photo mise à jour avec succès !' });

            // Mettre à jour le localStorage avec la photo complète
            const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
            localStorage.setItem('user', JSON.stringify({
                ...storedUser,
                photo: data.profile.photo
            }));

            window.dispatchEvent(new Event('auth-change'));
        } catch (error) {
            console.error('Error uploading photo:', error);
            setMessage({ type: 'error', text: error.message || 'Erreur lors de l\'upload de la photo' });
        }
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

    if (loading) {
        return (
            <div className="profile-container">
                <div className="loading">Chargement du profil...</div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="profile-container">
                <div className="profile-card">
                    {message.text && (
                        <div className={`message message-${message.type}`}>
                            {message.text}
                        </div>
                    )}
                    <div className="error">
                        <p>Profil non trouvé</p>
                        <button onClick={loadProfile} className="btn-primary" style={{ marginTop: '1rem' }}>
                            Réessayer
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const completeness = calculateCompleteness(profile);
    const photoUrl = getPhotoUrl(profile.photo);

    return (
        <div className="profile-container">
            <div className="profile-card">
                <h1>Mon Profil</h1>

                {message.text && (
                    <div className={`message message-${message.type}`}>
                        {message.text}
                    </div>
                )}

                {/* Photo de profil */}
                <div className="profile-photo-section">
                    <div className="photo-wrapper">
                        {photoPreview ? (
                            <img src={photoPreview} alt="Preview" className="profile-photo" />
                        ) : photoUrl ? (
                            <img
                                src={photoUrl}
                                alt="Photo de profil"
                                className="profile-photo"
                                onError={(e) => {
                                    console.error('Erreur chargement photo:', photoUrl);
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                }}
                            />
                        ) : null}

                        {!photoPreview && !photoUrl && (
                            <div className="profile-photo-placeholder">
                                {profile.prenom?.[0] || 'U'}{profile.nom?.[0] || 'N'}
                            </div>
                        )}
                    </div>

                    <div className="photo-upload">
                        <input
                            type="file"
                            id="photo"
                            accept="image/*"
                            onChange={handlePhotoChange}
                            style={{ display: 'none' }}
                        />
                        <label htmlFor="photo" className="btn-secondary">
                            {photoUrl ? 'Changer la photo' : 'Choisir une photo'}
                        </label>
                        {photoFile && (
                            <button onClick={handlePhotoUpload} className="btn-primary">
                                Enregistrer la photo
                            </button>
                        )}
                    </div>
                </div>

                {/* Barre de progression du profil */}
                <div className="profile-completeness">
                    <div className="completeness-header">
                        <span>Profil complété à {completeness}%</span>
                    </div>
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${completeness}%` }}
                        ></div>
                    </div>
                </div>

                {/* Informations du profil */}
                {!editing ? (
                    <div className="profile-info">
                        <div className="info-row">
                            <label>Email</label>
                            <span>{profile.email}</span>
                        </div>
                        <div className="info-row">
                            <label>Prénom</label>
                            <span>{profile.prenom || '—'}</span>
                        </div>
                        <div className="info-row">
                            <label>Nom</label>
                            <span>{profile.nom || '—'}</span>
                        </div>
                        <div className="info-row">
                            <label>Téléphone</label>
                            <span>{profile.telephone || '—'}</span>
                        </div>
                        <div className="info-row">
                            <label>Adresse postale</label>
                            <span>{profile.adressePostale || '—'}</span>
                        </div>

                        <button onClick={() => setEditing(true)} className="btn-primary">
                            Modifier le profil
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="profile-form">
                        <div className="form-group">
                            <label>Email</label>
                            <input type="email" value={profile.email} disabled />
                        </div>

                        <div className="form-group">
                            <label>Prénom</label>
                            <input
                                type="text"
                                name="prenom"
                                value={formData.prenom}
                                onChange={handleChange}
                                placeholder="Jean"
                            />
                        </div>

                        <div className="form-group">
                            <label>Nom</label>
                            <input
                                type="text"
                                name="nom"
                                value={formData.nom}
                                onChange={handleChange}
                                placeholder="Dupont"
                            />
                        </div>

                        <div className="form-group">
                            <label>Téléphone</label>
                            <input
                                type="tel"
                                name="telephone"
                                value={formData.telephone}
                                onChange={handleChange}
                                placeholder="+33 6 12 34 56 78"
                            />
                        </div>

                        <div className="form-group">
                            <label>Adresse postale</label>
                            <textarea
                                name="adressePostale"
                                value={formData.adressePostale}
                                onChange={handleChange}
                                placeholder="123 Rue de la Paix, 75001 Paris"
                                rows="3"
                            />
                        </div>

                        <div className="form-actions">
                            <button type="submit" className="btn-primary">
                                Enregistrer
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setEditing(false);
                                    setFormData({
                                        prenom: profile.prenom || '',
                                        nom: profile.nom || '',
                                        telephone: profile.telephone || '',
                                        adressePostale: profile.adressePostale || ''
                                    });
                                }}
                                className="btn-secondary"
                            >
                                Annuler
                            </button>
                        </div>
                    </form>
                )}

                {/* Informations du compte */}
                <div className="account-info">
                    <h3>Informations du compte</h3>
                    <div className="info-row">
                        <label>Membre depuis</label>
                        <span>{new Date(profile.createdAt).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div className="info-row">
                        <label>Dernière mise à jour</label>
                        <span>{new Date(profile.updatedAt).toLocaleDateString('fr-FR')}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function calculateCompleteness(profile) {
    const fields = ['email', 'prenom', 'nom', 'telephone', 'adressePostale', 'photo'];
    const filledFields = fields.filter(field => profile[field] && profile[field] !== '').length;
    return Math.round((filledFields / fields.length) * 100);
}

export default Profile;