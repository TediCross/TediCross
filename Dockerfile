FROM node:10-alpine

WORKDIR /opt/TediCross/

COPY . .

RUN npm install --production

RUN adduser -S tedicross
USER tedicross

VOLUME /opt/TediCross/data/

ENTRYPOINT /usr/local/bin/npm start -- -c data/settings.yaml
