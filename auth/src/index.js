import express from 'express';
import morgan from 'morgan';
import router from './routes.js';
import { connectDB } from './db.js';

const app = express();

app.use(morgan('dev'));
app.use(express.json());
app.use(router);

const PORT = 80;
app.listen(PORT, async () => {
    console.log('Auth service running…');
    await connectDB();
});