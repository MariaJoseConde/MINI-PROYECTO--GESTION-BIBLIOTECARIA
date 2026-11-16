FROM node:22-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ curl && rm -rf /var/lib/apt/lists/*

COPY package.json ./

RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=development

CMD ["npm", "run", "dev"]
