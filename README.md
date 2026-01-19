# Projet Web - Réseau Social - Prestations entre étudiants (basé Microservices)

Application de réseau social complète basée sur une architecture microservices avec messagerie temps réel, système de posts avec tags, et notifications email asynchrones.


## Technologies

### Backend
- **Node.js** + **Express** - Framework serveur
- **MongoDB** - Base de données NoSQL
- **Redis** - Cache et pub/sub pour messagerie temps réel
- **RabbitMQ** - Queue de messages pour emails asynchrones
- **JWT** - Authentification sécurisée
- **Nginx** - Reverse proxy

### Frontend
- **React** + **Vite** - Interface utilisateur moderne
- **React Router** - Navigation
- **WebSocket** - Communication temps réel

### Services externes
- **Brevo (SendinBlue)** - Envoi d'emails transactionnels

### Microservices

| Service | Port | Description |
|---------|------|-------------|
| **Front** | 5173 | Interface React |
| **Auth** | 3000 | Authentification JWT |
| **Users** | 3001 | Profils & relations sociales |
| **Posts** | 3002 | Posts, likes, commentaires, intéressés |
| **Messages** | 3005 | Messagerie temps réel |
| **Email** | 3006 | Notifications email |
| **Nginx** | 8080 | Reverse proxy |

### Infrastructure

| Service | Port | Description |
|---------|------|-------------|
| **MongoDB** | 27017 | Base de données |
| **Redis** | 6379 | Cache & pub/sub |
| **RabbitMQ** | 5672, 15672 | Queue & interface admin |

## Prérequis

- **Docker** >= 20.10
- **Docker Compose** >= 2.0
- **Git**
- Compte **Brevo** (optionnel, pour emails réels)

## 🔧 Installation

### 1. Cloner le repository

```bash
git clone https://github.com/LouBellST/projet-web-valide.git
cd projet-web-valide
```

### 2. Configuration des variables d'environnement

Créer un fichier `.env` à la racine du projet :

```bash
# la clé pour notre projet : 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

# Email service
SENDINBLUE_API_KEY=clé_api_brevo
```

Créer un fichier `.env` dans /email :

```bash
# Email service 
BREVO_API_KEY=clé_api_brevo
```

> **Note:** Sans clé API Brevo, les emails seront affichés dans les logs (mode développement).

### 3. Lancer l'application

```bash
# Construire et démarrer tous les services
docker-compose -f docker-compose.dev.yml up --build


# Ou en arrière-plan
docker-compose -f docker-compose.dev.yml up -d --build
```

### 4. Vérifier que tous les services sont actifs

```bash
docker-compose ps
```

Tous les services doivent afficher `Up` ou `healthy`.

## Utilisation

### Accès à l'application

| Interface | URL | Description |
|-----------|-----|-------------|
| **Application** | http://localhost:8080 | Interface utilisateur React |
| **API Documentation** | http://localhost:8080/api-docs | Documentation Swagger interactive |
| **RabbitMQ Admin** | http://localhost:15672 | Interface admin RabbitMQ (guest/guest) |

## Documentation API

### Accéder à Swagger UI

**URL:** http://localhost:8080/api-docs

Interface interactive pour tester tous les endpoints de l'API avec :
- Description détaillée de chaque route
- Paramètres requis/optionnels
- Exemples de requêtes/réponses
- Codes d'erreur
- Test en direct depuis le navigateur

### Authentification

La plupart des endpoints nécessitent un token JWT :

1. **Obtenir un token :**
   ```bash
   curl -X POST http://localhost:8080/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "user@example.com", "password": "password123"}'
   ```

2. **Utiliser le token :**
   ```bash
   curl http://localhost:8080/posts/posts/feed?userId=xxx \
     -H "Authorization: Bearer VOTRE_TOKEN"
   ```

### Exemples de requêtes

#### Créer un post
```bash
curl -X POST http://localhost:8080/posts/posts \
  -H "Authorization: Bearer TOKEN" \
  -F "authorId=USER_ID" \
  -F "authorName=John Doe" \
  -F "content=Mon premier post #test" \
  -F "image=@photo.jpg"
```

#### Rechercher des utilisateurs
```bash
curl "http://localhost:8080/users/search?q=jean" \
  -H "Authorization: Bearer TOKEN"
```

## Services

### Auth Service
- Inscription avec email de bienvenue
- Connexion JWT
- Réinitialisation mot de passe par email
- Validation des tokens

### Users Service
- Profils utilisateurs (nom, prenom, photo, etc.)
- Système follow/followers
- Recherche d'utilisateurs
- Statistiques

### Posts Service
- Création de posts avec images
- Extraction automatique des #hashtags
- Likes, commentaires, bookmarks
- **Système "Intéressé"** avec notifications email
- Feed personnalisé (tous ou abonnements)
- Recherche par tags

### Messages Service
- Messagerie temps réel (WebSocket + Redis pub/sub)
- Conversations privées
- Messages non lus
- Emails de notification (si inactif > 1h)

### Email Service
- Queue asynchrone (RabbitMQ)
- Templates HTML professionnels
- Types d'emails :
  - Bienvenue
  - Réinitialisation mot de passe
  - Nouveau message
  - Nouveau follower
  - **Quelqu'un est intéressé par votre post**
  - **Nouveau commentaire**

## Structure du projet

```
projet-web/
├── auth/                    # Service authentification
│   ├── src/
│   │   ├── index.js        # Point d'entrée
│   │   ├── routes.js       # Routes API
│   │   └── db.js           # Connexion MongoDB
│   └── Dockerfile.dev
├── users/                   # Service utilisateurs
│   ├── src/
│   │   ├── index.js
│   │   ├── routes.js
│   │   └── db.js
│   └── uploads/            # Photos de profil
├── posts/                   # Service posts
│   ├── src/
│   │   ├── index.js
│   │   ├── routes.js       # Routes posts, likes, commentaires, intéressés
│   │   └── db.js
│   └── uploads/            # Images de posts
├── messages/                # Service messagerie
│   ├── src/
│   │   ├── index.js        # WebSocket + Redis pub/sub
│   │   ├── routes.js
│   │   └── db.js
├── email/                   # Service email
│   ├── src/
│   │   └── index.js        # Consumer RabbitMQ + Brevo
│   └── Dockerfile.dev
├── front/                   # Frontend React
│   ├── src/
│   │   ├── pages/          # Pages (Feed, Profile, Chat, etc.)
│   │   ├── components/     # Composants réutilisables
│   │   ├── styles/         # CSS
│   │   └── auth/           # Contexte authentification
│   └── Dockerfile.dev
├── reverse-proxy/           # Nginx
│   └── nginx.conf.dev
├── docker-compose.yml       # Orchestration services
├── swagger.yaml             # Documentation API OpenAPI
└── README.md               # This file
```

## 🛠️ Développement

### Logs des services

```bash
# Tous les services
docker-compose logs -f

# Service spécifique
docker-compose logs -f posts
docker-compose logs -f email
docker-compose logs -f messages
```

### Redémarrer un service

```bash
docker-compose restart posts
```

### Reconstruire un service

```bash
docker-compose up -d --build posts
```

### Accéder à un container

```bash
docker exec -it projet-web-posts sh
```

### Nettoyer tout

```bash
# Arrêter et supprimer tout
docker-compose down -v

# Rebuild complet
docker-compose up --build
```

## Monitoring

### RabbitMQ Management UI
- **URL:** http://localhost:15672
- **User:** guest
- **Password:** guest
- Visualiser les queues, messages, connexions

### MongoDB
```bash
# Accéder à MongoDB
docker exec -it projet-web-mongo mongosh

# Utiliser une DB
use postsdb
db.posts.find().pretty()
```

### Redis
```bash
# Accéder à Redis CLI
docker exec -it projet-web-redis redis-cli

# Voir les channels pub/sub
PUBSUB CHANNELS user:*
```

## Troubleshooting

### Les services ne démarrent pas
```bash
# Vérifier les logs
docker-compose logs

# Reconstruire
docker-compose down -v
docker-compose up --build
```

### Emails non envoyés
- Vérifier que RabbitMQ est actif : http://localhost:15672
- Vérifier les logs du service email : `docker-compose logs email`
- En dev sans clé Brevo, les emails apparaissent dans les logs

### WebSocket ne se connecte pas
- Vérifier que Redis est actif
- Vérifier les logs du service messages
- Vérifier la configuration nginx pour `/messages/`

### MongoDB erreurs de connexion
```bash
# Vérifier que MongoDB est actif
docker-compose ps mongodb

# Recréer le volume
docker-compose down -v
docker-compose up mongodb
```


**Autres**

Pour toute question, consulter la documentation Swagger : http://localhost:8080/api-docs