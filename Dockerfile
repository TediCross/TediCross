FROM node:24-alpine AS build

RUN apk add --no-cache python3 g++ make

WORKDIR /opt/TediCross

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /opt/TediCross

COPY --from=build --chown=node:node /opt/TediCross/package.json ./
COPY --from=build --chown=node:node /opt/TediCross/node_modules ./node_modules
COPY --from=build --chown=node:node /opt/TediCross/dist ./dist
RUN mkdir -p /opt/TediCross/data && chown node:node /opt/TediCross/data

VOLUME /opt/TediCross/data/
USER node

ENTRYPOINT ["node", "dist/main.js"]
CMD ["-c", "data/settings.yaml"]
