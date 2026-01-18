const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const redis = require('redis');
const { MongoClient, ObjectId } = require('mongodb');
const amqp = require('amqplib');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configuration
const PORT = process.env.PORT || 3005;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017';
const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const RABBIT_URL = process.env.RABBIT_URL || 'amqp://rabbitmq';
const USERS_SERVICE_URL = process.env.USERS_SERVICE_URL || 'http://users:80';

// Middleware
app.use(cors());
app.use(express.json());

// Connexion MongoDB
let db;
let conversationsCollection;
let messagesCollection;
let userActivityCollection;

MongoClient.connect(MONGO_URI, { useUnifiedTopology: true })
    .then(client => {
        console.log('Connected to MongoDB');
        db = client.db('messagesdb');
        conversationsCollection = db.collection('conversations');
        messagesCollection = db.collection('messages');
        userActivityCollection = db.collection('user_activity');

        // Créer les index
        conversationsCollection.createIndex({ participants: 1 });
        conversationsCollection.createIndex({ lastMessageAt: -1 });
        messagesCollection.createIndex({ conversationId: 1, createdAt: -1 });
        userActivityCollection.createIndex({ userId: 1 });
    })
    .catch(err => console.error('MongoDB connection error:', err));

// Connexion Redis pour pub/sub
const redisPublisher = redis.createClient({
    socket: {
        host: REDIS_HOST,
        port: REDIS_PORT
    }
});

const redisSubscriber = redis.createClient({
    socket: {
        host: REDIS_HOST,
        port: REDIS_PORT
    }
});

const redisCache = redis.createClient({
    socket: {
        host: REDIS_HOST,
        port: REDIS_PORT
    }
});

Promise.all([
    redisPublisher.connect(),
    redisSubscriber.connect(),
    redisCache.connect()
]).then(() => {
    console.log('Connected to Redis');
}).catch(err => {
    console.error('Redis connection error:', err);
});

// Connexion RabbitMQ pour emails
let channel = null;

async function connectRabbitMQ() {
    try {
        const connection = await amqp.connect(RABBIT_URL);
        channel = await connection.createChannel();
        await channel.assertQueue('emails.send', { durable: true });
        console.log('Messages service connected to RabbitMQ');
    } catch (error) {
        console.error('RabbitMQ connection error:', error);
        console.log('Emails will not be sent');
    }
}

connectRabbitMQ();

// Fonction pour envoyer un email
function sendEmail(emailData) {
    if (channel) {
        try {
            channel.sendToQueue(
                'emails.send',
                Buffer.from(JSON.stringify(emailData)),
                { persistent: true }
            );
            console.log(`Email queued: ${emailData.type} to ${emailData.email}`);
        } catch (error) {
            console.error('Error queueing email:', error);
        }
    }
}

// Map des connexions WebSocket par userId
const connectedUsers = new Map();

// WebSocket - Gestion des connexions
wss.on('connection', (ws, req) => {
    console.log('📱 New WebSocket connection');

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'auth') {
                // Authentification de l'utilisateur
                ws.userId = data.userId;
                ws.userName = data.userName;
                connectedUsers.set(data.userId, ws);
                console.log(`User ${data.userName} (${data.userId}) authenticated`);

                // ← NOUVEAU : Mettre à jour l'activité de l'utilisateur
                await userActivityCollection.updateOne(
                    { userId: data.userId },
                    { 
                        $set: { 
                            lastActivity: new Date(),
                            online: true
                        } 
                    },
                    { upsert: true }
                );

                // S'abonner au canal Redis de l'utilisateur
                await redisSubscriber.subscribe(`user:${data.userId}`, (message) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(message);
                    }
                });

                // Envoyer confirmation
                ws.send(JSON.stringify({
                    type: 'auth_success',
                    userId: data.userId
                }));
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

    ws.on('close', async () => {
        if (ws.userId) {
            connectedUsers.delete(ws.userId);
            console.log(`User ${ws.userId} disconnected`);

            // ← NOUVEAU : Marquer comme hors ligne
            try {
                await userActivityCollection.updateOne(
                    { userId: ws.userId },
                    { 
                        $set: { 
                            lastActivity: new Date(),
                            online: false
                        } 
                    }
                );
            } catch (error) {
                console.error('Error updating user activity:', error);
            }
        }
    });
});

// ← NOUVEAU : Fonction pour vérifier si l'utilisateur est inactif
async function isUserInactive(userId) {
    try {
        const activity = await userActivityCollection.findOne({ userId });
        
        // Si pas d'activité enregistrée, considérer comme inactif
        if (!activity) return true;
        
        // Si en ligne, ne pas envoyer d'email
        if (activity.online) return false;
        
        // Vérifier si inactif depuis plus d'1 heure
        const oneHourAgo = new Date(Date.now() - 3600000);
        return activity.lastActivity < oneHourAgo;
    } catch (error) {
        console.error('Error checking user activity:', error);
        return true; // En cas d'erreur, envoyer l'email par sécurité
    }
}

// ==================== ROUTES API ====================

// Créer ou obtenir une conversation
app.post('/conversations', async (req, res) => {
    try {
        const { userId1, userId2, user1Name, user2Name } = req.body;

        if (!userId1 || !userId2) {
            return res.status(400).json({ error: 'userId1 et userId2 requis' });
        }

        // Vérifier si une conversation existe déjà
        const existingConversation = await conversationsCollection.findOne({
            participants: { $all: [userId1, userId2] }
        });

        if (existingConversation) {
            return res.json({ conversation: existingConversation });
        }

        // Créer une nouvelle conversation
        const conversation = {
            participants: [userId1, userId2],
            participantsInfo: {
                [userId1]: { name: user1Name },
                [userId2]: { name: user2Name }
            },
            createdAt: new Date(),
            lastMessageAt: new Date(),
            lastMessage: null
        };

        const result = await conversationsCollection.insertOne(conversation);
        conversation._id = result.insertedId;

        res.json({ conversation });
    } catch (error) {
        console.error('Error creating conversation:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Obtenir toutes les conversations d'un utilisateur
app.get('/conversations/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const conversations = await conversationsCollection
            .find({ participants: userId })
            .sort({ lastMessageAt: -1 })
            .toArray();

        // Enrichir avec le nombre de messages non lus
        const enrichedConversations = await Promise.all(
            conversations.map(async (conv) => {
                const unreadCount = await messagesCollection.countDocuments({
                    conversationId: conv._id.toString(),
                    senderId: { $ne: userId },
                    read: false
                });

                return {
                    ...conv,
                    unreadCount
                };
            })
        );

        res.json({ conversations: enrichedConversations });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Envoyer un message
app.post('/messages', async (req, res) => {
    try {
        const { conversationId, senderId, senderName, content } = req.body;

        if (!conversationId || !senderId || !content) {
            return res.status(400).json({ error: 'conversationId, senderId et content requis' });
        }

        // Créer le message
        const message = {
            conversationId,
            senderId,
            senderName,
            content,
            createdAt: new Date(),
            read: false
        };

        const result = await messagesCollection.insertOne(message);
        message._id = result.insertedId;

        // Mettre à jour la conversation
        await conversationsCollection.updateOne(
            { _id: new ObjectId(conversationId) },
            {
                $set: {
                    lastMessage: content,
                    lastMessageAt: new Date()
                }
            }
        );

        // Trouver le destinataire
        const conversation = await conversationsCollection.findOne({
            _id: new ObjectId(conversationId)
        });

        const recipientId = conversation.participants.find(id => id !== senderId);

        // Publier le message via Redis pub/sub
        const messageData = JSON.stringify({
            type: 'new_message',
            message: {
                ...message,
                _id: message._id.toString()
            }
        });

        await redisPublisher.publish(`user:${recipientId}`, messageData);
        await redisPublisher.publish(`user:${senderId}`, messageData);

        // ← NOUVEAU : Envoyer email SEULEMENT si l'utilisateur est inactif depuis 1h
        const inactive = await isUserInactive(recipientId);
        
        if (inactive) {
            console.log(`User ${recipientId} is inactive, sending email notification`);
            
            // Récupérer les infos du destinataire
            try {
                const userResponse = await fetch(`${USERS_SERVICE_URL}/users/${recipientId}`);
                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    const recipientName = `${userData.prenom} ${userData.nom}`.trim() || userData.email.split('@')[0];
                    
                    sendEmail({
                        type: 'new_message',
                        email: userData.email,
                        name: recipientName,
                        senderName: senderName
                    });
                }
            } catch (error) {
                console.error('Error fetching user data for email:', error);
            }
        } else {
            console.log(`User ${recipientId} is active, skipping email notification`);
        }

        res.json({ message });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Obtenir les messages d'une conversation
app.get('/messages/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const skip = parseInt(req.query.skip) || 0;

        const messages = await messagesCollection
            .find({ conversationId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

        // Inverser pour avoir l'ordre chronologique
        messages.reverse();

        res.json({ messages });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Marquer les messages comme lus
app.patch('/messages/:conversationId/read', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { userId } = req.body;

        await messagesCollection.updateMany(
            {
                conversationId,
                senderId: { $ne: userId },
                read: false
            },
            {
                $set: { read: true }
            }
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Supprimer une conversation
app.delete('/conversations/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;

        // Supprimer tous les messages
        await messagesCollection.deleteMany({ conversationId });

        // Supprimer la conversation
        await conversationsCollection.deleteOne({ _id: new ObjectId(conversationId) });

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting conversation:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'messages',
        mongodb: db ? 'connected' : 'disconnected',
        redis: redisPublisher.isReady ? 'connected' : 'disconnected',
        rabbitmq: channel ? 'connected' : 'disconnected',
        websocket: {
            clients: wss.clients.size,
            authenticated: connectedUsers.size
        }
    });
});

// Démarrer le serveur
server.listen(PORT, () => {
    console.log(`Messages service listening on port ${PORT}`);
    console.log(`WebSocket server ready`);
});

// Gestion des erreurs
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing connections...');
    await redisPublisher.quit();
    await redisSubscriber.quit();
    await redisCache.quit();
    if (channel) await channel.close();
    process.exit(0);
});