/**
 * Apex hostname for your product (API is served at `api.<domain>`).
 * Replace with your real domains before deploying.
 */
export const domain =
  {
    production: "example.com",
    dev: "dev.example.com",
  }[$app.stage] || `${$app.stage}.dev.example.com`;
