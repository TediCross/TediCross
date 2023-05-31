FROM node:19-alpine

RUN apk add --no-cache python3 g++ make

WORKDIR /opt/TediCross/

COPY . .

RUN npm install --production

VOLUME /opt/TediCross/data/

ENTRYPOINT /usr/local/bin/npm start
CMD ["-c", "data/settings.yaml"]