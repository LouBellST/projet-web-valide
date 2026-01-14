import express from 'express';
import users from './users.js';
import rateLimit from 'express-rate-limit';

const userDetailLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const router = express.Router();

router.use(async (req, res, next) => {
    const latency = Math.floor(Math.random() * 1000) + 300;
    await new Promise(resolve => setTimeout(resolve, latency));
    next();
});

router.get('/', (req, res) => res.send('Simple user API!'));
router.get('/users', users.getUsers);
router.get('/users/:uuid', userDetailLimiter, users.getUser);

export default router;
