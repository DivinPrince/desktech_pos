/**
 * Apex hostname for your product (API is served at `api.<domain>`).
 * Replace with your real domains before deploying.
 */
export const domain =
  {
    production: "desktech-pos.spura.app",
    dev: "dev.desktech-pos.spura.app",
  }[$app.stage] || `${$app.stage}.dev.desktech-pos.spura.app`;
