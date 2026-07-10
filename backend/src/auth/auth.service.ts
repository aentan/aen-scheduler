import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async validateGoogleUser(profile: any): Promise<any> {
    const { id: googleId, emails, displayName, photos, accessToken, refreshToken, tokenExpiry } = profile;
    const email = emails[0].value;
    const picture = photos?.[0]?.value;

    let user = await this.usersService.findByGoogleId(googleId);
    if (!user) {
      user = await this.usersService.create({ googleId, email, name: displayName, picture });
    } else if (picture && picture !== user.picture) {
      // Google avatar URLs go stale; refresh the stored one on every login
      user = await this.prisma.user.update({ where: { id: user.id }, data: { picture } });
    }

    await this.prisma.googleAccount.upsert({
      where: { userId_googleId: { userId: user.id, googleId } },
      update: { accessToken, refreshToken: refreshToken || undefined, tokenExpiry, name: displayName, picture },
      create: {
        userId: user.id,
        googleId,
        email,
        name: displayName,
        picture,
        accessToken,
        refreshToken: refreshToken ?? '',
        tokenExpiry,
        isPrimary: true,
      },
    });

    return user;
  }

  async connectGoogleAccount(userId: string, profile: any): Promise<void> {
    const { id: googleId, emails, displayName, photos, accessToken, refreshToken, tokenExpiry } = profile;
    const email = emails[0].value;
    const picture = photos?.[0]?.value;

    await this.prisma.googleAccount.upsert({
      where: { userId_googleId: { userId, googleId } },
      update: { accessToken, refreshToken: refreshToken || undefined, tokenExpiry, name: displayName, picture },
      create: {
        userId,
        googleId,
        email,
        name: displayName,
        picture,
        accessToken,
        refreshToken: refreshToken ?? '',
        tokenExpiry,
        isPrimary: false,
      },
    });
  }

  generateConnectToken(userId: string): string {
    return this.jwtService.sign({ userId, mode: 'connect' }, { expiresIn: '10m' });
  }

  verifyConnectToken(token: string): { userId: string; mode: string } {
    return this.jwtService.verify(token);
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email };
    return { access_token: this.jwtService.sign(payload), user };
  }
}
