export const secret = {
  BetterAuthSecret: new sst.Secret("BetterAuthSecret"),
  FrontendUrl: new sst.Secret("FrontendUrl"),
};

export const allSecrets = Object.values(secret);
