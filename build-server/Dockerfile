FROM  ubuntu:focal

# Update and upgrade package list
RUN apt-get update 
# install curl
RUN apt-get install -y curl
# Install node
RUN curl -sL https://deb.nodesource.com/setup_22.x | bash -
RUN apt-get upgrade -y
RUN apt-get install -y nodejs

# Install git
RUN apt-get install git -y

WORKDIR /home/app


COPY main.sh main.sh
COPY script.js script.js
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


