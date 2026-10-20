/**
 * Every string on the landing page lives here so the copy can be edited in one
 * place. The page renders from this file alone: no API call, no `/meta`
 * request, no backend.
 *
 * The copy only claims what the sprint product actually does — inference,
 * delay, injected errors, list size, method/path/status and an open runtime.
 */

export type FeatureIconName =
  | "schema"
  | "clock"
  | "alert"
  | "list"
  | "route"
  | "terminal";

export interface FeatureItem {
  icon: FeatureIconName;
  title: string;
  body: string;
}

export interface StepItem {
  number: string;
  title: string;
  body: string;
}

export const landingContent = {
  brand: {
    name: "FakeEnd",
    mark: "{}",
  },
  nav: {
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Features", href: "#features" },
      { label: "Privacy", href: "#privacy" },
    ],
    cta: { label: "Open the builder", href: "/" },
  },
  hero: {
    eyebrow: "JSON in. Live endpoint out.",
    titleLead: "Paste JSON.",
    titleAccent: "Call a live fake endpoint.",
    description:
      "FakeEnd reads your sample, infers the schema and serves it back as fresh data over HTTP. Set the delay, the error rate and the list size, then call the URL from a browser, from curl or from your app.",
    primaryCta: { label: "Create a fake endpoint", href: "/" },
    secondaryCta: { label: "See how it works", href: "#how-it-works" },
    footnote: "No account, no sign-up, one page from sample to URL.",
  },
  code: {
    caption:
      "A JSON sample is inferred into a schema and served back with the same shape and fresh values.",
    sampleLabel: "sample.json",
    sampleInputLabel: "Input",
    sample: `{
  "id": 1,
  "name": "Ahmed Benali",
  "email": "ahmed@example.com",
  "roles": ["admin", "editor"],
  "active": true,
  "score": 87.5
}`,
    servedLabel: "Served at",
    method: "GET",
    url: "http://localhost:5031/m/k3j9x2m8qa/users",
    responseLabel: "response.json",
    responseOutputLabel: "Fresh on every call",
    response: `{
  "id": 412,
  "name": "Maya Chen",
  "email": "maya.chen@example.org",
  "roles": ["editor"],
  "active": true,
  "score": 64.25
}`,
  },
  steps: {
    eyebrow: "How it works",
    title: "From sample to endpoint in three steps",
    items: [
      {
        number: "01",
        title: "Paste a JSON sample",
        body: "An object or a list. The API infers the fields, the types and the nesting it will serve, and shows you the schema.",
      },
      {
        number: "02",
        title: "Tune the behaviour",
        body: "Pick the method, the path and the success status. Add a delay range, an error rate with its status codes, and the size of the list you get back.",
      },
      {
        number: "03",
        title: "Call the URL",
        body: "Copy the endpoint URL and request it. Every call answers with the same shape and new values, and CORS is open so a browser can call it directly.",
      },
    ] satisfies StepItem[],
  },
  features: {
    eyebrow: "What you get",
    title: "Enough control to make a mock useful",
    description:
      "Not just random strings. The shape, the timing and the failure modes you can actually test against.",
    items: [
      {
        icon: "schema",
        title: "A schema from your sample",
        body: "Inference reads types, fields and nesting, so the endpoint answers with the structure you pasted — not a generic blob.",
      },
      {
        icon: "clock",
        title: "Realistic delay",
        body: "Set a minimum and a maximum delay. Each response reports the delay it applied in the X-Mock-Delay-Ms header.",
      },
      {
        icon: "alert",
        title: "Injectable errors",
        body: "Choose a rate and the status codes to inject. The failing response says it was simulated and carries the request id.",
      },
      {
        icon: "list",
        title: "Lists of any size",
        body: "Return a list instead of a single object and set how many records it holds, from one to a thousand.",
      },
      {
        icon: "route",
        title: "Method, path and status",
        body: "GET, POST, PUT or DELETE on the path you want, answering with the success status your client expects.",
      },
      {
        icon: "terminal",
        title: "Test it in place",
        body: "Call the endpoint from the page and read the status, the latency, the headers and the body without leaving the browser.",
      },
    ] satisfies FeatureItem[],
  },
  privacy: {
    eyebrow: "Privacy",
    title: "Do not paste real or sensitive data",
    body: "The sample is sent to the API to build the mock, so treat it like any other request. FakeEnd keeps nothing in your browser: no sample, no schema and no token is written to local or session storage, and the page reloads clean.",
  },
  footer: {
    note: "Paste JSON, get a live fake endpoint.",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Features", href: "#features" },
      { label: "Privacy", href: "#privacy" },
      { label: "Builder", href: "/" },
    ],
  },
};
