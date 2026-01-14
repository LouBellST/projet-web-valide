import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDB } from './db.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

// Middleware de simulation de latence (comme dans users service)
router.use(async (req, res, next) => {
    const latency = Math.floor(Math.random() * 500) + 100;
    await new Promise(resolve => setTimeout(resolve, latency));
    next();
});

router.get('/', (req, res) => {
    res.json({ message: 'Auth service API' });
});

// POST /auth/register
router.post('/register', async (req, res) => {
    try {
        const { email, password, prenom, nom } = req.body;

        // Validation basique
        if (!email || !password) {
            return res.status(400).json({ error: 'Email et password requis' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
        }

        const db = getDB();
        const usersCollection = db.collection('users');

        // Vérifier si l'utilisateur existe déjà
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: 'Cet email est déjà utilisé' });
        }

        // Hasher le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // Créer l'utilisateur
        const newUser = {
            email,
            password: hashedPassword,
            prenom: prenom || '',
            nom: nom || '',
            createdAt: new Date()
        };

        const result = await usersCollection.insertOne(newUser);

        // Générer un token JWT
        const token = jwt.sign(
            { 
                userId: result.insertedId,
                email: email 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

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

// POST /auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation basique
        if (!email || !password) {
            return res.status(400).json({ error: 'Email et password requis' });
        }

        const db = getDB();
        const usersCollection = db.collection('users');

        // Trouver l'utilisateur
        const user = await usersCollection.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        // Vérifier le mot de passe
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        // Générer un token JWT
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

// GET /auth/verify - Vérifier si un token est valide
router.get('/verify', authenticateToken, (req, res) => {
    res.json({
        valid: true,
        user: req.user
    });
});

// Middleware d'authentification JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

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