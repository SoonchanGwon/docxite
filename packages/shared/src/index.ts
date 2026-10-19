export type DocumentFormat = "hwp" | "hwpx" | "pdf";

export interface HealthStatus {
  status: "ok";
  service: string;
  time: string;
}
