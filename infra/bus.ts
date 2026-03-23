import { allSecrets } from "./secret";

export const bus = new sst.aws.Bus("Bus");

bus.subscribe("Event", {
  handler: "./packages/core/src/functions/event/index.handler",
  link: [...allSecrets],
  timeout: "5 minutes",
});

export const outputs = {
  bus: bus.name,
};
