# 🤖 DevOpsBot – Pilotage de VM Linux (SSH + Nexus) via Chat

&nbsp;&nbsp;&nbsp;**Crée par:** `Aboudi Yasmine`<br>
&nbsp;&nbsp;&nbsp;**Coaché par:** `Essouri Amir`

## Sommaire

* [Description](#Description)
* [Fonctionnalités](#Fonctionnalités)
* [Prerequis](#Prerequis)
* [Architecture](#Architecture)
* [Structure_du_projet](#Structure_du_projet)
* [Installation](#Installation)
* [Auteurs](#Auteurs)
* [License](#License)
* [Contact](#Contact)

---
## Description

DevOpsBot est un chatbot permettant à une équipe DevOps d’exécuter à distance des **commandes Linux**, de **récupérer des fichiers de logs** et de **lancer des scripts d’installation** stockés dans **Nexus Repository**.  
Il fonctionne avec **Microsoft Teams** (Bot Framework) et **Slack**.

---

## ✨ Fonctionnalités

- Exécution de commandes autorisées (liste blanche)
- Téléchargement de fichiers logs depuis la VM (`/getlog /chemin/fichier.log`)
- Exécution de scripts `.sh` ou `.jar` provenant de Nexus (`/runscript nomscript.sh`)
- Intégration Slack (mentions) et Teams
- Sécurisation via variables d’environnement

---

## ✅ Prerequis

- Node.js 18+
- VM Linux accessible en SSH (ex: Ubuntu)
- Nexus Repository (raw hosted) avec un repo `install-scripts`
- Slack Bot Token (si usage Slack) / Bot Azure (si Teams)
- ngrok (si développement local)

---

## 🧱 Architecture (vue rapide)

Bot (Node.js) → SSH/SFTP (`ssh2`) → VM Linux  
Bot → Nexus (HTTP) → Téléchargement script → Exécution sur VM

---

## 📂 Structure_du_projet

src/
├─ handlers/commandHandler.ts # Logique SSH, scripts, logs

      ├─ allowedCommands.json # Liste blanche des commandes
      ├─ index.ts # Serveur Express + endpoints Slack
      ├─ teamsBot.ts # Initialisation application
.env # Variables 

---

## ⚙️ Installation

```bash
git clone <repo>
cd devopsbot
npm install
cp .env.example .env   # Créez votre fichier .env
```

---

## 👩‍💻 Auteurs

#### Aboudi Yasmine
* [GitHub] https://github.com/yasmine123ab
* [LinkedIn] https://www.linkedin.com/in/aboudi-yasmine/

---

## 📄 License

La licence du dépôt `bot_devops` est l'Academic Free License v3.0 (AFL-3.0).

---

## 📬 Contact

Pour toute information, suggestion ou question concernant mon travail, vous pouvez me contacter par e-mail 📧 : [yasmine.aboudi@esprit.tn]


