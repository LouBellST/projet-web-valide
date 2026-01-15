import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { authFetch } from '../auth/useAuth';
import '../styles/PublicProfile.css';

function PublicProfile() {
    const { userId } = useParams();
    const { user, loading: authLoading } = useAuth(); // ← AJOUT de loading
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [posts, setPosts] = useState([]);
    const [following, setFollowing] = useState(false);

    useEffect(() => {
        // ← AJOUT : Attendre que user soit chargé
        if (authLoading || !user) return;

        // Si c'est notre propre profil, rediriger vers /profile
        if (userId === user.id) {
            navigate('/profile');
            return;
        }

        loadProfile();
        loadUserPosts();
    }, [userId, user, authLoading]); // ← AJOUT de authLoading

    const loadProfile = async () => {
        try {
            setLoading(true);
            const response = await authFetch(`/users/users/${userId}?currentUserId=${user.id}`);

            if (!response.ok) {
                throw new Error('Profil non trouvé');
            }

            const data = await response.json();
            setProfile(data);
            setFollowing(data.isFollowing || false);
        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadUserPosts = async () => {
        try {
            const response = await authFetch(`/posts/posts/user/${userId}?limit=20`);

            if (response.ok) {
                const data = await response.json();
                setPosts(data.posts);
            }
        } catch (error) {
            console.error('Error loading user posts:', error);
        }
    };

    const handleFollowToggle = async () => {
        try {
            if (following) {
                await authFetch(`/users/users/${userId}/follow?followerId=${user.id}`, {
                    method: 'DELETE'
                });
                setFollowing(false);
            } else {
                await authFetch(`/users/users/${userId}/follow`, {
                    method: 'POST',
                    body: JSON.stringify({ followerId: user.id })
                });
                setFollowing(true);
            }

            loadProfile();
        } catch (error) {
            console.error('Error toggling follow:', error);
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

            loadUserPosts();
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    };

    const getPhotoUrl = (photoPath) => {
        if (!photoPath) return null;
        if (photoPath.startsWith('/uploads/')) {
            return `/users${photoPath}`;
        }
        return photoPath;
    };

    // ← AJOUT : Afficher loading pendant l'authentification
    if (authLoading) {
        return (
            <div className="public-profile-container">
                <div className="loading">Chargement...</div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="public-profile-container">
                <div className="loading">Chargement du profil...</div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="public-profile-container">
                <div className="error">
                    <p>Profil non trouvé</p>
                    <button onClick={() => navigate('/')} className="btn-primary">
                        Retour au feed
                    </button>
                </div>
            </div>
        );
    }

    const photoUrl = getPhotoUrl(profile.photo);

    return (
        <div className="public-profile-container">
            <div className="public-profile-card">
                <div className="profile-header">
                    <div className="photo-section">
                        {photoUrl ? (
                            <img
                                src={photoUrl}
                                alt="Photo de profil"
                                className="profile-photo"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                }}
                            />
                        ) : (
                            <div className="profile-photo-placeholder">
                                {profile.prenom?.[0] || 'U'}{profile.nom?.[0] || 'N'}
                            </div>
                        )}
                    </div>

                    <div className="profile-info">
                        <h1>{profile.prenom} {profile.nom}</h1>
                        <p className="profile-email">{profile.email}</p>

                        <div className="profile-stats">
                            <div className="stat">
                                <strong>{profile.followersCount || 0}</strong>
                                <span>Abonnés</span>
                            </div>
                            <div className="stat">
                                <strong>{profile.followingCount || 0}</strong>
                                <span>Abonnements</span>
                            </div>
                            <div className="stat">
                                <strong>{posts.length}</strong>
                                <span>Posts</span>
                            </div>
                        </div>

                        <button
                            onClick={handleFollowToggle}
                            className={`btn-follow ${following ? 'following' : ''}`}
                        >
                            {following ? 'Ne plus suivre' : 'Suivre'}
                        </button>
                    </div>
                </div>

                <div className="user-posts">
                    <h2>Posts de {profile.prenom}</h2>

                    {posts.length === 0 ? (
                        <div className="no-posts">
                            <p>{profile.prenom} n'a pas encore publié de post.</p>
                        </div>
                    ) : (
                        <div className="posts-list">
                            {posts.map(post => (
                                <div key={post._id} className="post-card">
                                    <div className="post-header">
                                        <div className="post-date">
                                            {new Date(post.createdAt).toLocaleDateString('fr-FR', {
                                                day: 'numeric',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
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
                                                        onClick={() => navigate(`/tags/${tag}`)}
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
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PublicProfile;