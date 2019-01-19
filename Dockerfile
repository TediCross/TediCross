FROM node:10-alpine

WORKDIR /opt/TediCross/

ADD . .

RUN npm install --production

# Hack to make the settings file work from the data/ directory
# Remove this line if you build with the settings file integrated
RUN ln -s data/settings.yaml settings.yaml

VOLUME /opt/TediCross/data/

ENTRYPOINT /usr/local/bin/npm start
