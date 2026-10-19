import { CustomerResponseDto } from './customer-response.dto.js';

export class AuthResponseDto {
  customer!: CustomerResponseDto;
  accessToken!: string;
  refreshToken!: string;

  constructor(
    customer: CustomerResponseDto,
    accessToken: string,
    refreshToken: string,
  ) {
    this.customer = customer;
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }
}
