import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, authFetch } from '../auth/useAuth';
import { useWebSocket } from '../messages/useWebSocket';
import '../styles/Messages.css';

function Messages() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { lastMessage } = useWebSocket(user);
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.id) {
            loadConversations();
        }
    }, [user]);

    // Rafraîchir quand on reçoit un nouveau message
    useEffect(() => {
        if (lastMessage?.type === 'new_message') {
            loadConversations();
        }
    }, [lastMessage]);

    const loadConversations = async () => {
        try {
            setLoading(true);
            const response = await authFetch(`/messages/conversations/${user.id}`);

            if (response.ok) {
                const data = await response.json();
                setConversations(data.conversations);
            }
        } catch (error) {
            console.error('Error loading conversations:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleConversationClick = (conversation) => {
        navigate(`/chat/${conversation._id}`);
    };

    const getOtherUser = (conversation) => {
        const otherUserId = conversation.participants.find(id => id !== user.id);
        return conversation.participantsInfo[otherUserId];
    };

    const formatDate = (date) => {
        const d = new Date(date);
        const now = new Date();
        const diffMs = now - d;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'À l\'instant';
        if (diffMins < 60) return `${diffMins}min`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}j`;

        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    };

    if (loading) {
        return (
            <div className="messages-container">
                <div className="loading">Chargement...</div>
            </div>
        );
    }

    return (
        <div className="messages-container">
            <button className="btn-back-to-feed" onClick={() => navigate('/')}>
                ← Retour au feed
            </button>

            <div className="messages-page-header">  {/* ← RENOMMÉ */}
                <h1>Messages</h1>
            </div>

            {conversations.length === 0 ? (
                <div className="no-conversations">
                    <div className="empty-icon">💬</div>
                    <p>Aucune conversation</p>
                    <p className="empty-subtitle">
                        Cliquez sur un profil pour commencer une conversation
                    </p>
                </div>
            ) : (
                <div className="conversations-list">
                    {conversations.map(conversation => {
                        const otherUser = getOtherUser(conversation);

                        return (
                            <div
                                key={conversation._id}
                                className={`conversation-item ${conversation.unreadCount > 0 ? 'unread' : ''}`}
                                onClick={() => handleConversationClick(conversation)}
                            >
                                <div className="conversation-avatar">
                                    {otherUser?.name?.[0]?.toUpperCase() || '?'}
                                </div>

                                <div className="conversation-info">
                                    <div className="conversation-item-header">  {/* ← RENOMMÉ */}
                                        <span className="conversation-name">
                                            {otherUser?.name || 'Utilisateur'}
                                        </span>
                                        <span className="conversation-time">
                                            {formatDate(conversation.lastMessageAt)}
                                        </span>
                                    </div>

                                    <div className="conversation-preview">
                                        <p className={conversation.unreadCount > 0 ? 'preview-unread' : ''}>
                                            {conversation.lastMessage || 'Aucun message'}
                                        </p>
                                        {conversation.unreadCount > 0 && (
                                            <span className="unread-count">
                                                {conversation.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default Messages;