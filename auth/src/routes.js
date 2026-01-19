import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import amqp from 'amqplib';
import { getDB } from './db.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';
const USERS_SERVICE_URL = process.env.USERS_SERVICE_URL || 'http://users:80';
const RABBIT_URL = process.env.RABBIT_URL || 'amqp://rabbitmq';

// Connexion RabbitMQ avec retry
let channel = null;

async function connectRabbitMQ() {
    try {
        const connection = await amqp.connect(RABBIT_URL);
        channel = await connection.createChannel();
        await channel.assertQueue('emails.send', { durable: true });
        console.log('Auth service connected to RabbitMQ');
    } catch (error) {
        console.error('RabbitMQ connection error:', error);
        console.log('Retrying in 5 seconds...');
        // Retry automatique
        setTimeout(connectRabbitMQ, 5000);
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
    } else {
        console.log('Email not sent (RabbitMQ not connected yet):', emailData.type);
    }
}

// Middleware de simulation de latence
router.use(async (req, res, next) => {
    const latency = Math.floor(Math.random() * 500) + 100;
    await new Promise(resolve => setTimeout(resolve, latency));
    next();
});

router.get('/', (req, res) => {
    res.json({ message: 'Auth service API' });
});



router.post('/register', async (req, res) => {
    try {
        const { email, password, prenom, nom } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email et password requis' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
        }

        const db = getDB();
        const usersCollection = db.collection('users');

        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: 'Cet email est déjà utilisé' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            email,
            password: hashedPassword,
            prenom: prenom || '',
            nom: nom || '',
            createdAt: new Date()
        };

        const result = await usersCollection.insertOne(newUser);

        // Appeler le service users pour créer le profil complet
        try {
            await fetch(`${USERS_SERVICE_URL}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: result.insertedId.toString(),
                    email,
                    prenom: prenom || '',
                    nom: nom || ''
                })
            });
        } catch (userServiceError) {
            console.error('Error creating user profile:', userServiceError);
            // On continue même si le service users échoue
        }

        const token = jwt.sign(
            { 
                userId: result.insertedId,
                email: email 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Envoyer l'email de bienvenue
        const userName = `${prenom} ${nom}`.trim() || email.split('@')[0];
        sendEmail({
            type: 'welcome',
            email: email,
            name: userName
        });

        res.status(201).json({
            message: 'Utilisateur créé avec succès',
            token,
            user: {
                id: result.insertedId,
                email,
                prenom: prenom || '',
                nom: nom || ''
            }
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Erreur lors de la création du compte' });
    }
});


router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email et password requis' });
        }

        const db = getDB();
        const usersCollection = db.collection('users');

        const user = await usersCollection.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        const token = jwt.sign(
            { 
                userId: user._id,
                email: user.email 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
            message: 'Connexion réussie',
            token,
            user: {
                id: user._id,
                email: user.email,
                prenom: user.prenom || '',
                nom: user.nom || ''
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Erreur lors de la connexion' });
    }
});

router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email requis' });
        }

        const db = getDB();
        const usersCollection = db.collection('users');
        
        const user = await usersCollection.findOne({ email });
        
        if (!user) {
            return res.json({ 
                message: 'Si cet email existe, un lien de réinitialisation a été envoyé' 
            });
        }

        // Génére un token de réinitialisation
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = await bcrypt.hash(resetToken, 10);

        // Sauvegarder le token avec expiration (1 heure)
        await usersCollection.updateOne(
            { _id: user._id },
            {
                $set: {
                    resetToken: resetTokenHash,
                    resetTokenExpiry: new Date(Date.now() + 3600000)
                }
            }
        );

        const userName = `${user.prenom} ${user.nom}`.trim() || email.split('@')[0];
        sendEmail({
            type: 'password_reset',
            email: email,
            name: userName,
            resetToken: resetToken
        });

        res.json({ 
            message: 'Si cet email existe, un lien de réinitialisation a été envoyé' 
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});


router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token et nouveau mot de passe requis' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
        }

        const db = getDB();
        const usersCollection = db.collection('users');

        // Trouve un utilisateur avec un token non expiré
        const user = await usersCollection.findOne({
            resetToken: { $exists: true },
            resetTokenExpiry: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Token invalide ou expiré' });
        }

        // Vérifie le token
        const validToken = await bcrypt.compare(token, user.resetToken);
        if (!validToken) {
            return res.status(400).json({ error: 'Token invalide' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Mettre à jour et supprimer le token
        await usersCollection.updateOne(
            { _id: user._id },
            {
                $set: { password: hashedPassword },
                $unset: { resetToken: '', resetTokenExpiry: '' }
            }
        );

        res.json({ message: 'Mot de passe réinitialisé avec succès' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /auth/verify - Vérifie si un token est valide
router.get('/verify', authenticateToken, (req, res) => {
    res.json({
        valid: true,
        user: req.user
    });
});


// Route admin pour supprimer TOUS les comptes
router.delete('/admin/delete-all', async (req, res) => {
    try {
        const db = getDB();
        
        // Supprimer tous les comptes de authdb
        const usersResult = await db.collection('users').deleteMany({});
        
        console.log('Tous les comptes authdb supprimés:', usersResult.deletedCount);
        
        res.json({
            message: 'Tous les comptes supprimés',
            deleted: {
                users: usersResult.deletedCount
            }
        });
    } catch (error) {
        console.error('Error deleting all users:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
});

// Middleware d'authentification JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token manquant' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token invalide ou expiré' });
        }
        req.user = user;
        next();
    });
}

export default router;