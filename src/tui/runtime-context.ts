import type { AdapterId } from "../adapters/index.js";

export interface TuiRuntimeContext {
  source?: AdapterId;
  invalidSource?: string;
}
