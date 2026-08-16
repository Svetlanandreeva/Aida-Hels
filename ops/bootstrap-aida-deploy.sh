#!/usr/bin/env bash
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-aida-deploy}"
APP_ROOT="${APP_ROOT:-/opt/aida}"
PUBLIC_KEY="${1:-}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script as root." >&2
  exit 1
fi

if [ -z "$PUBLIC_KEY" ]; then
  echo "Usage: sudo bash ops/bootstrap-aida-deploy.sh 'ssh-ed25519 AAAA... aida-github-actions'" >&2
  exit 1
fi

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$DEPLOY_USER"
fi

install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
printf '%s\n' "$PUBLIC_KEY" > "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"

install -d -m 755 "$APP_ROOT/backend" "$APP_ROOT/frontend"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_ROOT"

cat > /etc/sudoers.d/aida-deploy <<EOF
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart aida-backend, /usr/bin/systemctl status aida-backend, /usr/bin/journalctl -u aida-backend *
EOF
chmod 440 /etc/sudoers.d/aida-deploy
visudo -cf /etc/sudoers.d/aida-deploy >/dev/null

echo "Deploy user '$DEPLOY_USER' is ready."
echo "Allowed app root: $APP_ROOT"
echo "Restricted sudo: restart/status/journalctl for aida-backend only."
