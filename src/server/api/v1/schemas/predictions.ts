import { z } from "zod";
import { predictionsBodySchema } from "@/lib/predictions";

export const predictionsSaveBodySchema = predictionsBodySchema;
export const predictionsSavedSchema = z.object({
  saved: z.number().int().describe("How many predictions were stored."),
});
