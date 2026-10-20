export const landingContent = {
  brand: {
    name: "MockAPI",
    mark: "{}",
  },
  nav: {
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Features", href: "/#features" },
      { label: "Privacy", href: "/#privacy" },
    ],
    help: { label: "Help", href: "/help" },
    cta: { label: "Open builder", href: "/new" },
  },
  hero: {
    eyebrow: "JSON in. Live API out.",
    titleLead: "Paste JSON.",
    titleAccent: "Call a live mock API.",
    description:
      "MockAPI infers a schema from your sample and serves fresh, realistic data from a URL you can use right now. Add delay, random errors and pagination without writing a backend.",
    primaryCta: { label: "Create a mock API", href: "/new" },
    secondaryCta: { label: "Read the quickstart", href: "/help" },
    footnote: "No account. No sign-up. Projects stay live for 7 days.",
  },
  code: {
    caption:
      "Example: a JSON sample is inferred into a schema and served as a list of realistic records.",
    sampleLabel: "sample.json",
    sampleInputLabel: "Input",
    sample: `{
  "id": 1,
  "name": "Ahmed Benali",
  "email": "ahmed@example.com",
  "created_at": "2026-01-15T10:30:00Z"
}`,
    servedLabel: "Served at",
    method: "GET",
    url: "https://api.example.com/m/k3j9x2m8qa/users",
    responseLabel: "response.json",
    responseOutputLabel: "Fresh on every call",
    response: `[
  {
    "id": 1,
    "name": "Maya Chen",
    "email": "maya.chen@example.org",
    "created_at": "2026-09-02T08:15:00Z"
  }
]`,
  },
  steps: {
    eyebrow: "How it works",
    title: "From sample to endpoint in three steps",
    items: [
      {
        number: "01",
        title: "Paste a JSON sample",
        body: "An object, a list or a full paginated envelope. Inference fills in types, field meaning and nesting.",
      },
      {
        number: "02",
        title: "Tune the behaviour",
        body: "Set a fixed or random delay, inject errors at a chosen rate, and control list size, pagination and seed.",
      },
      {
        number: "03",
        title: "Call the URL",
        body: "Every request returns new data with the same shape. CORS is open, so your browser can call it directly.",
      },
    ],
  },
  features: {
    eyebrow: "What you get",
    title: "Enough control to make a mock useful",
    description:
      "Not just random strings. Shape, timing and failure modes you can actually test against.",
    items: [
      {
        icon: "sparkles",
        title: "Data that looks real",
        body: "Names, emails, addresses, dates and prices are chosen from the field name, not only its type.",
      },
      {
        icon: "layers",
        title: "Your shape, preserved",
        body: "Objects, arrays and nested items keep the structure of your sample, including optional and nullable fields.",
      },
      {
        icon: "clock",
        title: "Delay on purpose",
        body: "Add 300–1500 ms, or any range up to 10 seconds, to see how your UI handles a slow response.",
      },
      {
        icon: "alert",
        title: "Random failures",
        body: "Inject 4xx and 5xx responses at a percentage you choose, so retry and error states get exercised.",
      },
      {
        icon: "list",
        title: "Lists and pagination",
        body: "Return 0 to 1000 items, or enable page and limit with total counts and pagination headers.",
      },
      {
        icon: "terminal",
        title: "Logs that explain",
        body: "See method, path, status, delay and latency for the last 1,000 calls. New entries arrive while you watch.",
      },
    ],
    extras:
      "Also included: a fixed seed for repeatable output · CORS from every origin · path parameters · errors you can tell apart from real ones.",
  },
  privacy: {
    eyebrow: "Privacy",
    title: "Do not paste real or sensitive data.",
    body: "Samples are analyzed in memory and never stored. The one exception is a field detected as an enum: its sample values are kept so the generator can reuse them.",
    points: [
      "No accounts, and no IP address is stored.",
      "Mock request bodies are kept in logs, truncated to 4 KB.",
      "Projects expire after 7 days, then return 410 for 3 more days before deletion.",
    ],
  },
  finalCta: {
    title: "Stop mocking by hand.",
    description:
      "Paste one sample and get a URL your frontend can call in the next minute.",
    primaryCta: { label: "Create a mock API", href: "/new" },
    secondaryCta: { label: "Read the quickstart", href: "/help" },
  },
  footer: {
    note: "No accounts. Projects expire after 7 days.",
    links: [
      { label: "Builder", href: "/new" },
      { label: "Quickstart", href: "/help" },
      { label: "Privacy", href: "/#privacy" },
    ],
  },
} as const;

export type LandingContent = typeof landingContent;
export type FeatureItem = LandingContent["features"]["items"][number];
