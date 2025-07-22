// src/handlers/commandHandler.ts
import { TurnContext } from "botbuilder";
import { Selector } from "@microsoft/teams-ai";
import { ApplicationTurnState } from "../internal/interface";
import { Client, ConnectConfig } from "ssh2";
import allowedCommands from "../allowedCommands.json";
import fs from "fs";
import path from "path";
import os from "os";
import http from "http";

export class CommandHandler {
  triggerPatterns: string | RegExp | Selector | (string | RegExp | Selector)[] = /.*/;

  async handleCommandReceived(
    context: TurnContext,
    state: ApplicationTurnState
  ): Promise<string | void> {
    if (
      context.activity.type !== "message" ||
      context.activity.from?.role !== "user"
    ) {
      return;
    }

    const text = context.activity.text?.trim();
    if (!text) return;

    if (!text.startsWith("/")) {
      return [
        "👋 Bonjour ! Je suis votre bot DevOps.",
        "Je peux exécuter des commandes à distance sur votre VM.",
        "🚀 Tapez une commande commençant par `/`, par exemple :",
        "   • `/df` pour voir l’espace disque",
        "   • `/uptime` pour voir la charge système",
        "   • `/getlog /chemin/fichier.log` pour récupérer un fichier log",
        "   • `/runscript install-example.sh` pour exécuter un script Nexus"
      ].join("\n");
    }

    const [cmd, ...args] = text.slice(1).split(/\s+/);

    if (cmd === "getlog" && args.length > 0) {
      try {
        const remotePath = args.join(" ");
        const localPath = await retrieveLogFile(remotePath);
        return `✅ Fichier \`${remotePath}\` sauvegardé localement ici :\n\n📁 ${localPath}`;
      } catch (err: any) {
        console.error("Erreur lors du getlog:", err);
        return `❌ Impossible de récupérer le fichier : ${err.message}`;
      }
    }

    if (cmd === "runscript" && args.length === 1) {
      const scriptName = args[0];
      try {
        const result = await downloadAndRunScript(scriptName);
        return result;
      } catch (err: any) {
        console.error("Erreur runscript:", err);
        return `❌ Échec lors de l'exécution du script : ${err.message}`;
      }
    }

    const commandToRun = (allowedCommands as Record<string, string>)[cmd];
    if (!commandToRun) {
      return `❌ Commande "/${cmd}" non autorisée.`;
    }

    try {
      const output = await runSSH(commandToRun);
      return `✅ Résultat :\n${output}`;
    } catch (err: any) {
      console.error("SSH Error:", err);
      return `❌ Erreur SSH : ${err.message || err}`;
    }
  }
}

async function runSSH(cmd: string): Promise<string> {
  const config: ConnectConfig = {
    host: process.env.SSH_HOST!,
    port: parseInt(process.env.SSH_PORT!),
    username: process.env.SSH_USER!,
    password: process.env.SSH_PASS!,
    readyTimeout: 20000,
    algorithms: { serverHostKey: ["ssh-rsa", "ssh-ed25519"] },
  };

  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => {
        conn.exec(cmd, (err, stream) => {
          if (err) {
            conn.end();
            return reject(err);
          }
          let out = "";
          stream
            .on("data", (d: Buffer) => (out += d.toString()))
            .stderr.on("data", (d: Buffer) => (out += d.toString()))
            .on("close", () => {
              conn.end();
              resolve(out.trim());
            });
        });
      })
      .on("error", (e) => reject(e))
      .connect(config);
  });
}

async function retrieveLogFile(remotePath: string): Promise<string> {
  const config: ConnectConfig = {
    host: process.env.SSH_HOST!,
    port: parseInt(process.env.SSH_PORT!),
    username: process.env.SSH_USER!,
    password: process.env.SSH_PASS!,
    readyTimeout: 50000,
    algorithms: { serverHostKey: ["ssh-rsa", "ssh-ed25519"] },
  };

  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => {
        conn.sftp((err, sftp) => {
          if (err) return reject(err);

          const downloadDir = path.join(__dirname, "..", "downloads");
          if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
          }

          const localPath = path.join(downloadDir, path.basename(remotePath));
          const writeStream = fs.createWriteStream(localPath);

          const readStream = sftp.createReadStream(remotePath);
          readStream
            .on("error", reject)
            .pipe(writeStream)
            .on("finish", () => resolve(localPath));
        });
      })
      .on("error", (e) => reject(e))
      .connect(config);
  });
}

async function uploadToVM(localPath: string, remotePath: string): Promise<void> {
  const config: ConnectConfig = {
    host: process.env.SSH_HOST!,
    port: parseInt(process.env.SSH_PORT!),
    username: process.env.SSH_USER!,
    password: process.env.SSH_PASS!,
    readyTimeout: 50000,
    algorithms: { serverHostKey: ["ssh-rsa", "ssh-ed25519"] },
  };

  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => {
        conn.sftp((err, sftp) => {
          if (err) return reject(err);

          const readStream = fs.createReadStream(localPath);
          const writeStream = sftp.createWriteStream(remotePath, { mode: 0o755 });

          writeStream.on("close", () => {
            conn.end();
            resolve();
          });

          readStream.on("error", reject);
          writeStream.on("error", reject);

          readStream.pipe(writeStream);
        });
      })
      .on("error", (e) => reject(e))
      .connect(config);
  });
}

async function downloadAndRunScript(scriptName: string): Promise<string> {
  const nexusHost = process.env.NEXUS_HOST || "http://192.168.1.6:8081";
  const scriptUrl = `${nexusHost}/repository/install-scripts/${scriptName}`;
  const localTempPath = path.join(os.tmpdir(), scriptName);
  const remoteTempPath = `/tmp/${scriptName}`;

  return new Promise((resolve, reject) => {
    http.get(scriptUrl, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Fichier non trouvé : ${scriptUrl}`));
      }

      let scriptData = "";
      res
        .on("data", (chunk) => {
          scriptData += chunk;
        })
        .on("end", async () => {
          try {
            fs.writeFileSync(localTempPath, scriptData.replace(/\r/g, ""), { mode: 0o755 });
            await uploadToVM(localTempPath, remoteTempPath);

            const command = scriptName.endsWith(".jar")
              ? `java -jar ${remoteTempPath}`
              : `bash ${remoteTempPath}`;

            const output = await runSSH(command);
            const link = `[${scriptName}](${scriptUrl})`;

            resolve(`✅ Script ${link} terminé.\n\nSortie :\n${output}`);
          } catch (e) {
            reject(e);
          }
        });
    }).on("error", reject);
  });
}
