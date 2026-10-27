import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { listFiles } from "../lib/files.ts";
import type { Check, Finding } from "./types.ts";

const LISTING = ".context/listing";
// supply and deliver treat every folder in metadata/ as a locale, so a stray one aborts the upload.
const NOT_LOCALES = ["review_information", "trade_representative_contact_information", "app_clip_review_information"];
const LOCALE = /^[a-z]{2,3}(-([A-Za-z]{2}|[A-Za-z]{4}))?$/;
const PLAY_TEXT = ["title.txt", "short_description.txt", "full_description.txt"];
const PLAY_IMAGE_FOLDERS = ["phoneScreenshots", "sevenInchScreenshots", "tenInchScreenshots", "tvScreenshots", "wearScreenshots"];

const folders = (path: string) => (existsSync(path) ? readdirSync(path, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name) : []);

export const listing: Check = {
  id: "listing",
  module: "listing",
  description: "listing/ is fastlane's tree: metadata/ per store, locale folders only, Play's three text files, fastlane image folders, zero-padded screenshots",
  run({ repo }) {
    const root = join(repo, LISTING);
    if (!existsSync(root)) return [];
    const findings: Finding[] = [];
    const add = (file: string, message: string) => findings.push({ check: "listing", level: "error", file, message });
    for (const store of ["android", "ios"]) {
      if (!existsSync(join(root, store))) continue;
      const metadata = join(root, store, "metadata");
      if (!existsSync(metadata)) {
        add(`${LISTING}/${store}/`, "no metadata/ folder");
        continue;
      }
      for (const name of folders(metadata)) {
        if (!NOT_LOCALES.includes(name) && !LOCALE.test(name)) add(`${LISTING}/${store}/metadata/${name}`, "not a locale — fastlane would upload it as one");
      }
    }
    for (const locale of folders(join(root, "android", "metadata"))) {
      const at = `${LISTING}/android/metadata/${locale}`;
      for (const file of PLAY_TEXT) if (!existsSync(join(repo, at, file))) add(`${at}/${file}`, "missing");
      for (const name of folders(join(repo, at, "images"))) {
        if (!PLAY_IMAGE_FOLDERS.includes(name)) add(`${at}/images/${name}`, "not a fastlane image folder");
      }
    }
    // Play ships screenshots in file-name order, so `2-` sorts after `10-`.
    for (const file of listFiles(repo, LISTING, (name) => name.endsWith(".png"))) {
      if (/[Ss]creenshots\//.test(file) && /\/\d-[^/]*$/.test(file)) add(file, "unpadded screenshot number — name it NN-<screen>.png");
    }
    return findings;
  },
};
