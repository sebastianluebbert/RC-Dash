# SSL-Zertifikat Setup mit Let's Encrypt

## 📋 Übersicht

RexCloud unterstützt automatische SSL-Zertifikate via Let's Encrypt mit vollständiger Verwaltung über die Web-UI.

## 🚀 Installation

### Voraussetzungen

1. **Domain-Konfiguration**: Ihre Domain muss bereits auf Ihren Server zeigen (A-Record)
2. **Ports**: Port 80 und 443 müssen erreichbar sein
3. **Root-Zugriff**: Das Setup-Script benötigt Root-Rechte

### Schritt 1: Domain-DNS konfigurieren

Erstellen Sie einen A-Record bei Ihrem Domain-Provider:

```
Type: A
Name: @ (für root domain) oder subdomain
Value: [Ihre Server-IP]
TTL: 300 (oder Standard)
```

Für www-Subdomain:
```
Type: A
Name: www
Value: [Ihre Server-IP]
```

**Warten Sie 5-15 Minuten** bis die DNS-Änderungen propagiert sind.

### Schritt 2: SSL-Setup ausführen

```bash
cd ~/RC-Dash
sudo ./setup-ssl.sh
```

Das Script führt Sie durch den Prozess:
1. Fragt nach Ihrer Domain (z.B. `dashboard.example.com`)
2. Fragt nach Ihrer E-Mail-Adresse (für Let's Encrypt Benachrichtigungen)
3. Bestätigung der Eingaben
4. Automatische Installation von certbot (falls nicht vorhanden)
5. Zertifikat-Anforderung bei Let's Encrypt
6. Nginx-Konfiguration mit SSL
7. Container-Neustart mit HTTPS
8. Einrichtung automatischer Erneuerung

### Schritt 3: Überprüfung

Nach dem Setup ist Ihre Installation unter `https://ihre-domain.com` erreichbar.

HTTP-Anfragen werden automatisch auf HTTPS weitergeleitet.

## 🔄 Automatische Erneuerung

Das Setup konfiguriert automatisch einen Cron-Job, der:
- **Zweimal täglich** (00:00 und 12:00 Uhr) prüft, ob eine Erneuerung nötig ist
- Zertifikate **30 Tage vor Ablauf** erneuert
- Nach Erneuerung automatisch **Nginx neu lädt**
- Alle Aktionen in `ssl-renewal.log` protokolliert

### Erneuerungs-Logs anzeigen

```bash
tail -f ~/RC-Dash/ssl-renewal.log
```

## 🎛️ Verwaltung über Web-UI

Nach der Installation können Sie das Zertifikat über die Web-UI verwalten:

1. Einloggen in RexCloud
2. Navigation zu **Einstellungen** → **SSL-Zertifikat**
3. Hier können Sie:
   - Zertifikat-Status einsehen
   - Verbleibende Gültigkeitsdauer prüfen
   - Manuell erneuern (falls nötig)
   - Konfiguration testen
   - Erneuerungs-Historie anzeigen

### Zertifikat-Informationen

Die SSL-Seite zeigt:
- **Domain**: Ihre konfigurierte Domain
- **Aussteller**: Let's Encrypt
- **Gültig von/bis**: Gültigkeitszeitraum
- **Verbleibende Tage**: Countdown bis Ablauf
- **Automatische Erneuerung**: Status des Auto-Renewal
- **Letzte Erneuerung**: Zeitpunkt der letzten Erneuerung

### Manuelle Erneuerung

Falls Sie das Zertifikat manuell erneuern möchten:

**Via Web-UI:**
1. Einstellungen → SSL-Zertifikat
2. Button "Jetzt erneuern" klicken

**Via Command Line:**
```bash
cd ~/RC-Dash
sudo certbot renew --force-renewal
sudo ./renew-ssl.sh
```

### Konfiguration testen

**Via Web-UI:**
1. Einstellungen → SSL-Zertifikat
2. Button "Konfiguration testen" klicken

**Via Command Line:**
```bash
# Nginx Konfiguration testen
docker-compose exec frontend nginx -t

# Zertifikat prüfen
openssl x509 -in /etc/letsencrypt/live/IHRE-DOMAIN/fullchain.pem -noout -dates
```

## 🔧 Troubleshooting

### Problem: Zertifikat kann nicht ausgestellt werden

**Mögliche Ursachen:**
1. Domain zeigt nicht auf Server (DNS nicht propagiert)
2. Port 80 ist blockiert (Firewall/Router)
3. Webserver läuft bereits auf Port 80

**Lösung:**
```bash
# DNS prüfen
dig +short ihre-domain.com
# oder
nslookup ihre-domain.com

# Port 80 testen
curl -I http://ihre-domain.com/.well-known/acme-challenge/test

# Firewall-Status prüfen
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Problem: Automatische Erneuerung funktioniert nicht

**Überprüfung:**
```bash
# Cron-Job anzeigen
crontab -l | grep certbot

# Manueller Erneuerungs-Test (Dry-Run)
sudo certbot renew --dry-run
```

**Cron-Job manuell hinzufügen:**
```bash
crontab -e

# Folgende Zeile hinzufügen:
0 0,12 * * * certbot renew --quiet --deploy-hook 'cd /home/user/RC-Dash && ./renew-ssl.sh'
```

### Problem: Nginx startet nach SSL-Setup nicht

**Überprüfung:**
```bash
# Logs anzeigen
docker-compose logs frontend

# Nginx Konfiguration testen
docker-compose exec frontend nginx -t

# Container neu starten
docker-compose restart frontend
```

### Problem: Zertifikat abgelaufen

**Manuelle Erneuerung:**
```bash
cd ~/RC-Dash
sudo certbot renew --force-renewal
sudo ./renew-ssl.sh
docker-compose restart frontend
```

## 📁 Wichtige Dateien

```
~/RC-Dash/
├── setup-ssl.sh           # SSL-Setup Script
├── renew-ssl.sh           # Erneuerungs-Script
├── nginx-ssl.conf         # Nginx SSL-Konfiguration
├── nginx.conf             # Aktive Nginx-Config
├── nginx/ssl/             # Zertifikat-Kopien
│   ├── fullchain.pem
│   └── privkey.pem
├── certbot/
│   ├── www/               # ACME Challenge Verzeichnis
│   └── conf/              # Certbot Konfiguration
└── ssl-renewal.log        # Erneuerungs-Log
```

**Originale Let's Encrypt Zertifikate:**
```
/etc/letsencrypt/live/IHRE-DOMAIN/
├── fullchain.pem          # Vollständige Zertifikatskette
├── privkey.pem            # Private Key
├── cert.pem               # Nur Zertifikat
└── chain.pem              # Nur Zwischenzertifikate
```

## 🔐 Sicherheit

### SSL/TLS Konfiguration

Die Nginx-Konfiguration verwendet:
- **Protokolle**: TLSv1.2 und TLSv1.3
- **Ciphers**: HIGH:!aNULL:!MD5
- **HSTS**: Strict-Transport-Security Header (1 Jahr)
- **Session Cache**: 10MB, 10 Minuten Timeout

### Security Headers

Automatisch aktiviert:
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

### Zertifikat-Berechtigungen

Die Zertifikat-Dateien werden nur lesbar für den Nginx-Container gemountet:
```yaml
volumes:
  - ./nginx/ssl:/etc/nginx/ssl:ro  # read-only
```

## 🌐 Mehrere Domains

Um mehrere Domains zu unterstützen:

1. Zertifikat für zweite Domain anfordern:
```bash
sudo certbot certonly --webroot \
  --webroot-path /home/user/RC-Dash/certbot/www \
  --email ihre@email.com \
  --agree-tos \
  --domain zweite-domain.com
```

2. Nginx-Konfiguration erweitern:
```nginx
server {
    listen 443 ssl http2;
    server_name zweite-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/zweite-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/zweite-domain.com/privkey.pem;
    
    # ... Rest der Konfiguration
}
```

3. Nginx neu laden:
```bash
docker-compose exec frontend nginx -s reload
```

## 📚 Weitere Informationen

- [Let's Encrypt Dokumentation](https://letsencrypt.org/docs/)
- [Certbot Dokumentation](https://certbot.eff.org/docs/)
- [Nginx SSL Konfiguration](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [SSL Server Test](https://www.ssllabs.com/ssltest/)

## 💡 Tipps

1. **Backup**: Sichern Sie `/etc/letsencrypt/` regelmäßig
2. **Monitoring**: Überwachen Sie die Gültigkeit über die Web-UI
3. **Testing**: Testen Sie Erneuerungen mit `--dry-run` bevor Sie sie erzwingen
4. **Logs**: Überprüfen Sie regelmäßig `ssl-renewal.log`
5. **Updates**: Halten Sie certbot aktuell: `sudo apt update && sudo apt upgrade certbot`

## 🆘 Support

Bei Problemen:
1. Überprüfen Sie die Logs: `docker-compose logs`
2. Testen Sie die Nginx-Konfiguration: `docker-compose exec frontend nginx -t`
3. Prüfen Sie den Certbot-Status: `sudo certbot certificates`
4. Konsultieren Sie die Certbot-Logs: `sudo less /var/log/letsencrypt/letsencrypt.log`
