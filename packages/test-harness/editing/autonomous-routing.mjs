import { routeUseCase } from "../../../skills/yap/scripts/use-case-routing.mjs";

const useCases = ["launch", "podcast", "teaser"];

/**
 * Run the same focused workflow routing that a fresh consumer agent discovers.
 * The harness records the returned provenance; it does not duplicate routing
 * policy or inspect media on the skill's behalf.
 */
export function collectUseCaseRouting(referenceRoot) {
  return Promise.all(useCases.map((useCase) => routeUseCase({ useCase }, referenceRoot)));
}
