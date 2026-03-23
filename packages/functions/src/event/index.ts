import { Actor } from "@repo/core/actor";
import { TemplateExampleEvent } from "@repo/core/template-event";
import { bus } from "sst/aws/bus";

const events = [TemplateExampleEvent];

async function provideActor<
  T extends {
    metadata: {
      actor: {
        type: "user" | "system" | "public";
        properties: Record<string, unknown>;
      };
    };
  },
>(event: T, fn: () => Promise<void>) {
  const actor = event.metadata.actor;

  if (actor.type === "user") {
    await Actor.provide(
      "user",
      {
        userID: String(actor.properties.userID),
        role: String(actor.properties.role ?? "user"),
      },
      fn,
    );
    return;
  }

  if (actor.type === "system") {
    await Actor.provide(
      "system",
      {
        userID: String(actor.properties.userID),
      },
      fn,
    );
    return;
  }

  await Actor.provide("public", {}, fn);
}

export const handler = bus.subscriber(events, async (event) =>
  provideActor(event, async () => {
    if (event.type === TemplateExampleEvent.type) {
      console.info("template.example", { message: event.properties.message });
      return;
    }
    console.warn("[bus] unhandled event type", (event as { type: string }).type);
  }),
);
