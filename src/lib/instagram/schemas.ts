import { z } from "zod";

/** Zod compartido cliente/servidor para los endpoints de Instagram (feature 008). */

/** Publicar: unión discriminada compositor genérico (`manual`) vs desde propiedad. */
export const publishSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("manual"),
    storageKey: z.string().min(1),
    caption: z.string().max(2200).optional(),
  }),
  z.object({
    source: z.literal("property"),
    propertyId: z.string().min(1),
    caption: z.string().max(2200).optional(),
  }),
]);
export type PublishInput = z.infer<typeof publishSchema>;

export const commentReplySchema = z.object({
  commentId: z.string().min(1),
  message: z.string().min(1).max(2200),
});
export type CommentReplyInput = z.infer<typeof commentReplySchema>;

export const commentHideSchema = z.object({
  commentId: z.string().min(1),
  action: z.enum(["hide", "delete"]),
});
export type CommentHideInput = z.infer<typeof commentHideSchema>;

export const sendDmSchema = z.object({
  recipientIgsid: z.string().min(1),
  text: z.string().min(1).max(1000),
});
export type SendDmInput = z.infer<typeof sendDmSchema>;
