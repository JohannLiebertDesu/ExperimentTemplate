// Generates study.jas from study-config.json with fresh UUIDs.
// Run once when creating a new study from the template: npm run init-study
//
// IMPORTANT: Never run this again after importing to JATOS.
// Regenerating UUIDs causes JATOS to treat re-imports as a new study
// instead of updating the existing one, resulting in duplicates.
//
// Use --force to overwrite an existing study.jas (e.g. before first JATOS import).

import { randomUUID } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const jasPath = resolve(root, "study.jas");
const configPath = resolve(root, "study-config.json");
const force = process.argv.includes("--force");

if (existsSync(jasPath) && !force) {
  console.error(
    "study.jas already exists. Run with --force to overwrite.\n" +
    "WARNING: overwriting after a JATOS import will cause duplicate studies on re-import."
  );
  process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));

const jas = {
  version: "3",
  data: {
    uuid: randomUUID(),
    title: config.title,
    description: config.description ?? "",
    groupStudy: false,
    linearStudy: false,
    allowPreview: false,
    dirName: config.dirName,
    comments: "",
    jsonData: null,
    endRedirectUrl: "",
    studyEntryMsg: null,
    componentList: [
      {
        uuid: randomUUID(),
        title: "Consent",
        htmlFilePath: "consent.html",
        reloadable: true,
        active: true,
        comments: "",
        jsonData: null,
      },
      {
        uuid: randomUUID(),
        title: "Experiment",
        htmlFilePath: "experiment.html",
        reloadable: true,
        active: true,
        comments: "",
        jsonData: null,
      },
      {
        uuid: randomUUID(),
        title: "Debrief",
        htmlFilePath: "debrief.html",
        reloadable: true,
        active: true,
        comments: "",
        jsonData: null,
      },
    ],
    batchList: [
      {
        uuid: randomUUID(),
        title: "Main",
        active: true,
        maxActiveMembers: null,
        maxTotalMembers: null,
        maxTotalWorkers: config.maxParticipants ?? null,
        allowedWorkerTypes: ["GeneralMultiple"],
        comments: "Main data collection batch.",
        jsonData: null,
      },
      {
        uuid: randomUUID(),
        title: "Test",
        active: true,
        maxActiveMembers: null,
        maxTotalMembers: null,
        maxTotalWorkers: null,
        allowedWorkerTypes: ["GeneralMultiple"],
        comments: "Testing batch — researcher use only.",
        jsonData: null,
      },
    ],
  },
};

writeFileSync(jasPath, JSON.stringify(jas, null, 2) + "\n");
console.log(`study.jas generated for "${config.title}" (dirName: ${config.dirName})`);
