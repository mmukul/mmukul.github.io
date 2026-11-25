// Provider-neutral VPS adapter contract for NextGen Lab Management.
// Implement against the selected provider's CURRENT official API only.
// Never place provider credentials in browser code, SQL, or this repository.
export type ProviderConfig = {
  region: string;
  planId: string;
  imageId: string;
  sshKeyId: string;
  maxNodes: number;
  monthlyBudgetInr: number;
};

export type WorkerRequest = {
  name: string;
  region: string;
  planId: string;
  imageId: string;
  sshKeyId: string;
  idempotencyKey: string;
  tags: Record<string, string>;
};

export type WorkerInstance = {
  providerInstanceId: string;
  status: "pending" | "provisioning" | "running" | "stopped" | "failed" | "deleted";
  publicIp?: string;
  privateIp?: string;
  region: string;
  planId: string;
};

export interface VpsProviderAdapter {
  validateCredentials(): Promise<{ ok: boolean; accountLabel?: string; message: string }>;
  listRegionsAndPlans(): Promise<{ regions: string[]; plans: string[]; images: string[] }>;
  createWorker(request: WorkerRequest): Promise<WorkerInstance>;
  getInstance(providerInstanceId: string): Promise<WorkerInstance>;
  deleteInstance(providerInstanceId: string, idempotencyKey: string): Promise<void>;
}
