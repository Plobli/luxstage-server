# LuxStage — Betreiber-Panel (statischer, zustandsloser Service).
# Getrennt vom Hauptimage: eine Panel-Änderung erfordert kein Mandanten-Redeploy.
FROM node:22-alpine

WORKDIR /app
COPY operator-panel/package.json ./package.json
COPY operator-panel/index.html ./index.html
COPY operator-panel/operator-panel.js ./operator-panel.js
COPY operator-panel/server.js ./server.js

EXPOSE 3001

CMD ["node", "server.js"]
