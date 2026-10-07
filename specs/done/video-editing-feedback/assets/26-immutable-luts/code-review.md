The new required manifest field invalidates previously persisted prepared-audio recipes during recovery or portable adoption. The rest of the reviewed LUT path appears internally consistent.

Review comment:

- [P1] Preserve resumability of old prepared-audio recipes — /Users/server/dev/yap-immutable-lut/packages/composition/src/execution-window.ts:58-58
  When the service resumes a prepared-audio job or portable prepared-audio artifact created before this change, `readRecipe` in `packages/core/src/prepared-audio.ts` parses the persisted manifest through this now-required `luts` field and rejects it because older manifests do not contain the field. This breaks all existing audio recipes even though LUTs are irrelevant to audio; make the field backward-tolerant with a default empty list or migrate old recipes.