import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { authFetch } from '../auth/useAuth';
import '../styles/PublicProfile.css';

function PublicProfile() {
    const { userId } = useParams();
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [posts, setPosts] = useState([]);
    const [following, setFollowing] = useState(false);
    const [showComments, setShowComments] = useState({});
    const [comments, setComments] = useState({});
    const [commentText, setCommentText] = useState({});
    const [loadingComments, setLoadingComments] = useState({});

    useEffect(() => {
        if (authLoading || !user) return;

        if (userId === user.id) {
            navigate('/profile');
            return;
        }

        loadProfile();
        loadUserPosts();
    }, [userId, user, authLoading]);

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

    const handleStartConversation = async () => {
        try {
            const response = await authFetch('/messages/conversations', {
                method: 'POST',
                body: JSON.stringify({
                    userId1: user.id,
                    userId2: userId,
                    user1Name: `${user.prenom} ${user.nom}`.trim() || user.email,
                    user2Name: profile.prenom && profile.nom
                        ? `${profile.prenom} ${profile.nom}`.trim()
                        : profile.email
                })
            });

            if (response.ok) {
                const data = await response.json();
                navigate(`/chat/${data.conversation._id}`);
            }
        } catch (error) {
            console.error('Error starting conversation:', error);
            alert('Erreur lors de la création de la conversation');
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

    const loadComments = async (postId) => {
        try {
            setLoadingComments({ ...loadingComments, [postId]: true });
            const response = await authFetch(`/posts/posts/${postId}/comments`);
            if (response.ok) {
                const data = await response.json();
                setComments({ ...comments, [postId]: data.comments });
            }
        } catch (error) {
            console.error('Error loading comments:', error);
        } finally {
            setLoadingComments({ ...loadingComments, [postId]: false });
        }
    };

    const toggleComments = async (postId) => {
        const isShowing = showComments[postId];
        setShowComments({ ...showComments, [postId]: !isShowing });

        if (!isShowing && !comments[postId]) {
            await loadComments(postId);
        }
    };

    const handleCommentSubmit = async (postId) => {
        const text = commentText[postId];
        if (!text || !text.trim()) return;

        try {
            await authFetch(`/posts/posts/${postId}/comments`, {
                method: 'POST',
                body: JSON.stringify({
                    authorId: user.id,
                    authorName: `${user.prenom} ${user.nom}`.trim() || user.email,
                    content: text
                })
            });

            await loadComments(postId);
            setCommentText({ ...commentText, [postId]: '' });
            loadUserPosts();
        } catch (error) {
            console.error('Error submitting comment:', error);
        }
    };

    const getPhotoUrl = (photoPath) => {
        if (!photoPath) return null;
        if (photoPath.startsWith('/uploads/')) {
            return `/users${photoPath}`;
        }
        return photoPath;
    };

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
            <button className="btn-back-to-feed" onClick={() => navigate('/')}>
                ← Retour au feed
            </button>

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

                        <div className="profile-actions">
                            <button
                                onClick={handleFollowToggle}
                                className={`btn-follow ${following ? 'following' : ''}`}
                            >
                                {following ? 'Ne plus suivre' : 'Suivre'}
                            </button>

                            <button
                                onClick={handleStartConversation}
                                className="btn-message"
                            >
                                💬 Message
                            </button>
                        </div>
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

                                        <button
                                            className="btn-action"
                                            onClick={() => toggleComments(post._id)}
                                        >
                                            💬 {post.commentsCount}
                                        </button>
                                    </div>

                                    {showComments[post._id] && (
                                        <div className="comments-section">
                                            {loadingComments[post._id] ? (
                                                <div className="comment-loading">Chargement...</div>
                                            ) : (
                                                <>
                                                    <div className="comments-list">
                                                        {comments[post._id]?.map(comment => (
                                                            <div key={comment._id} className="comment-item">
                                                                <div className="comment-avatar">
                                                                    {comment.authorName?.[0]?.toUpperCase() || 'U'}
                                                                </div>
                                                                <div className="comment-content">
                                                                    <div className="comment-author">{comment.authorName}</div>
                                                                    <div className="comment-text">{comment.content}</div>
                                                                    <div className="comment-date">
                                                                        {new Date(comment.createdAt).toLocaleDateString('fr-FR', {
                                                                            day: 'numeric',
                                                                            month: 'short',
                                                                            hour: '2-digit',
                                                                            minute: '2-digit'
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div className="comment-form">
                                                        <input
                                                            type="text"
                                                            placeholder="Écrire un commentaire..."
                                                            value={commentText[post._id] || ''}
                                                            onChange={(e) => setCommentText({
                                                                ...commentText,
                                                                [post._id]: e.target.value
                                                            })}
                                                            className="comment-input"
                                                            onKeyPress={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    handleCommentSubmit(post._id);
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            onClick={() => handleCommentSubmit(post._id)}
                                                            className="btn-comment-submit"
                                                            disabled={!commentText[post._id]?.trim()}
                                                        >
                                                            Envoyer
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
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