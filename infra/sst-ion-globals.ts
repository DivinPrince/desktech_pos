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

  namespace neon {
    class Project {
      readonly id: unknown;
      readonly connectionUri: unknown;
      constructor(
        name: string,
        args: { orgId: string } | Record<string, unknown>,
        opts?: { import: string },
      );
    }

    class Branch {
      readonly id: unknown;
      constructor(
        name: string,
        args: {
          projectId: unknown;
          name: string;
          "protected"?: string;
        },
      );
    }

    class Endpoint {
      readonly host: unknown;
      constructor(
        name: string,
        args: {
          projectId: unknown;
          branchId: unknown;
          type: string;
        },
      );
    }

    class Role {
      readonly name: unknown;
      readonly password: unknown;
      constructor(
        name: string,
        args: {
          projectId: unknown;
          branchId: unknown;
          name: string;
        },
      );
    }

    class Database {
      readonly name: unknown;
      constructor(
        name: string,
        args: {
          projectId: unknown;
          branchId: unknown;
          name: string;
          ownerName: unknown;
        },
      );
    }
  }

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
