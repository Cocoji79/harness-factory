import { Store } from "./src/store/store.js";
import { handleIngestVision } from "./src/tools/ingest-vision.js";
import { handleIngestInterview } from "./src/tools/ingest-interview.js";
import { handleAnalyzeGaps } from "./src/tools/analyze-gaps.js";
import { handleDefineNorthStar } from "./src/tools/define-north-star.js";
import { handleGenerateHarness } from "./src/tools/generate-harness.js";
import { join } from "node:path";

const DATA_DIR = join(import.meta.dirname, "data");
const store = new Store(DATA_DIR);

async function run() {
  await store.init();

  const step = process.argv[2];
  const projectId = process.argv[3];

  switch (step) {
    case "create": {
      const project = await store.createProject("试用期转正");
      console.log(JSON.stringify({ project_id: project.id }, null, 2));
      break;
    }
    case "vision": {
      const result = await handleIngestVision(store, {
        project_id: projectId,
        ...JSON.parse(process.argv[4]),
      });
      console.log(result);
      break;
    }
    case "interview": {
      const result = await handleIngestInterview(store, {
        project_id: projectId,
        ...JSON.parse(process.argv[4]),
      });
      console.log(result);
      break;
    }
    case "analyze-get": {
      const result = await handleAnalyzeGaps(store, {
        project_id: projectId,
      });
      console.log(result);
      break;
    }
    case "analyze-save": {
      const result = await handleAnalyzeGaps(store, {
        project_id: projectId,
        gap_analysis: JSON.parse(process.argv[4]),
      });
      console.log(result);
      break;
    }
    case "northstar-get": {
      const result = await handleDefineNorthStar(store, {
        project_id: projectId,
      });
      console.log(result);
      break;
    }
    case "northstar-save": {
      const result = await handleDefineNorthStar(store, {
        project_id: projectId,
        north_star: JSON.parse(process.argv[4]),
      });
      console.log(result);
      break;
    }
    case "generate": {
      const fs = await import("node:fs");
      const data = JSON.parse(fs.readFileSync(process.argv[4], "utf-8"));
      const result = await handleGenerateHarness(store, {
        project_id: projectId,
        harness: data,
      });
      console.log(result);
      break;
    }
    case "export": {
      const { handleExportHandbook } =
        await import("./src/tools/manage-registry.js");
      const result = await handleExportHandbook(store, {
        project_id: projectId,
        format: (process.argv[4] as "markdown" | "json") ?? "markdown",
      });
      console.log(result);
      break;
    }
    default:
      console.error("Unknown step:", step);
  }
}

run().catch(console.error);
