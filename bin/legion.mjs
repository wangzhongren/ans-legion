#!/usr/bin/env node
const argumentsList = process.argv.slice(2);
if (argumentsList.length !== 1 || argumentsList[0] !== "demo") {
  console.error("Usage: legion demo");
  process.exitCode = 2;
} else {
  await import("../src/kernel/interface/demo.mjs");
}
