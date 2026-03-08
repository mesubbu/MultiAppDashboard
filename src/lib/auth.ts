import type { SessionUser } from '@/types/platform';

export const SESSION_COOKIE = 'platform_session';

export const defaultSessionUser: SessionUser = {
  userId: 'usr_platform_admin',
  tenantId: 'platform-root',
  appId: 'control-dashboard',
  name: 'Rhea Sharma',
  email: 'rhea@platform.local',
  roles: ['platform_owner', 'ops_admin'],
};
