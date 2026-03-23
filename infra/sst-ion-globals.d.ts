/**
 * Ambient types for SST Ion globals available when `infra/*.ts` is loaded from
 * `sst.config.ts` `run()`. The real definitions live in generated `sst-env.d.ts`
 * (often gitignored); this file keeps `tsc`/the IDE happy without it.
 */

declare global {
  const $dev: boolean;

  const $app: {
    readonly stage: string;
  };

  namespace aws {
    namespace lambda {
      class Invocation {
        constructor(
          name: string,
          args: {
            input: string;
            functionName: unknown;
          },
        );
      }
    }
  }

  namespace sst {
    class Secret {
      readonly value: string;
      constructor(name: string);
    }

    class Linkable<T = Record<string, unknown>> {
      constructor(name: string, args: { properties: T });
    }

    namespace cloudflare {
      function dns(): unknown;
    }

    namespace aws {
      class Bucket {
        readonly name: unknown;
        constructor(name: string, args?: Record<string, unknown>);
      }

      class Bus {
        readonly name: unknown;
        constructor(name: string, args?: Record<string, unknown>);
        subscribe(topic: string, subscriber: Record<string, unknown>): void;
      }

      class Function {
        readonly name: unknown;
        readonly url: unknown;
        constructor(name: string, args?: Record<string, unknown>);
      }

      class Router {
        readonly url: unknown;
        constructor(name: string, args?: Record<string, unknown>);
      }
    }
  }
}

export {};
