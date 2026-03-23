import { Sdk } from "@repo/sdk";

export const api = new Sdk({
  baseURL: import.meta.env.VITE_API_URL || "",
  credentials: "include",
});
