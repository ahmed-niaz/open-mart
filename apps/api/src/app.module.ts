import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    CqrsModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}