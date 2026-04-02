declare const $config: <
  T extends {
    app?: (input?: { stage: string }) => unknown;
    run?: () => unknown | Promise<unknown>;
  },
>(
  config: T,
) => T;

export default $config({
  app(input?: { stage: string }) {
    return {
      name: "desktech-pos",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          region: "us-east-1",
        },
        cloudflare: true,
      },
    };
  },
  async run() {
    const { readdirSync } = await import("node:fs");
    const outputs: Record<string, unknown> = {};
    for (const value of readdirSync("./infra/")) {
      if (!value.endsWith(".ts") && !value.endsWith(".js")) continue;
      const result = await import("./infra/" + value);
      if (result.outputs) Object.assign(outputs, result.outputs);
    }
    const { domain } = await import("./infra/" + "dns.ts");
    const apiUrl = "https://api." + domain;
    return outputs;
  },
});
