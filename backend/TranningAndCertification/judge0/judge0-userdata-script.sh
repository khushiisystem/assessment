#!/bin/bash
exec > /var/log/judge0-userdata.log 2>&1
set -euxo pipefail

echo "=== user-data start: $(date) ==="

export DEBIAN_FRONTEND=noninteractive
apt update

GRUB_FILE="/etc/default/grub"
if grep -q '^GRUB_CMDLINE_LINUX=' "$GRUB_FILE"; then
    if ! grep -q 'systemd.unified_cgroup_hierarchy=0' "$GRUB_FILE"; then
        sed -i 's/^GRUB_CMDLINE_LINUX=\"\([^\"]*\)\"/GRUB_CMDLINE_LINUX=\"systemd.unified_cgroup_hierarchy=0 \1\"/' "$GRUB_FILE"
    fi
else
    echo 'GRUB_CMDLINE_LINUX="systemd.unified_cgroup_hierarchy=0"' >> "$GRUB_FILE"
fi

update-grub

apt install -y curl unzip nginx ca-certificates openssl ufw fail2ban unattended-upgrades

dpkg-reconfigure -f noninteractive unattended-upgrades || true

ufw --force enable
ufw limit ssh/tcp
ufw allow 80/tcp
ufw default deny incoming
ufw default allow outgoing

systemctl enable --now fail2ban

tee /etc/nginx/sites-available/default >/dev/null <<'NGINX_CONF'
server {
    listen 80;
    server_name _;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:2358;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
}
NGINX_CONF

nginx -t
ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
systemctl restart nginx

apt remove -y docker.io docker-compose docker-compose-v2 docker-doc podman-docker containerd runc || true

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

tee /etc/apt/sources.list.d/docker.sources <<DOCKER_SOURCES
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
DOCKER_SOURCES

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable --now docker

groupadd -f docker
usermod -aG docker ubuntu || true

JUDGE0_VERSION="v1.13.1"
JUDGE0_ZIP="judge0-${JUDGE0_VERSION}.zip"
JUDGE0_URL="https://github.com/judge0/judge0/releases/download/${JUDGE0_VERSION}/judge0-${JUDGE0_VERSION}.zip"
WORKDIR="/home/ubuntu"

cd "$WORKDIR"
curl -fsSL -o "$JUDGE0_ZIP" "$JUDGE0_URL"
unzip -o "$JUDGE0_ZIP"

JDIR=$(find . -maxdepth 1 -type d -name "judge0-*" | head -n1)
JDIR=${JDIR#./}

cd "$JDIR"

REDIS_PASS="Redis@5432"
POSTGRES_PASS="Postgres@5432"

sed -i "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=$REDIS_PASS|" judge0.conf
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$POSTGRES_PASS|" judge0.conf

SERVICE_PATH="/etc/systemd/system/judge0.service"
tee "$SERVICE_PATH" >/dev/null <<SERVICE_UNIT
[Unit]
Description=Judge0 Compose Stack
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=${WORKDIR}/${JDIR}
ExecStartPre=/usr/bin/docker compose pull
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
RemainAfterExit=yes
Restart=on-failure
TimeoutStartSec=300
TimeoutStopSec=300

[Install]
WantedBy=multi-user.target
SERVICE_UNIT

systemctl daemon-reload
systemctl enable --now judge0.service

systemctl reload nginx || true

echo "SUCCESS" > /home/ubuntu/setup_done
chown ubuntu:ubuntu /home/ubuntu/setup_done

reboot
