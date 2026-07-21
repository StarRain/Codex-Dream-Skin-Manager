FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=19341 \
    MANAGER_AGENT_HOST=host.docker.internal \
    MANAGER_AGENT_PORT=4174 \
    MANAGER_AGENT_TOKEN_FILE=/run/secrets/agent.token

COPY package.json ./
COPY src/lib.mjs src/web-server.mjs ./src/
COPY public ./public

EXPOSE 19341
CMD ["node", "src/web-server.mjs"]
