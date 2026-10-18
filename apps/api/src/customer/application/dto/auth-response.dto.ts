import { CustomerResponseDto } from './customer-response.dto.js';

export class AuthResponseDto {
  customer!: CustomerResponseDto;
  accessToken!: string;

  constructor(customer: CustomerResponseDto, accessToken: string) {
    this.customer = customer;
    this.accessToken = accessToken;
  }
}
