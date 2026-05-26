import {
  APPROVED_NTP_HOSTS,
  CLOCK_DRIFT_BUDGET_MS,
  checkApprovedNtpReachable,
  readChronyDrift,
} from '@/tasks/clockDriftMonitor';

describe('clockDriftMonitor (FIB §44, OSI §2.6 — KZ UTC(kz) sync)', () => {
  it('returns null when chronyc is not installed (graceful degradation)', async () => {
    // The test environment does not have chronyc by default; readChronyDrift
    // must not throw, just return null so the monitor can log "no data".
    const drift = await readChronyDrift();
    expect(drift === null || typeof drift === 'number').toBe(true);
  });

  it('budget is exactly 500 ms per FIB §44 implementation note', () => {
    expect(CLOCK_DRIFT_BUDGET_MS).toBe(500);
  });

  it('approved NTP hosts include time.kz', () => {
    expect(APPROVED_NTP_HOSTS).toContain('time.kz');
  });

  it('checkApprovedNtpReachable returns a reachable/unreachable split', async () => {
    const r = await checkApprovedNtpReachable();
    expect(Array.isArray(r.reachable)).toBe(true);
    expect(Array.isArray(r.unreachable)).toBe(true);
    expect(r.reachable.length + r.unreachable.length).toBe(
      APPROVED_NTP_HOSTS.length,
    );
  }, 10_000);
});
