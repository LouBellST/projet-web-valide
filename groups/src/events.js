import amqp from 'amqplib';

const RABBIT_URL = process.env.RABBIT_URL;
const RABBIT_EXCHANGE = process.env.RABBIT_EXCHANGE;

let channelPromise;

async function getChannel() {
  if (channelPromise) return channelPromise;
  channelPromise = (async () => {
    const connection = await amqp.connect(RABBIT_URL);
    const channel = await connection.createChannel();
    await channel.assertExchange(RABBIT_EXCHANGE, 'fanout', { durable: false });
    return channel;
  })();
  return channelPromise;
}

export async function publishEvent(type, payload = {}) {
  const channel = await getChannel();
  const message = { type, payload, timestamp: new Date().toISOString() };
  channel.publish(RABBIT_EXCHANGE, '', Buffer.from(JSON.stringify(message)), {
    contentType: 'application/json'
  });
}