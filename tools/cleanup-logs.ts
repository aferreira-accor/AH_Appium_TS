import fs from 'fs';
import path from 'path';

// Simple log pruning: delete files older than N days inside logs/
const LOGS_DIR = path.resolve(__dirname, '../logs');
const DAYS_TO_KEEP = Number(process.env.LOG_DAYS_TO_KEEP!);

function isOlderThan(filePath: string, days: number): boolean {
  try {
    const stats = fs.statSync(filePath);
    const ageMs = Date.now() - stats.mtimeMs;
    return ageMs > days * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function safeUnlink(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
    console.log(`Deleted: ${path.relative(process.cwd(), filePath)}`);
  } catch {
    // ignore
  }
}

function pruneLogs(): void {
  if (!fs.existsSync(LOGS_DIR)) {
    console.log('No logs directory to prune.');
    return;
  }

  const entries = fs.readdirSync(LOGS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(LOGS_DIR, entry.name);

    if (entry.isDirectory()) {
      // Known folder that can grow large
      if (entry.name === 'performance-report') {
        const perfEntries = fs.readdirSync(fullPath, { withFileTypes: true });
        for (const pe of perfEntries) {
          const perfPath = path.join(fullPath, pe.name);
          if (pe.isFile() && isOlderThan(perfPath, DAYS_TO_KEEP)) {
            safeUnlink(perfPath);
          }
        }
      }
      continue;
    }

    // Files: remove old ones based on extension
    const isLogLike = /\.(log|err|csv|json)$/i.test(entry.name);
    if (isLogLike && isOlderThan(fullPath, DAYS_TO_KEEP)) {
      safeUnlink(fullPath);
    }
  }

  console.log(`Pruned logs older than ${DAYS_TO_KEEP} day(s).`);
}

pruneLogs();


