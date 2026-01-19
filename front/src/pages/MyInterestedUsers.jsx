import { useState, useEffect } from 'react';
import { useAuth, authFetch } from '../auth/useAuth';
import { useNavigate } from 'react-router-dom';
import '../styles/MyInterestedUsers.css';

function MyInterestedUsers() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [postsWithInterested, setPostsWithInterested] = useState([]);

    useEffect(() => {
        loadInterestedUsers();
    }, []);

    const loadInterestedUsers = async () => {
        try {
            const response = await authFetch(`/posts/interested/by-user/${user.id}`);
            if (response.ok) {
                const data = await response.json();
                setPostsWithInterested(data.postsWithInterested);
            }
        } catch (error) {
            console.error('Error loading interested users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleStartConversation = async (otherUserId, otherUserName) => {
        try {
            // Créer ou récupérer la conversation
            const response = await authFetch('/messages/conversations', {
                method: 'POST',
                body: JSON.stringify({
                    participants: [user.id, otherUserId],
                    participantsInfo: {
                        [user.id]: {
                            name: `${user.prenom} ${user.nom}`.trim() || user.email
                        },
                        [otherUserId]: {
                            name: otherUserName
                        }
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                navigate(`/chat/${data.conversation._id}`);
            }
        } catch (error) {
            console.error('Error starting conversation:', error);
        }
    };

    const getUserDisplayName = (u) => {
        const fullName = `${u.prenom || ''} ${u.nom || ''}`.trim();
        return fullName || u.email?.split('@')[0] || 'Utilisateur';
    };

    if (loading) {
        return <div className="loading">Chargement...</div>;
    }

    if (postsWithInterested.length === 0) {
        return (
            <div className="my-interested-container">
                <div className="empty-state">
                    <h2>😔 Aucune personne intéressée</h2>
                    <p>Personne n'a encore montré d'intérêt pour vos posts.</p>
                    <button onClick={() => navigate('/')} className="btn-primary">
                        Retour à l'accueil
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="my-interested-container">
            <div className="page-header">
                <button onClick={() => navigate(-1)} className="btn-back-interested">
                    ← Retour
                </button>
                <h1>⭐ Personnes intéressées par vos posts</h1>
                <p className="subtitle">
                    {postsWithInterested.length} post(s) avec des personnes intéressées
                </p>
            </div>

            <div className="posts-interested-list">
                {postsWithInterested.map(({ post, interestedUsers, interestedCount }) => (
                    <div key={post._id} className="post-interested-item">
                        <div className="post-preview">
                            <h3>Votre post :</h3>
                            <p className="post-content">{post.content}</p>
                            {post.tags && post.tags.length > 0 && (
                                <div className="post-tags">
                                    {post.tags.map((tag, i) => (
                                        <span key={i} className="tag">#{tag}</span>
                                    ))}
                                </div>
                            )}
                            <div className="post-meta">
                                <span>{interestedCount} personne(s) intéressée(s)</span>
                            </div>
                        </div>

                        <div className="interested-users-list">
                            {interestedUsers.map((interestedUser) => (
                                <div key={interestedUser.userId} className="interested-user-card">
                                    <div className="user-info">
                                        {interestedUser.photo ? (
                                            <img
                                                src={interestedUser.photo}
                                                alt={getUserDisplayName(interestedUser)}
                                                className="user-photo"
                                            />
                                        ) : (
                                            <div className="user-avatar">
                                                {getUserDisplayName(interestedUser)[0].toUpperCase()}
                                            </div>
                                        )}
                                        <div className="user-details">
                                            <div className="user-name">
                                                {getUserDisplayName(interestedUser)}
                                            </div>
                                            <div className="user-email">{interestedUser.email}</div>
                                            <div className="interested-date">
                                                Intéressé le {new Date(interestedUser.interestedAt).toLocaleDateString('fr-FR')}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        className="btn-message-interested"
                                        onClick={() => handleStartConversation(
                                            interestedUser.userId,
                                            getUserDisplayName(interestedUser)
                                        )}
                                    >
                                        💬 Envoyer un message
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default MyInterestedUsers;