import { z } from "zod";
import type { Catalog } from "./catalog.js";
import type { SpeakerEvidenceIdentity } from "./speaker-evidence.js";

export const speakerLabelBindingSchema = z.strictObject({
  slot: z.int().min(0).max(3),
  displayName: z.string().trim().min(1).max(128),
});
export const speakerLabelBindingsSchema = z
  .array(speakerLabelBindingSchema)
  .max(4)
  .superRefine((bindings, context) => {
    const seen = new Set<number>();
    for (const [index, binding] of bindings.entries()) {
      if (seen.has(binding.slot))
        context.addIssue({
          code: "custom",
          path: [index, "slot"],
          message: "Speaker label slots must be unique",
        });
      seen.add(binding.slot);
    }
  });
export type SpeakerLabelBinding = z.infer<typeof speakerLabelBindingSchema>;

/** Durable caller-authored names are keyed by one retained acoustic generation. */
export class SpeakerLabelStore {
  constructor(private readonly store: Catalog) {
    store.catalog.exec(`CREATE TABLE IF NOT EXISTS speaker_label_bindings (
      ownerId TEXT NOT NULL, sourceId TEXT NOT NULL, generation TEXT NOT NULL, policy TEXT NOT NULL,
      slot INTEGER NOT NULL, displayName TEXT NOT NULL,
      PRIMARY KEY(ownerId, sourceId, generation, policy, slot)) STRICT;`);
  }

  bind(identity: SpeakerEvidenceIdentity, input: readonly SpeakerLabelBinding[]) {
    const bindings = speakerLabelBindingsSchema.parse(input);
    const key = this.key(identity);
    this.store.transaction(() => {
      this.store.catalog
        .prepare(
          "DELETE FROM speaker_label_bindings WHERE ownerId=? AND sourceId=? AND generation=? AND policy=?",
        )
        .run(...key);
      const insert = this.store.catalog.prepare(
        "INSERT INTO speaker_label_bindings(ownerId,sourceId,generation,policy,slot,displayName) VALUES (?,?,?,?,?,?)",
      );
      for (const binding of bindings) insert.run(...key, binding.slot, binding.displayName);
    });
    return this.read(identity);
  }

  read(identity: SpeakerEvidenceIdentity): SpeakerLabelBinding[] {
    const rows = this.store.catalog
      .prepare(
        "SELECT slot,displayName FROM speaker_label_bindings WHERE ownerId=? AND sourceId=? AND generation=? AND policy=? ORDER BY slot",
      )
      .all(...this.key(identity)) as { slot: number; displayName: string }[];
    return rows.map((row) => speakerLabelBindingSchema.parse(row));
  }

  remove(identity: SpeakerEvidenceIdentity): void {
    this.store.catalog
      .prepare(
        "DELETE FROM speaker_label_bindings WHERE ownerId=? AND sourceId=? AND generation=? AND policy=?",
      )
      .run(...this.key(identity));
  }

  private key(identity: SpeakerEvidenceIdentity): [string, string, string, string] {
    return [identity.owner.assetId, identity.sourceId, identity.generation, identity.policy];
  }
}
