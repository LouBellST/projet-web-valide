import { useState, useEffect } from 'react';
import { useAuth } from '../auth/useAuth';
import { authFetch } from '../auth/useAuth';
import { useNavigate } from 'react-router-dom';
import '../styles/Profile.css';

function Profile() {
    const { user } = useAuth();
    const navigate = useNavigate();
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
    const [showModal, setShowModal] = useState(null);
    const [modalUsers, setModalUsers] = useState([]);
    const [modalLoading, setModalLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('profile');
    const [bookmarkedPosts, setBookmarkedPosts] = useState([]);
    const [loadingBookmarks, setLoadingBookmarks] = useState(false);

    useEffect(() => {
        if (user?.id) {
            loadProfile();
        }
    }, [user]);

    const loadProfile = async () => {
        try {
            setLoading(true);
            setMessage({ type: '', text: '' });

            const response = await authFetch(`/users/users/${user.id}?currentUserId=${user.id}`);

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

    const loadFollowersOrFollowing = async (type) => {
        try {
            setModalLoading(true);
            const endpoint = type === 'followers'
                ? `/users/users/${user.id}/followers`
                : `/users/users/${user.id}/following`;

            const response = await authFetch(endpoint);

            if (!response.ok) {
                throw new Error('Erreur lors du chargement');
            }

            const data = await response.json();
            const users = type === 'followers' ? data.followers : data.following;
            setModalUsers(users);
            setShowModal(type);
        } catch (error) {
            console.error('Error loading users:', error);
        } finally {
            setModalLoading(false);
        }
    };

    const handleFollowToggle = async (targetUserId, isCurrentlyFollowing) => {
        try {
            if (isCurrentlyFollowing) {
                await authFetch(`/users/users/${targetUserId}/follow?followerId=${user.id}`, {
                    method: 'DELETE'
                });
            } else {
                await authFetch(`/users/users/${targetUserId}/follow`, {
                    method: 'POST',
                    body: JSON.stringify({ followerId: user.id })
                });
            }

            loadFollowersOrFollowing(showModal);
            loadProfile();
        } catch (error) {
            console.error('Error toggling follow:', error);
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

    const loadBookmarks = async () => {
        try {
            setLoadingBookmarks(true);
            const response = await authFetch(`/posts/bookmarks?userId=${user.id}&limit=50`);
            if (response.ok) {
                const data = await response.json();
                setBookmarkedPosts(data.posts);
            }
        } catch (error) {
            console.error('Error loading bookmarks:', error);
        } finally {
            setLoadingBookmarks(false);
        }
    };

    const handleLike = async (postId, isLiked) => {
        try {
            if (isLiked) {
                await authFetch(`/posts/posts/${postId}/like?userId=${user.id}`, {
                    method: 'DELETE'
                });
            } else {
                await authFetch(`/posts/posts/${postId}/like`, {
                    method: 'POST',
                    body: JSON.stringify({
                        userId: user.id,
                        userName: `${user.prenom} ${user.nom}`.trim() || user.email
                    })
                });
            }

            loadBookmarks();
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    };

    const handleBookmark = async (postId) => {
        try {
            await authFetch(`/posts/bookmarks?userId=${user.id}&postId=${postId}`, {
                method: 'DELETE'
            });

            loadBookmarks();
        } catch (error) {
            console.error('Error removing bookmark:', error);
        }
    };

    const handleTagClick = (tag) => {
        navigate(`/tags/${tag}`);
    };

    const handleAuthorClick = (authorId) => {
        if (authorId === user.id) {
            setActiveTab('profile');
        } else {
            navigate(`/user/${authorId}`);
        }
    };

    const getPhotoUrl = (photoPath) => {
        if (!photoPath) return null;
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

                {/* Stats Followers/Following */}
                <div className="profile-stats">
                    <button
                        className="stat-button"
                        onClick={() => loadFollowersOrFollowing('followers')}
                    >
                        <strong>{profile.followersCount || 0}</strong>
                        <span>Abonnés</span>
                    </button>
                    <button
                        className="stat-button"
                        onClick={() => loadFollowersOrFollowing('following')}
                    >
                        <strong>{profile.followingCount || 0}</strong>
                        <span>Abonnements</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="profile-tabs">
                    <button
                        className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
                        onClick={() => setActiveTab('profile')}
                    >
                        Profil
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'bookmarks' ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab('bookmarks');
                            if (bookmarkedPosts.length === 0) {
                                loadBookmarks();
                            }
                        }}
                    >
                        Enregistrés ({bookmarkedPosts.length})
                    </button>
                </div>

                {/* Tab Profil */}
                {activeTab === 'profile' && (
                    <>
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
                    </>
                )}

                {/* Tab Bookmarks */}
                {activeTab === 'bookmarks' && (
                    <div className="bookmarks-section">
                        {loadingBookmarks ? (
                            <div className="loading">Chargement...</div>
                        ) : bookmarkedPosts.length === 0 ? (
                            <div className="no-posts">
                                <p>Aucun post enregistré</p>
                            </div>
                        ) : (
                            <div className="posts-list">
                                {bookmarkedPosts.map(post => (
                                    <div key={post._id} className="post-card">
                                        <div className="post-header">
                                            <div className="post-author" onClick={() => handleAuthorClick(post.authorId)}>
                                                <div className="author-avatar">
                                                    {post.authorName?.[0]?.toUpperCase() || 'U'}
                                                </div>
                                                <div className="author-info">
                                                    <span className="author-name">{post.authorName}</span>
                                                    <span className="post-date">
                                                        {new Date(post.createdAt).toLocaleDateString('fr-FR', {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="post-content">
                                            <p>{post.content}</p>

                                            {post.tags && post.tags.length > 0 && (
                                                <div className="post-tags">
                                                    {post.tags.map(tag => (
                                                        <span
                                                            key={tag}
                                                            className="tag"
                                                            onClick={() => handleTagClick(tag)}
                                                        >
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {post.image && (
                                                <img
                                                    src={`/posts${post.image}`}
                                                    alt="Post"
                                                    className="post-image"
                                                />
                                            )}
                                        </div>

                                        <div className="post-actions">
                                            <button
                                                onClick={() => handleLike(post._id, post.isLiked)}
                                                className={`btn-action ${post.isLiked ? 'liked' : ''}`}
                                            >
                                                {post.isLiked ? '❤️' : '🤍'} {post.likesCount}
                                            </button>

                                            <button className="btn-action">
                                                💬 {post.commentsCount}
                                            </button>

                                            <button
                                                onClick={() => handleBookmark(post._id)}
                                                className="btn-action bookmarked"
                                            >
                                                🔖 Retirer
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal Followers/Following */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{showModal === 'followers' ? 'Abonnés' : 'Abonnements'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(null)}>
                                ✕
                            </button>
                        </div>

                        <div className="modal-body">
                            {modalLoading ? (
                                <div className="modal-loading">Chargement...</div>
                            ) : modalUsers.length === 0 ? (
                                <div className="modal-empty">
                                    {showModal === 'followers'
                                        ? 'Aucun abonné pour le moment'
                                        : 'Vous ne suivez personne pour le moment'
                                    }
                                </div>
                            ) : (
                                <div className="users-list">
                                    {modalUsers.map(u => (
                                        <div key={u.userId} className="user-item">
                                            <div className="user-avatar">
                                                {u.photo ? (
                                                    <img src={`/users${u.photo}`} alt={u.name} />
                                                ) : (
                                                    <div className="user-avatar-placeholder">
                                                        {u.name?.[0]?.toUpperCase() || 'U'}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="user-info">
                                                <span className="user-name">{u.name}</span>
                                                <span className="user-date">
                                                    Depuis {new Date(u.followedAt).toLocaleDateString('fr-FR')}
                                                </span>
                                            </div>
                                            {u.userId !== user.id && (
                                                <button
                                                    className={`btn-follow ${u.isFollowing ? 'following' : ''}`}
                                                    onClick={() => handleFollowToggle(u.userId, u.isFollowing)}
                                                >
                                                    {u.isFollowing ? 'Ne plus suivre' : 'Suivre'}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function calculateCompleteness(profile) {
    const fields = ['email', 'prenom', 'nom', 'telephone', 'adressePostale', 'photo'];
    const filledFields = fields.filter(field => profile[field] && profile[field] !== '').length;
    return Math.round((filledFields / fields.length) * 100);
}

export default Profile;