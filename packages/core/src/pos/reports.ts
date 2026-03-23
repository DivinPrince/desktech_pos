import { and, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { withTransaction } from "../drizzle/transaction";
import { fn } from "../util/fn";
import { saleLineTable, saleTable } from "./sale.sql";

export namespace ReportService {
  export const SalesSummary = z.object({
    businessId: z.string(),
    from: z.date(),
    to: z.date(),
    completedSaleCount: z.number(),
    grossCents: z.number(),
    taxCents: z.number(),
    netCents: z.number(),
    byPaymentMethod: z.array(
      z.object({
        paymentMethod: z.string(),
        count: z.number(),
        totalCents: z.number(),
      }),
    ),
    byDay: z.array(
      z.object({
        day: z.string(),
        totalCents: z.number(),
        saleCount: z.number(),
      }),
    ),
  });

  export const ProductSalesRow = z.object({
    productId: z.string(),
    productName: z.string(),
    unitsSold: z.number(),
    lineTotalCents: z.number(),
  });

  export const salesSummary = fn(
    z.object({
      businessId: z.string(),
      from: z.coerce.date(),
      to: z.coerce.date(),
    }),
    async ({ businessId, from, to }) => {
      return withTransaction(async (tx) => {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);

        const sales = await tx
          .select()
          .from(saleTable)
          .where(
            and(
              eq(saleTable.businessId, businessId),
              eq(saleTable.status, "completed"),
              gte(saleTable.completedAt, from),
              lte(saleTable.completedAt, end),
            ),
          );

        const grossCents = sales.reduce((a, s) => a + s.subtotalCents, 0);
        const taxCents = sales.reduce((a, s) => a + s.taxCents, 0);
        const netCents = sales.reduce((a, s) => a + s.totalCents, 0);

        const paymentMap = new Map<string, { count: number; totalCents: number }>();
        for (const s of sales) {
          const key = s.paymentMethod ?? "unknown";
          const cur = paymentMap.get(key) ?? { count: 0, totalCents: 0 };
          cur.count += 1;
          cur.totalCents += s.totalCents;
          paymentMap.set(key, cur);
        }
        const byPaymentMethod = [...paymentMap.entries()].map(([paymentMethod, v]) => ({
          paymentMethod,
          count: v.count,
          totalCents: v.totalCents,
        }));

        const dayMap = new Map<string, { totalCents: number; saleCount: number }>();
        for (const s of sales) {
          if (!s.completedAt) continue;
          const d = s.completedAt.toISOString().slice(0, 10);
          const cur = dayMap.get(d) ?? { totalCents: 0, saleCount: 0 };
          cur.totalCents += s.totalCents;
          cur.saleCount += 1;
          dayMap.set(d, cur);
        }
        const byDay = [...dayMap.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, v]) => ({
            day,
            totalCents: v.totalCents,
            saleCount: v.saleCount,
          }));

        return SalesSummary.parse({
          businessId,
          from,
          to: end,
          completedSaleCount: sales.length,
          grossCents,
          taxCents,
          netCents,
          byPaymentMethod,
          byDay,
        });
      });
    },
  );

  export const productSales = fn(
    z.object({
      businessId: z.string(),
      from: z.coerce.date(),
      to: z.coerce.date(),
    }),
    async ({ businessId, from, to }) => {
      return withTransaction(async (tx) => {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);

        const rows = await tx
          .select({
            productId: saleLineTable.productId,
            productName: saleLineTable.productNameSnapshot,
            units: sql<number>`sum(${saleLineTable.quantity})::int`,
            lineTotal: sql<number>`sum(${saleLineTable.quantity} * ${saleLineTable.unitPriceCents} - ${saleLineTable.lineDiscountCents})::bigint`,
          })
          .from(saleLineTable)
          .innerJoin(saleTable, eq(saleLineTable.saleId, saleTable.id))
          .where(
            and(
              eq(saleTable.businessId, businessId),
              eq(saleTable.status, "completed"),
              gte(saleTable.completedAt, from),
              lte(saleTable.completedAt, end),
            ),
          )
          .groupBy(saleLineTable.productId, saleLineTable.productNameSnapshot);

        const mapped = rows.map((r) =>
          ProductSalesRow.parse({
            productId: r.productId,
            productName: r.productName,
            unitsSold: r.units,
            lineTotalCents: Number(r.lineTotal),
          }),
        );
        mapped.sort((a, b) => b.lineTotalCents - a.lineTotalCents);
        return mapped;
      });
    },
  );
}
