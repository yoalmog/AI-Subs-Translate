import { DemoVideo } from "../types";
import { DEMO_CONFIGS, renderDemoFrame } from "../utils/demoVideoGenerator";

export const DEMO_VIDEOS: DemoVideo[] = DEMO_CONFIGS.map((cfg) => ({
  id: cfg.id,
  title: cfg.title,
  description: cfg.description,
  duration: cfg.duration,
  language: cfg.language,
  url: `demo:${cfg.id}`,
  sampleCues: cfg.sampleCues,
}));

export { DEMO_CONFIGS, renderDemoFrame };
