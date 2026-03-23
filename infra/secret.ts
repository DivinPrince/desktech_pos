export const secret = {
  DatabaseUrl: new sst.Secret("DatabaseUrl"),
  BetterAuthSecret: new sst.Secret("BetterAuthSecret"),
  FrontendUrl: new sst.Secret("FrontendUrl"),
};

export const allSecrets = Object.values(secret);
