#!/usr/bin/env node

// Match logic duplicated exactly from scripts/netlify-ignore.mjs
const androidOnlyPatterns = [
  /^apps\/studio-android\//,
  /^packages\/ui-android\//,
  /^android\//
];

function shouldBuild(changedFiles) {
  if (changedFiles.length === 0) {
    return false; // Skip
  }
  return changedFiles.some(file => {
    return !androidOnlyPatterns.some(pattern => pattern.test(file));
  });
}

const testCases = [
  {
    name: "Android-only change (apps/studio-android/**)",
    files: ["apps/studio-android/package.json", "apps/studio-android/src/main.tsx"],
    expectedBuild: false // Skip Netlify build
  },
  {
    name: "Android UI-only change (packages/ui-android/**)",
    files: ["packages/ui-android/package.json", "packages/ui-android/src/components/BottomNav.tsx"],
    expectedBuild: false // Skip Netlify build
  },
  {
    name: "Gradle-only change (apps/studio-android/android/**)",
    files: ["apps/studio-android/android/app/build.gradle", "apps/studio-android/android/gradlew"],
    expectedBuild: false // Skip Netlify build
  },
  {
    name: "Web-only change (apps/studio-web/**)",
    files: ["apps/studio-web/package.json", "apps/studio-web/src/main.tsx"],
    expectedBuild: true // Run Netlify build
  },
  {
    name: "Web UI change (packages/ui-web/**)",
    files: ["packages/ui-web/src/components/StudioSidebar.tsx"],
    expectedBuild: true // Run Netlify build
  },
  {
    name: "Shared core change (packages/studio-core/**)",
    files: ["packages/studio-core/src/lib/sync.ts"],
    expectedBuild: true // Run Netlify build
  },
  {
    name: "Shared UI change (packages/ui-shared/**)",
    files: ["packages/ui-shared/src/components/ui/button.tsx"],
    expectedBuild: true // Run Netlify build
  },
  {
    name: "Root dependency change (package.json)",
    files: ["package.json"],
    expectedBuild: true // Run Netlify build
  },
  {
    name: "Root dependency change (pnpm-lock.yaml)",
    files: ["pnpm-lock.yaml"],
    expectedBuild: true // Run Netlify build
  },
  {
    name: "Invalid or unknown path (should build safely)",
    files: ["unknown-file.txt"],
    expectedBuild: true // Run Netlify build
  }
];

let failed = 0;
console.log("Running Netlify ignore path-filtering tests...\n");

for (const tc of testCases) {
  const result = shouldBuild(tc.files);
  const passed = result === tc.expectedBuild;
  if (passed) {
    console.log(`✓ [PASSED] ${tc.name}`);
    console.log(`  Files: [${tc.files.join(", ")}]`);
    console.log(`  Decision: ${result ? "BUILD" : "SKIP"}\n`);
  } else {
    console.log(`✗ [FAILED] ${tc.name}`);
    console.log(`  Files: [${tc.files.join(", ")}]`);
    console.log(`  Expected: ${tc.expectedBuild ? "BUILD" : "SKIP"}`);
    console.log(`  Actual: ${result ? "BUILD" : "SKIP"}\n`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`✗ Netlify path-filtering test failed with ${failed} failure(s).`);
  process.exit(1);
} else {
  console.log("✓ All Netlify path-filtering tests passed successfully.");
  process.exit(0);
}
