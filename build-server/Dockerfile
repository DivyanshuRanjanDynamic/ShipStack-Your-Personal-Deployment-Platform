FROM ubuntu:24.04

# ubuntu:focal is past standard support; 24.04 is the current LTS.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates git xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Several Node majors, pre-installed so builds never download Node at run time.
# Node 16 is end-of-life and is kept only for legacy projects.
ENV NODE_VERSION_16=16.20.2 \
    NODE_VERSION_18=18.20.5 \
    NODE_VERSION_20=20.18.1 \
    NODE_VERSION_22=22.12.0
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
    amd64) nodearch='x64' ;; \
    arm64) nodearch='arm64' ;; \
    *) echo "unsupported architecture: $arch" >&2; exit 1 ;; \
    esac; \
    mkdir -p /opt/node; \
    for v in "$NODE_VERSION_16" "$NODE_VERSION_18" "$NODE_VERSION_20" "$NODE_VERSION_22"; do \
    major="${v%%.*}"; \
    tarball="node-v${v}-linux-${nodearch}.tar.xz"; \
    curl -fsSLO "https://nodejs.org/dist/v${v}/${tarball}"; \
    curl -fsSL "https://nodejs.org/dist/v${v}/SHASUMS256.txt" -o SHASUMS256.txt; \
    grep " ${tarball}\$" SHASUMS256.txt | sha256sum -c -; \
    mkdir -p "/opt/node/${major}"; \
    tar -xJf "${tarball}" -C "/opt/node/${major}" --strip-components=1; \
    rm -f "${tarball}" SHASUMS256.txt; \
    done

# Node 22 is the default on PATH; the build-server process itself runs on it.
ENV PATH=/opt/node/22/bin:$PATH

# Manifest the build-server reads at run time to pick a Node version per build.
RUN node -e "const fs=require('fs'),cp=require('child_process'); \
    const list=fs.readdirSync('/opt/node').filter(d=>/^[0-9]+$/.test(d)) \
    .map(m=>({major:Number(m),version:cp.execFileSync('/opt/node/'+m+'/bin/node',['-v'],{encoding:'utf8'}).trim().replace(/^v/,''),binDir:'/opt/node/'+m+'/bin'})) \
    .sort((a,b)=>a.major-b.major); \
    fs.writeFileSync('/opt/node/versions.json',JSON.stringify(list,null,2)); \
    console.log('installed node versions:',list.map(v=>v.version).join(', '))"

# corepack provides the pnpm and yarn shims (versions come from the repo's packageManager
# field or lockfile). Enable it for every installed major so switching Node keeps them.
# Note: Node 16's bundled corepack ships old signing keys, so corepack-managed pnpm/yarn
# downloads on Node 16 can fail; Node 16 projects typically use npm.
RUN for m in 16 18 20 22; do /opt/node/$m/bin/corepack enable --install-directory /opt/node/$m/bin; done
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

WORKDIR /home/app

COPY main.sh main.sh
COPY script.js script.js
COPY lib lib
COPY package*.json .
COPY kafka.pem kafka.pem

RUN npm install

# now we need to give the executable permission to the main.sh file
RUN chmod +x main.sh
RUN chmod +x script.js

# Create non-root user and hand over ownership
RUN groupadd -r appuser && useradd -r -g appuser -m appuser
RUN chown -R appuser:appuser /home/app
USER appuser

ENTRYPOINT [ "/home/app/main.sh" ]
