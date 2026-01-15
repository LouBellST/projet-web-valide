import express from 'express';
import multer from 'multer';
import path from 'path';
import { getDB, ObjectId } from './db.js';
import rateLimit from 'express-rate-limit';
import fs from 'fs';

const router = express.Router();

// Configuration de multer pour l'upload de photos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/profile-pictures';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Seules les images sont autorisées (jpeg, jpg, png, gif, webp)'));
        }
    }
});

// Rate limiting
const userDetailLimiter = rateLimit({
    windowMs: 60_000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' }
});

// Middleware de simulation de latence
router.use(async (req, res, next) => {
    const latency = Math.floor(Math.random() * 300) + 100;
    await new Promise(resolve => setTimeout(resolve, latency));
    next();
});

// GET / - Info sur le service
router.get('/', (req, res) => {
    res.json({ 
        message: 'Users service API',
        database: 'usersdb (collection: profiles)',
        endpoints: {
            'GET /users': 'Liste tous les profils utilisateurs',
            'GET /users/:userId': 'Détails d\'un profil utilisateur',
            'POST /users': 'Créer un profil utilisateur',
            'PUT /users/:userId': 'Mettre à jour un profil',
            'PATCH /users/:userId/profile': 'Mettre à jour partiellement le profil',
            'POST /users/:userId/photo': 'Upload photo de profil',
            'DELETE /users/:userId': 'Supprimer un profil',
            'GET /users/email/:email': 'Trouver un profil par email',
            'POST /users/:userId/follow': 'Suivre un utilisateur',
            'DELETE /users/:userId/follow': 'Ne plus suivre un utilisateur',
            'GET /users/:userId/following': 'Liste des abonnements',
            'GET /users/:userId/followers': 'Liste des abonnés'
        }
    });
});

// GET /users - Liste tous les profils
router.get('/users', async (req, res) => {
    try {
        const db = getDB();
        const { limit = 50, page = 1, search } = req.query;
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        let query = {};
        if (search) {
            query = {
                $or: [
                    { email: { $regex: search, $options: 'i' } },
                    { prenom: { $regex: search, $options: 'i' } },
                    { nom: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const profiles = await db.collection('profiles')
            .find(query)
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 })
            .toArray();

        const total = await db.collection('profiles').countDocuments(query);

        res.json({
            users: profiles,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
    }
});

// GET /users/:userId - Détails d'un profil
router.get('/users/:userId', userDetailLimiter, async (req, res) => {
    try {
        const db = getDB();
        const { userId } = req.params;
        const { currentUserId } = req.query;

        const profile = await db.collection('profiles').findOne({ userId });

        if (!profile) {
            return res.status(404).json({ error: 'Profil utilisateur non trouvé' });
        }

        // Ajouter les stats de follow
        const followersCount = await db.collection('follows').countDocuments({ followingId: userId });
        const followingCount = await db.collection('follows').countDocuments({ followerId: userId });
        
        // Vérifier si l'utilisateur courant suit ce profil
        let isFollowing = false;
        if (currentUserId && currentUserId !== userId) {
            const follow = await db.collection('follows').findOne({
                followerId: currentUserId,
                followingId: userId
            });
            isFollowing = !!follow;
        }

        res.json({
            ...profile,
            followersCount,
            followingCount,
            isFollowing
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
    }
});

// GET /users/email/:email - Trouver un profil par email
router.get('/users/email/:email', async (req, res) => {
    try {
        const db = getDB();
        const { email } = req.params;

        const profile = await db.collection('profiles').findOne({ email });

        if (!profile) {
            return res.status(404).json({ error: 'Profil utilisateur non trouvé' });
        }

        res.json(profile);
    } catch (error) {
        console.error('Error fetching user by email:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
    }
});

// POST /users - Créer un profil utilisateur (appelé par le service auth lors de l'inscription)
router.post('/users', async (req, res) => {
    try {
        const db = getDB();
        const { userId, email, prenom, nom } = req.body;

        if (!userId || !email) {
            return res.status(400).json({ error: 'userId et email requis' });
        }

        // Vérifier si le profil existe déjà
        const existingProfile = await db.collection('profiles').findOne({ userId });
        if (existingProfile) {
            return res.status(409).json({ error: 'Ce profil existe déjà' });
        }

        // Créer le profil utilisateur
        const newProfile = {
            userId,
            email,
            prenom: prenom || '',
            nom: nom || '',
            telephone: '',
            adressePostale: '',
            photo: null,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection('profiles').insertOne(newProfile);

        res.status(201).json({
            message: 'Profil utilisateur créé',
            profile: { ...newProfile, _id: result.insertedId }
        });
    } catch (error) {
        console.error('Error creating profile:', error);
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Ce profil existe déjà' });
        }
        res.status(500).json({ error: 'Erreur lors de la création du profil' });
    }
});

// PUT /users/:userId - Mettre à jour un profil (complet)
router.put('/users/:userId', async (req, res) => {
    try {
        const db = getDB();
        const { userId } = req.params;
        const { prenom, nom, email, telephone, adressePostale } = req.body;

        const updateData = {
            updatedAt: new Date()
        };

        if (prenom !== undefined) updateData.prenom = prenom;
        if (nom !== undefined) updateData.nom = nom;
        if (email !== undefined) updateData.email = email;
        if (telephone !== undefined) updateData.telephone = telephone;
        if (adressePostale !== undefined) updateData.adressePostale = adressePostale;

        const result = await db.collection('profiles').findOneAndUpdate(
            { userId },
            { $set: updateData },
            { returnDocument: 'after' }
        );

        if (!result) {
            return res.status(404).json({ error: 'Profil utilisateur non trouvé' });
        }

        res.json({
            message: 'Profil mis à jour',
            profile: result
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
    }
});

// PATCH /users/:userId/profile - Mettre à jour partiellement le profil
router.patch('/users/:userId/profile', async (req, res) => {
    try {
        const db = getDB();
        const { userId } = req.params;
        const updates = req.body;

        // Filtrer les champs autorisés
        const allowedFields = ['prenom', 'nom', 'telephone', 'adressePostale'];
        const updateData = {};
        
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                updateData[field] = updates[field];
            }
        });

        updateData.updatedAt = new Date();

        const result = await db.collection('profiles').findOneAndUpdate(
            { userId },
            { $set: updateData },
            { returnDocument: 'after' }
        );

        if (!result) {
            return res.status(404).json({ error: 'Profil utilisateur non trouvé' });
        }

        res.json({
            message: 'Profil mis à jour',
            profile: result
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
    }
});

// POST /users/:userId/photo - Upload photo de profil
router.post('/users/:userId/photo', upload.single('photo'), async (req, res) => {
    try {
        const db = getDB();
        const { userId } = req.params;

        if (!req.file) {
            return res.status(400).json({ error: 'Aucune photo fournie' });
        }

        // Récupérer l'ancienne photo pour la supprimer
        const profile = await db.collection('profiles').findOne({ userId });
        if (profile && profile.photo) {
            const oldPhotoPath = profile.photo.replace('/uploads/', 'uploads/');
            if (fs.existsSync(oldPhotoPath)) {
                fs.unlinkSync(oldPhotoPath);
            }
        }

        const photoUrl = `/uploads/profile-pictures/${req.file.filename}`;

        const result = await db.collection('profiles').findOneAndUpdate(
            { userId },
            { 
                $set: { 
                    photo: photoUrl,
                    updatedAt: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            return res.status(404).json({ error: 'Profil utilisateur non trouvé' });
        }

        res.json({
            message: 'Photo de profil mise à jour',
            photo: photoUrl,
            profile: result
        });
    } catch (error) {
        console.error('Error uploading photo:', error);
        res.status(500).json({ error: 'Erreur lors de l\'upload de la photo' });
    }
});

// DELETE /users/:userId - Supprimer un profil
router.delete('/users/:userId', async (req, res) => {
    try {
        const db = getDB();
        const { userId } = req.params;

        // Récupérer le profil pour supprimer sa photo
        const profile = await db.collection('profiles').findOne({ userId });
        if (profile && profile.photo) {
            const photoPath = profile.photo.replace('/uploads/', 'uploads/');
            if (fs.existsSync(photoPath)) {
                fs.unlinkSync(photoPath);
            }
        }

        const result = await db.collection('profiles').deleteOne({ userId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Profil utilisateur non trouvé' });
        }

        // Supprimer aussi les relations de follow
        await db.collection('follows').deleteMany({
            $or: [
                { followerId: userId },
                { followingId: userId }
            ]
        });

        res.json({ message: 'Profil utilisateur supprimé' });
    } catch (error) {
        console.error('Error deleting profile:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression du profil' });
    }
});

// GET /users/:userId/stats - Statistiques d'un profil
router.get('/users/:userId/stats', async (req, res) => {
    try {
        const db = getDB();
        const { userId } = req.params;

        const profile = await db.collection('profiles').findOne({ userId });

        if (!profile) {
            return res.status(404).json({ error: 'Profil utilisateur non trouvé' });
        }

        const followersCount = await db.collection('follows').countDocuments({ followingId: userId });
        const followingCount = await db.collection('follows').countDocuments({ followerId: userId });

        const stats = {
            profileCompleteness: calculateProfileCompleteness(profile),
            accountAge: Math.floor((new Date() - new Date(profile.createdAt)) / (1000 * 60 * 60 * 24)),
            lastUpdate: profile.updatedAt,
            followersCount,
            followingCount
        };

        res.json(stats);
    } catch (error) {
        console.error('Error fetching profile stats:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
    }
});

// ==================== FOLLOW SYSTEM ====================

// POST /users/:userId/follow - Suivre un utilisateur
router.post('/users/:userId/follow', async (req, res) => {
    try {
        const db = getDB();
        const { userId } = req.params; // Utilisateur à suivre (followingId)
        const { followerId } = req.body; // Utilisateur qui suit

        if (!followerId) {
            return res.status(400).json({ error: 'followerId requis' });
        }

        if (followerId === userId) {
            return res.status(400).json({ error: 'Vous ne pouvez pas vous suivre vous-même' });
        }

        // Vérifier que les deux profils existent
        const followerProfile = await db.collection('profiles').findOne({ userId: followerId });
        const followingProfile = await db.collection('profiles').findOne({ userId });

        if (!followerProfile || !followingProfile) {
            return res.status(404).json({ error: 'Profil non trouvé' });
        }

        // Vérifier si déjà suivi
        const existingFollow = await db.collection('follows').findOne({
            followerId,
            followingId: userId
        });

        if (existingFollow) {
            return res.status(400).json({ error: 'Vous suivez déjà cet utilisateur' });
        }

        // Créer le follow
        const follow = {
            followerId,
            followerName: `${followerProfile.prenom} ${followerProfile.nom}`.trim() || followerProfile.email,
            followerPhoto: followerProfile.photo,
            followingId: userId,
            followingName: `${followingProfile.prenom} ${followingProfile.nom}`.trim() || followingProfile.email,
            followingPhoto: followingProfile.photo,
            followedAt: new Date()
        };

        await db.collection('follows').insertOne(follow);

        res.status(201).json({
            message: 'Utilisateur suivi',
            follow
        });
    } catch (error) {
        console.error('Error following user:', error);
        res.status(500).json({ error: 'Erreur lors du suivi' });
    }
});

// DELETE /users/:userId/follow - Ne plus suivre un utilisateur
router.delete('/users/:userId/follow', async (req, res) => {
    try {
        const db = getDB();
        const { userId } = req.params; // Utilisateur à ne plus suivre
        const { followerId } = req.query; // Utilisateur qui arrête de suivre

        if (!followerId) {
            return res.status(400).json({ error: 'followerId requis' });
        }

        const result = await db.collection('follows').deleteOne({
            followerId,
            followingId: userId
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Relation de suivi non trouvée' });
        }

        res.json({ message: 'Ne suit plus cet utilisateur' });
    } catch (error) {
        console.error('Error unfollowing user:', error);
        res.status(500).json({ error: 'Erreur lors de l\'arrêt du suivi' });
    }
});

// GET /users/:userId/following - Liste des abonnements (utilisateurs suivis)
router.get('/users/:userId/following', async (req, res) => {
    try {
        const db = getDB();
        const { userId } = req.params;
        const { limit = 100, page = 1 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const following = await db.collection('follows')
            .find({ followerId: userId })
            .sort({ followedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();

        const total = await db.collection('follows').countDocuments({ followerId: userId });

        // Enrichir avec les profils
        const enrichedFollowing = following.map(f => ({
            userId: f.followingId,
            name: f.followingName,
            photo: f.followingPhoto,
            followedAt: f.followedAt
        }));

        res.json({
            following: enrichedFollowing,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching following:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des abonnements' });
    }
});

// GET /users/:userId/followers - Liste des abonnés (utilisateurs qui suivent)
router.get('/users/:userId/followers', async (req, res) => {
    try {
        const db = getDB();
        const { userId } = req.params;
        const { limit = 100, page = 1 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const followers = await db.collection('follows')
            .find({ followingId: userId })
            .sort({ followedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();

        const total = await db.collection('follows').countDocuments({ followingId: userId });

        // Enrichir avec les profils
        const enrichedFollowers = followers.map(f => ({
            userId: f.followerId,
            name: f.followerName,
            photo: f.followerPhoto,
            followedAt: f.followedAt
        }));

        res.json({
            followers: enrichedFollowers,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching followers:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des abonnés' });
    }
});

// Route admin pour supprimer TOUS les profils
router.delete('/users/admin/delete-all', async (req, res) => {
    try {
        const db = getDB();
        const result = await db.collection('profiles').deleteMany({});
        
        console.log('Profils supprimés:', result.deletedCount);
        
        // Supprimer aussi tous les follows
        await db.collection('follows').deleteMany({});
        
        res.json({
            message: 'Tous les profils supprimés',
            deleted: { profiles: result.deletedCount }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
});

// Fonction helper pour calculer le pourcentage de complétion du profil
function calculateProfileCompleteness(profile) {
    const fields = ['email', 'prenom', 'nom', 'telephone', 'adressePostale', 'photo'];
    const filledFields = fields.filter(field => profile[field] && profile[field] !== '').length;
    return Math.round((filledFields / fields.length) * 100);
}

export default router;