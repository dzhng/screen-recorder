FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git unzip \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global @openai/codex@0.160.0 @anthropic-ai/claude-code@2.1.289 skills@1.7.0 \
    && npm cache clean --force
COPY runtime/ /opt/evals/
RUN printf '#!/bin/sh\nexec node /opt/evals/cli-launcher.mjs "$@"\n' > /usr/local/bin/screenrec \
    && chmod 755 /usr/local/bin/screenrec
ENV HOME=/sandbox/home
ENV PATH=/usr/local/bin:/usr/bin:/bin
USER node
WORKDIR /sandbox
ENTRYPOINT ["sh", "-c", "tar -xf - -C /sandbox && exec node /opt/evals/worker.mjs"]
