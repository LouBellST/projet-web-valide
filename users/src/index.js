import express from 'express';
import morgan from 'morgan';
import router from './routes.js';
import { seedUsers } from './users.js';

const app = express();

app.use(morgan('dev'));
app.use(express.json());
app.use(router);

const PORT = 80;
app.listen(PORT, async () => {
    console.log('Users service running…');
    await seedUsers(); // génération dès le démarrage
});
