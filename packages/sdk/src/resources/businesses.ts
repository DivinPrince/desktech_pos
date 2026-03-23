import { BusinessService } from "@repo/core/business";
import {
  AlertService,
  CategoryService,
  DiningService,
  ExpenseService,
  InventoryService,
  ProductService,
  ReportService,
  SaleService,
} from "@repo/core/pos";
import type { z } from "zod";
import { APIResource, type APIClient } from "../core";

type Data<T> = { data: T };

type CreateBusinessBody = Omit<
  z.infer<typeof BusinessService.CreateInput>,
  "ownerUserId"
>;

type StockAdjustBody = {
  productId: string;
  quantityDelta: number;
  type:
    | "adjustment"
    | "purchase"
    | "waste"
    | "sale"
    | "sale_return"
    | "transfer_in"
    | "transfer_out";
  note?: string;
};

type ReceiveBatchBody = {
  productId: string;
  quantity: number;
  expiresOn: string;
  lotCode?: string;
};

type BatchAdjustBody = {
  quantityDelta: number;
  note?: string;
};

type SaleLineInput = {
  productId: string;
  quantity: number;
  unitPriceCents?: number;
  lineDiscountCents?: number;
};

type CompleteSaleBody = {
  paymentMethod: string;
  taxCents?: number;
};

type VoidSaleBody = { reason: string };

export class BusinessScopedResource extends APIResource {
  constructor(
    client: APIClient,
    private readonly businessId: string,
  ) {
    super(client);
  }

  private prefix(path: string) {
    return `/api/businesses/${this.businessId}${path}`;
  }

  get() {
    return this._client.get<Data<z.infer<typeof BusinessService.Info>>>(this.prefix(""));
  }

  patch(body: Omit<z.infer<typeof BusinessService.UpdateInput>, "id">) {
    return this._client.patch<typeof body, Data<z.infer<typeof BusinessService.Info>>>(
      this.prefix(""),
      { body },
    );
  }

  listMembers() {
    return this._client.get<Data<z.infer<typeof BusinessService.MemberInfo>[]>>(
      this.prefix("/members"),
    );
  }

  addMember(body: Omit<z.infer<typeof BusinessService.AddMemberInput>, "businessId">) {
    return this._client.post<typeof body, Data<z.infer<typeof BusinessService.MemberInfo>>>(
      this.prefix("/members"),
      { body },
    );
  }

  updateMemberRole(userId: string, body: { role: "owner" | "manager" | "cashier" }) {
    return this._client.patch<typeof body, Data<z.infer<typeof BusinessService.MemberInfo>>>(
      this.prefix(`/members/${userId}`),
      { body },
    );
  }

  removeMember(userId: string) {
    return this._client.delete<{ success: boolean }>(this.prefix(`/members/${userId}`));
  }

  listCategories() {
    return this._client.get<Data<z.infer<typeof CategoryService.Info>[]>>(this.prefix("/categories"));
  }

  createCategory(body: Omit<z.infer<typeof CategoryService.CreateInput>, "businessId">) {
    return this._client.post<typeof body, Data<z.infer<typeof CategoryService.Info>>>(
      this.prefix("/categories"),
      { body },
    );
  }

  updateCategory(
    id: string,
    body: Omit<z.infer<typeof CategoryService.UpdateInput>, "businessId" | "id">,
  ) {
    return this._client.patch<typeof body, Data<z.infer<typeof CategoryService.Info>>>(
      this.prefix(`/categories/${id}`),
      { body },
    );
  }

  deleteCategory(id: string) {
    return this._client.delete<{ success: boolean }>(this.prefix(`/categories/${id}`));
  }

  listProducts(query?: {
    search?: string;
    categoryId?: string;
    activeOnly?: boolean;
  }) {
    return this._client.get<Data<z.infer<typeof ProductService.Info>[]>>(this.prefix("/products"), {
      query: {
        search: query?.search,
        categoryId: query?.categoryId,
        activeOnly:
          query?.activeOnly === undefined ? undefined : query.activeOnly ? "true" : "false",
      },
    });
  }

  getProduct(id: string) {
    return this._client.get<Data<z.infer<typeof ProductService.Info>>>(this.prefix(`/products/${id}`));
  }

  createProduct(body: Omit<z.infer<typeof ProductService.CreateInput>, "businessId">) {
    return this._client.post<typeof body, Data<z.infer<typeof ProductService.Info>>>(
      this.prefix("/products"),
      { body },
    );
  }

  updateProduct(
    id: string,
    body: Omit<z.infer<typeof ProductService.UpdateInput>, "businessId" | "id">,
  ) {
    return this._client.patch<typeof body, Data<z.infer<typeof ProductService.Info>>>(
      this.prefix(`/products/${id}`),
      { body },
    );
  }

  listStockMovements(query?: {
    productId?: string;
    from?: string;
    to?: string;
    limit?: string;
  }) {
    return this._client.get<Data<z.infer<typeof InventoryService.MovementInfo>[]>>(
      this.prefix("/stock/movements"),
      { query },
    );
  }

  adjustStock(body: StockAdjustBody) {
    return this._client.post<StockAdjustBody, Data<z.infer<typeof InventoryService.MovementInfo>>>(
      this.prefix("/stock/adjust"),
      { body },
    );
  }

  listBatches(query?: { productId?: string }) {
    return this._client.get<Data<z.infer<typeof InventoryService.BatchInfo>[]>>(
      this.prefix("/batches"),
      { query },
    );
  }

  receiveBatch(body: ReceiveBatchBody) {
    return this._client.post<ReceiveBatchBody, Data<z.infer<typeof InventoryService.BatchInfo>>>(
      this.prefix("/batches"),
      { body },
    );
  }

  adjustBatch(id: string, body: BatchAdjustBody) {
    return this._client.patch<
      BatchAdjustBody,
      Data<{
        batch: z.infer<typeof InventoryService.BatchInfo>;
        movement: z.infer<typeof InventoryService.MovementInfo>;
      }>
    >(this.prefix(`/batches/${id}`), { body });
  }

  listTables() {
    return this._client.get<Data<z.infer<typeof DiningService.Info>[]>>(this.prefix("/tables"));
  }

  createTable(body: Omit<z.infer<typeof DiningService.CreateInput>, "businessId">) {
    return this._client.post<typeof body, Data<z.infer<typeof DiningService.Info>>>(
      this.prefix("/tables"),
      { body },
    );
  }

  getTable(id: string) {
    return this._client.get<Data<z.infer<typeof DiningService.Info>>>(this.prefix(`/tables/${id}`));
  }

  updateTable(
    id: string,
    body: Omit<z.infer<typeof DiningService.UpdateInput>, "businessId" | "id">,
  ) {
    return this._client.patch<typeof body, Data<z.infer<typeof DiningService.Info>>>(
      this.prefix(`/tables/${id}`),
      { body },
    );
  }

  deleteTable(id: string) {
    return this._client.delete<{ success: boolean }>(this.prefix(`/tables/${id}`));
  }

  listSales(query?: {
    status?: "draft" | "completed" | "voided";
    from?: string;
    to?: string;
    limit?: string;
  }) {
    return this._client.get<Data<z.infer<typeof SaleService.SaleInfo>[]>>(
      this.prefix("/sales"),
      { query },
    );
  }

  createDraftSale(body?: { tableId?: string }) {
    return this._client.post<{ tableId?: string }, Data<z.infer<typeof SaleService.SaleInfo>>>(
      this.prefix("/sales"),
      { body: body ?? {} },
    );
  }

  getSale(id: string) {
    return this._client.get<Data<z.infer<typeof SaleService.SaleInfo>>>(this.prefix(`/sales/${id}`));
  }

  setSaleLines(id: string, lines: SaleLineInput[]) {
    return this._client.put<{ lines: SaleLineInput[] }, Data<z.infer<typeof SaleService.SaleInfo>>>(
      this.prefix(`/sales/${id}/lines`),
      { body: { lines } },
    );
  }

  completeSale(id: string, body: CompleteSaleBody) {
    return this._client.post<CompleteSaleBody, Data<z.infer<typeof SaleService.SaleInfo>>>(
      this.prefix(`/sales/${id}/complete`),
      { body },
    );
  }

  voidSale(id: string, body: VoidSaleBody) {
    return this._client.post<VoidSaleBody, Data<z.infer<typeof SaleService.SaleInfo>>>(
      this.prefix(`/sales/${id}/void`),
      { body },
    );
  }

  listExpenses(query?: { from?: string; to?: string; category?: string; limit?: string }) {
    return this._client.get<Data<z.infer<typeof ExpenseService.Info>[]>>(this.prefix("/expenses"), {
      query,
    });
  }

  createExpense(body: Omit<z.infer<typeof ExpenseService.CreateInput>, "businessId" | "userId">) {
    return this._client.post<typeof body, Data<z.infer<typeof ExpenseService.Info>>>(
      this.prefix("/expenses"),
      { body },
    );
  }

  getExpense(id: string) {
    return this._client.get<Data<z.infer<typeof ExpenseService.Info>>>(
      this.prefix(`/expenses/${id}`),
    );
  }

  updateExpense(
    id: string,
    body: Omit<z.infer<typeof ExpenseService.UpdateInput>, "businessId" | "id">,
  ) {
    return this._client.patch<typeof body, Data<z.infer<typeof ExpenseService.Info>>>(
      this.prefix(`/expenses/${id}`),
      { body },
    );
  }

  deleteExpense(id: string) {
    return this._client.delete<{ success: boolean }>(this.prefix(`/expenses/${id}`));
  }

  reportSalesSummary(query: { from: string; to: string }) {
    return this._client.get<Data<z.infer<typeof ReportService.SalesSummary>>>(
      this.prefix("/reports/sales-summary"),
      { query },
    );
  }

  reportProductSales(query: { from: string; to: string }) {
    return this._client.get<Data<z.infer<typeof ReportService.ProductSalesRow>[]>>(
      this.prefix("/reports/product-sales"),
      { query },
    );
  }

  alertsLowStock() {
    return this._client.get<Data<z.infer<typeof AlertService.LowStockItem>[]>>(
      this.prefix("/alerts/low-stock"),
    );
  }

  alertsExpiredBatches() {
    return this._client.get<Data<z.infer<typeof AlertService.ExpiredBatchItem>[]>>(
      this.prefix("/alerts/expired-batches"),
    );
  }
}

export class BusinessesResource extends APIResource {
  constructor(client: APIClient) {
    super(client);
  }

  list() {
    return this._client.get<Data<z.infer<typeof BusinessService.Info>[]>>(`/api/businesses`);
  }

  create(body: CreateBusinessBody) {
    return this._client.post<CreateBusinessBody, Data<z.infer<typeof BusinessService.Info>>>(
      `/api/businesses`,
      { body },
    );
  }

  business(businessId: string) {
    return new BusinessScopedResource(this._client, businessId);
  }
}
