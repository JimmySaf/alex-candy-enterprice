
# Stage 1: Build the React frontend
FROM node:24-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

ARG VITE_API_BASE_URL=/api
ARG VITE_WHATSAPP_NUMBER

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_WHATSAPP_NUMBER=${VITE_WHATSAPP_NUMBER}

RUN npm run build


# Stage 2: Run Django
FROM python:3.12-slim AS application

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt

RUN python -m pip install --no-cache-dir \
    -r /app/backend/requirements.txt

COPY backend/ /app/backend/

COPY --from=frontend-build /app/frontend/dist/ /app/frontend/dist/

WORKDIR /app/backend

RUN SECRET_KEY=build-only-secret \
    DEBUG=False \
    ALLOWED_HOSTS=localhost \
    python manage.py collectstatic --noinput

EXPOSE 10000

CMD ["sh", "-c", "python manage.py migrate --noinput && python ensure_production_admin.py && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-10000}"]
