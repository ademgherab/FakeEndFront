/**
 * Demo fixtures shared by the seeded mock project, the help page and the
 * demo console. The values are product copy for the demo, not credentials.
 */

export const DEMO_SLUG = "demo";
export const DEMO_EDIT_TOKEN = "et_demo_mockapi_hackathon_2026";
export const DEMO_ENDPOINT_PATH = "/users";

export const DEMO_SAMPLE = JSON.stringify(
  [
    {
      id: 1,
      name: "Ada",
      email: "ada@example.com",
      role: "admin",
      active: true,
      createdAt: "2026-01-12T09:30:00.000Z",
    },
    {
      id: 2,
      name: "Grace",
      email: "grace@example.com",
      role: "editor",
      active: true,
      createdAt: "2026-02-03T14:05:00.000Z",
    },
    {
      id: 3,
      name: "Linus",
      email: "linus@example.com",
      role: "viewer",
      active: false,
      createdAt: "2026-03-21T18:45:00.000Z",
    },
  ],
  null,
  2,
);
