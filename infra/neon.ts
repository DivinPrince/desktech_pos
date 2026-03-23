import "./sst-ion-globals";

/**
 * Neon + SST: https://neon.com/guides/neon-sst
 * One Neon project (shared across stages) + one branch per SST stage.
 * Set NEON_PROJECT_ID after the first project exists so every stage targets the same project.
 */
import { all } from "@pulumi/pulumi";

const orgId = process.env.NEON_ORG_ID;
if (!orgId) {
  throw new Error(
    "NEON_ORG_ID is required (Neon Console → Account settings → Organization).",
  );
}

const existingProjectId = process.env.NEON_PROJECT_ID?.trim();

const neonProject = existingProjectId
  ? new neon.Project(
      "DesktechNeonProject",
      { orgId },
      { import: existingProjectId },
    )
  : new neon.Project("DesktechNeonProject", {
      name: process.env.NEON_PROJECT_NAME ?? "desktech-pos",
      pgVersion: 17,
      regionId: "aws-us-east-1",
      orgId,
      historyRetentionSeconds: 21600,
    });

/** Neon branch names: alphanumeric, underscore, hyphen (stage is normalized). */
function branchNameFromStage(stage: string): string {
  const normalized = stage
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (normalized || "stage").slice(0, 128);
}

const stageBranchName = branchNameFromStage($app.stage);

const stageBranch = new neon.Branch("DesktechStageBranch", {
  projectId: neonProject.id,
  name: stageBranchName,
  ...($app.stage === "production" ? { "protected": "yes" } : {}),
});

const stageEndpoint = new neon.Endpoint("DesktechStageEndpoint", {
  projectId: neonProject.id,
  branchId: stageBranch.id,
  type: "read_write",
});

const appRole = new neon.Role("DesktechAppRole", {
  projectId: neonProject.id,
  branchId: stageBranch.id,
  name: "app_user",
});

const appDatabase = new neon.Database("DesktechAppDatabase", {
  projectId: neonProject.id,
  branchId: stageBranch.id,
  name: "desktech",
  ownerName: appRole.name,
});

const connectionString = all([
  stageEndpoint.host,
  appRole.name,
  appRole.password,
  appDatabase.name,
]).apply(([host, user, password, database]) => {
  const u = encodeURIComponent(user);
  const p = encodeURIComponent(password);
  const d = encodeURIComponent(database);
  return `postgresql://${u}:${p}@${host}/${d}?sslmode=require`;
});

/** Linked as `Resource.NeonDatabase.connectionString` (Lambda, `sst shell`, etc.). */
export const neonDatabase = new sst.Linkable("NeonDatabase", {
  properties: {
    connectionString,
  },
});

export const outputs = {
  neonProjectId: neonProject.id,
  neonBranchName: stageBranchName,
};
