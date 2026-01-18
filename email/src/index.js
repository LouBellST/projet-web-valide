const express = require('express');
const amqp = require('amqplib');
const SibApiV3Sdk = require('@sendinblue/client');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 80;

// Configuration
const RABBIT_URL = process.env.RABBIT_URL || 'amqp://rabbitmq';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'projetweb.noreply@gmail.com';
const FROM_NAME = process.env.FROM_NAME || 'Projet Web';

// Middleware
app.use(cors());
app.use(express.json());

// Configuration Brevo
let apiInstance;
if (BREVO_API_KEY) {
    apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, BREVO_API_KEY);
    console.log('Brevo API configured');
} else {
    console.warn('BREVO_API_KEY not set - emails will be logged only');
}

// Fonction d'envoi d'email
async function sendEmail({ to, subject, htmlContent, textContent }) {
    if (!apiInstance) {
        console.log('[DEV MODE] Email would be sent:');
        console.log(`   To: ${to}`);
        console.log(`   Subject: ${subject}`);
        console.log(`   Content: ${textContent || htmlContent}`);
        return { success: true, mode: 'dev' };
    }

    try {
        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
        sendSmtpEmail.sender = { email: FROM_EMAIL, name: FROM_NAME };
        sendSmtpEmail.to = [{ email: to }];
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = htmlContent;
        sendSmtpEmail.textContent = textContent;

        const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log(`Email sent to ${to}: ${subject}`);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
}

// Templates d'emails
const templates = {
    welcome: (name) => ({
        subject: 'Bienvenue !',
        htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Bienvenue ${name} !</h1>
                </div>
                <div style="padding: 30px; background: #f8f8f8;">
                    <p style="font-size: 16px; line-height: 1.6;">
                        Merci de vous être inscrit ! Votre compte a été créé avec succès.
                    </p>
                    <p style="font-size: 16px; line-height: 1.6;">
                        Vous pouvez maintenant vous connecter et commencer à utiliser l'application.
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.APP_URL || 'http://localhost:8080'}" 
                           style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                  color: white; 
                                  padding: 15px 30px; 
                                  text-decoration: none; 
                                  border-radius: 8px;
                                  display: inline-block;">
                            Accéder à l'application
                        </a>
                    </div>
                </div>
                <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                    <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
                </div>
            </div>
        `,
        textContent: `Bienvenue ${name} !\n\nMerci de vous être inscrit ! Votre compte a été créé avec succès.\n\nVous pouvez maintenant vous connecter et commencer à utiliser l'application.`
    }),

    passwordReset: (name, resetToken) => ({
        subject: 'Réinitialisation de mot de passe',
        htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Réinitialisation de mot de passe</h1>
                </div>
                <div style="padding: 30px; background: #f8f8f8;">
                    <p style="font-size: 16px; line-height: 1.6;">
                        Bonjour ${name},
                    </p>
                    <p style="font-size: 16px; line-height: 1.6;">
                        Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.APP_URL || 'http://localhost:8080'}/reset-password?token=${resetToken}" 
                           style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                  color: white; 
                                  padding: 15px 30px; 
                                  text-decoration: none; 
                                  border-radius: 8px;
                                  display: inline-block;">
                            Réinitialiser mon mot de passe
                        </a>
                    </div>
                    <p style="font-size: 14px; color: #666;">
                        Ce lien est valide pendant 1 heure.
                    </p>
                    <p style="font-size: 14px; color: #666;">
                        Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
                    </p>
                </div>
                <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                    <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
                </div>
            </div>
        `,
        textContent: `Bonjour ${name},\n\nVous avez demandé la réinitialisation de votre mot de passe.\n\nCliquez sur ce lien : ${process.env.APP_URL}/reset-password?token=${resetToken}\n\nCe lien est valide pendant 1 heure.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet email.`
    }),

    newMessage: (name, senderName) => ({
        subject: `Nouveau message de ${senderName}`,
        htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Nouveau message !</h1>
                </div>
                <div style="padding: 30px; background: #f8f8f8;">
                    <p style="font-size: 16px; line-height: 1.6;">
                        Bonjour ${name},
                    </p>
                    <p style="font-size: 16px; line-height: 1.6;">
                        <strong>${senderName}</strong> vous a envoyé un nouveau message.
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.APP_URL || 'http://localhost:8080'}/chat" 
                           style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                  color: white; 
                                  padding: 15px 30px; 
                                  text-decoration: none; 
                                  border-radius: 8px;
                                  display: inline-block;">
                            Voir le message
                        </a>
                    </div>
                </div>
                <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                    <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
                </div>
            </div>
        `,
        textContent: `Bonjour ${name},\n\n${senderName} vous a envoyé un nouveau message.\n\nConnectez-vous pour le lire : ${process.env.APP_URL}/chat`
    }),

    newFollower: (name, followerName) => ({
        subject: `${followerName} vous suit maintenant !`,
        htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Nouvel abonné !</h1>
                </div>
                <div style="padding: 30px; background: #f8f8f8;">
                    <p style="font-size: 16px; line-height: 1.6;">
                        Bonjour ${name},
                    </p>
                    <p style="font-size: 16px; line-height: 1.6;">
                        <strong>${followerName}</strong> a commencé à vous suivre !
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.APP_URL || 'http://localhost:8080'}/profile" 
                           style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                  color: white; 
                                  padding: 15px 30px; 
                                  text-decoration: none; 
                                  border-radius: 8px;
                                  display: inline-block;">
                            Voir mon profil
                        </a>
                    </div>
                </div>
                <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                    <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
                </div>
            </div>
        `,
        textContent: `Bonjour ${name},\n\n${followerName} a commencé à vous suivre !\n\nVoir votre profil : ${process.env.APP_URL}/profile`
    })
};

// ==================== RABBITMQ CONSUMER ====================

let channel = null;
let connection = null;

async function connectRabbitMQ() {
    try {
        connection = await amqp.connect(RABBIT_URL);
        channel = await connection.createChannel();

        // Queue pour les emails
        const emailQueue = 'emails.send';
        await channel.assertQueue(emailQueue, { durable: true });

        console.log('Connected to RabbitMQ');
        console.log(`Listening for emails on queue: ${emailQueue}`);

        // Consommer les messages
        channel.consume(emailQueue, async (msg) => {
            if (msg !== null) {
                try {
                    const emailData = JSON.parse(msg.content.toString());
                    console.log(`Received email request: ${emailData.type}`);

                    let emailTemplate;
                    switch (emailData.type) {
                        case 'welcome':
                            emailTemplate = templates.welcome(emailData.name);
                            break;
                        case 'password_reset':
                            emailTemplate = templates.passwordReset(emailData.name, emailData.resetToken);
                            break;
                        case 'new_message':
                            emailTemplate = templates.newMessage(emailData.name, emailData.senderName);
                            break;
                        case 'new_follower':
                            emailTemplate = templates.newFollower(emailData.name, emailData.followerName);
                            break;
                        default:
                            throw new Error(`Unknown email type: ${emailData.type}`);
                    }

                    await sendEmail({
                        to: emailData.email,
                        subject: emailTemplate.subject,
                        htmlContent: emailTemplate.htmlContent,
                        textContent: emailTemplate.textContent
                    });

                    channel.ack(msg);
                } catch (error) {
                    console.error('Error processing email:', error);
                    // Rejeter le message (il sera mis en dead letter si configuré)
                    channel.nack(msg, false, false);
                }
            }
        });
    } catch (error) {
        console.error('Error connecting to RabbitMQ:', error);
        // Retry après 5 secondes
        setTimeout(connectRabbitMQ, 5000);
    }
}

// Démarrer la connexion RabbitMQ
connectRabbitMQ();

// ==================== API REST ====================

// Envoyer un email directement (pour tests ou usage synchrone)
app.post('/send', async (req, res) => {
    try {
        const { to, type, data } = req.body;

        if (!to || !type) {
            return res.status(400).json({ error: 'to and type are required' });
        }

        let emailTemplate;
        switch (type) {
            case 'welcome':
                emailTemplate = templates.welcome(data.name);
                break;
            case 'password_reset':
                emailTemplate = templates.passwordReset(data.name, data.resetToken);
                break;
            case 'new_message':
                emailTemplate = templates.newMessage(data.name, data.senderName);
                break;
            case 'new_follower':
                emailTemplate = templates.newFollower(data.name, data.followerName);
                break;
            default:
                return res.status(400).json({ error: 'Invalid email type' });
        }

        const result = await sendEmail({
            to,
            subject: emailTemplate.subject,
            htmlContent: emailTemplate.htmlContent,
            textContent: emailTemplate.textContent
        });

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Error in /send:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'email',
        brevo: apiInstance ? 'configured' : 'dev-mode',
        rabbitmq: channel ? 'connected' : 'disconnected'
    });
});

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`Email service listening on port ${PORT}`);
});

// Gestion propre de l'arrêt
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing connections...');
    if (channel) await channel.close();
    if (connection) await connection.close();
    process.exit(0);
});