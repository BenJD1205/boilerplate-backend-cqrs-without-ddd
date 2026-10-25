import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext, Logger } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Server, ServerOptions } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { productionOptions } from './production.config.js';
import { positiveInteger } from './runtime-role.config.js';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor!: ReturnType<typeof createAdapter>;
  private pubClient?: { isOpen: boolean; destroy(): void };
  private subClient?: { isOpen: boolean; destroy(): void };
  protected readonly logger = new Logger(RedisIoAdapter.name);

  constructor(
    app: INestApplicationContext,
    private readonly configService: ConfigService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const startupTimeout = positiveInteger(
      this.configService.get('REDIS_SOCKET_STARTUP_TIMEOUT_MS'),
      10000,
      'REDIS_SOCKET_STARTUP_TIMEOUT_MS',
    );
    const pubClient = createClient({
      socket: {
        host: this.configService.get('REDIS_HOST'),
        port: Number(this.configService.get('REDIS_PORT', 6379)),
        connectTimeout: 5000,
      },
      password: this.configService.get('REDIS_PASSWORD'),
      username: this.configService.get<string>('REDIS_USERNAME') || undefined,
    });

    const subClient = pubClient.duplicate();
    this.pubClient = pubClient;
    this.subClient = subClient;
    pubClient.on('error', (error: Error) => this.logger.error(error.message));
    subClient.on('error', (error: Error) => this.logger.error(error.message));

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.all([pubClient.connect(), subClient.connect()]),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            reject(
              new Error(
                `Socket.IO Redis startup exceeded ${startupTimeout}ms; check Redis availability and application credentials`,
              ),
            );
          }, startupTimeout);
        }),
      ]);
    } catch (error) {
      if (pubClient.isOpen) pubClient.destroy();
      if (subClient.isOpen) subClient.destroy();
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: Record<string, any>) {
    const { origins, production, corsOrigin } = productionOptions(
      this.configService,
    );
    const server = super.createIOServer(port, {
      ...options,
      transports: ['websocket'],
      cors: { origin: corsOrigin, credentials: true },
      allowRequest: (
        request: { headers: { origin?: string } },
        callback: (error: string | null, allowed: boolean) => void,
      ) => {
        const origin = request.headers.origin;
        callback(
          null,
          !origin ||
            origins.includes(origin) ||
            (!production && origins.length === 0),
        );
      },
    } as unknown as ServerOptions) as Server;

    server.adapter(this.adapterConstructor);

    return server;
  }

  bindClientConnect(server: Server, callback: Function): void {
    server.on('connection', callback);
  }

  dispose(): Promise<void> {
    for (const client of [this.pubClient, this.subClient]) {
      if (client?.isOpen) client.destroy();
    }
    return Promise.resolve();
  }
}
