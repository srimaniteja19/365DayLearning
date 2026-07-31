export type GenerationTelemetry = {
  repairCalls: number;
  modelOutcomes: Record<string, { attempts: number; failures: number }>;
};

export function newTelemetry(): GenerationTelemetry {
  return { repairCalls: 0, modelOutcomes: {} };
}
