FROM scratch AS pro-context
COPY --from=agentic-signal-pro . /agentic-signal-pro-files

FROM oven/bun:latest AS base

# Install curl, unzip, and Deno
RUN apt-get update && apt-get install -y curl unzip
RUN curl -fsSL https://deno.land/install.sh | sh
ENV PATH="/root/.deno/bin:$PATH"

WORKDIR /app

COPY --from=pro-context /agentic-signal-pro-files ./agentic-signal-pro

ADD . ./agentic-signal

WORKDIR /app/agentic-signal

RUN bun install
RUN cd client && bun install

EXPOSE 8080 8000
CMD ["bun", "run", "dev"]