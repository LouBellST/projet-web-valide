import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useState } from 'react';
import '../styles/Navbar.css';

function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState({ users: [], tags: [] });
    const [showResults, setShowResults] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleSearch = async (query) => {
        setSearchQuery(query);

        if (query.trim().length < 2) {
            setSearchResults({ users: [], tags: [] });
            setShowResults(false);
            return;
        }

        setSearchLoading(true);
        setShowResults(true);

        try {
            // ← VRAIE API DE RECHERCHE
            const usersResponse = await fetch(`/users/search?q=${encodeURIComponent(query)}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            let users = [];
            if (usersResponse.ok) {
                const usersData = await usersResponse.json();
                users = usersData.users || [];
            }

            // Recherche tags
            let tags = [];
            try {
                const tagsResponse = await fetch(`/posts?tag=${encodeURIComponent(query)}&limit=5`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                if (tagsResponse.ok) {
                    const tagsData = await tagsResponse.json();
                    const uniqueTags = [...new Set(
                        tagsData.posts
                            ?.flatMap(post => post.tags || [])
                            .filter(tag => tag.toLowerCase().includes(query.toLowerCase()))
                    )];
                    tags = uniqueTags.slice(0, 5);
                }
            } catch (err) {
                console.log('Tags search error:', err);
            }

            setSearchResults({
                users,
                tags
            });
        } catch (error) {
            console.error('Erreur de recherche:', error);
            setSearchResults({ users: [], tags: [] });
        } finally {
            setSearchLoading(false);
        }
    };

    const handleUserClick = (userId) => {
        navigate(`/user/${userId}`);
        setShowResults(false);
        setSearchQuery('');
    };

    const handleTagClick = (tag) => {
        navigate(`/tags/${encodeURIComponent(tag)}`);
        setShowResults(false);
        setSearchQuery('');
    };

    const handleClickOutside = (e) => {
        if (!e.target.closest('.search-container')) {
            setShowResults(false);
        }
    };

    const getUserDisplayName = (u) => {
        const fullName = `${u.prenom || ''} ${u.nom || ''}`.trim();
        return fullName || u.email.split('@')[0];
    };

    return (
        <nav className="navbar" onClick={handleClickOutside}>
            <div className="navbar-container">
                <Link to="/" className="navbar-logo">
                    StudentApp
                </Link>

                <div className="search-container">
                    <input
                        type="text"
                        className="search-input"
                        placeholder="🔍 Rechercher des utilisateurs ou tags..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                    />

                    {showResults && (
                        <div className="search-results">
                            {searchLoading ? (
                                <div className="search-loading">Recherche...</div>
                            ) : (
                                <>
                                    {searchResults.users.length > 0 && (
                                        <div className="search-section">
                                            <div className="search-section-title">Utilisateurs</div>
                                            {searchResults.users.map(u => (
                                                <div
                                                    key={u.userId}
                                                    className="search-result-item"
                                                    onClick={() => handleUserClick(u.userId)}
                                                >
                                                    {u.photo ? (
                                                        <img
                                                            src={u.photo}
                                                            alt={getUserDisplayName(u)}
                                                            className="search-user-photo"
                                                        />
                                                    ) : (
                                                        <div className="search-user-avatar">
                                                            {(u.prenom?.[0] || u.email[0]).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className="search-user-info">
                                                        <div className="search-user-name">
                                                            {getUserDisplayName(u)}
                                                        </div>
                                                        <div className="search-user-email">{u.email}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {searchResults.tags.length > 0 && (
                                        <div className="search-section">
                                            <div className="search-section-title">🏷️ Tags</div>
                                            {searchResults.tags.map(tag => (
                                                <div
                                                    key={tag}
                                                    className="search-result-item search-tag-item"
                                                    onClick={() => handleTagClick(tag)}
                                                >
                                                    <span className="search-tag">#{tag}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {searchResults.users.length === 0 && searchResults.tags.length === 0 && (
                                        <div className="search-no-results">
                                            Aucun résultat pour "{searchQuery}"
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="navbar-links">
                    <Link to="/" className="navbar-link">
                        Accueil
                    </Link>
                    <Link to="/profile" className="navbar-link">
                        Profil
                    </Link>
                    <button onClick={handleLogout} className="navbar-logout">
                        Déconnexion
                    </button>
                </div>
            </div>
        </nav>
    );
}

export default Navbar;