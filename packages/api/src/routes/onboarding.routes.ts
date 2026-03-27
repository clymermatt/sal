import type { FastifyInstance, FastifyRequest } from "fastify";
import { getSupabase } from "../db/client.js";
import { logger } from "../lib/logger.js";

// Default service catalog for plumbing businesses — saves owners from
// having to type out every service during onboarding
const DEFAULT_PLUMBING_CATALOG = [
  { job_type: "Drain clearing — kitchen", flat_rate: 185, duration_mins: 60, category: "repair" },
  { job_type: "Drain clearing — bathroom", flat_rate: 165, duration_mins: 45, category: "repair" },
  { job_type: "Drain clearing — main line", flat_rate: 350, duration_mins: 120, category: "repair" },
  { job_type: "Toilet repair", flat_rate: 195, duration_mins: 60, category: "repair" },
  { job_type: "Toilet replacement", flat_rate: 450, duration_mins: 120, category: "installation" },
  { job_type: "Water heater repair", flat_rate: 275, duration_mins: 90, category: "repair" },
  { job_type: "Water heater replacement — tank", flat_rate: 1800, duration_mins: 240, category: "installation" },
  { job_type: "Water heater replacement — tankless", flat_rate: 3200, duration_mins: 360, category: "installation" },
  { job_type: "Leak repair — pipe", flat_rate: 225, duration_mins: 90, category: "repair" },
  { job_type: "Leak repair — faucet", flat_rate: 145, duration_mins: 45, category: "repair" },
  { job_type: "Faucet replacement", flat_rate: 275, duration_mins: 60, category: "installation" },
  { job_type: "Garbage disposal installation", flat_rate: 350, duration_mins: 60, category: "installation" },
  { job_type: "Sewer line camera inspection", flat_rate: 295, duration_mins: 60, category: "repair" },
  { job_type: "Emergency callout — after hours", flat_rate: 150, duration_mins: 30, category: "emergency" },
  { job_type: "Burst pipe repair", flat_rate: 475, duration_mins: 120, category: "emergency" },
];

interface CreateBusinessBody {
  name: string;
  owner_cell: string;
  phone?: string;
  timezone?: string;
  service_area_zips?: string[];
  business_hours?: Record<string, { open: string; close: string }>;
  plan?: "solo" | "pro" | "growth";
}

interface AddTechBody {
  name: string;
  phone: string;
  skills?: string[];
  home_address?: string;
}

interface AddServiceBody {
  job_type: string;
  flat_rate: number;
  duration_mins: number;
  category: "emergency" | "repair" | "installation" | "maintenance";
  description?: string;
}

interface UpdateServiceBody {
  job_type?: string;
  flat_rate?: number;
  duration_mins?: number;
  category?: "emergency" | "repair" | "installation" | "maintenance";
  description?: string;
  is_active?: boolean;
}

export async function registerOnboardingRoutes(app: FastifyInstance): Promise<void> {
  const supabase = getSupabase();

  // Step 1: Create a new business
  app.post(
    "/business",
    async (request: FastifyRequest<{ Body: CreateBusinessBody }>) => {
      const { name, owner_cell, phone, timezone, service_area_zips, business_hours, plan } = request.body;

      if (!name || !owner_cell) {
        return { error: "name and owner_cell are required" };
      }

      const { data: business, error } = await supabase
        .from("businesses")
        .insert({
          name,
          owner_cell,
          phone: phone ?? null,
          timezone: timezone ?? "America/Chicago",
          service_area_zips: service_area_zips ?? [],
          business_hours: business_hours ?? {},
          plan: plan ?? "solo",
        })
        .select("id, name, owner_cell, timezone, plan")
        .single();

      if (error || !business) {
        logger.error({ error }, "Failed to create business");
        return { error: "Failed to create business", details: error };
      }

      // Seed default service catalog
      const catalogItems = DEFAULT_PLUMBING_CATALOG.map((item) => ({
        ...item,
        business_id: business.id,
      }));

      const { error: catalogError } = await supabase
        .from("service_catalog")
        .insert(catalogItems);

      if (catalogError) {
        logger.warn({ catalogError }, "Failed to seed default catalog — business created without it");
      }

      logger.info({ businessId: business.id, name }, "Business created via onboarding");

      return {
        success: true,
        business,
        catalog_seeded: !catalogError,
        catalog_count: catalogError ? 0 : catalogItems.length,
        next_steps: [
          "Add your technicians: POST /api/onboarding/:businessId/technicians",
          "Customize your service catalog: GET/PUT/DELETE /api/onboarding/:businessId/catalog",
          "Update business hours: PUT /api/onboarding/:businessId/settings",
        ],
      };
    },
  );

  // Step 2: Add a technician
  app.post(
    "/:businessId/technicians",
    async (request: FastifyRequest<{ Params: { businessId: string }; Body: AddTechBody }>) => {
      const { businessId } = request.params;
      const { name, phone, skills, home_address } = request.body;

      if (!name || !phone) {
        return { error: "name and phone are required" };
      }

      const { data: tech, error } = await supabase
        .from("technicians")
        .insert({
          business_id: businessId,
          name,
          phone,
          skills: skills ?? ["general"],
          last_known_address: home_address ?? null,
        })
        .select("id, name, phone, skills, last_known_address")
        .single();

      if (error || !tech) {
        return { error: "Failed to add technician", details: error };
      }

      logger.info({ businessId, techId: tech.id, name }, "Technician added");
      return { success: true, technician: tech };
    },
  );

  // List technicians
  app.get(
    "/:businessId/technicians",
    async (request: FastifyRequest<{ Params: { businessId: string } }>) => {
      const { businessId } = request.params;

      const { data: techs } = await supabase
        .from("technicians")
        .select("id, name, phone, skills, is_active")
        .eq("business_id", businessId)
        .order("created_at");

      return { technicians: techs ?? [] };
    },
  );

  // Update a technician
  app.put(
    "/:businessId/technicians/:techId",
    async (
      request: FastifyRequest<{
        Params: { businessId: string; techId: string };
        Body: Partial<AddTechBody> & { is_active?: boolean };
      }>,
    ) => {
      const { businessId, techId } = request.params;
      const updates = request.body;

      const { data: tech, error } = await supabase
        .from("technicians")
        .update(updates)
        .eq("id", techId)
        .eq("business_id", businessId)
        .select("id, name, phone, skills, is_active")
        .single();

      if (error || !tech) {
        return { error: "Failed to update technician", details: error };
      }

      return { success: true, technician: tech };
    },
  );

  // Step 3: View/customize service catalog
  app.get(
    "/:businessId/catalog",
    async (request: FastifyRequest<{ Params: { businessId: string } }>) => {
      const { businessId } = request.params;

      const { data: catalog } = await supabase
        .from("service_catalog")
        .select("id, job_type, description, flat_rate, duration_mins, category, is_active")
        .eq("business_id", businessId)
        .order("category")
        .order("job_type");

      return { catalog: catalog ?? [] };
    },
  );

  // Add a custom service
  app.post(
    "/:businessId/catalog",
    async (request: FastifyRequest<{ Params: { businessId: string }; Body: AddServiceBody }>) => {
      const { businessId } = request.params;
      const { job_type, flat_rate, duration_mins, category, description } = request.body;

      if (!job_type || flat_rate == null || !duration_mins || !category) {
        return { error: "job_type, flat_rate, duration_mins, and category are required" };
      }

      const { data: service, error } = await supabase
        .from("service_catalog")
        .insert({
          business_id: businessId,
          job_type,
          flat_rate,
          duration_mins,
          category,
          description: description ?? null,
        })
        .select("id, job_type, flat_rate, duration_mins, category")
        .single();

      if (error || !service) {
        return { error: "Failed to add service", details: error };
      }

      return { success: true, service };
    },
  );

  // Update a service
  app.put(
    "/:businessId/catalog/:serviceId",
    async (
      request: FastifyRequest<{
        Params: { businessId: string; serviceId: string };
        Body: UpdateServiceBody;
      }>,
    ) => {
      const { businessId, serviceId } = request.params;
      const updates = request.body;

      const { data: service, error } = await supabase
        .from("service_catalog")
        .update(updates)
        .eq("id", serviceId)
        .eq("business_id", businessId)
        .select("id, job_type, flat_rate, duration_mins, category, is_active")
        .single();

      if (error || !service) {
        return { error: "Failed to update service", details: error };
      }

      return { success: true, service };
    },
  );

  // Delete a service
  app.delete(
    "/:businessId/catalog/:serviceId",
    async (
      request: FastifyRequest<{
        Params: { businessId: string; serviceId: string };
      }>,
    ) => {
      const { businessId, serviceId } = request.params;

      const { error } = await supabase
        .from("service_catalog")
        .delete()
        .eq("id", serviceId)
        .eq("business_id", businessId);

      if (error) {
        return { error: "Failed to delete service", details: error };
      }

      return { success: true };
    },
  );

  // Step 4: Update business settings
  app.put(
    "/:businessId/settings",
    async (
      request: FastifyRequest<{
        Params: { businessId: string };
        Body: Partial<CreateBusinessBody>;
      }>,
    ) => {
      const { businessId } = request.params;
      const updates = request.body;

      const { data: business, error } = await supabase
        .from("businesses")
        .update(updates)
        .eq("id", businessId)
        .select("id, name, phone, owner_cell, timezone, service_area_zips, business_hours, plan")
        .single();

      if (error || !business) {
        return { error: "Failed to update business", details: error };
      }

      return { success: true, business };
    },
  );

  // Get full onboarding status — shows what's configured and what's missing
  app.get(
    "/:businessId/status",
    async (request: FastifyRequest<{ Params: { businessId: string } }>) => {
      const { businessId } = request.params;

      const [businessResult, techsResult, catalogResult] = await Promise.all([
        supabase.from("businesses").select("*").eq("id", businessId).single(),
        supabase.from("technicians").select("id").eq("business_id", businessId).eq("is_active", true),
        supabase.from("service_catalog").select("id").eq("business_id", businessId).eq("is_active", true),
      ]);

      const business = businessResult.data;
      if (!business) return { error: "Business not found" };

      const techCount = techsResult.data?.length ?? 0;
      const catalogCount = catalogResult.data?.length ?? 0;
      const hours = business.business_hours as Record<string, unknown>;
      const hasHours = hours && Object.keys(hours).length > 0;
      const hasServiceArea = (business.service_area_zips as string[])?.length > 0;

      const steps = {
        business_created: true,
        has_technicians: techCount > 0,
        has_catalog: catalogCount > 0,
        has_business_hours: hasHours,
        has_service_area: hasServiceArea,
        has_phone_number: !!business.pipeai_number,
      };

      const complete = Object.values(steps).every(Boolean);

      return {
        business_id: businessId,
        business_name: business.name,
        steps,
        complete,
        tech_count: techCount,
        catalog_count: catalogCount,
        message: complete
          ? "Onboarding complete — Sal is ready to work!"
          : "Some setup steps remaining",
      };
    },
  );
}
