# SPDX-License-Identifier: Apache-2.0

ARG BUILD_IMAGE=node:20-bullseye
ARG RUN_IMAGE=gcr.io/distroless/nodejs20-debian11:nonroot

# Stage 1 (Build with Dev Deps)
FROM ${BUILD_IMAGE} AS builder
LABEL stage=build
# TS -> JS stage

WORKDIR /home/app
COPY ./src ./src
COPY ./package*.json ./
COPY ./tsconfig.json ./
COPY .npmrc ./
ARG GH_TOKEN

RUN npm ci --ignore-scripts
RUN npm run build

# Stage 2 (Remove Unneeded Node Modules)
FROM ${BUILD_IMAGE} AS dep-resolver
LABEL stage=pre-prod
# To filter out dev dependencies from final build

COPY package*.json ./
COPY .npmrc ./
ARG GH_TOKEN
RUN npm ci --omit=dev --ignore-scripts

# Stage 3 (Run Image - Everything above not included in final build)
FROM ${RUN_IMAGE} AS run-env
USER nonroot

WORKDIR /home/app
COPY --from=dep-resolver /node_modules ./node_modules
COPY --from=builder /home/app/build ./build
COPY package.json ./
COPY deployment.yaml ./
COPY service.yaml ./

# Turn down the verbosity to default level.
ENV NPM_CONFIG_LOGLEVEL warn

ENV FUNCTION_NAME="event-flow-rule-processor"
ENV RULE_VERSION="1.0.0"
ENV RULE_NAME="EFRuP"
ENV NODE_ENV=production
ENV MAX_CPU=1

# Apm
ENV APM_ACTIVE=true
ENV APM_URL=http://apm-server.development.svc.cluster.local:8200/
ENV APM_SECRET_TOKEN=
ENV APM_SERVICE_NAME=

ENV LOGSTASH_LEVEL='info'

# Database
ENV CONFIGURATION_DATABASE_CERT_PATH='/usr/local/share/ca-certificates/ca-certificates.crt'
ENV CONFIGURATION_DATABASE='configuration'
ENV CONFIGURATION_DATABASE_USER='root'
ENV CONFIGURATION_DATABASE_URL=
ENV CONFIGURATION_DATABASE_PASSWORD=


# Redis
ENV REDIS_DATABASE=0
ENV REDIS_AUTH=
ENV REDIS_SERVERS=
ENV REDIS_IS_CLUSTER=
ENV DISTRIBUTED_CACHETTL=300
ENV DISTRIBUTED_CACHE_ENABLED=true

# NodeCache
ENV LOCAL_CACHETTL=300
ENV LOCAL_CACHE_ENABLED=true

#Nats
ENV STARTUP_TYPE=nats
ENV SERVER_URL=0.0.0.0:4222
ENV PRODUCER_STREAM=
ENV CONSUMER_STREAM=
ENV STREAM_SUBJECT=
ENV ACK_POLICY=Explicit
ENV PRODUCER_STORAGE=File
ENV PRODUCER_RETENTION_POLICY=Workqueue

ENV SIDECAR_HOST=0.0.0.0:5000

CMD ["build/index.js"]
