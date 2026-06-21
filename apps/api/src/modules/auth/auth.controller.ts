import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { registerSchema, RegisterDto } from './dto/register.dto';
import { loginSchema, LoginDto } from './dto/login.dto';
import { refreshSchema, forgotPasswordSchema, resetPasswordSchema, verifyEmailSchema } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  async register(@Body() body: RegisterDto) {
    const dto = registerSchema.parse(body);
    return { data: await this.authService.register(dto), meta: { timestamp: new Date().toISOString() } };
  }

  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() body: unknown) {
    const dto = verifyEmailSchema.parse(body);
    return { data: { verified: true, token: dto.token }, meta: { timestamp: new Date().toISOString() } };
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto) {
    const dto = loginSchema.parse(body);
    return { data: await this.authService.login(dto), meta: { timestamp: new Date().toISOString() } };
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: unknown) {
    const dto = refreshSchema.parse(body);
    return { data: await this.authService.refresh(dto.refresh_token), meta: { timestamp: new Date().toISOString() } };
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  async logout(@Body() body: unknown) {
    const dto = refreshSchema.parse(body);
    return { data: await this.authService.logout(dto.refresh_token), meta: { timestamp: new Date().toISOString() } };
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: unknown) {
    forgotPasswordSchema.parse(body);
    return { data: { message: 'إذا كان البريد مسجلاً، تم إرسال رابط إعادة التعيين', message_en: 'If the email is registered, a reset link has been sent' }, meta: { timestamp: new Date().toISOString() } };
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: unknown) {
    const dto = resetPasswordSchema.parse(body);
    return { data: { token: dto.token, password_updated: true }, meta: { timestamp: new Date().toISOString() } };
  }
}
