import { Injectable, Logger, UnauthorizedException, ConflictException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { hash, verify } from 'argon2';
import { sign, verify as jwtVerify } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { db, users, refreshTokens } from '@aht/database';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';
  }

  async register(dto: RegisterDto) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException({
        error: {
          code: 'EMAIL_EXISTS',
          message: 'البريد الإلكتروني مسجل مسبقاً',
          message_en: 'Email already registered',
          statusCode: 409,
        },
        meta: { timestamp: new Date().toISOString() },
      });
    }

    const passwordHash = await hash(dto.password);

    const [user] = await db
      .insert(users)
      .values({
        email: dto.email,
        passwordHash,
        firstNameAr: dto.first_name_ar,
        lastNameAr: dto.last_name_ar,
        firstNameEn: dto.first_name_en ?? null,
        lastNameEn: dto.last_name_en ?? null,
        phone: dto.phone ?? null,
        role: 'customer',
        isActive: true,
        isVerified: false,
        failedLoginAttempts: 0,
      })
      .returning({ id: users.id, email: users.email, role: users.role });

    this.logger.log(`User registered: ${user.email}`);
    return { id: user.id, email: user.email };
  }

  async login(dto: LoginDto) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
          message_en: 'Invalid email or password',
          statusCode: 401,
        },
        meta: { timestamp: new Date().toISOString() },
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'الحساب معطل',
          message_en: 'Account is disabled',
          statusCode: 401,
        },
        meta: { timestamp: new Date().toISOString() },
      });
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      throw new UnauthorizedException({
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'الحساب مقفل مؤقتاً. حاول مرة أخرى لاحقاً',
          message_en: 'Account is temporarily locked. Try again later',
          statusCode: 423,
        },
        meta: { timestamp: new Date().toISOString() },
      });
    }

    const passwordValid = await verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      const attempts = user.failedLoginAttempts + 1;
      const updates: Record<string, unknown> = { failedLoginAttempts: attempts };

      if (attempts >= 5) {
        updates.lockedUntil = new Date(now.getTime() + 30 * 60 * 1000);
        this.logger.warn(`Account locked: ${user.email}`);
      }

      await db.update(users).set(updates).where(eq(users.id, user.id));

      throw new UnauthorizedException({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
          message_en: 'Invalid email or password',
          statusCode: 401,
        },
        meta: { timestamp: new Date().toISOString() },
      });
    }

    await db
      .update(users)
      .set({ failedLoginAttempts: 0, lastLoginAt: now })
      .where(eq(users.id, user.id));

    const accessToken = this.generateAccessToken(user.id, user.email, user.role);
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
        first_name_ar: user.firstNameAr,
        last_name_ar: user.lastNameAr,
        role: user.role,
      },
    };
  }

  async refresh(tokenValue: string) {
    let payload: { sub: string; type: string; jti: string };
    try {
      payload = jwtVerify(tokenValue, this.jwtRefreshSecret) as typeof payload;
    } catch {
      throw new UnauthorizedException({
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'رمز التحديث غير صالح أو منتهي الصلاحية',
          message_en: 'Invalid or expired refresh token',
          statusCode: 401,
        },
        meta: { timestamp: new Date().toISOString() },
      });
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException({
        error: { code: 'INVALID_TOKEN_TYPE', message: 'Invalid token type', message_en: 'Invalid token type', statusCode: 401 },
        meta: { timestamp: new Date().toISOString() },
      });
    }

    const [stored] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.id, payload.jti))
      .limit(1);

    if (!stored || stored.revokedAt) {
      if (stored) {
        await db
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(eq(refreshTokens.userId, stored.userId));
        this.logger.warn(`Token reuse detected for user: ${stored.userId} — all tokens revoked`);
      }
      throw new UnauthorizedException({
        error: {
          code: 'TOKEN_REUSE_DETECTED',
          message: 'تم اكتشاف إعادة استخدام الرمز. جميع الجلسات ألغيت',
          message_en: 'Token reuse detected. All sessions revoked',
          statusCode: 401,
        },
        meta: { timestamp: new Date().toISOString() },
      });
    }

    if (new Date(stored.expiresAt) < new Date()) {
      throw new UnauthorizedException({
        error: {
          code: 'REFRESH_TOKEN_EXPIRED',
          message: 'انتهت صلاحية رمز التحديث',
          message_en: 'Refresh token expired',
          statusCode: 401,
        },
        meta: { timestamp: new Date().toISOString() },
      });
    }

    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, stored.id));

    const [user] = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, stored.userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException({
        error: { code: 'USER_NOT_FOUND', message: 'User not found', message_en: 'User not found', statusCode: 401 },
        meta: { timestamp: new Date().toISOString() },
      });
    }

    const accessToken = this.generateAccessToken(user.id, user.email, user.role);
    const newRefreshToken = await this.generateRefreshToken(user.id, stored.id);

    return { accessToken, refreshToken: newRefreshToken, expiresIn: 900 };
  }

  async logout(tokenValue: string) {
    try {
      const [stored] = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenValue))
        .limit(1);

      if (stored && !stored.revokedAt) {
        await db
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(eq(refreshTokens.id, stored.id));
      }
    } catch {
      // Best-effort logout
    }

    return { message: 'Logged out' };
  }

  private generateAccessToken(userId: string, email: string, role: string): string {
    return sign(
      { sub: userId, email, role, type: 'access' },
      this.jwtSecret,
      { expiresIn: '15m', jwtid: randomUUID() },
    );
  }

  private async generateRefreshToken(userId: string, replacedBy?: string): Promise<string> {
    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(refreshTokens).values({
      userId,
      tokenHash: jti,
      expiresAt,
      replacedBy: replacedBy ?? null,
    });

    return sign(
      { sub: userId, type: 'refresh', jti },
      this.jwtRefreshSecret,
      { expiresIn: '7d', jwtid: jti },
    );
  }
}
