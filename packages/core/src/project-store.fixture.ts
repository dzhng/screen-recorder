import { assetTranscriptOwner } from "./transcript-processing.js";
import { AcquisitionStore } from "./acquisitions.js";
import type { AssetStore } from "./assets.js";
import type { Catalog } from "./catalog.js";
import { ProjectStore } from "./projects.js";
import { TranscriptStore } from "./transcript.js";

/** Test projects use the same retained transcript owner as the service. */
export function projectStoreFixture(
  catalog: Catalog,
  assets: AssetStore,
  home: string,
  acquisitions = new AcquisitionStore(catalog),
) {
  return new ProjectStore(
    catalog,
    assets,
    new TranscriptStore(catalog, home, assetTranscriptOwner(assets, acquisitions)),
    acquisitions,
  );
}
