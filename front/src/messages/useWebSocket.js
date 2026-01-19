import { useEffect, useRef, useState } from 'react';

export function useWebSocket(user) {
    const ws = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState(null);
    const reconnectTimeout = useRef(null);

    useEffect(() => {
        if (!user?.id) return;

        const connect = () => {
            // WebSocket vers le service de messagerie via nginx
            ws.current = new WebSocket('ws://localhost:8080/messages/ws');

            ws.current.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);

                // Authentifier l'utilisateur
                ws.current.send(JSON.stringify({
                    type: 'auth',
                    userId: user.id,
                    userName: `${user.prenom} ${user.nom}`.trim() || user.email
                }));
            };

            ws.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('Message reçu:', data);
                    setLastMessage(data);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            };

            ws.current.onclose = () => {
                console.log('WebSocket disconnected');
                setIsConnected(false);

                // Reconnexion automatique après 3s
                reconnectTimeout.current = setTimeout(() => {
                    console.log('Tentative de reconnexion...');
                    connect();
                }, 3000);
            };

            ws.current.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        };

        connect();

        // Cleanup
        return () => {
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
            }
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [user]);

    return { isConnected, lastMessage, ws: ws.current };
}