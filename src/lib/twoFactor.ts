export interface TwoFactorChallenge {
  requiresTwoFactor: true;
  challengeToken: string;
  expiresAt: number;
}
export class TwoFactorRequired extends Error {
  constructor(public challenge: TwoFactorChallenge) {
    super('Enter your authenticator code to finish signing in.');
  }
}
export class TwoFactorSetupRequired extends Error {
  constructor() {
    super('Set up two-factor authentication to continue.');
  }
}
export interface TwoFactorStatus {
  enabled: boolean;
  recoveryCodesRemaining: number;
}
export interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  expiresAt: number;
}
export interface TwoFactorResult extends TwoFactorStatus {
  recoveryCodes?: string[];
}
