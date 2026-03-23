import { event } from "sst/event";
import { z } from "zod";
import { Actor } from "./actor";

const zodValidator = <T extends z.ZodTypeAny>(schema: T) => (input: unknown) =>
  schema.parse(input);

export const defineEvent = event.builder({
  validator: zodValidator,
  metadata() {
    return {
      actor: Actor.current(),
    };
  },
});
