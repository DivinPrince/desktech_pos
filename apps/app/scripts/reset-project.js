#!/usr/bin/env node

/**
 * Resets the project to a blank Expo Router layout under `src/`.
 * Moves or deletes `src/app`, `src/components`, `src/hooks`, `src/constants`
 * and recreates `src/app` with starter files.
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const root = process.cwd();
const srcDir = path.join(root, "src");
const oldDirs = ["app", "components", "hooks", "constants"];
const exampleDir = path.join(srcDir, "app-example");
const newAppDir = path.join(srcDir, "app");

const indexContent = `import { Text, View } from "react-native";

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text>Edit src/app/index.tsx to edit this screen.</Text>
    </View>
  );
}
`;

const layoutContent = `import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack />;
}
`;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const moveDirectories = async (userInput) => {
  try {
    await fs.promises.mkdir(srcDir, { recursive: true });

    if (userInput === "y") {
      await fs.promises.mkdir(exampleDir, { recursive: true });
      console.log("📁 src/app-example directory ready.");
    }

    for (const dir of oldDirs) {
      const oldDirPath = path.join(srcDir, dir);
      if (fs.existsSync(oldDirPath)) {
        if (userInput === "y") {
          const newDirPath = path.join(exampleDir, dir);
          await fs.promises.rename(oldDirPath, newDirPath);
          console.log(`➡️ src/${dir} moved to src/app-example/${dir}.`);
        } else {
          await fs.promises.rm(oldDirPath, { recursive: true, force: true });
          console.log(`❌ src/${dir} deleted.`);
        }
      } else {
        console.log(`➡️ src/${dir} does not exist, skipping.`);
      }
    }

    await fs.promises.mkdir(newAppDir, { recursive: true });
    console.log("\n📁 New src/app directory created.");

    const indexPath = path.join(newAppDir, "index.tsx");
    await fs.promises.writeFile(indexPath, indexContent);
    console.log("📄 src/app/index.tsx created.");

    const layoutPath = path.join(newAppDir, "_layout.tsx");
    await fs.promises.writeFile(layoutPath, layoutContent);
    console.log("📄 src/app/_layout.tsx created.");

    console.log("\n✅ Project reset complete. Next steps:");
    console.log(
      `1. Run \`npx expo start\` to start a development server.\n2. Edit src/app/index.tsx to edit the main screen.${
        userInput === "y"
          ? "\n3. Delete src/app-example when you're done referencing it."
          : ""
      }`
    );
  } catch (error) {
    console.error(`❌ Error during script execution: ${error.message}`);
  }
};

rl.question(
  "Do you want to move existing files to src/app-example instead of deleting them? (Y/n): ",
  (answer) => {
    const userInput = answer.trim().toLowerCase() || "y";
    if (userInput === "y" || userInput === "n") {
      moveDirectories(userInput).finally(() => rl.close());
    } else {
      console.log("❌ Invalid input. Please enter 'Y' or 'N'.");
      rl.close();
    }
  }
);
