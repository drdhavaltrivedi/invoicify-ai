import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface InvoiceData {
  summary: string;
  full_text: string;
  structured_data: {
    merchant: {
      name: string;
      address: string;
      phone?: string;
      email?: string;
      website?: string;
    };
    billed_to?: {
      name?: string;
      email?: string;
      address?: string;
    };
    invoice_details: {
      number: string;
      date: string;
      due_date?: string;
      currency: string;
    };
    line_items: Array<{
      description: string;
      quantity: number;
      unit_price: number;
      amount: number;
    }>;
    totals: {
      subtotal: number;
      tax_amount: number;
      discount?: number;
      total_amount: number;
    };
    payment_info?: {
      bank_name?: string;
      account_number?: string;
      iban?: string;
      swift_code?: string;
    };
  };
  suggested_category: string;
  confidence_scores: {
    merchant: number;
    invoice_details: number;
    line_items: number;
    totals: number;
  };
}

export async function processInvoice(fileData: string, mimeType: string, selectedFields?: string[]): Promise<InvoiceData> {
  const model = "gemini-3-flash-preview";

  const fieldsSelection = selectedFields?.length 
    ? `IMPORTANT: The user explicitly requested to focus on these specific fields: ${selectedFields.join(', ')}. Ensure they are extracted with high accuracy.` 
    : "";

  const prompt = `Analyze this invoice and provide:
1. A concise human-readable summary.
2. The full text extracted from the document.
3. Structured data following the schema.
4. Confidence scores (0.0 to 1.0) for each major section (merchant, details, items, totals).
5. A suggested category for this expense (e.g., Utilities, Rent, Supplies, Travel, Food, Marketing, Software, Healthcare, etc.).

${fieldsSelection}

Be precise with amounts and dates. If a field is missing, leave it null or omit it.`;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          inlineData: {
            data: fileData.split(',')[1], // Remove the data:image/png;base64, part
            mimeType: mimeType,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          full_text: { type: Type.STRING },
          structured_data: {
            type: Type.OBJECT,
            properties: {
              merchant: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  address: { type: Type.STRING },
                  phone: { type: Type.STRING },
                  email: { type: Type.STRING },
                  website: { type: Type.STRING },
                },
              },
              billed_to: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  email: { type: Type.STRING },
                  address: { type: Type.STRING },
                },
              },
              invoice_details: {
                type: Type.OBJECT,
                properties: {
                  number: { type: Type.STRING },
                  date: { type: Type.STRING },
                  due_date: { type: Type.STRING },
                  currency: { type: Type.STRING },
                },
              },
              line_items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    description: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    unit_price: { type: Type.NUMBER },
                    amount: { type: Type.NUMBER },
                  },
                },
              },
              totals: {
                type: Type.OBJECT,
                properties: {
                  subtotal: { type: Type.NUMBER },
                  tax_amount: { type: Type.NUMBER },
                  discount: { type: Type.NUMBER },
                  total_amount: { type: Type.NUMBER },
                },
              },
              payment_info: {
                type: Type.OBJECT,
                properties: {
                  bank_name: { type: Type.STRING },
                  account_number: { type: Type.STRING },
                  iban: { type: Type.STRING },
                  swift_code: { type: Type.STRING },
                },
              },
            },
          },
          confidence_scores: {
            type: Type.OBJECT,
            properties: {
              merchant: { type: Type.NUMBER },
              invoice_details: { type: Type.NUMBER },
              line_items: { type: Type.NUMBER },
              totals: { type: Type.NUMBER },
            },
          },
          suggested_category: { type: Type.STRING },
        },
      },
    },
  });

  if (!response.text) {
    throw new Error("No response from AI");
  }

  return JSON.parse(response.text) as InvoiceData;
}

export async function processBulkSummary(invoices: InvoiceData[]): Promise<string> {
  const model = "gemini-3-flash-preview";

  const prompt = `
    You are a financial analyst. Below is data from multiple invoices.
    Provide a comprehensive bulleted summary (in Markdown) of these invoices including:
    1. Total number of invoices.
    2. Key merchants identified.
    3. Major spending categories or items.
    4. Any notable dates or frequency of invoices.
    5. A final closing aggregate statement about the financial activity.

    Invoices Data:
    ${JSON.stringify(invoices.map(inv => ({ 
      merchant: inv.structured_data.merchant.name,
      total: inv.structured_data.totals.total_amount,
      currency: inv.structured_data.invoice_details.currency,
      date: inv.structured_data.invoice_details.date,
      summary: inv.summary
    })), null, 2)}
  `;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [{ text: prompt }],
    },
  });

  if (!response.text) {
    throw new Error("No bulk summary generated");
  }

  return response.text;
}
