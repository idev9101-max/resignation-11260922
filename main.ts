#!/usr/bin/env node
/**
 * Deterministic entry writer.
 * Target: /output/entry.txt, or MAKEFUN_OUTPUT_DIR/entry.txt when set.
 * No network access, no secrets, no stdout.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Chosen over retry/rate-limit variants: a cron monitor asks "still running?"
// every minute, never "how are you?" That is the joke and it is technically true.
const ENTRY: string =
  "I resign as your cron job: every minute you asked if I was still running, and never once how I was doing.";

const MAX_CHARS = 140;
const FILE_NAME = "entry.txt";
const DEFAULT_DIR = "/output";

function getOutputDir(): string {
  const override = process.env.MAKEFUN_OUTPUT_DIR;
  return override === undefined || override === "" ? DEFAULT_DIR : override;
}

function assertSingleLine(entry: string): void {
  if (entry.length === 0) {
    throw new Error("Entry must not be empty");
  }
  if (entry.trim() !== entry) {
    throw new Error("Entry must not have leading or trailing whitespace");
  }
  if (/[\r\n\u2028\u2029]/.test(entry)) {
    throw new Error("Entry must be exactly one line");
  }
}

function assertWithinLimit(entry: string): void {
  const codePoints = [...entry].length;
  if (entry.length > MAX_CHARS || codePoints > MAX_CHARS) {
    throw new Error(
      `Entry is ${entry.length} UTF-16 units and ${codePoints} code points; limit is ${MAX_CHARS}`,
    );
  }
}

function buildPayload(entry: string): Buffer {
  assertSingleLine(entry);
  assertWithinLimit(entry);
  const bytes = Buffer.from(entry, "utf8");
  if (bytes.toString("utf8") !== entry) {
    throw new Error("Entry must be valid UTF-8");
  }
  if (bytes.includes(0x0a) || bytes.includes(0x0d)) {
    throw new Error("Entry bytes must not contain a line break");
  }
  return bytes;
}

function verifyWrittenFile(outputPath: string, expected: Buffer): void {
  const written = readFileSync(outputPath);
  if (!written.equals(expected)) {
    throw new Error("Written entry does not match the chosen line");
  }
  if (written.toString("utf8") !== ENTRY) {
    throw new Error("Written entry failed UTF-8 round trip");
  }
}

function main(): void {
  const payload = buildPayload(ENTRY);
  const outputDir = getOutputDir();
  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, FILE_NAME);

  // Direct write avoids temp files, so the output directory contains only entry.txt.
  // No trailing newline is added: the file is exactly the chosen UTF-8 line.
  writeFileSync(outputPath, payload, { flag: "w" });
  verifyWrittenFile(outputPath, payload);
}

main();
