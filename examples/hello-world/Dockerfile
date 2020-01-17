FROM node:latest

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

WORKDIR /usr/src/app/bin

EXPOSE 8000

CMD [ "node", "server.js" ]
