import express from 'express';
import multer from 'multer';
import path from 'path';
import { getDB, ObjectId } from './db.js';
import rateLimit from 'express-rate-limit';
import fs from 'fs';

const router = express.Router();

// Configuration de multer pour l'upload d'images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/posts';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'post-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Seules les images sont autorisées'));
        }
    }
});

// Rate limiting
const postLimiter = rateLimit({
    windowMs: 60_000,
    max: 10,
    message: { error: 'Trop de posts, réessayez plus tard' }
});

// Helper pour extraire les tags d'un texte
function extractTags(content) {
    const tagRegex = /#(\w+)/g;
    const tags = [];
    let match;
    
    while ((match = tagRegex.exec(content)) !== null) {
        const tag = match[1].toLowerCase();
        if (!tags.includes(tag)) {
            tags.push(tag);
        }
    }
    
    return tags;
}

// GET / - Info
router.get('/', (req, res) => {
    res.json({ 
        message: 'Posts service API',
        database: 'postsdb',
        collections: {
            posts: 'Posts avec likes et tags',
            comments: 'Commentaires sur les posts',
            bookmarks: 'Posts enregistrés par utilisateur',
            interested: 'Utilisateurs intéressés par les posts'
        }
    });
});

// ==================== POSTS ====================

// GET /posts/feed - Feed de posts (tous ou abonnements)
router.get('/posts/feed', async (req, res) => {
    try {
        const db = getDB();
        const { limit = 20, page = 1, userId, followingOnly = 'false' } = req.query;
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        let query = {};
        
        // Si followingOnly=true, ne montrer que les posts des abonnements
        if (followingOnly === 'true' && userId) {
            // Récupérer les IDs des utilisateurs suivis depuis le service users
            try {
                const followingResponse = await fetch(`http://users:80/users/${userId}/following?limit=1000`);
                if (followingResponse.ok) {
                    const followingData = await followingResponse.json();
                    const followingIds = followingData.following.map(f => f.userId);
                    
                    if (followingIds.length === 0) {
                        // Pas d'abonnements, retourner vide
                        return res.json({
                            posts: [],
                            pagination: { total: 0, page: 1, limit: parseInt(limit), pages: 0 }
                        });
                    }
                    
                    query.authorId = { $in: followingIds };
                }
            } catch (error) {
                console.error('Error fetching following:', error);
            }
        }
        
        const posts = await db.collection('posts')
            .find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();
        
        // Enrichir les posts
        const enrichedPosts = await Promise.all(posts.map(async (post) => {
            const commentsCount = await db.collection('comments').countDocuments({ postId: post._id.toString() });
            
            let isLiked = false;
            let isBookmarked = false;
            let isInterested = false;
            
            if (userId) {
                isLiked = post.likes?.some(like => like.userId === userId) || false;
                const bookmark = await db.collection('bookmarks').findOne({ 
                    userId, 
                    postId: post._id.toString() 
                });
                isBookmarked = !!bookmark;
                const interested = await db.collection('interested').findOne({
                    userId,
                    postId: post._id.toString()
                });
                isInterested = !!interested;
            }
            
            return {
                ...post,
                likesCount: post.likes?.length || 0,
                commentsCount,
                isLiked,
                isBookmarked,
                isInterested
            };
        }));
        
        const total = await db.collection('posts').countDocuments(query);
        
        res.json({
            posts: enrichedPosts,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching feed:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du feed' });
    }
});

// GET /posts/tags/:tag - Posts par tag
router.get('/posts/tags/:tag', async (req, res) => {
    try {
        const db = getDB();
        const { tag } = req.params;
        const { limit = 20, page = 1, userId } = req.query;
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const posts = await db.collection('posts')
            .find({ tags: tag.toLowerCase() })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();
        
        // Enrichir les posts
        const enrichedPosts = await Promise.all(posts.map(async (post) => {
            const commentsCount = await db.collection('comments').countDocuments({ postId: post._id.toString() });
            
            let isLiked = false;
            let isBookmarked = false;
            let isInterested = false;
            
            if (userId) {
                isLiked = post.likes?.some(like => like.userId === userId) || false;
                const bookmark = await db.collection('bookmarks').findOne({ 
                    userId, 
                    postId: post._id.toString() 
                });
                isBookmarked = !!bookmark;
                const interested = await db.collection('interested').findOne({
                    userId,
                    postId: post._id.toString()
                });
                isInterested = !!interested;
            }
            
            return {
                ...post,
                likesCount: post.likes?.length || 0,
                commentsCount,
                isLiked,
                isBookmarked,
                isInterested
            };
        }));
        
        const total = await db.collection('posts').countDocuments({ tags: tag.toLowerCase() });
        
        res.json({
            tag: tag,
            posts: enrichedPosts,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching posts by tag:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des posts' });
    }
});

// GET /posts/:postId - Détails d'un post
router.get('/posts/:postId', async (req, res) => {
    try {
        const db = getDB();
        const { postId } = req.params;
        const { userId } = req.query;
        
        if (!ObjectId.isValid(postId)) {
            return res.status(400).json({ error: 'ID de post invalide' });
        }
        
        const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
        
        if (!post) {
            return res.status(404).json({ error: 'Post non trouvé' });
        }
        
        const commentsCount = await db.collection('comments').countDocuments({ postId });
        
        let isLiked = false;
        let isBookmarked = false;
        let isInterested = false;
        
        if (userId) {
            isLiked = post.likes?.some(like => like.userId === userId) || false;
            const bookmark = await db.collection('bookmarks').findOne({ userId, postId });
            isBookmarked = !!bookmark;
            const interested = await db.collection('interested').findOne({
                userId,
                postId: post._id.toString()
            });
            isInterested = !!interested;
        }
        
        res.json({
            ...post,
            likesCount: post.likes?.length || 0,
            commentsCount,
            isLiked,
            isBookmarked,
            isInterested
        });
    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du post' });
    }
});

// POST /posts - Créer un post
router.post('/posts', postLimiter, upload.single('image'), async (req, res) => {
    try {
        const db = getDB();
        const { authorId, authorName, content } = req.body;
        
        if (!authorId || !content) {
            return res.status(400).json({ error: 'authorId et content requis' });
        }
        
        // Extraire les tags du contenu
        const tags = extractTags(content);
        
        const newPost = {
            authorId,
            authorName: authorName || 'Anonyme',
            content,
            tags, // Tags extraits
            image: req.file ? `/uploads/posts/${req.file.filename}` : null,
            likes: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const result = await db.collection('posts').insertOne(newPost);
        
        res.status(201).json({
            message: 'Post créé',
            post: { ...newPost, _id: result.insertedId, likesCount: 0, commentsCount: 0 }
        });
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ error: 'Erreur lors de la création du post' });
    }
});

// PUT /posts/:postId - Modifier un post
router.put('/posts/:postId', async (req, res) => {
    try {
        const db = getDB();
        const { postId } = req.params;
        const { authorId, content } = req.body;
        
        if (!ObjectId.isValid(postId)) {
            return res.status(400).json({ error: 'ID de post invalide' });
        }
        
        const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
        
        if (!post) {
            return res.status(404).json({ error: 'Post non trouvé' });
        }
        
        if (post.authorId !== authorId) {
            return res.status(403).json({ error: 'Non autorisé' });
        }
        
        // Extraire les nouveaux tags
        const tags = extractTags(content);
        
        const result = await db.collection('posts').findOneAndUpdate(
            { _id: new ObjectId(postId) },
            { 
                $set: { 
                    content,
                    tags,
                    updatedAt: new Date()
                }
            },
            { returnDocument: 'after' }
        );
        
        res.json({
            message: 'Post mis à jour',
            post: result
        });
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du post' });
    }
});

// DELETE /posts/:postId - Supprimer un post
router.delete('/posts/:postId', async (req, res) => {
    try {
        const db = getDB();
        const { postId } = req.params;
        const { authorId } = req.query;
        
        if (!ObjectId.isValid(postId)) {
            return res.status(400).json({ error: 'ID de post invalide' });
        }
        
        const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
        
        if (!post) {
            return res.status(404).json({ error: 'Post non trouvé' });
        }
        
        if (post.authorId !== authorId) {
            return res.status(403).json({ error: 'Non autorisé' });
        }
        
        // Supprimer l'image si elle existe
        if (post.image) {
            const imagePath = post.image.replace('/uploads/', 'uploads/');
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
        
        await db.collection('posts').deleteOne({ _id: new ObjectId(postId) });
        await db.collection('comments').deleteMany({ postId });
        await db.collection('bookmarks').deleteMany({ postId });
        await db.collection('interested').deleteMany({ postId });
        
        res.json({ message: 'Post supprimé' });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression du post' });
    }
});

// ==================== LIKES ====================

// POST /posts/:postId/like - Liker un post
router.post('/posts/:postId/like', async (req, res) => {
    try {
        const db = getDB();
        const { postId } = req.params;
        const { userId, userName } = req.body;
        
        if (!ObjectId.isValid(postId)) {
            return res.status(400).json({ error: 'ID de post invalide' });
        }
        
        if (!userId) {
            return res.status(400).json({ error: 'userId requis' });
        }
        
        const post = await db.collection('posts').findOne({ _id: new ObjectId(postId) });
        
        if (!post) {
            return res.status(404).json({ error: 'Post non trouvé' });
        }
        
        const alreadyLiked = post.likes?.some(like => like.userId === userId);
        
        if (alreadyLiked) {
            return res.status(400).json({ error: 'Post déjà liké' });
        }
        
        const result = await db.collection('posts').findOneAndUpdate(
            { _id: new ObjectId(postId) },
            { 
                $push: { 
                    likes: { 
                        userId, 
                        userName: userName || 'Anonyme',
                        likedAt: new Date() 
                    }
                }
            },
            { returnDocument: 'after' }
        );
        
        res.json({
            message: 'Post liké',
            likesCount: result.likes?.length || 0
        });
    } catch (error) {
        console.error('Error liking post:', error);
        res.status(500).json({ error: 'Erreur lors du like' });
    }
});

// DELETE /posts/:postId/like - Unliker un post
router.delete('/posts/:postId/like', async (req, res) => {
    try {
        const db = getDB();
        const { postId } = req.params;
        const { userId } = req.query;
        
        if (!ObjectId.isValid(postId)) {
            return res.status(400).json({ error: 'ID de post invalide' });
        }
        
        if (!userId) {
            return res.status(400).json({ error: 'userId requis' });
        }
        
        const result = await db.collection('posts').findOneAndUpdate(
            { _id: new ObjectId(postId) },
            { 
                $pull: { 
                    likes: { userId }
                }
            },
            { returnDocument: 'after' }
        );
        
        if (!result) {
            return res.status(404).json({ error: 'Post non trouvé' });
        }
        
        res.json({
            message: 'Like retiré',
            likesCount: result.likes?.length || 0
        });
    } catch (error) {
        console.error('Error unliking post:', error);
        res.status(500).json({ error: 'Erreur lors du unlike' });
    }
});

// ==================== COMMENTS ====================

// GET /posts/:postId/comments - Commentaires d'un post
router.get('/posts/:postId/comments', async (req, res) => {
    try {
        const db = getDB();
        const { postId } = req.params;
        const { limit = 50, page = 1 } = req.query;
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const comments = await db.collection('comments')
            .find({ postId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();
        
        const total = await db.collection('comments').countDocuments({ postId });
        
        res.json({
            comments,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des commentaires' });
    }
});

// POST /posts/:postId/comments - Commenter un post
router.post('/posts/:postId/comments', async (req, res) => {
    try {
        const db = getDB();
        const { postId } = req.params;
        const { authorId, authorName, content } = req.body;
        
        if (!authorId || !content) {
            return res.status(400).json({ error: 'authorId et content requis' });
        }
        
        const newComment = {
            postId,
            authorId,
            authorName: authorName || 'Anonyme',
            content,
            createdAt: new Date()
        };
        
        const result = await db.collection('comments').insertOne(newComment);
        
        res.status(201).json({
            message: 'Commentaire ajouté',
            comment: { ...newComment, _id: result.insertedId }
        });
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({ error: 'Erreur lors de la création du commentaire' });
    }
});

// DELETE /comments/:commentId - Supprimer un commentaire
router.delete('/comments/:commentId', async (req, res) => {
    try {
        const db = getDB();
        const { commentId } = req.params;
        const { authorId } = req.query;
        
        if (!ObjectId.isValid(commentId)) {
            return res.status(400).json({ error: 'ID de commentaire invalide' });
        }
        
        const comment = await db.collection('comments').findOne({ _id: new ObjectId(commentId) });
        
        if (!comment) {
            return res.status(404).json({ error: 'Commentaire non trouvé' });
        }
        
        if (comment.authorId !== authorId) {
            return res.status(403).json({ error: 'Non autorisé' });
        }
        
        await db.collection('comments').deleteOne({ _id: new ObjectId(commentId) });
        
        res.json({ message: 'Commentaire supprimé' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression du commentaire' });
    }
});

// ==================== BOOKMARKS ====================

// GET /bookmarks - Posts enregistrés par un utilisateur
router.get('/bookmarks', async (req, res) => {
    try {
        const db = getDB();
        const { userId, limit = 20, page = 1 } = req.query;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId requis' });
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const bookmarks = await db.collection('bookmarks')
            .find({ userId })
            .sort({ savedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();
        
        const postIds = bookmarks.map(b => new ObjectId(b.postId));
        const posts = await db.collection('posts')
            .find({ _id: { $in: postIds } })
            .toArray();
        
        const enrichedPosts = await Promise.all(posts.map(async (post) => {
            const commentsCount = await db.collection('comments').countDocuments({ postId: post._id.toString() });
            const isLiked = post.likes?.some(like => like.userId === userId) || false;
            
            return {
                ...post,
                likesCount: post.likes?.length || 0,
                commentsCount,
                isLiked,
                isBookmarked: true,
                isInterested: await db.collection('interested').findOne({
                    userId,
                    postId: post._id.toString()
                }) ? true : false   
            };
        }));
        
        const total = await db.collection('bookmarks').countDocuments({ userId });
        
        res.json({
            posts: enrichedPosts,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching bookmarks:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des posts enregistrés' });
    }
});

// POST /bookmarks - Enregistrer un post
router.post('/bookmarks', async (req, res) => {
    try {
        const db = getDB();
        const { userId, postId } = req.body;
        
        if (!userId || !postId) {
            return res.status(400).json({ error: 'userId et postId requis' });
        }
        
        const existing = await db.collection('bookmarks').findOne({ userId, postId });
        
        if (existing) {
            return res.status(400).json({ error: 'Post déjà enregistré' });
        }
        
        const bookmark = {
            userId,
            postId,
            savedAt: new Date()
        };
        
        await db.collection('bookmarks').insertOne(bookmark);
        
        res.status(201).json({
            message: 'Post enregistré',
            bookmark
        });
    } catch (error) {
        console.error('Error saving bookmark:', error);
        res.status(500).json({ error: 'Erreur lors de l\'enregistrement du post' });
    }
});

// DELETE /bookmarks - Retirer un post enregistré
router.delete('/bookmarks', async (req, res) => {
    try {
        const db = getDB();
        const { userId, postId } = req.query;
        
        if (!userId || !postId) {
            return res.status(400).json({ error: 'userId et postId requis' });
        }
        
        const result = await db.collection('bookmarks').deleteOne({ userId, postId });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Bookmark non trouvé' });
        }
        
        res.json({ message: 'Post retiré des enregistrements' });
    } catch (error) {
        console.error('Error removing bookmark:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression du bookmark' });
    }
});

// GET /posts/user/:userId - Posts d'un utilisateur
router.get('/posts/user/:userId', async (req, res) => {
    try {
        const db = getDB();
        const { userId } = req.params;
        const { limit = 20, page = 1 } = req.query;
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const posts = await db.collection('posts')
            .find({ authorId: userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();
        
        const enrichedPosts = await Promise.all(posts.map(async (post) => {
            const commentsCount = await db.collection('comments').countDocuments({ postId: post._id.toString() });
            const isLiked = post.likes?.some(like => like.userId === userId) || false;
            
            return {
                ...post,
                likesCount: post.likes?.length || 0,
                commentsCount,
                isLiked
            };
        }));
        
        const total = await db.collection('posts').countDocuments({ authorId: userId });
        
        res.json({
            posts: enrichedPosts,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching user posts:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des posts' });
    }
});

// ==================== ROUTES INTÉRESSÉ ====================

// POST /posts/:postId/interested - Marquer comme intéressé
router.post('/posts/:postId/interested', async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId requis' });
        }

        const db = getDB();
        const postsCollection = db.collection('posts');
        const interestedCollection = db.collection('interested');

        // Vérifier si le post existe
        const post = await postsCollection.findOne({ _id: new ObjectId(postId) });
        if (!post) {
            return res.status(404).json({ error: 'Post non trouvé' });
        }

        // Vérifier si déjà intéressé
        const existing = await interestedCollection.findOne({ postId, userId });
        if (existing) {
            return res.status(409).json({ error: 'Déjà marqué comme intéressé' });
        }

        // Créer l'intérêt
        const newInterest = {
            postId,
            userId,
            createdAt: new Date()
        };

        await interestedCollection.insertOne(newInterest);

        // ← ENVOYER EMAIL si pas le propriétaire du post
        if (post.authorId !== userId) {
            const postOwner = await getUserInfo(post.authorId);
            const interestedUser = await getUserInfo(userId);

            if (postOwner && interestedUser) {
                const postOwnerName = `${postOwner.prenom} ${postOwner.nom}`.trim() || postOwner.email.split('@')[0];
                const interestedUserName = `${interestedUser.prenom} ${interestedUser.nom}`.trim() || interestedUser.email.split('@')[0];

                sendEmail({
                    type: 'post_interested',
                    email: postOwner.email,
                    name: postOwnerName,
                    userName: interestedUserName,
                    postContent: post.content.substring(0, 100)
                });
            }
        }

        res.status(201).json({ message: 'Marqué comme intéressé' });
    } catch (error) {
        console.error('Error marking interested:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE /posts/:postId/interested/:userId - Retirer l'intérêt
router.delete('/posts/:postId/interested/:userId', async (req, res) => {
    try {
        const { postId, userId } = req.params;

        const db = getDB();
        const interestedCollection = db.collection('interested');

        const result = await interestedCollection.deleteOne({ postId, userId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Intérêt non trouvé' });
        }

        res.json({ message: 'Intérêt retiré' });
    } catch (error) {
        console.error('Error removing interest:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /posts/:postId/interested - Liste des utilisateurs intéressés
router.get('/posts/:postId/interested', async (req, res) => {
    try {
        const { postId } = req.params;

        const db = getDB();
        const interestedCollection = db.collection('interested');

        const interests = await interestedCollection
            .find({ postId })
            .sort({ createdAt: -1 })
            .toArray();

        // Récupérer les infos des utilisateurs
        const userIds = interests.map(i => i.userId);
        const usersInfo = await Promise.all(
            userIds.map(userId => getUserInfo(userId))
        );

        const interestedUsers = usersInfo
            .filter(u => u !== null)
            .map((user, index) => ({
                ...user,
                interestedAt: interests[index].createdAt
            }));

        res.json({ interestedUsers });
    } catch (error) {
        console.error('Error fetching interested users:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /posts/interested/by-user/:userId - Posts où l'utilisateur est intéressé par ses propres posts
router.get('/posts/interested/by-user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const db = getDB();
        const postsCollection = db.collection('posts');
        const interestedCollection = db.collection('interested');

        // Récupérer les posts de l'utilisateur
        const userPosts = await postsCollection
            .find({ authorId: userId })
            .toArray();

        const postIds = userPosts.map(p => p._id.toString());

        // Récupérer tous les intéressés pour ces posts
        const interests = await interestedCollection
            .find({ postId: { $in: postIds } })
            .toArray();

        // Grouper par post
        const postInterests = {};
        for (const interest of interests) {
            if (!postInterests[interest.postId]) {
                postInterests[interest.postId] = [];
            }
            postInterests[interest.postId].push(interest);
        }

        // Récupérer les infos de tous les utilisateurs intéressés
        const allUserIds = [...new Set(interests.map(i => i.userId))];
        const usersInfo = await Promise.all(
            allUserIds.map(uid => getUserInfo(uid))
        );
        
        const usersMap = {};
        usersInfo.forEach(user => {
            if (user) {
                usersMap[user.userId] = user;
            }
        });

        // Construire la réponse avec posts + intéressés
        const postsWithInterested = userPosts.map(post => {
            const postId = post._id.toString();
            const postInterestsList = postInterests[postId] || [];
            
            const interestedUsers = postInterestsList.map(interest => ({
                ...usersMap[interest.userId],
                interestedAt: interest.createdAt
            })).filter(u => u.userId); // Enlever les nulls

            return {
                post,
                interestedUsers,
                interestedCount: interestedUsers.length
            };
        }).filter(p => p.interestedCount > 0); // Seulement les posts avec intéressés

        res.json({ postsWithInterested });
    } catch (error) {
        console.error('Error fetching posts with interested:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ==================== EMAILS SUR COMMENTAIRES ====================

// Modifier la route POST /posts/:postId/comments pour ajouter email
router.post('/posts/:postId/comments', async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId, userName, content } = req.body;

        if (!userId || !content) {
            return res.status(400).json({ error: 'userId et content requis' });
        }

        const db = getDB();
        const postsCollection = db.collection('posts');
        const commentsCollection = db.collection('comments');

        // Vérifier si le post existe
        const post = await postsCollection.findOne({ _id: new ObjectId(postId) });
        if (!post) {
            return res.status(404).json({ error: 'Post non trouvé' });
        }

        const newComment = {
            postId,
            userId,
            userName,
            content,
            createdAt: new Date()
        };

        await commentsCollection.insertOne(newComment);

        // Mettre à jour le compteur de commentaires
        await postsCollection.updateOne(
            { _id: new ObjectId(postId) },
            { $inc: { commentsCount: 1 } }
        );

        // ← ENVOYER EMAIL si pas le propriétaire du post
        if (post.authorId !== userId) {
            const postOwner = await getUserInfo(post.authorId);
            const commenter = await getUserInfo(userId);

            if (postOwner && commenter) {
                const postOwnerName = `${postOwner.prenom} ${postOwner.nom}`.trim() || postOwner.email.split('@')[0];
                const commenterName = `${commenter.prenom} ${commenter.nom}`.trim() || commenter.email.split('@')[0];

                sendEmail({
                    type: 'post_comment',
                    email: postOwner.email,
                    name: postOwnerName,
                    userName: commenterName,
                    postContent: post.content.substring(0, 100),
                    commentContent: content.substring(0, 100)
                });
            }
        }

        res.status(201).json({
            message: 'Commentaire ajouté',
            comment: newComment
        });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Erreur lors de l\'ajout du commentaire' });
    }
});

export default router;

// ==================== HELPER FUNCTIONS ====================

// Fonction pour récupérer les infos d'un utilisateur depuis le service users
async function getUserInfo(userId) {
    try {
        const response = await fetch(`http://users:80/users/${userId}`);
        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
        console.error('Error fetching user info:', error);
        return null;
    }
}

// Fonction pour envoyer un email via le service email
async function sendEmail({ type, email, name, userName, postContent, commentContent }) {
    try {
        const response = await fetch('http://email:80/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: email,
                type,
                data: { name, userName, postContent, commentContent }
            })
        });
        
        if (!response.ok) {
            console.error('Error sending email:', await response.text());
        }
    } catch (error) {
        console.error('Error sending email:', error);
    }
}