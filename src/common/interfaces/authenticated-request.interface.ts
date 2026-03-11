export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface AuthenticatedRequest {
  user: AuthenticatedUser;
  headers: Record<string, string | string[] | undefined>;
}
