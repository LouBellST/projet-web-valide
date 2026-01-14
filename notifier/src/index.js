import express from 'express';
import amqp from 'amqplib';
import morgan from 'morgan';

const app = express();

app.use(morgan('dev'));
app.use(express.json());

const PORT = 80;
const RABBIT_URL = process.env.RABBIT_URL;
const RABBIT_EXCHANGE = process.env.RABBIT_EXCHANGE;

// Variables pour stocker les stats en mémoire
let stats = { hits: 0, misses: 0 };

// --- RABBITMQ : Consommation des messages ---
async function startRabbit() {
  try {
    const connection = await amqp.connect(RABBIT_URL);
    const channel = await connection.createChannel();

    await channel.assertExchange(RABBIT_EXCHANGE, 'fanout', { durable: false });

    // On crée une queue pour ce service
    const q = await channel.assertQueue('', { exclusive: true });
    await channel.bindQueue(q.queue, RABBIT_EXCHANGE, '');

    console.log("Notifier en attente de messages...");

    channel.consume(q.queue, (msg) => {
      if (msg.content) {
        const event = JSON.parse(msg.content.toString());

        // Mise à jour des stats selon le type d'événement
        if (event.type === 'cache.hit') stats.hits++;
        if (event.type === 'cache.miss') stats.misses++;

        console.log("Stats mises à jour:", stats);
      }
    }, { noAck: true });
  } catch (err) {
    console.error("Impossible de se connecter à RabbitMQ, nouvelle tentative dans 5s...");
    setTimeout(startRabbit, 5000);
  }
}

// --- SSE : Envoi vers le Dashboard ---
app.get('/events', (req, res) => {
  // 1. Ouverture SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // Flush immédiat des headers pour établir la connexion
  res.flushHeaders();

  // Envoyer les stats toutes les 1 secondes
  const interval = setInterval(() => {
    const total = stats.hits + stats.misses;
    const missRate = total > 0 ? (stats.misses / total) * 100 : 0;

    const data = {
      type: 'cache.stats',
      ...stats,
      total,
      missRate: missRate.toFixed(2)
    };

    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }, 1000);

  req.on('close', () => clearInterval(interval));
});


async function startServer() {
  app.listen(PORT, () => {
    console.log(`Notifier service running…`);
    startRabbit().catch(console.error);
  });
}

startServer().catch((err) => {
  console.error("Erreur au démarrage du serveur :", err);
  process.exit(1);
});