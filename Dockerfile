FROM node:22-bullseye

# Install Ghostscript
RUN apt-get update && apt-get install -y ghostscript

# App directory
WORKDIR /app

# Copy files
COPY package*.json ./
RUN npm install

COPY . .

# Create folders
RUN mkdir -p uploads compressed

# Start server
CMD ["npm", "start"]
