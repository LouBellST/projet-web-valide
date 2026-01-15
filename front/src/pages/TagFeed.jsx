import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { authFetch } from '../auth/useAuth';
import '../styles/TagFeed.css';

function TagFeed() {
    const { tag } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState(null);

    useEffect(() => {
        if (tag) {
            loadTagPosts();
        }
    }, [tag, user]);

    const loadTagPosts = async () => {
        try {
            setLoading(true);
            const response = await authFetch(`/posts/posts/tags/${tag}?userId=${user.id}&limit=50`);

            if (!response.ok) {
                throw new Error('Erreur lors du chargement des posts');
            }

            const data = await response.json();
            setPosts(data.posts);
            setPagination(data.pagination);
        } catch (error) {
            console.error('Error loading tag posts:', error);
        } finally {
            setLoading(false);
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

            loadTagPosts();
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    };

    const handleBookmark = async (postId, isBookmarked) => {
        try {
            if (isBookmarked) {
                await authFetch(`/posts/bookmarks?userId=${user.id}&postId=${postId}`, {
                    method: 'DELETE'
                });
            } else {
                await authFetch('/posts/bookmarks', {
                    method: 'POST',
                    body: JSON.stringify({ userId: user.id, postId })
                });
            }

            loadTagPosts();
        } catch (error) {
            console.error('Error toggling bookmark:', error);
        }
    };

    const handleTagClick = (clickedTag) => {
        navigate(`/tags/${clickedTag}`);
    };

    const handleBackToFeed = () => {
        navigate('/');
    };

    if (loading) {
        return (
            <div className="tag-feed-container">
                <div className="loading">Chargement des posts...</div>
            </div>
        );
    }

    return (
        <div className="tag-feed-container">
            <div className="tag-feed-header">
                <button onClick={handleBackToFeed} className="btn-back">
                    ← Retour au feed
                </button>
                <h1>
                    <span className="tag-icon">#</span>{tag}
                </h1>
                <div className="tag-stats">
                    {pagination && (
                        <span>{pagination.total} post{pagination.total > 1 ? 's' : ''}</span>
                    )}
                </div>
            </div>

            <div className="posts-list">
                {posts.length === 0 ? (
                    <div className="no-posts">
                        <p>Aucun post avec le tag #{tag}</p>
                        <p>Soyez le premier à publier avec ce tag !</p>
                        <button onClick={handleBackToFeed} className="btn-primary">
                            Retour au feed
                        </button>
                    </div>
                ) : (
                    posts.map(post => (
                        <div key={post._id} className="post-card">
                            <div className="post-header">
                                <div className="post-author" onClick={() => navigate(`/user/${post.authorId}`)}>
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

                                {/* Tags */}
                                {post.tags && post.tags.length > 0 && (
                                    <div className="post-tags">
                                        {post.tags.map(t => (
                                            <span
                                                key={t}
                                                className={`tag ${t === tag ? 'tag-active' : ''}`}
                                                onClick={() => handleTagClick(t)}
                                            >
                                                #{t}
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
                                    onClick={() => handleBookmark(post._id, post.isBookmarked)}
                                    className={`btn-action ${post.isBookmarked ? 'bookmarked' : ''}`}
                                >
                                    {post.isBookmarked ? '🔖' : '📑'}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination si nécessaire */}
            {pagination && pagination.pages > 1 && (
                <div className="pagination">
                    <button
                        disabled={pagination.page === 1}
                        className="btn-page"
                    >
                        Précédent
                    </button>
                    <span className="page-info">
                        Page {pagination.page} sur {pagination.pages}
                    </span>
                    <button
                        disabled={pagination.page === pagination.pages}
                        className="btn-page"
                    >
                        Suivant
                    </button>
                </div>
            )}
        </div>
    );
}

export default TagFeed;