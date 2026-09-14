export const CRM_API_BASE =
  process.env.NEXT_PUBLIC_CRM_API_BASE?.replace(/\/$/, "") ?? "http://localhost:32831";
