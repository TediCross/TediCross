FROM node:24.1-alpine3.20

RUN apk add --no-cache python3 g++ make

WORKDIR /opt/TediCross/

COPY . .

RUN npm install --omit=dev

VOLUME /opt/TediCross/data/

ENTRYPOINT ["/usr/local/bin/npm"]
CMD ["start", "--", "-c", "data/settings.yaml"]
