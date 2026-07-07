FROM node:22-slim
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY . .
EXPOSE 4021
CMD ["node", "src/server.js"]
