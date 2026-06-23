import { execSync } from "child_process";
import { IS_CI } from "./config";

function findRedisContainerId(): string | null {
  try {
    const id = execSync(
      'docker ps --filter "ancestor=redis:7-alpine" --format "{{.ID}}"',
      { encoding: "utf-8", timeout: 5000 },
    ).trim();
    return id || null;
  } catch {
    return null;
  }
}

export function stopRedis(): void {
  if (IS_CI) {
    const id = findRedisContainerId();
    if (!id) throw new Error("Redis container not found");
    execSync(`docker stop ${id}`, { timeout: 10000 });
  } else {
    execSync("sudo systemctl stop redis-server", { timeout: 10000 });
  }
}

export function startRedis(): void {
  if (IS_CI) {
    const id = findRedisContainerId();
    if (!id) {
      execSync("docker start $(docker ps -a --filter 'ancestor=redis:7-alpine' --format '{{.ID}}' | head -1)", { timeout: 10000 });
      return;
    }
    execSync(`docker start ${id}`, { timeout: 10000 });
  } else {
    execSync("sudo systemctl start redis-server", { timeout: 10000 });
  }
}
