import { useState, useEffect } from 'react';
import { useAuth } from '../auth/useAuth';
import { authFetch } from '../auth/useAuth';
import { useNavigate } from 'react-router-dom';
import '../styles/Feed.css';

function Feed() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newPostContent, setNewPostContent] = useState('');
    const [newPostImage, setNewPostImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [showCreatePost, setShowCreatePost] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [feedFilter, setFeedFilter] = useState('all');
    const [showComments, setShowComments] = useState({});
    const [comments, setComments] = useState({});
    const [commentText, setCommentText] = useState({});
    const [loadingComments, setLoadingComments] = useState({});

    useEffect(() => {
        loadFeed();
    }, [user, feedFilter]);

    const loadFeed = async () => {
        try {
            setLoading(true);
            const followingOnly = feedFilter === 'following' ? 'true' : 'false';
            const response = await authFetch(`/posts/posts/feed?userId=${user.id}&limit=50&followingOnly=${followingOnly}`);

            if (!response.ok) {
                throw new Error('Erreur lors du chargement du feed');
            }

            const data = await response.json();
            setPosts(data.posts);
        } catch (error) {
            console.error('Error loading feed:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setNewPostImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleCreatePost = async (e) => {
        e.preventDefault();

        if (!newPostContent.trim()) return;

        setSubmitting(true);

        try {
            const formData = new FormData();
            formData.append('authorId', user.id);
            formData.append('authorName', `${user.prenom} ${user.nom}`.trim() || user.email);
            formData.append('content', newPostContent);

            if (newPostImage) {
                formData.append('image', newPostImage);
            }

            const response = await fetch('/posts/posts', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error('Erreur lors de la création du post');
            }

            const data = await response.json();
            setPosts([data.post, ...posts]);

            setNewPostContent('');
            setNewPostImage(null);
            setImagePreview(null);
            setShowCreatePost(false);
        } catch (error) {
            console.error('Error creating post:', error);
            alert('Erreur lors de la création du post');
        } finally {
            setSubmitting(false);
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
            loadFeed();
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
            loadFeed();
        } catch (error) {
            console.error('Error toggling bookmark:', error);
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
            loadFeed();
        } catch (error) {
            console.error('Error submitting comment:', error);
        }
    };

    const handleAuthorClick = (authorId) => {
        if (authorId === user.id) {
            navigate('/profile');
        } else {
            navigate(`/user/${authorId}`);
        }
    };

    const handleTagClick = (tag) => {
        navigate(`/tags/${tag}`);
    };

    if (loading) {
        return (
            <div className="feed-container">
                <div className="loading">Chargement du feed...</div>
            </div>
        );
    }

    return (
        <div className="feed-container">
            <div className="feed-header">
                <h1>Feed</h1>
                <button
                    onClick={() => setShowCreatePost(!showCreatePost)}
                    className="btn-create-post"
                >
                    {showCreatePost ? 'Annuler' : '+ Nouveau post'}
                </button>
            </div>

            <div className="feed-filter">
                <button
                    className={`filter-btn ${feedFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setFeedFilter('all')}
                >
                    Tous
                </button>
                <button
                    className={`filter-btn ${feedFilter === 'following' ? 'active' : ''}`}
                    onClick={() => setFeedFilter('following')}
                >
                    Abonnements
                </button>
            </div>

            {showCreatePost && (
                <div className="create-post-card">
                    <form onSubmit={handleCreatePost}>
                        <textarea
                            value={newPostContent}
                            onChange={(e) => setNewPostContent(e.target.value)}
                            placeholder="Quoi de neuf ? Utilisez #hashtags pour taguer votre post !"
                            rows="4"
                            required
                        />

                        {imagePreview && (
                            <div className="image-preview">
                                <img src={imagePreview} alt="Preview" />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setNewPostImage(null);
                                        setImagePreview(null);
                                    }}
                                    className="btn-remove-image"
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        <div className="create-post-actions">
                            <input
                                type="file"
                                id="post-image"
                                accept="image/*"
                                onChange={handleImageChange}
                                style={{ display: 'none' }}
                            />
                            <label htmlFor="post-image" className="btn-add-image">
                                📷 Ajouter une image
                            </label>

                            <button
                                type="submit"
                                className="btn-submit-post"
                                disabled={submitting || !newPostContent.trim()}
                            >
                                {submitting ? 'Publication...' : 'Publier'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="posts-list">
                {posts.length === 0 ? (
                    <div className="no-posts">
                        {feedFilter === 'following' ? (
                            <>
                                <p>Aucun post de vos abonnements</p>
                                <p>Suivez des utilisateurs pour voir leurs posts ici !</p>
                                <button onClick={() => setFeedFilter('all')} className="btn-secondary">
                                    Voir tous les posts
                                </button>
                            </>
                        ) : (
                            <>
                                <p>Aucun post pour le moment</p>
                                <p>Soyez le premier à publier !</p>
                            </>
                        )}
                    </div>
                ) : (
                    posts.map(post => (
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

                                <button
                                    className="btn-action"
                                    onClick={() => toggleComments(post._id)}
                                >
                                    💬 {post.commentsCount}
                                </button>

                                <button
                                    onClick={() => handleBookmark(post._id, post.isBookmarked)}
                                    className={`btn-action ${post.isBookmarked ? 'bookmarked' : ''}`}
                                >
                                    {post.isBookmarked ? '🔖' : '📑'}
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
                    ))
                )}
            </div>
        </div>
    );
}

export default Feed;