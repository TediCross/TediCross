FROM node:10-alpine

WORKDIR /opt/TediCross/

RUN chown node:node /opt/TediCross/

USER node
COPY --chown=node . .

RUN npm install --production

VOLUME /opt/TediCross/data/

ENTRYPOINT /usr/local/bin/npm start -- -c data/settings.yaml
