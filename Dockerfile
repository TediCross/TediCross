FROM node:10-alpine

WORKDIR /opt/TediCross/

ADD . .

RUN npm install --production

VOLUME /opt/TediCross/data/

ENTRYPOINT /usr/local/bin/npm start -- -c data/settings.yaml
