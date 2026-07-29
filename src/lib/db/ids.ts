import { nanoid } from "nanoid";

/** Prefijos de ID por entidad (IDs `text` con prefijo, D6 en research). */
export const ID_PREFIXES = {
  organization: "org",
  user: "usr",
  member: "mem",
  invitation: "inv",
  property: "prop",
  propertyPhoto: "photo",
  client: "cli",
  clientRequirements: "creq",
  candidacy: "cand",
  pipelineStage: "pst",
  conversation: "conv",
  conversationProperty: "cp",
  message: "msg",
  template: "tmpl",
  templateAnalytics: "tpla",
  showing: "show",
  calendarSettings: "calset",
  googleCalendarCredentials: "gcal",
  document: "doc",
  contract: "ctr",
  metaCredentials: "wamc",
  instagramCredentials: "igc",
  instagramPost: "igp",
  instagramDm: "igdm",
} as const;

export type IdEntity = keyof typeof ID_PREFIXES;

/** Genera un ID con prefijo, p. ej. `prop_V1StGXR8_Z5jdHi6B-myT`. */
export function newId(entity: IdEntity): string {
  return `${ID_PREFIXES[entity]}_${nanoid()}`;
}
