import { afterEach, describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { GlobTool } from "../../../packages/core/src/tools/builtin/glob.js";
import { GrepTool } from "../../../packages/core/src/tools/builtin/grep.js";

async function createTempWorkspace(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "beans-nav-"));
}

describe("navigation tool guidance", () => {
  const workspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(
      workspaces.map(async (workspace) => {
        await fs.rm(workspace, { recursive: true, force: true });
      }),
    );
    workspaces.length = 0;
  });

  it("ranks glob results using extracted keywords and surfaces top matches", async () => {
    const workspace = await createTempWorkspace();
    workspaces.push(workspace);

    await fs.mkdir(path.join(workspace, "src", "auth"), { recursive: true });
    await fs.mkdir(path.join(workspace, "src", "billing"), {
      recursive: true,
    });
    await fs.writeFile(path.join(workspace, "src", "auth", "login.ts"), "");
    await fs.writeFile(
      path.join(workspace, "src", "billing", "invoice.ts"),
      "",
    );
    await fs.writeFile(path.join(workspace, "src", "auth", "session.ts"), "");

    const tool = new GlobTool();
    const result = await tool.execute(
      { pattern: "src/**/*.ts" },
      {
        cwd: workspace,
        context: {
          extractedIntent: { keywords: ["auth"] },
          originalQuery: "find auth code",
        },
      },
    );

    expect(result.content.split("\n")[0]).toBe("auth/login.ts");
    expect(result.content).toContain("[TOP MATCHES]");
    expect(result.content).toContain("[NEXT STEP]");
  });

  it("adds read_file suggestions for the strongest grep hits", async () => {
    const workspace = await createTempWorkspace();
    workspaces.push(workspace);

    await fs.mkdir(path.join(workspace, "src"), { recursive: true });
    await fs.writeFile(
      path.join(workspace, "src", "auth-service.ts"),
      [
        "export function createAuthService() {",
        "  return authClient.login();",
        "}",
        "export const authState = true;",
      ].join("\n"),
    );
    await fs.writeFile(
      path.join(workspace, "src", "misc.ts"),
      ["const unrelated = true;", "console.log(unrelated);"].join("\n"),
    );

    const tool = new GrepTool();
    const result = await tool.execute(
      { pattern: "auth", path: "src", glob: "*.ts" },
      {
        cwd: workspace,
        context: {
          extractedIntent: { keywords: ["auth"] },
        },
      },
    );

    expect(result.content).toContain("[TOP FILES]");
    expect(result.content).toContain('read_file(path="');
    expect(result.content).toContain("[NEXT STEP]");
  });
});
