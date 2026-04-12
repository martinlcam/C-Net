import { Controller, Get, Route } from "tsoa"

@Route("health")
export class HealthController extends Controller {
  /* GET /health — public liveness probe */
  @Get()
  public async getHealth(): Promise<{ status: string; timestamp: string }> {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    }
  }
}
