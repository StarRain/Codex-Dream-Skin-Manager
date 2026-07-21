FROM node:22-alpine

ARG VERSION=dev
LABEL org.opencontainers.image.title="Codex Dream Skin Manager" \
      org.opencontainers.image.description="Local WebUI for managing Codex Dream Skin themes and runtime status" \
      org.opencontainers.image.source="https://github.com/StarRain/Codex-Dream-Skin-Manager" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="$VERSION"

WORKDIR /app
ENV NODE_ENV=production \
    PORT=19341 \
    MANAGER_AGENT_HOST=host.docker.internal \
    MANAGER_AGENT_PORT=4174 \
    MANAGER_AGENT_TOKEN_FILE=/run/secrets/agent.token

COPY package.json ./
COPY src/lib.mjs src/static-server.mjs src/web-server.mjs ./src/
COPY public ./public

EXPOSE 19341
CMD ["node", "src/web-server.mjs"]
