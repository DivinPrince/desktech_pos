import type { z } from "zod";

import type { BusinessService } from "@repo/core/business";
import type { CategoryService, ProductService } from "@repo/core/pos";

export type BusinessRow = z.infer<typeof BusinessService.Info>;
export type CategoryRow = z.infer<typeof CategoryService.Info>;
export type ProductRow = z.infer<typeof ProductService.Info>;
