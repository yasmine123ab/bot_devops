// src/index.ts
import 'dotenv/config';
import express, { Request, Response } from 'express';
import fetch from 'node-fetch';
import { TurnContext } from 'botbuilder';
import { adapter } from './internal/initialize';
import { ApplicationTurnState } from './internal/interface';
import { app as teamsApp } from './teamsBot';
import { CommandHandler } from './handlers/commandHandler';
import { HelloWorldCommandHandler } from './helloworldCommandHandler';

// Interface pour typer la réponse Slack
interface SlackResponse {
  ok: boolean;
  error?: string;
  [key: string]: any;
}

const expressApp = express();
expressApp.use(express.json());

// ----------------------------
// 1) Teams : vos handlers existants
// ----------------------------
const helloHandler = new HelloWorldCommandHandler();
teamsApp.message(
  helloHandler.triggerPatterns,
  async (context: TurnContext, state: ApplicationTurnState) => {
    const reply = await helloHandler.handleCommandReceived(context, state);
    if (reply) await context.sendActivity(reply);
  }
);

const commandHandler = new CommandHandler();
teamsApp.message(
  commandHandler.triggerPatterns,
  async (context: TurnContext, state: ApplicationTurnState) => {
    const reply = await commandHandler.handleCommandReceived(context, state);
    if (reply) await context.sendActivity(reply);
  }
);

// ----------------------------
// 2) Slack Events API
// ----------------------------
expressApp.post(
  '/api/slack/events',
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body;

    // 2.1) URL verification (lors de la config)
    if (body.type === 'url_verification') {
      res.status(200).send(body.challenge);
      return;
    }

    // 2.2) Event callbacks
    if (body.type === 'event_callback') {
      const ev = body.event as any;

      // On traite **seulement** les messages en DM (channel_type = im)
      // et **pas** ceux envoyés par un bot (évite les boucles)
      if (
        ev.type === 'message' &&
        ev.channel_type === 'im' &&
        !ev.bot_id
      ) {
        const userText: string = ev.text.trim();
        // Slack interprète “/df” comme Slash Command → on nettoie le “/”
        const cleaned = userText.startsWith('/')
          ? userText.slice(1)
          : userText;

        // Reconstruire un "fausse activité" pour votre CommandHandler :
        const fakeContext = {
          activity: {
            type: 'message',
            text: `/${cleaned}`,
            from: { role: 'user' },
          },
        } as TurnContext;

        // Exécution de la commande SSH / Nexus
        const reply = await commandHandler.handleCommandReceived(
          fakeContext,
          {} as ApplicationTurnState
        );

        if (typeof reply === 'string') {
          // On poste la réponse dans le même canal DM Slack
          const post = {
            channel: ev.channel,
            text: reply,
          };
          try {
            const slackRes = await fetch(
              'https://slack.com/api/chat.postMessage',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
                },
                body: JSON.stringify(post),
              }
            );
            const result = (await slackRes.json()) as SlackResponse;
            if (!result.ok) {
              console.error('❌ Slack API error:', result.error || result);
            }
          } catch (err) {
            console.error('❌ Error posting to Slack:', err);
          }
        }
      }
    }

    // Toujours 200 OK à Slack
    res.sendStatus(200);
  }
);

// ----------------------------
// 3) Teams : endpoint Bot Framework
// ----------------------------
expressApp.post('/api/messages', async (req, res) => {
  await adapter.process(req, res, async (context: TurnContext) => {
    if (context.activity.type === 'message') {
      await teamsApp.run(context);
    }
  });
});

// ----------------------------
// 4) Lancement du serveur
// ----------------------------
const port = parseInt(process.env.PORT || '3978', 10);
expressApp.listen(port, () => {
  console.log(`✅ Server listening on http://localhost:${port}`);
});
