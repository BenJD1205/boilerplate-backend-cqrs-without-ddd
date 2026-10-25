import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Redis } from 'ioredis';

export interface CreateAuthSessionInput {
  sessionId: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  platform: string;
  refreshJti: string;
  ttlSeconds: number;
}

export interface AuthSession {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  platform: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

const SESSION_KEY = (sessionId: string) => `auth:session:${sessionId}`;
const USER_SESSIONS_KEY = (userId: string) => `auth:user:${userId}:sessions`;
const USER_BLOCK_KEY = (userId: string) => `auth:user:${userId}:blocked`;
const BLOCKED_TOKEN_KEY = (jti: string) =>
  `auth:token:${createHash('sha256').update(jti).digest('hex')}:blocked`;

@Injectable()
export class AuthSessionService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async create(input: CreateAuthSessionInput): Promise<string> {
    const { sessionId } = input;
    const now = new Date().toISOString();
    const multi = this.redis.multi();
    multi.hset(SESSION_KEY(sessionId), {
      userId: input.userId,
      deviceId: input.deviceId,
      deviceName: input.deviceName,
      platform: input.platform,
      refreshJti: input.refreshJti,
      createdAt: now,
      lastSeenAt: now,
    });
    multi.expire(SESSION_KEY(sessionId), input.ttlSeconds);
    multi.sadd(USER_SESSIONS_KEY(input.userId), sessionId);
    multi.expire(USER_SESSIONS_KEY(input.userId), input.ttlSeconds);
    this.assertTransaction(await multi.exec());
    return sessionId;
  }

  async isActive(sessionId: string, userId: string): Promise<boolean> {
    const [storedUserId, blocked] = await Promise.all([
      this.redis.hget(SESSION_KEY(sessionId), 'userId'),
      this.redis.exists(USER_BLOCK_KEY(userId)),
    ]);
    return storedUserId === userId && blocked === 0;
  }

  async assertRefreshToken(
    sessionId: string,
    userId: string,
    refreshJti: string,
  ): Promise<void> {
    const [storedUserId, storedJti, blocked] = await Promise.all([
      this.redis.hget(SESSION_KEY(sessionId), 'userId'),
      this.redis.hget(SESSION_KEY(sessionId), 'refreshJti'),
      this.redis.exists(USER_BLOCK_KEY(userId)),
    ]);
    if (storedUserId !== userId || storedJti !== refreshJti || blocked > 0) {
      throw new UnauthorizedException('Refresh token is revoked or expired');
    }
  }

  async rotateRefreshToken(
    sessionId: string,
    userId: string,
    currentJti: string,
    nextJti: string,
    ttlSeconds: number,
  ): Promise<void> {
    const result = await this.redis.eval(
      `if redis.call('HGET', KEYS[1], 'userId') ~= ARGV[1] then return 0 end
       if redis.call('HGET', KEYS[1], 'refreshJti') ~= ARGV[2] then return 0 end
       if redis.call('EXISTS', KEYS[3]) == 1 then return 0 end
       redis.call('HSET', KEYS[1], 'refreshJti', ARGV[3], 'lastSeenAt', ARGV[4])
       redis.call('EXPIRE', KEYS[1], ARGV[5])
       redis.call('EXPIRE', KEYS[2], ARGV[5])
       return 1`,
      3,
      SESSION_KEY(sessionId),
      USER_SESSIONS_KEY(userId),
      USER_BLOCK_KEY(userId),
      userId,
      currentJti,
      nextJti,
      new Date().toISOString(),
      String(ttlSeconds),
    );
    if (result !== 1) {
      throw new UnauthorizedException(
        'Refresh token was already used or its session was revoked',
      );
    }
  }

  async listForUser(
    userId: string,
    currentSessionId: string,
  ): Promise<AuthSession[]> {
    const sessionIds = await this.redis.smembers(USER_SESSIONS_KEY(userId));
    if (sessionIds.length === 0) return [];
    const sessions = await Promise.all(
      sessionIds.map((sessionId) => this.redis.hgetall(SESSION_KEY(sessionId))),
    );
    const active: AuthSession[] = [];
    const expired: string[] = [];
    sessions.forEach((session, index) => {
      const sessionId = sessionIds[index];
      if (session.userId !== userId) {
        expired.push(sessionId);
        return;
      }
      active.push({
        id: sessionId,
        userId,
        deviceId: session.deviceId,
        deviceName: session.deviceName,
        platform: session.platform,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        current: sessionId === currentSessionId,
      });
    });
    if (expired.length > 0) {
      await this.redis.srem(USER_SESSIONS_KEY(userId), ...expired);
    }
    return active.sort((left, right) =>
      right.lastSeenAt.localeCompare(left.lastSeenAt),
    );
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const sessionKey = SESSION_KEY(sessionId);
    const storedUserId = await this.redis.hget(sessionKey, 'userId');
    if (storedUserId !== userId) {
      throw new NotFoundException('Session not found');
    }
    const result = await this.redis
      .multi()
      .del(sessionKey)
      .srem(USER_SESSIONS_KEY(userId), sessionId)
      .exec();
    this.assertTransaction(result);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const sessionIds = await this.redis.smembers(USER_SESSIONS_KEY(userId));
    const multi = this.redis.multi();
    if (sessionIds.length > 0) {
      multi.del(...sessionIds.map(SESSION_KEY));
    }
    multi.del(USER_SESSIONS_KEY(userId));
    this.assertTransaction(await multi.exec());
  }

  async blockUser(userId: string, ttlSeconds: number): Promise<void> {
    await this.revokeAllForUser(userId);
    await this.redis.set(USER_BLOCK_KEY(userId), '1', 'EX', ttlSeconds);
  }

  async unblockUser(userId: string): Promise<void> {
    await this.redis.del(USER_BLOCK_KEY(userId));
  }

  async blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(BLOCKED_TOKEN_KEY(jti), '1', 'EX', ttlSeconds);
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    return (await this.redis.exists(BLOCKED_TOKEN_KEY(jti))) > 0;
  }

  private assertTransaction(result: [Error | null, unknown][] | null): void {
    if (!result) throw new Error('Auth session transaction aborted');
    for (const [error] of result) {
      if (error) throw error;
    }
  }
}
