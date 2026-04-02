export const secret = {
  BetterAuthSecret: new sst.Secret("BetterAuthSecret"),
  FrontendUrl: new sst.Secret("FrontendUrl"),
  DatabaseUrl: new sst.Secret("DatabaseUrl"),
};

export const allSecrets = Object.values(secret);
