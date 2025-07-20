import { Selector } from "@microsoft/teams-ai";
import { Activity, TurnContext } from "botbuilder";
import { ApplicationTurnState } from "./internal/interface";

export class GenericCommandHandler {
  triggerPatterns: string | RegExp | Selector | (string | RegExp | Selector)[] = /^.+$/;

  async handleCommandReceived(
    context: TurnContext,
    state: ApplicationTurnState
  ): Promise<string | Partial<Activity> | void> {
    const raw = context.activity.text?.trim().toLowerCase();

    if (!raw || !["hi", "hello", "help", "helloworld"].includes(raw)) {
      return;
    }

    switch (raw) {
      case "hi":
        return "👋 Hi there! I'm your Command Bot.";
      case "hello":
        return "Hello! Ready to help you.";
      case "help":
        return "📋 Available commands:\n- `/df`\n- `/uptime`\n- `/status`\n- `helloWorld`";
      default:
        return;
    }
  }
}
