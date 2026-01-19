import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, authFetch } from '../auth/useAuth';
import '../styles/MessagesFloatingButton.css';

function MessagesFloatingButton() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user?.id) return;

        // Charger le nombre de messages non lus
        loadUnreadCount();

        // Rafraîchir toutes les 30 secondes
        const interval = setInterval(loadUnreadCount, 30000);

        return () => clearInterval(interval);
    }, [user]);

    const loadUnreadCount = async () => {
        try {
            const response = await authFetch(`/messages/conversations/${user.id}`);
            if (response.ok) {
                const data = await response.json();
                const total = data.conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
                setUnreadCount(total);
            }
        } catch (error) {
            console.error('Error loading unread count:', error);
        }
    };

    const handleClick = () => {
        navigate('/chat');
    };

    if (!user) return null;

    return (
        <button
            className="floating-messages-btn"
            onClick={handleClick}
            title="Messages"
        >
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
            >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {unreadCount > 0 && (
                <span className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
        </button>

    );
}

export default MessagesFloatingButton;