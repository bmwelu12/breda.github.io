// Business-side SDK: a registered business agent presents its Halo credential and opens a live
// session so the customer's "Verify this caller" check and the two-way code work.
export function createBusinessAgent(baseUrl: string, agentId: string, credential: string) {
  const post = async (path: string, body: unknown) => {
    const r = await fetch(baseUrl + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return r.json();
  };
  return {
    /** Read Halo's authorization notice before contacting a protected person. */
    notice: () => fetch(baseUrl + "/v1/authorization-notice").then((r) => r.json()),
    /** Start contact: Halo checks the credential and shows the person who is calling. */
    contact: (userId: string, callerNumber: string, businessName: string) =>
      post("/v1/inbound", { user_id: userId, caller_number: callerNumber, credential, claimed: { business: businessName } }),
    /** Open the live session that the person's "Verify this caller" button checks. Returns the shared code. */
    openLiveSession: (inboundId: string) => post("/v1/business-sessions", { agent_id: agentId, inbound_id: inboundId }),
    say: (inboundId: string, text: string) => post(`/v1/inbound/${inboundId}/lines`, { speaker: "caller", text }),
  };
}
