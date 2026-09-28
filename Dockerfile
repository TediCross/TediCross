FROM node:24-alpine

RUN apk add --no-cache python3 g++ make

WORKDIR /opt/TediCross/

COPY . .

RUN npm install --omit=dev

VOLUME /opt/TediCross/data/

ENTRYPOINT ["node", "dist/main.js"]
CMD ["-c", "data/settings.yaml"]
