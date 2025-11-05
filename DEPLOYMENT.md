# RexCloud - Komplette Deployment-Anleitung

Diese Anleitung führt Sie Schritt-für-Schritt durch die Installation von RexCloud auf einer frischen Linux VM.

> 💡 **Tipp:** Für eine **visuelle Anleitung** mit Diagrammen und erwarteten Ausgaben siehe [VISUAL_GUIDE.md](VISUAL_GUIDE.md)

## 📋 Inhaltsverzeichnis

1. [VM-Vorbereitung](#1-vm-vorbereitung)
2. [Automatische Installation](#2-automatische-installation-empfohlen)
3. [Manuelle Installation](#3-manuelle-installation-fortgeschritten)
4. [Erste Schritte nach der Installation](#4-erste-schritte-nach-der-installation)
5. [Konfiguration der Dienste](#5-konfiguration-der-dienste)
6. [SSL/TLS einrichten (optional)](#6-ssltls-einrichten-optional)
7. [Troubleshooting](#7-troubleshooting)
8. [Wartung und Updates](#8-wartung-und-updates)

---

## 1. VM-Vorbereitung

### 1.1 System-Anforderungen

**Minimum:**
- OS: Ubuntu 22.04 LTS oder Debian 12
- RAM: 2 GB
- CPU: 2 Cores
- Festplatte: 20 GB
- Netzwerk: Öffentliche IPv4-Adresse

**Empfohlen:**
- OS: Ubuntu 22.04 LTS
- RAM: 4 GB
- CPU: 4 Cores
- Festplatte: 50 GB SSD
- Netzwerk: Öffentliche IPv4-Adresse + Domain

### 1.2 VM erstellen

#### Bei Hetzner Cloud:

```bash
# Mit Hetzner CLI (optional)
hcloud server create \
  --name rexcloud \
  --type cx21 \
  --image ubuntu-22.04 \
  --ssh-key your-ssh-key
```

Oder über die Hetzner Cloud Console:
1. Server erstellen
2. Type: CX21 (2 vCPU, 4GB RAM)
3. Image: Ubuntu 22.04
4. SSH-Key hinzufügen
5. Server erstellen

#### Bei anderen Anbietern:

Erstellen Sie eine VM mit Ubuntu 22.04 LTS und stellen Sie sicher, dass:
- SSH-Zugriff aktiviert ist
- Port 80 und 443 offen sind
- Root-Zugriff oder Sudo-Rechte vorhanden sind

### 1.3 Erste Verbindung zur VM

```bash
# SSH-Verbindung herstellen
ssh root@your-server-ip

# Oder mit eigenem Benutzer
ssh username@your-server-ip
```

### 1.4 System aktualisieren

**WICHTIG:** Führen Sie dies als erstes aus:

```bash
# System-Updates installieren
sudo apt update && sudo apt upgrade -y

# Neustart (falls Kernel-Updates installiert wurden)
sudo reboot

# Nach Neustart wieder verbinden
ssh root@your-server-ip
```

### 1.5 Firewall konfigurieren (Optional, aber empfohlen)

```bash
# UFW Firewall installieren
sudo apt install ufw -y

# SSH erlauben (WICHTIG: Vor Aktivierung!)
sudo ufw allow 22/tcp

# HTTP und HTTPS erlauben
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Firewall aktivieren
sudo ufw enable

# Status prüfen
sudo ufw status
```

**Ausgabe sollte sein:**
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

---

## 2. Automatische Installation (Empfohlen)

### 2.1 Installation mit install.sh Script

Dies ist der **einfachste und schnellste Weg**:

```bash
# In Home-Verzeichnis wechseln
cd ~

# Repository klonen
git clone https://github.com/yourusername/rexcloud.git
cd rexcloud

# Installations-Script ausführbar machen
chmod +x install.sh

# Installation starten
./install.sh
```

Das Script wird:
1. ✅ System-Pakete aktualisieren
2. ✅ Docker & Docker Compose installieren
3. ✅ Sichere Passwörter generieren
4. ✅ .env-Datei erstellen
5. ✅ Docker-Container bauen
6. ✅ Services starten
7. ✅ Datenbank initialisieren

**Dauer:** ca. 5-10 Minuten

### 2.2 Während der Installation

Sie werden folgende Ausgaben sehen:

```
🚀 RexCloud Installation Script
================================

📋 Checking system requirements...
✓ Running as user: username
✓ User has sudo privileges
✓ Operating System: Ubuntu 22.04.3 LTS

📦 Installing system packages...
[... Installation läuft ...]

🐳 Installing Docker...
[... Docker Installation ...]

✅ Docker installed successfully
✅ User added to docker group

📥 Cloning RexCloud repository...
[... Git Clone ...]

🔐 Generating secure credentials...
Generated credentials:
  Database Password: [ZUFÄLLIGES PASSWORT]
  JWT Secret: [ZUFÄLLIGER SECRET]
  Encryption Key: [ZUFÄLLIGER KEY]

⚠️  IMPORTANT: Save these credentials securely!

🏗️  Building Docker images...
[... Docker Build ...]

🚀 Starting containers...
[... Container Start ...]

✅ All services are running!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ Installation Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2.3 Nach der automatischen Installation

**Server-IP herausfinden:**
```bash
# Externe IP anzeigen
curl ifconfig.me
```

**Zugriff testen:**
1. Öffnen Sie Browser
2. Navigieren Sie zu `http://IHRE-SERVER-IP`
3. Sie sollten die RexCloud Login-Seite sehen

**WICHTIG:** Nach der Installation müssen Sie sich **ausloggen und neu einloggen**, damit Docker-Berechtigungen wirksam werden:

```bash
# Ausloggen
exit

# Neu einloggen
ssh username@your-server-ip
```

---

## 3. Manuelle Installation (Fortgeschritten)

Falls Sie die Installation manuell durchführen möchten:

### 3.1 Docker installieren

```bash
# System aktualisieren
sudo apt update
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Docker GPG-Key hinzufügen
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Docker Repository hinzufügen
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Docker installieren
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Benutzer zur Docker-Gruppe hinzufügen
sudo usermod -aG docker $USER

# Docker-Dienst starten
sudo systemctl enable docker
sudo systemctl start docker

# Installation prüfen
docker --version
```

### 3.2 Docker Compose installieren

```bash
# Docker Compose installieren
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose

# Ausführbar machen
sudo chmod +x /usr/local/bin/docker-compose

# Version prüfen
docker-compose --version
```

### 3.3 RexCloud herunterladen

```bash
# Repository klonen
cd ~
git clone https://github.com/yourusername/rexcloud.git
cd rexcloud
```

### 3.4 Umgebungsvariablen konfigurieren

```bash
# Sichere Passwörter generieren
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
JWT_SECRET=$(openssl rand -base64 48 | tr -d "=+/" | cut -c1-48)
ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

# .env-Datei erstellen
cat > .env << EOF
# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=rexcloud
DB_USER=rexcloud
DB_PASSWORD=${DB_PASSWORD}

# JWT Configuration
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# Encryption Key (32 characters)
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Server Configuration
PORT=3001
NODE_ENV=production

# CORS Origins
CORS_ORIGINS=http://localhost
EOF

# Berechtigungen setzen
chmod 600 .env

# Passwörter anzeigen (WICHTIG: Notieren!)
echo "=== WICHTIG: Notieren Sie diese Passwörter ==="
echo "Database Password: ${DB_PASSWORD}"
echo "JWT Secret: ${JWT_SECRET}"
echo "Encryption Key: ${ENCRYPTION_KEY}"
echo "=============================================="
```

**⚠️ WICHTIG:** Speichern Sie diese Passwörter sicher! Sie werden nicht erneut angezeigt.

### 3.5 Docker-Container starten

```bash
# Container bauen
docker-compose build --no-cache

# Container starten
docker-compose up -d

# Warten bis Datenbank bereit ist
sleep 15

# Datenbank-Migration ausführen
docker-compose exec -T backend npm run migrate:build

# Status prüfen
docker-compose ps
```

**Erwartete Ausgabe:**
```
NAME                    STATUS              PORTS
rexcloud-frontend       Up 2 minutes        0.0.0.0:80->80/tcp
rexcloud-backend        Up 2 minutes        
rexcloud-db             Up 2 minutes
```

---

## 4. Erste Schritte nach der Installation

### 4.1 Zugriff testen

**Server-IP herausfinden:**
```bash
# Externe IP
curl ifconfig.me

# Oder
hostname -I | awk '{print $1}'
```

**Browser öffnen:**
```
http://IHRE-SERVER-IP
```

Sie sollten die RexCloud Anmeldeseite sehen.

### 4.2 Admin-Account erstellen

**WICHTIG:** Der **erste registrierte Benutzer** wird automatisch zum Admin!

1. Klicken Sie auf **"Registrieren"**
2. Geben Sie ein:
   - **Benutzername:** `admin` (oder Ihr gewünschter Name)
   - **E-Mail:** `admin@ihredomain.de`
   - **Passwort:** Mindestens 8 Zeichen, sicher!
3. Klicken Sie auf **"Registrieren"**
4. Sie werden automatisch eingeloggt

### 4.3 Erste Anmeldung

Nach erfolgreicher Registrierung sehen Sie das Dashboard mit:
- 📊 **Dashboard**: Übersicht
- 💻 **Proxmox**: VM/Container-Verwaltung
- 🌐 **DNS**: DNS-Verwaltung
- 📧 **Mail**: E-Mail-Server
- 🌍 **Websites**: Plesk-Verwaltung
- ☁️ **Hetzner**: Cloud-Server
- 📜 **Scripts**: Helper-Scripts
- 👥 **Kunden**: Kundenverwaltung
- ⚙️ **Einstellungen**: Konfiguration

### 4.4 Logs überprüfen

```bash
# Alle Logs anzeigen
docker-compose logs -f

# Nur Backend-Logs
docker-compose logs -f backend

# Nur Frontend-Logs
docker-compose logs -f frontend

# Letzte 50 Zeilen
docker-compose logs --tail=50
```

---

## 5. Konfiguration der Dienste

### 5.1 Proxmox Server hinzufügen

1. Gehen Sie zu **Einstellungen** → **Proxmox Server**
2. Klicken Sie **"Server hinzufügen"**
3. Geben Sie ein:
   ```
   Name: Proxmox-Node-1
   Host: https://proxmox.example.com
   Port: 8006
   Realm: pam (oder pve)
   Benutzername: root@pam
   Passwort: [Ihr Proxmox Passwort]
   ```
4. Klicken Sie **"Server hinzufügen"**
5. Server sollte jetzt unter **Proxmox** sichtbar sein

**Tipp:** Für API-Token statt Passwort:
```
Benutzername: root@pam!token-name
Passwort: [API Token Secret]
```

### 5.2 Hetzner DNS konfigurieren

1. Gehen Sie zu **Einstellungen** → **DNS Provider**
2. Wählen Sie **Hetzner DNS**
3. Geben Sie Ihren **Hetzner API Key** ein
4. Klicken Sie **"Speichern"**

**API Key erstellen:**
1. https://dns.hetzner.com
2. Account → API Tokens
3. "API Token erstellen"
4. Token kopieren

### 5.3 Hetzner Cloud konfigurieren

1. Gehen Sie zu **Einstellungen** → **Hetzner Cloud**
2. Geben Sie Ihren **Hetzner Cloud API Token** ein
3. Klicken Sie **"Speichern"**

**API Token erstellen:**
1. https://console.hetzner.cloud
2. Projekt auswählen
3. Security → API Tokens
4. "Token generieren"
5. Lese- und Schreibrechte aktivieren

### 5.4 Mailcow Server hinzufügen

1. Gehen Sie zu **Einstellungen** → **Mail Server**
2. Klicken Sie **"Server hinzufügen"**
3. Geben Sie ein:
   ```
   Name: Mail-Server 1
   Host: https://mail.example.com
   API Key: [Mailcow API Key]
   ```
4. Klicken Sie **"Server hinzufügen"**

**Mailcow API Key:**
1. Mailcow Admin-Panel öffnen
2. Konfiguration → API
3. API-Schlüssel erstellen
4. Lese- und Schreibrechte setzen

### 5.5 Plesk Server hinzufügen

1. Gehen Sie zu **Einstellungen** → **Plesk Server**
2. Klicken Sie **"Server hinzufügen"**
3. Geben Sie ein:
   ```
   Name: Webhosting-Server 1
   Host: https://plesk.example.com
   Port: 8443
   Benutzername: admin
   Passwort: [Plesk Admin-Passwort]
   ```
4. Klicken Sie **"Server hinzufügen"**

---

## 6. SSL/TLS einrichten (Optional)

### 6.1 Domain konfigurieren

**DNS-Eintrag erstellen:**
```
Type: A
Name: rexcloud (oder @)
Value: IHRE-SERVER-IP
TTL: 3600
```

**Warten bis DNS propagiert ist (5-30 Minuten):**
```bash
# DNS-Auflösung testen
nslookup rexcloud.ihredomain.de
dig rexcloud.ihredomain.de
```

### 6.2 Certbot installieren

```bash
# Certbot installieren
sudo apt install -y certbot python3-certbot-nginx

# Nginx als Reverse Proxy installieren
sudo apt install -y nginx
```

### 6.3 Nginx konfigurieren

```bash
# Nginx-Konfiguration erstellen
sudo nano /etc/nginx/sites-available/rexcloud
```

Fügen Sie ein:
```nginx
server {
    listen 80;
    server_name rexcloud.ihredomain.de;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Konfiguration aktivieren
sudo ln -s /etc/nginx/sites-available/rexcloud /etc/nginx/sites-enabled/

# Default-Config deaktivieren
sudo rm /etc/nginx/sites-enabled/default

# Nginx testen
sudo nginx -t

# Nginx neustarten
sudo systemctl restart nginx
```

### 6.4 SSL-Zertifikat erstellen

```bash
# Let's Encrypt Zertifikat erstellen
sudo certbot --nginx -d rexcloud.ihredomain.de

# Fragen beantworten:
# E-Mail: ihre-email@example.com
# Terms: Agree (A)
# Redirect HTTP to HTTPS: Yes (2)
```

**Automatische Erneuerung testen:**
```bash
# Dry-run
sudo certbot renew --dry-run
```

Certbot richtet automatisch einen Cronjob für Erneuerungen ein.

### 6.5 Zugriff mit HTTPS

Jetzt können Sie RexCloud über HTTPS erreichen:
```
https://rexcloud.ihredomain.de
```

---

## 7. Troubleshooting

### 7.1 Container starten nicht

**Problem:** Container starten nicht oder stoppen sofort

**Lösung:**
```bash
# Logs prüfen
docker-compose logs backend
docker-compose logs postgres

# Häufige Ursachen:
# 1. Datenbank nicht bereit
sleep 15 && docker-compose restart backend

# 2. Port bereits belegt
sudo lsof -i :80
sudo lsof -i :3001

# 3. Speicher voll
df -h
```

### 7.2 Datenbank-Verbindung fehlgeschlagen

**Problem:** Backend kann nicht mit Datenbank verbinden

**Lösung:**
```bash
# PostgreSQL-Container prüfen
docker-compose ps postgres

# Datenbank-Logs prüfen
docker-compose logs postgres

# In Datenbank einloggen (Test)
docker-compose exec postgres psql -U rexcloud -d rexcloud

# .env-Datei prüfen
cat .env | grep DB_
```

### 7.3 Frontend zeigt 502 Bad Gateway

**Problem:** Nginx zeigt 502-Fehler

**Lösung:**
```bash
# Backend-Status prüfen
docker-compose ps backend

# Backend neu starten
docker-compose restart backend

# Backend-Logs prüfen
docker-compose logs -f backend

# Port-Mapping prüfen
docker-compose ps
```

### 7.4 Login funktioniert nicht

**Problem:** Login schlägt fehl oder JWT-Fehler

**Lösung:**
```bash
# JWT_SECRET in .env prüfen
cat .env | grep JWT_SECRET

# Datenbank prüfen - Benutzer existiert?
docker-compose exec postgres psql -U rexcloud -d rexcloud -c "SELECT id, username, email, role FROM users;"

# Backend-Logs prüfen
docker-compose logs backend | grep -i error
```

### 7.5 Proxmox-Verbindung schlägt fehl

**Problem:** Kann nicht mit Proxmox verbinden

**Lösungen:**
1. **SSL-Zertifikat:** Proxmox verwendet selbst-signiertes Zertifikat
   - In Proxmox gültiges Zertifikat installieren
   - Oder SSL-Verifizierung temporär deaktivieren (nicht empfohlen)

2. **Firewall:** Port 8006 muss erreichbar sein
   ```bash
   # Von RexCloud-Server testen
   curl -k https://proxmox.example.com:8006
   ```

3. **Credentials:** Benutzername und Passwort prüfen
   - Format: `root@pam` oder `root@pve`
   - Passwort korrekt?

### 7.6 Zu wenig Speicherplatz

**Problem:** Docker-Images füllen Festplatte

**Lösung:**
```bash
# Speicher prüfen
df -h

# Ungenutzte Docker-Ressourcen löschen
docker system prune -a

# Logs einschränken
docker-compose logs --tail=100
```

### 7.7 Berechtigungsfehler

**Problem:** Permission denied bei Docker-Befehlen

**Lösung:**
```bash
# Benutzer zur Docker-Gruppe hinzufügen
sudo usermod -aG docker $USER

# Ausloggen und neu einloggen
exit
ssh username@your-server-ip

# Prüfen
docker ps
```

---

## 8. Wartung und Updates

### 8.1 System-Updates

```bash
# Regelmäßig ausführen
sudo apt update
sudo apt upgrade -y

# Nach Kernel-Updates
sudo reboot
```

### 8.2 RexCloud aktualisieren

```bash
cd ~/rexcloud

# Automatisches Update-Script
chmod +x update.sh
./update.sh
```

Das Script führt aus:
1. Backup der .env-Datei
2. Git pull (neueste Version)
3. Docker-Container neu bauen
4. Datenbank-Migrationen
5. Container neu starten

### 8.3 Backup erstellen

```bash
# Datenbank-Backup
docker-compose exec postgres pg_dump -U rexcloud rexcloud > backup_$(date +%Y%m%d_%H%M%S).sql

# .env-Datei sichern
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Komplettes Verzeichnis sichern
tar -czf rexcloud-backup-$(date +%Y%m%d).tar.gz ~/rexcloud
```

### 8.4 Datenbank wiederherstellen

```bash
# Aus Backup wiederherstellen
docker-compose exec -T postgres psql -U rexcloud rexcloud < backup_20240115_120000.sql
```

### 8.5 Container-Status überwachen

```bash
# Status anzeigen
docker-compose ps

# Ressourcen-Nutzung
docker stats

# Logs in Echtzeit
docker-compose logs -f
```

### 8.6 Services neu starten

```bash
# Alle Services
docker-compose restart

# Nur Backend
docker-compose restart backend

# Nur Frontend
docker-compose restart frontend

# Komplett neu starten
docker-compose down
docker-compose up -d
```

---

## 9. Zusätzliche Tipps

### 9.1 Performance-Optimierung

```bash
# Docker-Log-Rotation konfigurieren
sudo nano /etc/docker/daemon.json
```

Inhalt:
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

```bash
# Docker neu starten
sudo systemctl restart docker
docker-compose up -d
```

### 9.2 Monitoring einrichten

```bash
# Portainer installieren (Docker-GUI)
docker volume create portainer_data
docker run -d -p 9000:9000 --name=portainer --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce
```

Zugriff: `http://IHRE-IP:9000`

### 9.3 Automatische Backups einrichten

```bash
# Cronjob erstellen
crontab -e

# Tägliches Backup um 2:00 Uhr
0 2 * * * cd ~/rexcloud && docker-compose exec -T postgres pg_dump -U rexcloud rexcloud > ~/backups/rexcloud_$(date +\%Y\%m\%d).sql

# Alte Backups löschen (älter als 30 Tage)
0 3 * * * find ~/backups -name "rexcloud_*.sql" -mtime +30 -delete
```

---

## 10. Checkliste nach Installation

- [ ] System aktualisiert
- [ ] Firewall konfiguriert
- [ ] RexCloud installiert
- [ ] Admin-Account erstellt
- [ ] Proxmox-Server hinzugefügt
- [ ] DNS-Provider konfiguriert
- [ ] Mail-Server hinzugefügt (optional)
- [ ] Plesk-Server hinzugefügt (optional)
- [ ] SSL/TLS eingerichtet
- [ ] Backup-Strategie implementiert
- [ ] Monitoring eingerichtet
- [ ] .env-Datei gesichert
- [ ] Passwörter dokumentiert

---

## 11. Support und Hilfe

- 📖 **Dokumentation:** [README.md](README.md)
- 🐛 **Issues:** https://github.com/yourusername/rexcloud/issues
- 💬 **Diskussionen:** https://github.com/yourusername/rexcloud/discussions
- 📧 **E-Mail:** support@rexcloud.example

---

**Viel Erfolg mit RexCloud! 🚀**
