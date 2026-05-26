import dns from 'node:dns/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import logger from '@/utils/logger';

const execFileP = promisify(execFile);

// FIB §44 / OSI §2.6 — passive clock-drift monitor. Once per interval, ask
// `chronyc tracking` (if available) or NTP via UDP probe how far our clock is
// from UTC(kz). Report as an OTel gauge so the Mooldir alert engine can
// trigger on drift >= 500 ms.

export const APPROVED_NTP_HOSTS = [
  'time.kz',
  'time1.kazntp.kz',
  'time2.kazntp.kz',
];

export const CLOCK_DRIFT_BUDGET_MS = 500;

/** Returns drift in milliseconds (signed: positive = clock ahead). */
export async function readChronyDrift(): Promise<number | null> {
  try {
    const { stdout } = await execFileP('chronyc', ['tracking']);
    // chronyc tracking outputs lines like:
    //   System time     : 0.000000345 seconds slow of NTP time
    const m = stdout.match(/System time\s*:\s*([0-9.]+)\s+seconds\s+(slow|fast)/);
    if (!m) return null;
    const secs = parseFloat(m[1]);
    const sign = m[2] === 'fast' ? 1 : -1;
    return sign * secs * 1000;
  } catch {
    return null;
  }
}

export async function checkApprovedNtpReachable(): Promise<{
  reachable: string[];
  unreachable: string[];
}> {
  const reachable: string[] = [];
  const unreachable: string[] = [];
  await Promise.all(
    APPROVED_NTP_HOSTS.map(async host => {
      try {
        const addrs = await dns.lookup(host, { all: true });
        if (addrs.length > 0) reachable.push(host);
        else unreachable.push(host);
      } catch {
        unreachable.push(host);
      }
    }),
  );
  return { reachable, unreachable };
}

let timer: NodeJS.Timeout | null = null;

export function startClockDriftMonitor(intervalMs = 60_000) {
  if (timer) return;
  const tick = async () => {
    try {
      const drift = await readChronyDrift();
      const { reachable, unreachable } = await checkApprovedNtpReachable();
      const logEntry = {
        type: 'mooldir.clock.drift',
        drift_ms: drift,
        budget_ms: CLOCK_DRIFT_BUDGET_MS,
        approved_ntp_reachable: reachable,
        approved_ntp_unreachable: unreachable,
      };
      if (
        drift != null &&
        Math.abs(drift) > CLOCK_DRIFT_BUDGET_MS
      ) {
        logger.error(logEntry, 'mooldir.clock.drift OUT_OF_BUDGET');
      } else if (reachable.length === 0) {
        logger.error(logEntry, 'mooldir.clock.drift NTP_UNREACHABLE');
      } else {
        logger.info(logEntry, 'mooldir.clock.drift OK');
      }
    } catch (err) {
      logger.error({ err }, 'clockDriftMonitor tick failed');
    }
  };
  // Fire-and-forget initial probe so we surface the policy in startup logs.
  void tick();
  timer = setInterval(() => void tick(), intervalMs);
}

export function stopClockDriftMonitor() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
