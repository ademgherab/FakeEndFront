export interface SampleTemplate {
  id: string;
  label: string;
  description: string;
  text: string;
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * Static examples are product copy, not limits. They intentionally stay small
 * so they always fit under the meta sample-size limit.
 */
export const sampleTemplates: SampleTemplate[] = [
  {
    id: "users",
    label: "User list",
    description: "An array of user records.",
    text: pretty([
      {
        id: 1,
        name: "Ada Lovelace",
        email: "ada@example.com",
        role: "admin",
        active: true,
        createdAt: "2024-01-15T09:30:00Z",
      },
      {
        id: 2,
        name: "Grace Hopper",
        email: "grace@example.com",
        role: "member",
        active: true,
        createdAt: "2024-02-02T14:10:00Z",
      },
    ]),
  },
  {
    id: "products",
    label: "Products",
    description: "A catalog array with prices and tags.",
    text: pretty([
      {
        sku: "SKU-1001",
        name: "Standing desk",
        price: 499.0,
        currency: "USD",
        inStock: true,
        tags: ["office", "furniture"],
      },
      {
        sku: "SKU-1002",
        name: "Ergonomic chair",
        price: 249.5,
        currency: "USD",
        inStock: false,
        tags: ["office", "seating"],
      },
    ]),
  },
  {
    id: "paginated",
    label: "Paginated envelope",
    description: "An object with data plus pagination fields.",
    text: pretty({
      data: [
        { id: 1, title: "First item", published: true },
        { id: 2, title: "Second item", published: false },
      ],
      page: 1,
      limit: 10,
      total: 42,
      totalPages: 5,
      hasNext: true,
      hasPrev: false,
    }),
  },
];

export function findTemplate(id: string): SampleTemplate | undefined {
  return sampleTemplates.find((template) => template.id === id);
}
