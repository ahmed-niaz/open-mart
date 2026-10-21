export interface AdminAuthResponseDto {
  accessToken: string;
  refreshToken: string;
  admin: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
    role: string;
    avatarUrl: string | null;
    mustChangePassword: boolean;
  };
}
