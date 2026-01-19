import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import amqp from 'amqplib';
import { getDB } from './db.js';

const router = express.Router();
const RABBIT_URL = process.env.RABBIT_URL || 'amqp://rabbitmq';

// Connexion RabbitMQ
let channel = null;

async function connectRabbitMQ() {
    try {
        const connection = await amqp.connect(RABBIT_URL);
        channel = await connection.createChannel();
        await channel.assertQueue('emails.send', { durable: true });
        console.log('Users service connected to RabbitMQ');
    } catch (error) {
        console.error('RabbitMQ connection error:', error);
        console.log('Retrying in 5 seconds...');
        setTimeout(connectRabbitMQ, 5000);
    }
}

connectRabbitMQ();

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

// Configuration Multer pour upload photos
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = './uploads';
        try {
            await fs.mkdir(uploadDir, { recursive: true });
        } catch (err) {
            console.error('Error creating upload directory:', err);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'photo-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

router.get('/', (req, res) => {
    res.json({ message: 'Users service API' });
});



router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length < 2) {
            return res.json({ users: [] });
        }

        const db = getDB();
        const profilesCollection = db.collection('profiles');

        // regex pour recherche insensible à la casse
        const searchRegex = new RegExp(q, 'i');

        const users = await profilesCollection.find({
            $or: [
                { email: searchRegex },
                { prenom: searchRegex },
                { nom: searchRegex }
            ]
        })
        .limit(10)
        .toArray();

        res.json({ users });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Erreur lors de la recherche' });
    }
});


//  Récupérer tous les utilisateurs
router.get('/users', async (req, res) => {
    try {
        const db = getDB();
        const profilesCollection = db.collection('profiles');

        const limit = parseInt(req.query.limit) || 100;
        const users = await profilesCollection.find({}).limit(limit).toArray();

        res.json({ users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
    }
});

// Créer un profil utilisateur
router.post('/users', async (req, res) => {
    try {
        const { userId, email, prenom, nom } = req.body;

        if (!userId || !email) {
            return res.status(400).json({ error: 'userId et email requis' });
        }

        const db = getDB();
        const profilesCollection = db.collection('profiles');

        const existingProfile = await profilesCollection.findOne({ userId });
        if (existingProfile) {
            return res.status(409).json({ error: 'Profil déjà existant' });
        }

        const newProfile = {
            userId,
            email,
            prenom: prenom || '',
            nom: nom || '',
            bio: '',
            photo: null,
            isPrivate: false,
            createdAt: new Date()
        };

        await profilesCollection.insertOne(newProfile);

        res.status(201).json({
            message: 'Profil créé avec succès',
            profile: newProfile
        });
    } catch (error) {
        console.error('Error creating profile:', error);
        res.status(500).json({ error: 'Erreur lors de la création du profil' });
    }
});

// Récupérer un profil
router.get('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { currentUserId } = req.query;

        const db = getDB();
        const profilesCollection = db.collection('profiles');
        const followsCollection = db.collection('follows');

        const profile = await profilesCollection.findOne({ userId });

        if (!profile) {
            return res.status(404).json({ error: 'Profil non trouvé' });
        }

        // recup les stats
        const followersCount = await followsCollection.countDocuments({ userId });
        const followingCount = await followsCollection.countDocuments({ followerId: userId });

        let isFollowing = false;
        if (currentUserId) {
            const follow = await followsCollection.findOne({ userId, followerId: currentUserId });
            isFollowing = !!follow;
        }

        res.json({
            ...profile,
            followersCount,
            followingCount,
            isFollowing
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
    }
});

// Mettre à jour un profil
router.patch('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { prenom, nom, bio, isPrivate } = req.body;

        const db = getDB();
        const profilesCollection = db.collection('profiles');

        const updateData = {};
        if (prenom !== undefined) updateData.prenom = prenom;
        if (nom !== undefined) updateData.nom = nom;
        if (bio !== undefined) updateData.bio = bio;
        if (isPrivate !== undefined) updateData.isPrivate = isPrivate;

        const result = await profilesCollection.updateOne(
            { userId },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Profil non trouvé' });
        }

        const updatedProfile = await profilesCollection.findOne({ userId });

        res.json({
            message: 'Profil mis à jour avec succès',
            profile: updatedProfile
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
    }
});

// Upload photo de profil
router.post('/users/:userId/photo', upload.single('photo'), async (req, res) => {
    try {
        const { userId } = req.params;

        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier uploadé' });
        }

        const photoUrl = `/users/uploads/${req.file.filename}`;

        const db = getDB();
        const profilesCollection = db.collection('profiles');

        const result = await profilesCollection.updateOne(
            { userId },
            { $set: { photo: photoUrl } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Profil non trouvé' });
        }

        res.json({
            message: 'Photo uploadée avec succès',
            photoUrl
        });
    } catch (error) {
        console.error('Error uploading photo:', error);
        res.status(500).json({ error: 'Erreur lors de l\'upload de la photo' });
    }
});

// Servir les photos
router.get('/uploads/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const filepath = path.join(process.cwd(), 'uploads', filename);

        await fs.access(filepath);
        res.sendFile(filepath);
    } catch (error) {
        res.status(404).json({ error: 'Photo non trouvée' });
    }
});

// Suivre un utilisateur
router.post('/users/:userId/follow', async (req, res) => {
    try {
        const { userId } = req.params;
        const { followerId } = req.body;

        if (!followerId) {
            return res.status(400).json({ error: 'followerId requis' });
        }

        if (userId === followerId) {
            return res.status(400).json({ error: 'Impossible de se suivre soi-même' });
        }

        const db = getDB();
        const followsCollection = db.collection('follows');

        const existingFollow = await followsCollection.findOne({ userId, followerId });
        if (existingFollow) {
            return res.status(409).json({ error: 'Déjà suivi' });
        }

        const newFollow = {
            userId,
            followerId,
            createdAt: new Date()
        };

        await followsCollection.insertOne(newFollow);

        // Envoyer email de notification
        const profilesCollection = db.collection('profiles');
        const followerProfile = await profilesCollection.findOne({ userId: followerId });
        const followedProfile = await profilesCollection.findOne({ userId });

        if (followedProfile && followerProfile) {
            const followerName = `${followerProfile.prenom} ${followerProfile.nom}`.trim() || followerProfile.email.split('@')[0];
            const followedName = `${followedProfile.prenom} ${followedProfile.nom}`.trim() || followedProfile.email.split('@')[0];

            sendEmail({
                type: 'new_follower',
                email: followedProfile.email,
                name: followedName,
                followerName: followerName
            });
        }

        res.status(201).json({ message: 'Utilisateur suivi avec succès' });
    } catch (error) {
        console.error('Error following user:', error);
        res.status(500).json({ error: 'Erreur lors du suivi' });
    }
});

// Ne plus suivre
router.delete('/users/:userId/follow', async (req, res) => {
    try {
        const { userId } = req.params;
        const { followerId } = req.query;

        if (!followerId) {
            return res.status(400).json({ error: 'followerId requis' });
        }

        const db = getDB();
        const followsCollection = db.collection('follows');

        const result = await followsCollection.deleteOne({ userId, followerId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Relation de suivi non trouvée' });
        }

        res.json({ message: 'Ne suit plus cet utilisateur' });
    } catch (error) {
        console.error('Error unfollowing user:', error);
        res.status(500).json({ error: 'Erreur lors de l\'unfollow' });
    }
});

// Liste des followers
router.get('/users/:userId/followers', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 50, page = 1 } = req.query;

        const db = getDB();
        const followsCollection = db.collection('follows');
        const profilesCollection = db.collection('profiles');

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const follows = await followsCollection
            .find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();

        const followerIds = follows.map(f => f.followerId);

        const followers = await profilesCollection.find({
            userId: { $in: followerIds }
        }).toArray();

        // Combiner les données
        const followersWithDate = followers.map(follower => {
            const follow = follows.find(f => f.followerId === follower.userId);
            return {
                ...follower,
                followedAt: follow.createdAt
            };
        });

        const total = await followsCollection.countDocuments({ userId });

        res.json({
            followers: followersWithDate,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching followers:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des followers' });
    }
});

// Liste des suivis
router.get('/users/:userId/following', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 50, page = 1 } = req.query;

        const db = getDB();
        const followsCollection = db.collection('follows');
        const profilesCollection = db.collection('profiles');

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const follows = await followsCollection
            .find({ followerId: userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();

        const followingIds = follows.map(f => f.userId);

        const following = await profilesCollection.find({
            userId: { $in: followingIds }
        }).toArray();

        // Combiner les données
        const followingWithDate = following.map(followedUser => {
            const follow = follows.find(f => f.userId === followedUser.userId);
            return {
                ...followedUser,
                followedAt: follow.createdAt
            };
        });

        const total = await followsCollection.countDocuments({ followerId: userId });

        res.json({
            following: followingWithDate,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching following:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des suivis' });
    }
});

// stats d'un utilisateur
router.get('/users/:userId/stats', async (req, res) => {
    try {
        const { userId } = req.params;

        const db = getDB();
        const followsCollection = db.collection('follows');

        const followersCount = await followsCollection.countDocuments({ userId });
        const followingCount = await followsCollection.countDocuments({ followerId: userId });

        res.json({
            followers: followersCount,
            following: followingCount
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des stats' });
    }
});

export default router;