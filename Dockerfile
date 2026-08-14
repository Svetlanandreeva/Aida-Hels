FROM node:20-alpine AS build

RUN apk add --no-cache git
WORKDIR /src
RUN git clone --depth 1 --branch main https://github.com/Svetlanandreeva/Aida2-0-.git aida2

WORKDIR /src/aida2/frontend
ENV EXPO_NO_TELEMETRY=1
RUN corepack enable && yarn install --frozen-lockfile
RUN npx expo export --platform web

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/aida2/frontend/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
