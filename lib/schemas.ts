import { z } from "zod";

/** 22 URL-safe characters produced by `public.new_secret_slug()`. */
export const SecretSlugSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{22}$/, "קישור לא תקין");

export const MemberNameSchema = z
  .string()
  .trim()
  .min(1, "צריך שם")
  .max(20, "השם ארוך מדי");

export const UuidSchema = z.string().uuid();

export const ItemNameSchema = z.string().trim().min(1, "צריך שם").max(80);

export const QuantitySchema = z.number().positive().max(9999).nullable();

export const UnitSchema = z.string().trim().max(16).nullable();

export const NoteSchema = z.string().trim().max(280).nullable();

export const AddItemSchema = z.object({
  clientId: UuidSchema,
  listId: UuidSchema,
  name: ItemNameSchema,
  quantity: QuantitySchema.default(null),
  unit: UnitSchema.default(null),
  note: NoteSchema.default(null),
  isUrgent: z.boolean().default(false),
  categoryId: UuidSchema.nullable().default(null),
});

/**
 * The client parses the paste and sends one stable clientId per line, so a retry —
 * the offline queue's or an invisible network hiccup's — replays the exact same ids
 * and the operation ledger turns them into no-ops.
 */
export const BulkAddItemSchema = z.object({
  clientId: UuidSchema,
  name: ItemNameSchema,
  quantity: QuantitySchema.default(null),
  unit: UnitSchema.default(null),
});

export const BulkAddSchema = z.object({
  listId: UuidSchema,
  items: z.array(BulkAddItemSchema).min(1).max(200),
});

/**
 * `itemId` for a synced row, `itemClientId` for one that only exists in the offline
 * log: the server resolves the add's clientId to the real row once the add replays.
 */
export const ItemRefSchema = z
  .object({
    itemId: UuidSchema.optional(),
    itemClientId: UuidSchema.optional(),
  })
  .refine((ref) => ref.itemId !== undefined || ref.itemClientId !== undefined, {
    message: "חסר מזהה פריט",
  });

export const ToggleItemSchema = z
  .object({
    clientId: UuidSchema,
    isChecked: z.boolean(),
  })
  .and(ItemRefSchema);

export const UpdateItemSchema = z.object({
  name: ItemNameSchema.optional(),
  quantity: QuantitySchema.optional(),
  unit: UnitSchema.optional(),
  note: NoteSchema.optional(),
  isUrgent: z.boolean().optional(),
  categoryId: UuidSchema.nullable().optional(),
}).and(ItemRefSchema);

export const DeleteItemSchema = ItemRefSchema;

export const RestoreItemSchema = z.object({
  clientId: UuidSchema,
  listId: UuidSchema,
  name: ItemNameSchema,
  quantity: QuantitySchema.default(null),
  unit: UnitSchema.default(null),
  note: NoteSchema.default(null),
  isUrgent: z.boolean().default(false),
  categoryId: UuidSchema.nullable().default(null),
});

export const ListNameSchema = z.string().trim().min(1).max(30);

export const CreateListSchema = z.object({
  name: ListNameSchema,
  emoji: z.string().trim().min(1).max(8).default("🛒"),
});

export const RenameListSchema = z.object({
  listId: UuidSchema,
  name: ListNameSchema,
  emoji: z.string().trim().min(1).max(8).optional(),
});

export const ListSnapshotSchema = z.object({
  name: ListNameSchema,
  emoji: z.string().trim().min(1).max(8),
  position: z.number().int().min(0).max(999),
  items: z
    .array(
      z.object({
        name: ItemNameSchema,
        quantity: QuantitySchema,
        unit: UnitSchema,
        note: NoteSchema,
        isChecked: z.boolean(),
        isUrgent: z.boolean(),
        categoryId: UuidSchema.nullable(),
        addedBy: z.string().trim().max(20).nullable(),
      }),
    )
    .max(500),
});

export type ListSnapshot = z.infer<typeof ListSnapshotSchema>;

export const ReorderCategoriesSchema = z.object({
  orderedIds: z.array(UuidSchema).min(1).max(64),
});

export const UpdateCategorySchema = z.object({
  categoryId: UuidSchema,
  name: z.string().trim().min(1).max(30).optional(),
  emoji: z.string().trim().min(1).max(8).optional(),
});

export const CatalogQuerySchema = z.object({
  query: z.string().trim().max(80),
  limit: z.number().int().min(1).max(20).default(8),
});

export const AddStaplesSchema = z.object({
  listId: UuidSchema,
  catalogItemIds: z.array(UuidSchema).min(1).max(200),
});

export const CloseTripSchema = z.object({ listId: UuidSchema });

export const HouseholdNameSchema = z.string().trim().min(1).max(40);
