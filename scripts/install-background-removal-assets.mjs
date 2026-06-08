#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ASSET_VERSION = "1.7.0";
const ASSET_PACKAGE_URL = `https://staticimgly.com/@imgly/background-removal-data/${ASSET_VERSION}/package.tgz`;
const EXPECTED_PACKAGE_BYTES = 284706412;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const destinationDir = join(repoRoot, "public", "vendor", "background-removal", ASSET_VERSION, "dist");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }
}

function verifyInstalled() {
  const resourcesFile = join(destinationDir, "resources.json");
  const modelsDir = join(destinationDir, "models");
  const onnxDir = join(destinationDir, "onnxruntime-web");

  if (!existsSync(resourcesFile) || !existsSync(modelsDir) || !existsSync(onnxDir)) {
    throw new Error(`Background-removal assets are incomplete at ${destinationDir}`);
  }

  console.log(`Background-removal assets installed at ${destinationDir}`);
}

async function install() {
  const force = process.argv.includes("--force");
  const verifyOnly = process.argv.includes("--verify-only");

  if (verifyOnly) {
    verifyInstalled();
    return;
  }

  if (existsSync(destinationDir) && !force) {
    verifyInstalled();
    console.log("Use --force to replace the installed asset directory.");
    return;
  }

  const tempDir = await mkdtemp(join(tmpdir(), `background-removal-${ASSET_VERSION}-`));
  const archivePath = join(tempDir, "package.tgz");

  try {
    console.log(`Downloading ${ASSET_PACKAGE_URL}`);
    console.log(`Expected package size: ${EXPECTED_PACKAGE_BYTES} bytes`);
    run("curl", ["-fL", ASSET_PACKAGE_URL, "-o", archivePath]);

    console.log("Extracting package");
    run("tar", ["-xzf", archivePath, "-C", tempDir]);

    const extractedDistDir = join(tempDir, "package", "dist");
    if (!existsSync(extractedDistDir)) {
      throw new Error(`Expected package/dist in ${archivePath}`);
    }

    rmSync(destinationDir, { recursive: true, force: true });
    mkdirSync(destinationDir, { recursive: true });
    cpSync(extractedDistDir, destinationDir, { recursive: true });

    verifyInstalled();
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

install().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
