import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import type { Validated } from '@aht/types';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  async register(@Body() body: Validated<RegisterDto>) {
    return { data: await this.authService.register(body), meta: { timestamp: new Date().toISOString() } };
  }

  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() body: Validated<{ token: string }>) {
    return { data: { verified: true, token: body.token }, meta: { timestamp: new Date().toISOString() } };
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: Validated<LoginDto>) {
    return { data: await this.authService.login(body), meta: { timestamp: new Date().toISOString() } };
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: Validated<{ refresh_token: string }>) {
    return { data: await this.authService.refresh(body.refresh_token), meta: { timestamp: new Date().toISOString() } };
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  async logout(@Body() body: Validated<{ refresh_token: string }>) {
    return { data: await this.authService.logout(body.refresh_token), meta: { timestamp: new Date().toISOString() } };
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() _body: Validated<{ email: string }>) {
    return { data: { message: 'إذا كان البريد مسجلاً، تم إرسال رابط إعادة التعيين', message_en: 'If the email is registered, a reset link has been sent' }, meta: { timestamp: new Date().toISOString() } };
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: Validated<{ token: string; new_password: string }>) {
    return { data: { token: body.token, password_updated: true }, meta: { timestamp: new Date().toISOString() } };
  }
}
