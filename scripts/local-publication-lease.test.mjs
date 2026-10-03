import { describe, expect, it, vi } from 'vitest';
import { claimLease, leaseBlobSha, LEASE_POLICY } from './publication-lease.mjs';
import { ghJson, readRemoteLease, mutateRemoteLease, verifyRemoteOwnership, withLeaseHeartbeat } from './local-publication-lease.mjs';

const date = '2026-09-30', acquired = '2026-09-30T11:00:00+09:00', now = '2026-09-30T11:05:00+09:00';
const remoteServer = () => {
  const lease = claimLease(null, { owner: 'local author', targetDate: date, now: acquired });
  let content = `${JSON.stringify(lease, null, 2)}\n`, failWrite = null, readOverride = null;
  const calls = [];
  const api = (args, input) => {
    const method = args.includes('PUT') ? 'PUT' : 'GET'; calls.push({ method, args, input });
    if (method === 'PUT') {
      if (failWrite) throw failWrite;
      const request = JSON.parse(input);
      expect(request.sha).toBe(leaseBlobSha(content));
      expect(request.branch).toBe(LEASE_POLICY.branch);
      content = Buffer.from(request.content, 'base64').toString('utf8');
      return { content: { sha: leaseBlobSha(content) } };
    }
    const bytes = readOverride ? readOverride(content) : content;
    return { type: 'file', encoding: 'base64', content: Buffer.from(bytes).toString('base64'), sha: leaseBlobSha(bytes) };
  };
  return { lease, api, calls, replace: value => { content = JSON.stringify(value); }, fail: error => { failWrite = error; }, override: fn => { readOverride = fn; } };
};

describe('authenticated lease transport', () => {
  it('uses one contents CAS and exact readback before confirming ownership', () => {
    const server = remoteServer();
    const lease = mutateRemoteLease({ operation: 'renew', targetDate: date, leaseId: server.lease.leaseId }, { api: server.api, now: () => now });
    expect(server.calls.map(call => call.method)).toEqual(['GET', 'PUT', 'GET']);
    expect(lease.leaseId).toBe(server.lease.leaseId);
    expect(lease.updatedAt).toBe(now);
    expect(verifyRemoteOwnership(lease.leaseId, date, { api: server.api, now: () => now })).toEqual(lease);
  });

  it('cannot accept same semantic lease JSON when exact mutation bytes differ', () => {
    const server = remoteServer();
    server.override(content => server.calls.some(call => call.method === 'PUT') ? JSON.stringify(JSON.parse(content)) : content);
    expect(() => mutateRemoteLease({ operation: 'renew', targetDate: date, leaseId: server.lease.leaseId }, { api: server.api, now: () => now })).toThrow(/read-back/);
    expect(server.calls.map(call => call.method)).toEqual(['GET', 'PUT', 'GET']);
  });

  it('propagates 403 and CAS conflict without a retry, readback or alternate transport', () => {
    for (const status of [403, 409, 422]) {
      const server = remoteServer(); server.fail(new Error(`HTTP ${status}`));
      expect(() => mutateRemoteLease({ operation: 'renew', targetDate: date, leaseId: server.lease.leaseId }, { api: server.api, now: () => now })).toThrow(String(status));
      expect(server.calls.map(call => call.method)).toEqual(['GET', 'PUT']);
      const run = vi.fn(() => { throw new Error(`HTTP ${status}`); });
      expect(() => ghJson(['api', 'repos/example'], undefined, run)).toThrow(String(status));
      expect(run).toHaveBeenCalledTimes(1);
    }
  });

  it('rejects invalid remote metadata, mismatched blob SHA and malformed leases on read', () => {
    const server = remoteServer(), valid = server.api(['api', 'read']);
    for (const response of [{ ...valid, type: 'dir' }, { ...valid, encoding: 'none' }, { ...valid, sha: 'a'.repeat(40) },
      { ...valid, content: Buffer.from('null').toString('base64'), sha: leaseBlobSha('null') }]) {
      expect(() => readRemoteLease(() => response)).toThrow();
    }
  });
});

describe('long-running author lease heartbeat', () => {
  const timers = () => {
    let tick;
    const timer = { unref: vi.fn() }, schedule = vi.fn(callback => { tick = callback; return timer; }), unschedule = vi.fn();
    return { schedule, unschedule, timer, tick: () => tick() };
  };
  it('renews initially and every five minutes, verifies before each write and always cleans the timer', async () => {
    const server = remoteServer(), timer = timers();
    let clock = now;
    const result = await withLeaseHeartbeat({ targetDate: date, leaseId: server.lease.leaseId }, async guard => {
      expect(guard.beforeWrite().leaseId).toBe(server.lease.leaseId);
      clock = '2026-09-30T11:10:00+09:00'; timer.tick();
      expect(guard.beforeWrite().updatedAt).toBe(clock);
      return 'saved draft';
    }, { api: server.api, now: () => clock, schedule: timer.schedule, unschedule: timer.unschedule });
    expect(result).toBe('saved draft');
    expect(timer.schedule.mock.calls[0][1]).toBe(5 * 60_000);
    expect(timer.timer.unref).toHaveBeenCalledOnce();
    expect(timer.unschedule).toHaveBeenCalledExactlyOnceWith(timer.timer);
    expect(server.calls.filter(call => call.method === 'PUT')).toHaveLength(4);
  });

  it('fences later writes after a heartbeat denial and propagates the original failure', async () => {
    const server = remoteServer(), timer = timers(), error = new Error('HTTP 403: renewal denied');
    await expect(withLeaseHeartbeat({ targetDate: date, leaseId: server.lease.leaseId }, async guard => {
      server.fail(error); timer.tick();
      expect(() => guard.beforeWrite()).toThrow(error);
      timer.tick();
      return 'must not report success';
    }, { api: server.api, now: () => now, schedule: timer.schedule, unschedule: timer.unschedule })).rejects.toBe(error);
    expect(server.calls.filter(call => call.method === 'PUT')).toHaveLength(2);
    expect(timer.unschedule).toHaveBeenCalledExactlyOnceWith(timer.timer);
  });

  it('blocks a stale owner before a draft write and cleans up a failing author task', async () => {
    const server = remoteServer(), timer = timers();
    await expect(withLeaseHeartbeat({ targetDate: date, leaseId: server.lease.leaseId }, async guard => {
      server.replace(claimLease(null, { owner: 'new author', targetDate: date, now }));
      guard.beforeWrite();
      throw new Error('unreachable draft');
    }, { api: server.api, now: () => now, schedule: timer.schedule, unschedule: timer.unschedule })).rejects.toThrow(/Lost or expired/);
    expect(server.calls.filter(call => call.method === 'PUT')).toHaveLength(1);
    expect(timer.unschedule).toHaveBeenCalledExactlyOnceWith(timer.timer);
  });

  it('does not begin research or a timer after an unverifiable initial renewal', async () => {
    const server = remoteServer(), timer = timers(), work = vi.fn();
    server.override(content => server.calls.some(call => call.method === 'PUT') ? `${content}\n` : content);
    await expect(withLeaseHeartbeat({ targetDate: date, leaseId: server.lease.leaseId }, work,
      { api: server.api, now: () => now, schedule: timer.schedule, unschedule: timer.unschedule })).rejects.toThrow(/read-back/);
    expect(work).not.toHaveBeenCalled();
    expect(timer.schedule).not.toHaveBeenCalled();
  });
});
