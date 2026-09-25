#!/bin/bash
#
# NextGen DevSecOps Training Lab
# Multi-OS one-click installer
# Supported OS: Rocky Linux / RHEL-compatible and Ubuntu 24.04 LTS
#
# Roles:
#   1) Master-VM
#   2) Slave-VM
#   3) Master-Slave-VM
#   4) Full DevSecOps Lab
#   5) Exit
#
# Full DevSecOps pipeline:
#   Git -> TruffleHog -> SonarQube -> Dependency-Check -> Trivy
#       -> Checkov -> InSpec -> OWASP ZAP -> Falco
#
# Security roles:
#   TruffleHog       = secret scanning
#   SonarQube        = SAST
#   Dependency-Check = SCA
#   Trivy            = container / IaC scanning
#   Checkov          = IaC / cloud security scanning
#   InSpec           = infrastructure / compliance testing
#   OWASP ZAP        = DAST
#   Falco            = runtime security
#
set -Eeuo pipefail

# ============================================================
# Idempotent installation helpers
# Skip packages/tools that are already installed.
# ============================================================

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

rpm_installed() {
    rpm -q "$1" >/dev/null 2>&1
}

deb_installed() {
    dpkg-query -W -f='${Status}' "$1" 2>/dev/null | grep -q "install ok installed"
}

install_dnf_packages() {
    local missing=()
    local pkg
    for pkg in "$@"; do
        if rpm_installed "$pkg"; then
            log "SKIP: $pkg is already installed"
        else
            missing+=("$pkg")
        fi
    done
    if ((${#missing[@]})); then
        dnf install -y "${missing[@]}"
    fi
}

install_apt_packages() {
    local missing=()
    local pkg
    for pkg in "$@"; do
        if deb_installed "$pkg"; then
            log "SKIP: $pkg is already installed"
        else
            missing+=("$pkg")
        fi
    done
    if ((${#missing[@]})); then
        apt-get install -y "${missing[@]}"
    fi
}

ensure_command() {
    local cmd="$1"
    local package="$2"
    if command_exists "$cmd"; then
        log "SKIP: $cmd is already available"
        return 0
    fi
    log "Installing $package because $cmd is missing"
    if [[ "$OS_FAMILY" == "rpm" ]]; then
        install_dnf_packages "$package"
    else
        install_apt_packages "$package"
    fi
}


SCRIPT_NAME="nextgen-devsecops-setup.sh"
LOG_FILE="/var/log/nextgen-devsecops-setup.log"
LAB_DIR="/opt/devsecops-lab"
AGENT_DIR="/opt/jenkins-agent"
JAVA_HOME=""
OS_FAMILY=""
PKG=""
FIREWALL=""

trap 'echo "ERROR: Installation stopped at line $LINENO. Check $LOG_FILE" >&2' ERR

log(){ echo "$1" | tee -a "$LOG_FILE"; }
die(){ echo; log "ERROR: $1"; exit 1; }
has_cmd(){ command -v "$1" >/dev/null 2>&1; }

[[ $EUID -eq 0 ]] || { echo "Run as root: sudo bash $SCRIPT_NAME"; exit 1; }

touch "$LOG_FILE"; chmod 600 "$LOG_FILE"

source /etc/os-release
OS_ID="${ID:-unknown}"
OS_VERSION="${VERSION_ID:-unknown}"
OS_NAME="${PRETTY_NAME:-$OS_ID $OS_VERSION}"

case "$OS_ID" in
  ubuntu)
    [[ "$OS_VERSION" == "24.04" ]] || die "This installer supports Ubuntu 24.04 LTS. Detected Ubuntu $OS_VERSION."
    OS_FAMILY="debian"; PKG="apt"; FIREWALL="ufw" ;;
  rocky|rhel|almalinux|ol|centos|fedora)
    OS_FAMILY="rpm"; PKG="dnf"; FIREWALL="firewalld" ;;
  *) die "Unsupported OS: $OS_NAME. Supported: Rocky Linux/RHEL-compatible or Ubuntu 24.04 LTS." ;;
esac

log "Detected OS: $OS_NAME"

install_base_packages() {
    log "Checking base packages..."

    if [[ "$OS_FAMILY" == "rpm" ]]; then
        install_dnf_packages \
            curl \
            wget \
            ca-certificates \
            git \
            unzip \
            tar \
            gzip \
            openssl \
            firewalld
    elif [[ "$OS_FAMILY" == "debian" ]]; then
        local missing_base=()
        local pkg
        for pkg in curl wget ca-certificates git unzip tar gzip openssl ufw; do
            if ! deb_installed "$pkg"; then
                missing_base+=("$pkg")
            else
                log "SKIP: $pkg is already installed"
            fi
        done
        if ((${#missing_base[@]})); then
            apt-get update -y
            install_apt_packages "${missing_base[@]}"
        fi
    fi
}

configure_firewall(){
  log "Configuring firewall..."
  if [[ "$FIREWALL" == "ufw" ]]; then
    systemctl enable --now ufw >/dev/null 2>&1 || true
    ufw allow 22/tcp >/dev/null 2>&1 || true
    ufw allow 8080/tcp >/dev/null 2>&1 || true
    ufw allow 9000/tcp >/dev/null 2>&1 || true
    ufw --force enable >/dev/null 2>&1 || true
  else
    systemctl enable --now firewalld >/dev/null 2>&1 || true
    firewall-cmd --permanent --add-port=8080/tcp >/dev/null 2>&1 || true
    firewall-cmd --permanent --add-port=9000/tcp >/dev/null 2>&1 || true
    firewall-cmd --reload >/dev/null 2>&1 || true
  fi
}

open_port(){
  local port="$1"
  if [[ "$FIREWALL" == "ufw" ]]; then
    ufw allow "${port}/tcp" >/dev/null 2>&1 || true
  else
    firewall-cmd --permanent --add-port="${port}/tcp" >/dev/null 2>&1 || true
    firewall-cmd --reload >/dev/null 2>&1 || true
  fi
}

install_java(){
  log "Installing/checking Java 21..."
  if has_cmd java; then
    local major
    major="$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | awk -F. '{if ($1=="1") print $2; else print $1}' | head -1)"
    if [[ "$major" == "21" || "$major" == "25" ]]; then
      log "Compatible Java $major already installed."
    else
      log "Replacing incompatible Java with Java 21..."
      install_java_package
    fi
  else
    install_java_package
  fi

  has_cmd java || die "Java installation failed."
  JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")"
  cat > /etc/profile.d/nextgen-java.sh <<EOF2
export JAVA_HOME="$JAVA_HOME"
export PATH="\$JAVA_HOME/bin:\$PATH"
EOF2
  export JAVA_HOME PATH
  PATH="$JAVA_HOME/bin:$PATH"
  log "JAVA_HOME=$JAVA_HOME"
  java -version 2>&1 | tee -a "$LOG_FILE"
}

install_java_package(){
  if [[ "$OS_FAMILY" == "debian" ]]; then
    apt-get update -y
    apt-get install -y openjdk-21-jdk fontconfig
  else
    dnf install -y java-21-openjdk java-21-openjdk-devel fontconfig
  fi
}

install_jenkins(){
  log "Checking Jenkins LTS..."

  local installed="false"
  if [[ "$OS_FAMILY" == "debian" ]]; then
    if deb_installed jenkins; then installed="true"; fi
  else
    if rpm_installed jenkins; then installed="true"; fi
  fi

  if [[ "$installed" == "true" ]]; then
    log "SKIP: Jenkins package is already installed."
  else
    log "Installing Jenkins LTS..."
    if [[ "$OS_FAMILY" == "debian" ]]; then
      install -m 0755 -d /etc/apt/keyrings
      if [[ ! -s /etc/apt/keyrings/jenkins-keyring.asc ]]; then
        curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key -o /etc/apt/keyrings/jenkins-keyring.asc
        chmod a+r /etc/apt/keyrings/jenkins-keyring.asc
      fi
      if [[ ! -f /etc/apt/sources.list.d/jenkins.list ]]; then
        cat > /etc/apt/sources.list.d/jenkins.list <<'EOF2'
deb [signed-by=/etc/apt/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/
EOF2
      fi
      apt-get update -y
      apt-get install -y jenkins
    else
      if [[ ! -f /etc/yum.repos.d/jenkins.repo ]]; then
        curl -fsSL https://pkg.jenkins.io/rpm-stable/jenkins.repo -o /etc/yum.repos.d/jenkins.repo
      fi
      rpm --import https://pkg.jenkins.io/rpm-stable/jenkins.io-2026.key
      dnf install -y jenkins
    fi
  fi

  mkdir -p /etc/systemd/system/jenkins.service.d
  cat > /etc/systemd/system/jenkins.service.d/override.conf <<EOF2
[Service]
Environment="JAVA_HOME=$JAVA_HOME"
Environment="JENKINS_JAVA_CMD=$JAVA_HOME/bin/java"
TimeoutStartSec=300
EOF2
  systemctl daemon-reload

  if systemctl is-active --quiet jenkins; then
    log "SKIP: Jenkins service is already running."
  else
    log "Starting Jenkins service..."
    systemctl reset-failed jenkins >/dev/null 2>&1 || true
    systemctl enable jenkins >/dev/null 2>&1 || true
    if ! systemctl start jenkins; then
      log "Jenkins did not complete systemd startup within the configured timeout."
      systemctl status jenkins --no-pager || true
      journalctl -u jenkins -n 100 --no-pager || true
      if pgrep -f '[j]enkins.war|[/]usr/bin/jenkins' >/dev/null 2>&1; then
        log "Jenkins JVM is still running after the systemd timeout; continuing to readiness check."
      else
        die "Jenkins failed to start. Check: journalctl -u jenkins -n 100 --no-pager"
      fi
    fi
  fi

  open_port 8080

  # Service can be RUNNING before the Jenkins web UI is ready.
  # Poll briefly instead of relying on a fixed sleep. Initial setup is expected.
  log "Waiting for Jenkins web interface..."
  local ready="false"
  local i
  for i in $(seq 1 150); do
    if curl -fsS --max-time 2 http://127.0.0.1:8080/login >/dev/null 2>&1; then
      ready="true"
      break
    fi
    sleep 2
  done

  if [[ "$ready" == "true" ]]; then
    log "Jenkins web interface: READY"
  else
    log "WARNING: Jenkins service is running, but web interface is not ready yet."
    log "Jenkins may still be completing first-start initialization."
  fi

  log "Jenkins package: INSTALLED"
  log "Jenkins service: RUNNING"

  if [[ -f /var/lib/jenkins/secrets/initialAdminPassword ]]; then
    log "Jenkins initial setup: REQUIRED"
    log "Initial Admin Password:"
    cat /var/lib/jenkins/secrets/initialAdminPassword | tee -a "$LOG_FILE"
  fi
}

install_maven(){
    if command_exists "mvn"; then
        log "SKIP: maven is already installed"
        return 0
    fi
  log "Installing Maven..."
  if ! has_cmd mvn; then
    if [[ "$OS_FAMILY" == "debian" ]]; then apt-get install -y maven; else dnf install -y maven; fi
  fi
  has_cmd mvn || die "Maven installation failed."
  log "Maven: $(mvn -version 2>&1 | head -1)"
}

install_docker(){
  echo
  echo "============================================================"
  echo "                 DOCKER INSTALLATION"
  echo "============================================================"
  echo

  if has_cmd docker; then
    echo "[SKIP] Docker Engine is already installed."
  else
    echo "[1/3] Preparing Docker repository..."

    if [[ "$OS_FAMILY" == "debian" ]]; then
      install -m 0755 -d /etc/apt/keyrings
      if [[ ! -s /etc/apt/keyrings/docker.asc ]]; then
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
        chmod a+r /etc/apt/keyrings/docker.asc
      fi
      cat > /etc/apt/sources.list.d/docker.sources <<EOF2
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF2
      echo "[2/3] Refreshing Docker package metadata..."
      apt-get update -y
      echo "[3/3] Installing Docker Engine + Compose..."
      apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    else
      dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo || true
      echo "[2/3] Refreshing Docker package metadata..."
      dnf makecache -y
      echo "[3/3] Installing Docker Engine + Compose..."
      dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    fi
  fi

  if ! docker compose version >/dev/null 2>&1; then
    echo "[INFO] Docker Compose plugin is missing; installing..."
    if [[ "$OS_FAMILY" == "debian" ]]; then
      apt-get update -y
      apt-get install -y docker-compose-plugin
    else
      dnf install -y docker-compose-plugin
    fi
  else
    echo "[SKIP] Docker Compose plugin is already available."
  fi

  if systemctl is-active --quiet docker; then
    echo "[SKIP] Docker service is already running."
  else
    echo "[INFO] Starting Docker service..."
    systemctl enable --now docker
  fi

  systemctl is-active --quiet docker || die "Docker failed to start."
  echo "[OK] Docker: $(docker --version)"
  echo "[OK] Compose: $(docker compose version)"
}

install_trivy(){
  echo
  echo "============================================================"
  echo "                    TRIVY INSTALLATION"
  echo "============================================================"
  echo

  if command_exists "trivy"; then
    echo "[SKIP] Trivy is already installed."
    trivy --version | head -1
    return 0
  fi

  echo "[1/3] Preparing Trivy repository..."

  if [[ "$OS_FAMILY" == "debian" ]]; then
    install_apt_packages wget gnupg
    install -m 0755 -d /usr/share/keyrings
    if [[ ! -s /usr/share/keyrings/trivy.gpg ]]; then
      wget -qO- https://get.trivy.dev/deb/public.key | gpg --dearmor > /usr/share/keyrings/trivy.gpg
    fi
    echo "      Repository key: READY"
    cat > /etc/apt/sources.list.d/trivy.list <<'EOF2'
deb [signed-by=/usr/share/keyrings/trivy.gpg] https://get.trivy.dev/deb generic main
EOF2
    echo "[2/3] Refreshing Trivy package metadata..."
    apt-get update -y
    echo "[3/3] Installing Trivy package..."
    apt-get install -y trivy
  else
    cat > /etc/yum.repos.d/trivy.repo <<'EOF2'
[trivy]
name=Trivy repository
baseurl=https://get.trivy.dev/rpm/releases/$basearch/
gpgcheck=1
enabled=1
gpgkey=https://get.trivy.dev/rpm/public.key
EOF2
    echo "      Repository: READY"
    echo "[2/3] Refreshing Trivy package metadata..."
    dnf makecache -y
    echo "[3/3] Installing Trivy package..."
    dnf install -y trivy
  fi

  command_exists trivy || die "Trivy installation failed."
  echo
  echo "[OK] Trivy installed successfully."
  trivy --version | head -1
  echo "[INFO] Trivy vulnerability database will be downloaded when a scan requires it."
}

install_dependency_check(){
  echo
  echo "============================================================"
  echo "              OWASP DEPENDENCY-CHECK"
  echo "============================================================"
  echo

  local version="12.1.0"
  local install_dir="/opt/dependency-check"
  local archive="/tmp/dependency-check.zip"
  local extract_dir="/tmp/dependency-check-extract"
  local url="https://github.com/dependency-check/DependencyCheck/releases/download/v${version}/dependency-check-${version}-release.zip"

  if [[ -x "$install_dir/bin/dependency-check.sh" ]]; then
    echo "[SKIP] OWASP Dependency-Check is already installed."
    ln -sf "$install_dir/bin/dependency-check.sh" /usr/local/bin/dependency-check.sh
    return 0
  fi

  echo "[1/5] Downloading Dependency-Check ${version}..."
  rm -rf "$install_dir" "$extract_dir" "$archive"
  mkdir -p "$extract_dir"
  curl -fL --retry 3 --retry-delay 3 --progress-bar "$url" -o "$archive"

  echo "[2/5] Extracting package..."
  unzip -q "$archive" -d "$extract_dir"

  echo "[3/5] Locating extracted files..."
  local script_path=""
  script_path="$(find "$extract_dir" -type f -name 'dependency-check.sh' -print -quit)"

  if [[ -z "$script_path" ]]; then
    echo "[ERROR] dependency-check.sh was not found after extraction."
    echo "[INFO] Extracted contents:"
    find "$extract_dir" -maxdepth 3 -type f | head -50 || true
    die "Could not locate Dependency-Check executable."
  fi

  echo "[4/5] Installing to $install_dir..."
  local source_dir
  source_dir="$(dirname "$(dirname "$script_path")")"
  mkdir -p "$install_dir"
  cp -a "$source_dir"/. "$install_dir"/
  chmod +x "$install_dir/bin/dependency-check.sh"

  echo "[5/5] Creating command link..."
  ln -sf "$install_dir/bin/dependency-check.sh" /usr/local/bin/dependency-check.sh
  rm -rf "$extract_dir" "$archive"

  if [[ ! -x "$install_dir/bin/dependency-check.sh" ]]; then
    die "Dependency-Check installation completed but executable is missing."
  fi

  echo "[OK] OWASP Dependency-Check installed."
  echo "[INFO] Vulnerability data may be downloaded during its first scan/update."
}

install_checkov(){
  echo
  echo "============================================================"
  echo "                    CHECKOV INSTALLATION"
  echo "============================================================"
  echo

  if command_exists "checkov"; then
    echo "[SKIP] Checkov is already installed."
    checkov --version 2>/dev/null || true
    return 0
  fi

  echo "[1/4] Checking Python 3..."
  command_exists python3 || {
    if [[ "$OS_FAMILY" == "debian" ]]; then
      install_apt_packages python3 python3-venv python3-pip
    else
      install_dnf_packages python3 python3-pip
    fi
  }

  local venv="/opt/checkov-venv"
  echo "[2/4] Creating isolated Checkov environment..."
  if [[ ! -x "$venv/bin/python" ]]; then
    python3 -m venv "$venv"
  else
    echo "      Existing virtual environment: READY"
  fi

  echo "[3/4] Installing Checkov..."
  "$venv/bin/python" -m pip install --disable-pip-version-check --no-cache-dir --upgrade checkov

  echo "[4/4] Creating Checkov command..."
  cat > /usr/local/bin/checkov <<'EOF2'
#!/bin/bash
exec /opt/checkov-venv/bin/checkov "$@"
EOF2
  chmod +x /usr/local/bin/checkov

  command_exists checkov || die "Checkov installation failed."
  echo "[OK] Checkov installed successfully."
  checkov --version 2>/dev/null || true
}

install_inspec(){
  echo
  echo "============================================================"
  echo "                    INSPEC INSTALLATION"
  echo "============================================================"
  echo

  if command_exists "inspec"; then
    echo "[SKIP] InSpec is already installed."
    inspec version 2>/dev/null | head -1 || true
    return 0
  fi

  echo "[1/3] Preparing Chef InSpec installer..."
  echo "[2/3] Installing Chef InSpec..."
  curl -fsSL https://omnitruck.chef.io/install.sh | bash -s -- -P inspec

  echo "[3/3] Validating InSpec..."
  command_exists inspec || die "InSpec installation failed."
  echo "[OK] InSpec installed successfully."
  inspec version 2>/dev/null | head -1 || true
}

install_falco(){
  echo
  echo "============================================================"
  echo "                    FALCO INSTALLATION"
  echo "============================================================"
  echo
  if command_exists "falco"; then
    echo "[SKIP] Falco is already installed."
    return 0
  fi
  echo "[1/2] Preparing Falco repository..."
  echo "[2/2] Installing Falco runtime security..."
  has_cmd falco && { log "Falco already installed."; return; }
  if [[ "$OS_FAMILY" == "debian" ]]; then
    curl -fsSL https://falco.org/repo/falcosecurity-packages.asc | gpg --dearmor -o /usr/share/keyrings/falco-archive-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/falco-archive-keyring.gpg] https://download.falco.org/packages/deb stable main" > /etc/apt/sources.list.d/falcosecurity.list
    apt-get update -y
    FALCO_FRONTEND=noninteractive FALCO_DRIVER_CHOICE=modern_ebpf apt-get install -y falco
  else
    rpm --import https://falco.org/repo/falcosecurity-packages.asc
    curl -fsSL https://falco.org/repo/falcosecurity-rpm.repo -o /etc/yum.repos.d/falcosecurity.repo
    dnf makecache -y >/dev/null
    FALCO_FRONTEND=noninteractive FALCO_DRIVER_CHOICE=modern_ebpf dnf install -y falco
  fi
  if systemctl list-unit-files falco-modern-bpf.service >/dev/null 2>&1; then systemctl enable --now falco-modern-bpf.service || true
  elif systemctl list-unit-files falco-bpf.service >/dev/null 2>&1; then systemctl enable --now falco-bpf.service || true
  elif systemctl list-unit-files falco.service >/dev/null 2>&1; then systemctl enable --now falco.service || true
  fi
  log "Falco installed."
}

install_trufflehog(){
  echo
  echo "============================================================"
  echo "                  TRUFFLEHOG INSTALLATION"
  echo "============================================================"
  echo

  if command_exists "trufflehog"; then
    echo "[SKIP] TruffleHog is already installed."
    return 0
  fi

  echo "[1/2] Pulling official TruffleHog container image..."
  docker pull trufflesecurity/trufflehog:latest
  echo "[2/2] Creating TruffleHog command..."
  cat > /usr/local/bin/trufflehog <<'EOF2'
#!/bin/bash
exec docker run --rm -v "$(pwd):/work" -w /work trufflesecurity/trufflehog:latest "$@"
EOF2
  chmod +x /usr/local/bin/trufflehog
  echo "[OK] TruffleHog ready."
}

install_zap(){
  echo
  echo "============================================================"
  echo "                    OWASP ZAP"
  echo "============================================================"
  echo

  if [[ -x /usr/local/bin/zap.sh ]]; then
    echo "[SKIP] OWASP ZAP wrapper is already installed."
    return 0
  fi

  echo "[1/2] Pulling official OWASP ZAP container image..."
  docker pull ghcr.io/zaproxy/zaproxy:stable
  echo "[2/2] Creating ZAP command..."
  cat > /usr/local/bin/zap.sh <<'EOF2'
#!/bin/bash
exec docker run --rm -v "$(pwd):/zap/wrk/:rw" ghcr.io/zaproxy/zaproxy:stable "$@"
EOF2
  chmod +x /usr/local/bin/zap.sh
  echo "[OK] OWASP ZAP ready."
}

install_agent_user(){
  log "Configuring Jenkins agent user..."
  id jenkins-agent >/dev/null 2>&1 || useradd -m -s /bin/bash jenkins-agent
  getent group docker >/dev/null 2>&1 && usermod -aG docker jenkins-agent || true
  mkdir -p "$AGENT_DIR"
  chown -R jenkins-agent:jenkins-agent "$AGENT_DIR"
}

install_sonarqube(){
  echo
  echo "============================================================"
  echo "             SONARQUBE + POSTGRESQL"
  echo "============================================================"
  echo
  echo "[1/3] Preparing SonarQube configuration..."
  mkdir -p "$LAB_DIR/sonarqube"
  cat > "$LAB_DIR/sonarqube/docker-compose.yml" <<'EOF2'
services:
  sonarqube-db:
    image: postgres:17
    container_name: nextgen-sonarqube-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: sonar
      POSTGRES_PASSWORD: sonar
      POSTGRES_DB: sonarqube
    volumes:
      - sonarqube_db:/var/lib/postgresql/data
    networks: [sonarnet]
  sonarqube:
    image: sonarqube:community
    container_name: nextgen-sonarqube
    restart: unless-stopped
    depends_on: [sonarqube-db]
    environment:
      SONAR_JDBC_URL: jdbc:postgresql://sonarqube-db:5432/sonarqube
      SONAR_JDBC_USERNAME: sonar
      SONAR_JDBC_PASSWORD: sonar
    ports: ["9000:9000"]
    volumes:
      - sonarqube_data:/opt/sonarqube/data
      - sonarqube_extensions:/opt/sonarqube/extensions
      - sonarqube_logs:/opt/sonarqube/logs
    networks: [sonarnet]
volumes:
  sonarqube_db:
  sonarqube_data:
  sonarqube_extensions:
  sonarqube_logs:
networks:
  sonarnet:
EOF2
  sysctl -w vm.max_map_count=524288 >/dev/null
  sysctl -w fs.file-max=131072 >/dev/null
  cat > /etc/sysctl.d/99-nextgen-sonarqube.conf <<'EOF2'
vm.max_map_count=524288
fs.file-max=131072
EOF2
  sysctl --system >/dev/null
  echo "[2/3] Starting SonarQube + PostgreSQL containers..."
  (cd "$LAB_DIR/sonarqube" && docker compose up -d)
  open_port 9000
  echo "[3/3] SonarQube containers started."
  echo "[INFO] First SonarQube startup can take several minutes."
}

create_lab_dirs(){
  mkdir -p "$LAB_DIR"/{scripts,workspace,reports}
  chmod 755 "$LAB_DIR"
}

validate(){
  echo; echo "============================================================"; echo "                 LAB VALIDATION"; echo "============================================================"; echo
  echo "OS: $OS_NAME"
  echo "Java:"; java -version 2>&1 | head -1
  echo "Git:"; git --version
  has_cmd jenkins && { echo "Jenkins:"; jenkins --version 2>/dev/null || true; systemctl is-active jenkins || true; }
  has_cmd mvn && { echo "Maven:"; mvn -version | head -2; }
  has_cmd docker && { echo "Docker:"; docker --version; docker compose version; }
  has_cmd trivy && { echo "Trivy:"; trivy --version | head -1; }
  has_cmd checkov && { echo "Checkov:"; checkov --version 2>/dev/null | head -1 || true; }
  has_cmd inspec && { echo "InSpec:"; inspec version 2>/dev/null | head -1 || true; }
  has_cmd trufflehog && { echo "TruffleHog:"; trufflehog --version 2>&1 | head -2 || true; }
  [[ -x /usr/local/bin/dependency-check.sh ]] && { echo "Dependency-Check:"; /usr/local/bin/dependency-check.sh --version 2>/dev/null || true; }
  has_cmd falco && { echo "Falco:"; falco --version 2>/dev/null | head -1 || true; }
  [[ -x /usr/local/bin/zap.sh ]] && echo "OWASP ZAP: Docker image ready"
  [[ "$CHOICE" == "4" ]] && docker compose -f "$LAB_DIR/sonarqube/docker-compose.yml" ps || true
}

echo
echo "============================================================"
echo "     NextGen DevSecOps Playground"
echo "     Jenkins / DevSecOps Lab Installation"
echo "============================================================"
echo
echo "Detected OS: $OS_NAME"
echo
echo "Select VM installation type:"
echo
echo "  1) Master-VM"
echo "  2) Slave-VM"
echo "  3) Master-Slave-VM"
echo "  4) Full DevSecOps Lab"
echo "  5) Exit"
echo
read -r -p "Enter your choice [1-5]: " CHOICE
case "$CHOICE" in
  1) ROLE="Master-VM";; 2) ROLE="Slave-VM";; 3) ROLE="Master-Slave-VM";; 4) ROLE="Full DevSecOps Lab";; 5) exit 0;; *) die "Invalid choice.";;
esac

echo "Selected: $ROLE"
read -r -p "Start installation? [y/N]: " CONFIRM
[[ "$CONFIRM" =~ ^([yY][eE][sS]|[yY])$ ]] || { echo "Installation cancelled."; exit 0; }

install_base_packages
install_java
create_lab_dirs
configure_firewall

case "$CHOICE" in
  1)
    install_jenkins
    ;;
  2)
    install_maven
    install_docker
    install_trivy
    install_dependency_check
    install_falco
    install_agent_user
    ;;
  3)
    install_jenkins
    install_maven
    install_docker
    install_trivy
    install_dependency_check
    install_falco
    install_agent_user
    ;;
  4)
    install_jenkins
    install_maven
    install_docker
    install_trivy
    install_dependency_check
    install_checkov
    install_inspec
    install_falco
    install_agent_user
    install_trufflehog
    install_zap
    install_sonarqube
    ;;
esac

validate

echo
echo "============================================================"
echo "              INSTALLATION COMPLETED"
echo "============================================================"
echo "OS: $OS_NAME"
echo "Role: $ROLE"
echo "Log: $LOG_FILE"
echo
if [[ "$CHOICE" == "1" || "$CHOICE" == "3" || "$CHOICE" == "4" ]]; then
  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  echo "Jenkins: http://${IP:-<VM-IP>}:8080"
fi
if [[ "$CHOICE" == "4" ]]; then
  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  echo "SonarQube: http://${IP:-<VM-IP>}:9000"
  echo "Pipeline: Git -> TruffleHog -> SonarQube -> Dependency-Check -> Trivy -> OWASP ZAP -> Falco"
fi
echo "============================================================"
