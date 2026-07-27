import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { join } from 'path';
import { existsSync } from 'fs';
import { static as expressStatic } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'https://lh3.googleusercontent.com', 'https://*.googleusercontent.com'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
  }));
  app.enableCors({
    origin: [
      ...new Set(
        [process.env.APP_URL, process.env.FRONTEND_URL || 'http://localhost:5173'].filter(
          (u): u is string => !!u,
        ),
      ),
    ],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false,
  }));

  // Serve static frontend files + SPA fallback in production
  const publicPath = join(__dirname, '..', 'public');
  const indexHtml = join(publicPath, 'index.html');
  if (existsSync(publicPath)) {
    // Hashed assets are immutable; index.html must never be cached so
    // reloads always pick up the newest bundle after a deploy.
    app.use(expressStatic(publicPath, {
      index: false,
      setHeaders: (res, path) => {
        if (path.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }));
    app.use((req: any, res: any, next: any) => {
      if (!req.path.startsWith('/api') && existsSync(indexHtml)) {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(indexHtml);
      } else {
        next();
      }
    });
  }

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Scheduler API running on port ${port}`);
}

bootstrap();
