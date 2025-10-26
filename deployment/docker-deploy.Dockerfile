# Use Alpine Linux as base image
FROM alpine:latest

# Install git and openssh
RUN apk add --no-cache git openssh

# Create .ssh directory
RUN mkdir -p /root/.ssh

# Copy the deploy key from parent directory
COPY ../deploy_key /root/.ssh/id_rsa

# Set proper permissions for SSH key
RUN chmod 600 /root/.ssh/id_rsa

# Add GitHub to known hosts
RUN ssh-keyscan github.com >> /root/.ssh/known_hosts

# Set Git to use SSH instead of HTTPS
RUN git config --global url."git@github.com:".insteadOf "https://github.com/"

# Test script that attempts to clone a private repository
RUN echo '#!/bin/sh' > /test-clone.sh && \
    echo 'echo "=== SSH Deploy Key Test ==="' >> /test-clone.sh && \
    echo 'echo "Checking SSH key setup..."' >> /test-clone.sh && \
    echo 'ls -la /root/.ssh/' >> /test-clone.sh && \
    echo 'echo "Testing SSH connection to GitHub..."' >> /test-clone.sh && \
    echo 'ssh -T git@github.com || echo "SSH test completed (exit code expected)"' >> /test-clone.sh && \
    echo 'echo ""' >> /test-clone.sh && \
    echo 'echo "Attempting to clone private repository..."' >> /test-clone.sh && \
    echo 'if git clone git@github.com:FAN0020/CG_payment_service.git /test-repo; then' >> /test-clone.sh && \
    echo '  echo "SUCCESS: Private repository cloned successfully!"' >> /test-clone.sh && \
    echo '  echo "Repository contents:"' >> /test-clone.sh && \
    echo '  ls -la /test-repo' >> /test-clone.sh && \
    echo '  echo "Git remote URL:"' >> /test-clone.sh && \
    echo '  cd /test-repo && git remote -v' >> /test-clone.sh && \
    echo 'else' >> /test-clone.sh && \
    echo '  echo "ERROR: Failed to clone private repository"' >> /test-clone.sh && \
    echo '  echo "This could be due to:"' >> /test-clone.sh && \
    echo '  echo "1. Invalid SSH key"' >> /test-clone.sh && \
    echo '  echo "2. Key not added to GitHub repository"' >> /test-clone.sh && \
    echo '  echo "3. Repository does not exist"' >> /test-clone.sh && \
    echo '  echo "4. Network connectivity issues"' >> /test-clone.sh && \
    echo '  echo "5. SSH key permissions issue"' >> /test-clone.sh && \
    echo '  exit 1' >> /test-clone.sh && \
    echo 'fi' >> /test-clone.sh && \
    chmod +x /test-clone.sh

# Run the test
CMD ["/test-clone.sh"]

