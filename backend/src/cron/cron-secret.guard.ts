import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

/**
 * Guards the internal cron endpoints with a shared secret sent as the
 * `x-cron-secret` header. Fails closed: if CRON_SECRET is not configured the
 * endpoints are unreachable rather than open. The compare is constant-time.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  private readonly logger = new Logger(CronSecretGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      this.logger.error('CRON_SECRET is not set; rejecting cron request');
      throw new UnauthorizedException();
    }

    const provided = context.switchToHttp().getRequest().headers['x-cron-secret'];
    if (typeof provided !== 'string') {
      throw new UnauthorizedException();
    }

    const a = Buffer.from(provided);
    const b = Buffer.from(secret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
