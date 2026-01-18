import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, authFetch } from '../auth/useAuth';
import { useWebSocket } from '../messages/useWebSocket';
import '../styles/Conversation.css';

function Conversation() {
    const { conversationId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const { lastMessage } = useWebSocket(user);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [conversation, setConversation] = useState(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (conversationId && user?.id) {
            loadConversation();
            loadMessages();
            markAsRead();
        }
    }, [conversationId, user]);

    // Nouveau message reçu en temps réel
    useEffect(() => {
        if (lastMessage?.type === 'new_message') {
            const msg = lastMessage.message;
            if (msg.conversationId === conversationId) {
                setMessages(prev => [...prev, msg]);
                scrollToBottom();

                // Marquer comme lu si on est dans la conversation
                markAsRead();
            }
        }
    }, [lastMessage]);

    // Auto-scroll vers le bas
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const loadConversation = async () => {
        try {
            const response = await authFetch(`/messages/conversations/${user.id}`);
            if (response.ok) {
                const data = await response.json();
                const conv = data.conversations.find(c => c._id === conversationId);
                setConversation(conv);
            }
        } catch (error) {
            console.error('Error loading conversation:', error);
        }
    };

    const loadMessages = async () => {
        try {
            setLoading(true);
            const response = await authFetch(`/messages/messages/${conversationId}`);

            if (response.ok) {
                const data = await response.json();
                setMessages(data.messages);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async () => {
        try {
            await authFetch(`/messages/messages/${conversationId}/read`, {
                method: 'PATCH',
                body: JSON.stringify({ userId: user.id })
            });
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();

        if (!newMessage.trim() || sending) return;

        setSending(true);

        try {
            const response = await authFetch('/messages/messages', {
                method: 'POST',
                body: JSON.stringify({
                    conversationId,
                    senderId: user.id,
                    senderName: `${user.prenom} ${user.nom}`.trim() || user.email,
                    content: newMessage.trim()
                })
            });

            if (response.ok) {
                setNewMessage('');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Erreur lors de l\'envoi du message');
        } finally {
            setSending(false);
        }
    };

    const getOtherUser = () => {
        if (!conversation) return null;
        const otherUserId = conversation.participants.find(id => id !== user.id);
        return conversation.participantsInfo[otherUserId];
    };

    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatMessageDate = (date) => {
        const d = new Date(date);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (d.toDateString() === today.toDateString()) {
            return 'Aujourd\'hui';
        } else if (d.toDateString() === yesterday.toDateString()) {
            return 'Hier';
        } else {
            return d.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
            });
        }
    };

    // Grouper les messages par date
    const groupedMessages = messages.reduce((groups, message) => {
        const date = formatMessageDate(message.createdAt);
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(message);
        return groups;
    }, {});

    const otherUser = getOtherUser();

    return (
        <div className="conversation-container">
            {/* Header */}
            <div className="conversation-header">
                <button className="btn-back" onClick={() => navigate('/chat')}>
                    ← Retour
                </button>
                <div className="conversation-user-info">
                    <div className="conversation-avatar-small">
                        {otherUser?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="conversation-user-name">
                        {otherUser?.name || 'Utilisateur'}
                    </span>
                </div>
            </div>

            {/* Messages */}
            <div className="messages-area">
                {loading ? (
                    <div className="loading">Chargement...</div>
                ) : messages.length === 0 ? (
                    <div className="no-messages">
                        <p>Aucun message</p>
                        <p className="no-messages-subtitle">Envoyez le premier message !</p>
                    </div>
                ) : (
                    Object.entries(groupedMessages).map(([date, msgs]) => (
                        <div key={date}>
                            <div className="date-separator">
                                <span>{date}</span>
                            </div>
                            {msgs.map(message => (
                                <div
                                    key={message._id}
                                    className={`message ${message.senderId === user.id ? 'sent' : 'received'}`}
                                >
                                    <div className="message-content">
                                        <p>{message.content}</p>
                                        <span className="message-time">
                                            {formatTime(message.createdAt)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form className="message-input-area" onSubmit={handleSend}>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Écrivez un message..."
                    className="message-input"
                    disabled={sending}
                />
                <button
                    type="submit"
                    className="btn-send"
                    disabled={!newMessage.trim() || sending}
                >
                    {sending ? '...' : '➤'}
                </button>
            </form>
        </div>
    );
}

export default Conversation;