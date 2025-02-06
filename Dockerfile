FROM node:22.9-alpine3.20

RUN apk add --no-cache python3 g++ make

WORKDIR /opt/TediCross/

COPY . .

RUN npm install --omit=dev



ENTRYPOINT ["/usr/local/bin/npm"]
CMD ["start", "--", "-c", "data/settings.yaml"]
