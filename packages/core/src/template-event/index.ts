import { z } from "zod";
import { defineEvent } from "../event";

/** Example domain event — replace with your own `defineEvent` definitions. */
export const TemplateExampleEvent = defineEvent(
  "template.example",
  z.object({ message: z.string() }),
);
