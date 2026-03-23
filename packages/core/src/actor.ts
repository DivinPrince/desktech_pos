import { createContext } from "./context";
import { VisibleError } from "./error";

export namespace Actor {
  export interface User {
    type: "user";
    properties: {
      userID: string;
      role: string;
    };
  }

  export interface System {
    type: "system";
    properties: {
      userID: string;
    };
  }

  export interface Public {
    type: "public";
    properties: Record<string, never>;
  }

  export type Info = User | Public | System;

  export const Context = createContext<Info>();

  export function userID() {
    const actor = current();
    if ("userID" in actor.properties) return actor.properties.userID;
    throw new VisibleError(
      "authentication",
      "UNAUTHORIZED",
      "You don't have permission to access this resource."
    );
  }

  export function role() {
    const actor = current();
    if ("role" in actor.properties) return actor.properties.role;
    return null;
  }

  export function current(): Info {
    try {
      return Context.get();
    } catch {
      return { type: "public", properties: {} } as Public;
    }
  }

  export function assert<T extends Info["type"]>(type: T) {
    const actor = current();
    if (actor.type !== type)
      throw new VisibleError(
        "authentication",
        "UNAUTHORIZED",
        `Actor is not "${type}"`
      );
    return actor as Extract<Info, { type: T }>;
  }

  export function provide<
    T extends Info["type"],
    Next extends (...args: never[]) => unknown,
  >(type: T, properties: Extract<Info, { type: T }>["properties"], fn: Next) {
    return Context.provide({ type, properties } as Extract<Info, { type: T }>, fn);
  }
}
