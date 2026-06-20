import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { FastifyReply } from "fastify";

/** Global exception filter — maps all unhandled exceptions to the platform's error envelope. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : "Internal server error";

    response.status(status).send({
      error: {
        code: `HTTP_${status}`,
        message,
        message_en: message,
        statusCode: status,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: response.request?.id,
      },
    });
  }
}
