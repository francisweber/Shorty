# syntax=docker/dockerfile:1.7

FROM node:24.22.2-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8 AS node-toolchain

RUN npm install --global npm@12.2.2 \
    && rm -rf /usr/local/lib/node_modules/corepack /usr/local/bin/corepack /usr/local/bin/corepack.cjs \
    && rm -rf /usr/local/include/node \
    && test "$(node --version)" = "v24.22.2" \
    && test "$(npm --version)" = "12.2.2"

FROM php:8.5.12-cli-alpine@sha256:1ff5b45922ab30f418447c6089dbe2eba5f01e0b2742863d0327ac349305d70f AS runtime-build

ENV HOME=/tmp \
    PHP_BINARY=/usr/local/bin/php \
    NODE_PATH=/opt/shorty/docker/runtime/node_modules \
    SHORTY_BIND_HOST=0.0.0.0 \
    SHORTY_POLL_WATCH=1

COPY --from=node-toolchain /usr/local/ /usr/local/

WORKDIR /opt/shorty

RUN apk add --no-cache libstdc++=15.2.0-r5 unzip=6.0-r16

COPY package.json ./package.json
COPY bin/shorty.js ./bin/shorty.js
COPY bin/shorty-container.js ./bin/shorty-container.js
COPY docker/runtime/package.json docker/runtime/package-lock.json ./docker/runtime/
COPY docker/runtime/composer.json docker/runtime/composer.lock ./docker/runtime/
COPY docker/runtime/scripts/prepare.js ./docker/runtime/scripts/prepare.js

RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefix /opt/shorty/docker/runtime --ignore-scripts \
    && ln -s /opt/shorty/docker/runtime/node_modules /opt/shorty/node_modules

RUN --mount=type=cache,target=/root/.cache/composer \
    COMPOSER_ALLOW_SUPERUSER=1 \
    COMPOSER_HOME=/tmp/composer-home \
    COMPOSER_CACHE_DIR=/root/.cache/composer \
    node /opt/shorty/docker/runtime/scripts/prepare.js \
    && rm -rf /tmp/composer-home /tmp/shorty-composer-*

COPY src/ ./src/
COPY schemas/ ./schemas/

RUN test "$(node --version)" = "v24.22.2" \
    && test "$(npm --version)" = "12.2.2" \
    && php -r 'if (PHP_VERSION !== "8.5.12") { fwrite(STDERR, "Unexpected PHP version: " . PHP_VERSION . "\n"); exit(1); } foreach (["ctype", "iconv"] as $extension) { if (!extension_loaded($extension)) { fwrite(STDERR, "Missing PHP extension: $extension\n"); exit(1); } }' \
    && node -e 'require("ajv/dist/2020"); require("sass");' \
    && php -r 'require "/opt/shorty/docker/runtime/vendor/autoload.php"; if (!class_exists("Twig\\Environment")) { exit(1); }' \
    && node /opt/shorty/bin/shorty-container.js --help >/dev/null \
    && mkdir -p /workspace \
    && chmod 1777 /workspace

FROM runtime-build AS test

# Git is needed by the test suite for commit identity and init preflight tests.
RUN apk add --no-cache git

WORKDIR /opt/shorty
COPY --from=shorty-git --chown=1000:1000 . /opt/shorty/.git/
COPY --chown=1000:1000 package.json ./package.json
COPY --chown=1000:1000 docker/runtime/Dockerfile ./docker/runtime/Dockerfile
COPY --chown=1000:1000 tests/ ./tests/
RUN chown 1000:1000 /opt/shorty

USER 1000:1000
RUN npm test
ENTRYPOINT []
CMD ["npm", "test"]

FROM php:8.5.12-cli-alpine@sha256:1ff5b45922ab30f418447c6089dbe2eba5f01e0b2742863d0327ac349305d70f AS runtime-final

ENV HOME=/tmp \
    PHP_BINARY=/usr/local/bin/php \
    NODE_PATH=/opt/shorty/docker/runtime/node_modules \
    SHORTY_BIND_HOST=0.0.0.0 \
    SHORTY_POLL_WATCH=1

COPY --from=node-toolchain /usr/local/ /usr/local/
RUN apk add --no-cache libstdc++=15.2.0-r5
WORKDIR /opt/shorty
COPY --from=runtime-build /opt/shorty/docker/runtime/node_modules ./docker/runtime/node_modules
COPY --from=runtime-build /opt/shorty/docker/runtime/vendor ./docker/runtime/vendor
COPY --from=runtime-build /opt/shorty/package.json ./package.json
COPY --from=runtime-build /opt/shorty/bin/shorty-container.js ./bin/shorty-container.js
COPY --from=runtime-build /opt/shorty/src ./src
COPY --from=runtime-build /opt/shorty/schemas ./schemas

RUN ln -s /opt/shorty/docker/runtime/node_modules /opt/shorty/node_modules \
    && test "$(node --version)" = "v24.22.2" \
    && test "$(npm --version)" = "12.2.2" \
    && php -r 'if (PHP_VERSION !== "8.5.12") { fwrite(STDERR, "Unexpected PHP version: " . PHP_VERSION . "\n"); exit(1); } foreach (["ctype", "iconv"] as $extension) { if (!extension_loaded($extension)) { fwrite(STDERR, "Missing PHP extension: $extension\n"); exit(1); } }' \
    && node -e 'require("ajv/dist/2020"); require("sass");' \
    && php -r 'require "/opt/shorty/docker/runtime/vendor/autoload.php"; if (!class_exists("Twig\\Environment")) { exit(1); }' \
    && node /opt/shorty/bin/shorty-container.js --help >/dev/null \
    && mkdir -p /workspace \
    && chmod 1777 /workspace

WORKDIR /workspace
USER 1000:1000
ENTRYPOINT ["node", "/opt/shorty/bin/shorty-container.js"]
