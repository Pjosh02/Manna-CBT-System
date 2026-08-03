import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest) {
  const diagnostics: any = {
    platform: process.platform,
    arch: process.arch,
    cwd: process.cwd(),
    envPath: process.env.PATH,
    platformDetails: {},
  };

  // Run shell commands to check environment
  const commands = [
    "which chromium",
    "which google-chrome",
    "chromium --version",
    "google-chrome --version",
    "echo $PATH",
  ];

  diagnostics.commandResults = {};
  for (const cmd of commands) {
    try {
      const output = execSync(cmd, { stdio: "pipe" }).toString().trim();
      diagnostics.commandResults[cmd] = { success: true, output };
    } catch (err: any) {
      diagnostics.commandResults[cmd] = { success: false, error: err.message, stderr: err.stderr?.toString() };
    }
  }

  // Check some typical Linux directories
  const checkDirs = ["/usr/bin", "/usr/local/bin", "/run/current-system/sw/bin"];
  diagnostics.dirContents = {};
  for (const dir of checkDirs) {
    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        diagnostics.dirContents[dir] = files.filter(f => f.includes("chrome") || f.includes("chromium"));
      } else {
        diagnostics.dirContents[dir] = "Directory does not exist";
      }
    } catch (err: any) {
      diagnostics.dirContents[dir] = { error: err.message };
    }
  }

  return NextResponse.json(diagnostics);
}
