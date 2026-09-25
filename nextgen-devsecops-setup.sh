#!/usr/bin/env bash
set -Eeuo pipefail

# NextGen DevSecOps One-Click Lab Installer
# Intended for a fresh Linux training VM. Idempotent for the supported packages.
# Never stores Supabase, Turnstile, payment, cloud, or other application secrets.

if [[ $EUID -ne 0 ]]; then
  echo "Please run with sudo: sudo bash nextgen-devsecops-setup.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
log(){ printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }

. /etc/os-release
ARCH="$(uname -m)"

install_base_deb(){
  apt-get update
  apt-get install -y ca-certificates curl wget gnupg unzip git jq python3 python3-pip python3-venv openssh-client
}
install_base_rpm(){
  dnf install -y ca-certificates curl wget gnupg2 unzip git jq python3 python3-pip python3-devel openssh-clients
}

case "${ID:-}" in
  ubuntu|debian) PKG=deb; install_base_deb ;;
  rocky|rhel|almalinux|fedora|centos) PKG=rpm; install_base_rpm ;;
  *) echo "Unsupported Linux distribution: ${ID:-unknown}"; exit 2 ;;
esac

log "Installing Java 21"
if [[ "$PKG" == deb ]]; then
  apt-get install -y openjdk-21-jre-headless openjdk-21-jdk maven
else
  dnf install -y java-21-openjdk java-21-openjdk-devel maven
fi

log "Installing Docker"
if ! command -v docker >/dev/null 2>&1; then
  if [[ "$PKG" == deb ]]; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/${ID}/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${ID} $(. /etc/os-release && echo ${VERSION_CODENAME}) stable" > /etc/apt/sources.list.d/docker.list
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  else
    dnf install -y dnf-plugins-core
    dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi
fi
systemctl enable --now docker

log "Installing Jenkins"
if ! command -v jenkins >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  if [[ "$PKG" == deb ]]; then
    curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key | tee /etc/apt/keyrings/jenkins-keyring.asc >/dev/null
    echo "deb [signed-by=/etc/apt/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" > /etc/apt/sources.list.d/jenkins.list
    apt-get update && apt-get install -y fontconfig jenkins
  else
    curl -fsSL https://pkg.jenkins.io/rpm-stable/jenkins.io-2026.key -o /etc/pki/rpm-gpg/jenkins.io.key
    rpm --import /etc/pki/rpm-gpg/jenkins.io.key
    cat >/etc/yum.repos.d/jenkins.repo <<'EOF'
[jenkins]
name=Jenkins
baseurl=https://pkg.jenkins.io/rpm-stable/
gpgcheck=1
gpgkey=file:///etc/pki/rpm-gpg/jenkins.io.key
enabled=1
EOF
    dnf install -y jenkins
  fi
fi
systemctl enable --now jenkins

log "Installing Trivy"
if ! command -v trivy >/dev/null 2>&1; then
  if [[ "$PKG" == deb ]]; then
    curl -fsSL https://aquasecurity.github.io/trivy-repo/deb/public.key | gpg --dearmor -o /usr/share/keyrings/trivy.gpg
    echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb generic main" >/etc/apt/sources.list.d/trivy.list
    apt-get update && apt-get install -y trivy
  else
    rpm --import https://aquasecurity.github.io/trivy-repo/rpm/public.key
    cat >/etc/yum.repos.d/trivy.repo <<'EOF'
[trivy]
name=Trivy repository
baseurl=https://aquasecurity.github.io/trivy-repo/rpm/releases/$basearch/
enabled=1
gpgcheck=1
gpgkey=https://aquasecurity.github.io/trivy-repo/rpm/public.key
EOF
    dnf install -y trivy
  fi
fi

log "Installing Python security tooling: Checkov"
python3 -m venv /opt/nextgen-checkov-venv
/opt/nextgen-checkov-venv/bin/pip install --disable-pip-version-check --no-cache-dir checkov
ln -sf /opt/nextgen-checkov-venv/bin/checkov /usr/local/bin/checkov

log "Installing Chef InSpec"
if ! command -v inspec >/dev/null 2>&1; then
  curl -fsSL https://omnitruck.cinc.sh/install.sh -o /tmp/nextgen-inspec-install.sh
  bash /tmp/nextgen-inspec-install.sh -s -- -P inspec -v latest
fi

log "Installing OWASP Dependency-Check"
DC_VERSION="12.1.0"
DC_DIR="/opt/dependency-check"
if [[ ! -x "$DC_DIR/bin/dependency-check.sh" ]]; then
  tmp="$(mktemp -d)"
  curl -fL "https://github.com/jeremylong/DependencyCheck/releases/download/v${DC_VERSION}/dependency-check-${DC_VERSION}-release.zip" -o "$tmp/dc.zip"
  rm -rf "$DC_DIR"
  mkdir -p "$DC_DIR"
  unzip -q "$tmp/dc.zip" -d "$tmp/dc"
  mv "$tmp/dc/dependency-check"/* "$DC_DIR/"
  rm -rf "$tmp"
  chmod +x "$DC_DIR/bin/dependency-check.sh"
  ln -sf "$DC_DIR/bin/dependency-check.sh" /usr/local/bin/dependency-check.sh
fi

log "Creating a convenient lab workspace"
mkdir -p /opt/nextgen-devsecops-lab
cat >/opt/nextgen-devsecops-lab/README.txt <<'EOF'
NextGen DevSecOps Lab

Installed components include Java 21, Maven, Docker, Jenkins, Trivy,
Checkov, InSpec and OWASP Dependency-Check where supported by the host.

Jenkins: http://localhost:8080
Dependency-Check: /usr/local/bin/dependency-check.sh

Do not place Supabase service-role keys, Turnstile secrets, payment credentials,
cloud credentials, API keys or other production secrets in this lab.
EOF

log "Lab installation complete"
echo
printf '%s\n' 'NextGen DevSecOps Lab installer finished. Verify each tool below.'
printf '%s\n' 'Jenkins: http://localhost:8080'
printf '%s\n' 'Check versions with: java -version && mvn -version && docker --version && trivy --version'
printf '%s\n' 'Next: return to the Student Portal and open My Assigned Labs.'
