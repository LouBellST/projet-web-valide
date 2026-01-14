import express from 'express';
import morgan from 'morgan';
import router from './routes.js';
import { connectRedis } from "./redisClient.js";

const app = express();

app.use(morgan('dev'));
app.use(express.json());
app.use(router);

const PORT = 80;
async function startServer() {
  await connectRedis();

  app.listen(PORT, async () => {
    console.log('Groups service running…');
});
}

startServer().catch((err) => {
  console.error("Erreur au démarrage du serveur :", err);
  process.exit(1);
});
