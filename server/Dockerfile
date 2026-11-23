# Construit depuis la racine du dépôt : docker build -f server/Dockerfile .
# Le serveur réutilise le moteur du jeu (src/) pour rejouer et vérifier les parties.
FROM node:22-alpine
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev && npm i --no-save tsx
COPY src ./src
COPY server ./server
WORKDIR /app/server
ENV NODE_ENV=production PORT=2567
EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:2567/health || exit 1
CMD ["npx", "tsx", "src/index.ts"]
