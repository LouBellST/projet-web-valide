import express from 'express';
import { listGroups, getGroup, findGroupById } from './groups.js';
import { redis } from "./redisClient.js";
import { publishEvent } from './events.js';

const router = express.Router();

router.get('/', (req, res) => res.send('Simple group API!'));
router.get('/groups', listGroups);
router.get('/groups/:id', getGroup);
router.get('/groups/:id/stream', async (req, res) => {
    const groupId = req.params.id;
    // 0. Récupérer le groupe
    const group = await findGroupById(groupId);
    if (!group) {
        res.status(404).end();
        return;
    }

    // 1. Ouverture SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Flush immédiat des headers pour établir la connexion
    res.flushHeaders();

    // 2. Fonction utilitaire pour envoyer un événement SSE
    function sendEvent(eventName, data) {
        res.write(`event: ${eventName}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    }

    // I. pour chaque membre:
    /// récupère l’utilisateur(fetchUser),
    /// met à jour un compteur,
    /// envoie event: progress avec { percent, fetched, total };

    // Initialisation des compteurs
    const total = group.listUserIds.length;
    let completed = 0;

    // 3. Récupération des membres
    const promises = group.listUserIds.map(async (memberId) => {
        const start = Date.now();

        try {
            // Avant de récupérer l'utilisateur vérifier dans le cache :
            let user;
            const cacheKey = `user:${memberId}`; // Clé unique pour Redis

            // A. Vérification du Cache (HIT)
            const cachedUser = await redis.get(cacheKey);

            if (cachedUser) {
                console.log(`CACHE HIT user:${memberId}`, Date.now() - start, 'ms');
                user = JSON.parse(cachedUser);
                publishEvent('cache.hit', { cacheKey });
            } else {
                // Récupère l'utilisateur
                // B. Si pas en cache (MISS) -> Appel HTTP
                publishEvent('cache.miss', { cacheKey });

                const response = await fetch('http://users/users/' + memberId);
                if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

                user = await response.json();

                await redis.set(cacheKey, JSON.stringify(user), { EX: 120 });
            }

            // Mise à jour de la progression
            completed++;
            const percent = Math.round((completed / total) * 100);

            // Envoi de l'événement 'progress'
            sendEvent('progress', { percent, fetched: completed, total });

            return user; // Retourne l'user enrichi pour le tableau final
        } catch (error) {
            console.error(`Erreur fetch user ${memberId}`, error);
            completed++;

            // On envoie quand même un event progress même en cas d'erreur pour ne pas bloquer l'UI
            const percent = Math.round((completed / total) * 100);
            sendEvent('progress', { percent, fetched: completed, total });
            return { uuid: memberId, error: "Non trouvé" };
        }
    });

    // Attente de toutes les résolutions
    const results = await Promise.all(promises);

    // II. à la fin, envoie event: 'complete' avec les membres enrichis.
    // 4. Envoi final
    sendEvent('complete', {
        id: group.id,
        name: group.name,
        members: results
    });
})

export default router;
