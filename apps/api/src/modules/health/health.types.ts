export type DependencyState = 'up' | 'down' | 'skipped';

export type HealthLiveResponse = {
  status: 'ok';
  product: string;
  version: string;
};

export type HealthReadyResponse = {
  status: 'ok' | 'degraded';
  product: string;
  checks: {
    postgres: DependencyState;
    redis: DependencyState;
  };
};
