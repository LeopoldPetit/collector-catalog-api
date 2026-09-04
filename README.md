# collector-catalog-api

API métier du projet **Collector.shop**, construite avec **NestJS**. Gère les articles, les catégories et orchestre le contrôle automatique avant mise en vente.

## Rôle dans le projet

Cette API porte l'**US mère** du projet : *"Publication d'un article par un vendeur avec contrôle automatique avant mise en vente"*.

Flux principal :
1. Vendeur authentifié → `POST /articles` (titre, description, prix, frais de port, photos, catégorie) → statut `draft`
2. Publication d'un événement `article.submitted` sur RabbitMQ
3. Le [`collector-moderation-worker`](https://github.com/LeopoldPetit/collector-moderation-worker) applique les règles de contrôle et publie `article.validated` ou `article.rejected`
4. L'API consomme le résultat et met à jour le statut de l'article
5. `GET /articles?status=published` expose le catalogue public, sans authentification

## Stack

| Composant | Rôle |
|---|---|
| NestJS + TypeScript | Framework backend, DI, structure modulaire |
| PostgreSQL + Prisma | Persistance des articles, catégories, transactions |
| RabbitMQ | Publication/consommation des événements de contrôle |
| Keycloak (OIDC/OAuth2, JWT) | Authentification et autorisation (rôles acheteur/vendeur/admin) |
| Jest + Supertest | Tests unitaires et tests d'acceptation |
| Docker | Conteneurisation du service |

## Endpoints principaux

| Méthode | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/articles` | Crée un article (statut `draft`), publie `article.submitted` | Vendeur |
| `GET` | `/articles/:id` | Détail d'un article (reflète le statut après contrôle) | Vendeur |
| `GET` | `/articles?status=published` | Catalogue public des articles publiés | Public |

## Backlog (US concernées)

- **US1** — Authentification vendeur via Keycloak (JWT requis sur les endpoints protégés)
- **US2** — Publication d'un article + événement `article.submitted`
- **US4** — Mise à jour du statut après consommation du résultat de contrôle
- **US5** — Catalogue public sans authentification
- **US6** — Pipeline CI/CD (lint, tests, couverture, scan Trivy/npm audit)

## Démarrage local

Nécessite l'environnement de développement fourni par [`collector-infra`](https://github.com/LeopoldPetit/collector-infra) (PostgreSQL, RabbitMQ, Keycloak).

```bash
npm install
npx prisma migrate dev
npm run start:dev
```

## Tests

```bash
npm run test          # tests unitaires
npm run test:e2e       # tests d'acceptation (Supertest)
npm run test:cov       # couverture
```

## Documentation liée

Voir le repo [`collector-docs`](https://github.com/LeopoldPetit/collector-docs) pour le plan général, l'architecture détaillée et le backlog complet du projet.
