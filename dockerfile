FROM oven/bun:latest AS base

# Install curl, unzip, and Deno
RUN apt-get update && apt-get install -y curl unzip
RUN curl -fsSL https://deno.land/install.sh | sh
ENV PATH="/root/.deno/bin:$PATH"

WORKDIR /app

# Copy main project files
ADD . ./agentic-signal

WORKDIR /app/agentic-signal

RUN bun install
RUN cd client && bun install

# The backend listens on 127.0.0.1 unless told otherwise; a published port needs every interface.
ENV AGENTIC_SIGNAL_HOST=0.0.0.0

EXPOSE 8080 8000 8001
CMD ["bun", "run", "dev"]