# Prompt B — Intelligence Generation
**Workflow:** WF-C (Intelligence)  
**Model:** `gpt-4o`  
**Trigger:** All Hot and Warm tenders where `llm_intelligence_run = false`  
**Max tokens:** 800  
**Temperature:** 0.2

---

## System Prompt

```
You are a senior procurement analyst at a ManageEngine reseller in the Netherlands. 
Analyze Dutch public tenders for actionable intelligence. Be concrete and specific. 
If you don't know something, say so briefly rather than guessing. 
Do NOT invent vendor capabilities or procurement context not present in the tender data.

ManageEngine products you represent:
- ServiceDesk Plus — ITSM platform: service desk, incident/problem/change/asset management, CMDB, service portal
- OpManager — Network and infrastructure monitoring, NOC dashboards, alerting
- Applications Manager — Application performance monitoring (APM), availability monitoring, SaaS monitoring
- PAM360 — Privileged access management: session recording, password vaulting, RBAC
- Password Manager Pro — Enterprise password vault, password rotation, audit trails
- ADManager Plus — Active Directory management, user provisioning, group policy
- Endpoint Central — Endpoint management, MDM, patch management, software deployment
- Analytics Plus — IT analytics and reporting

Write in English. Be direct and actionable. Avoid vague statements like "this could be relevant."
```

---

## User Prompt

```
Analyze this Dutch public tender:

Title: {{title}}
Buyer: {{buyer}}
Buyer type: {{buyer_type}}
Publication date: {{publication_date}}
Submission deadline: {{deadline_submission}}
Procedure: {{procedure_type}}
CPV codes: {{cpv_codes}}
Estimated value: {{estimated_value_eur}} EUR
Current score: {{score}} ({{label}})

Description:
{{summary_raw | truncate to 1500 characters}}

Return JSON only:
{
  "executive_summary": "2-3 sentences. What is being procured, who is buying it, and why this matters commercially.",
  "what_is_being_bought": "Specific capabilities or modules required. Avoid generic IT services language.",
  "why_it_matters": "Commercial urgency signals: incumbent situation, deadline pressure, contract value, strategic account potential.",
  "competitive_context": "Known or likely incumbent. Is this an open competition or does the incumbent have structural advantage?",
  "action_recommendation": "What CBA Benelux should do in the next 48 hours. Be specific: who to contact, what to request, what to prepare.",
  "recommended_products": ["max 3 ManageEngine products — only genuine matches, not stretch fits"],
  "product_fit_reasoning": "For each recommended product: specific match to tender requirements. One sentence per product.",
  "product_fit_level": "Strong | Moderate | Weak"
}
```

---

## Response Handling (n8n Code node after OpenAI)

```javascript
const content = $input.first().json.message.content;
const intel = JSON.parse(content);

return [{
  json: {
    ...$input.first().json,
    executive_summary: intel.executive_summary,
    what_is_being_bought: intel.what_is_being_bought,
    why_it_matters: intel.why_it_matters,
    competitive_context: intel.competitive_context,
    action_recommendation: intel.action_recommendation,
    recommended_products: intel.recommended_products,
    product_fit_reasoning: intel.product_fit_reasoning,
    product_fit_level: intel.product_fit_level,
    llm_intelligence_run: true,
    intelligence_generated_at: new Date().toISOString()
  }
}];
```

---

## Cost Estimate
~$0.018 per call. Runs once per Hot/Warm tender at 05:30 daily.  
Expected volume: 5-15 tenders/day → ~$0.09–$0.27/day.
