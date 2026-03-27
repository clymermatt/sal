import { getSupabase } from "../../db/client.js";
import { logger } from "../../lib/logger.js";
import { getDriveTimes } from "../../lib/maps.js";

interface EmergencyResult {
  success: boolean;
  techId?: string;
  techName?: string;
  techPhone?: string;
  message: string;
}

/**
 * Emergency insertion — finds the best available tech and assigns immediately.
 * Priority: skill match > current workload > general availability.
 *
 * Once Google Maps is integrated, this will also factor in drive time
 * from the tech's current location.
 */
export async function insertEmergency(
  businessId: string,
  jobId: string,
): Promise<EmergencyResult> {
  const supabase = getSupabase();

  // Get the emergency job details
  const { data: job } = await supabase
    .from("jobs")
    .select("id, job_type, required_skills, address, customer_id")
    .eq("id", jobId)
    .single();

  if (!job) {
    return { success: false, message: "Job not found" };
  }

  // Get active technicians
  const { data: techs } = await supabase
    .from("technicians")
    .select("id, name, phone, skills, last_known_address")
    .eq("business_id", businessId)
    .eq("is_active", true);

  if (!techs || techs.length === 0) {
    return { success: false, message: "No active technicians available" };
  }

  // Count current in-progress or en-route jobs per tech
  const { data: activeJobs } = await supabase
    .from("jobs")
    .select("tech_id")
    .eq("business_id", businessId)
    .in("status", ["en_route", "in_progress"]);

  const activeCounts = new Map<string, number>();
  for (const j of activeJobs ?? []) {
    if (j.tech_id) {
      activeCounts.set(j.tech_id, (activeCounts.get(j.tech_id) ?? 0) + 1);
    }
  }

  const requiredSkills = job.required_skills ?? [];

  // Get drive times if job has an address and techs have locations
  const driveTimes = new Map<string, number>();
  if (job.address) {
    const origins = techs
      .filter((t) => t.last_known_address)
      .map((t) => ({ techId: t.id, address: t.last_known_address as string }));

    if (origins.length > 0) {
      const times = await getDriveTimes(origins, job.address);
      for (const t of times) {
        driveTimes.set(t.techId, t.durationMins);
      }
    }
  }

  // Score and rank techs
  const candidates = techs
    .map((tech) => {
      let score = 100;

      // Skill match
      if (requiredSkills.length > 0) {
        const matchCount = requiredSkills.filter((s: string) =>
          tech.skills.includes(s),
        ).length;
        if (matchCount === 0 && !tech.skills.includes("general")) {
          return { tech, score: -1, driveMins: null }; // Can't do the job
        }
        score += matchCount * 20;
      }

      // Prefer techs not currently on a job
      const active = activeCounts.get(tech.id) ?? 0;
      if (active === 0) {
        score += 50; // Available right now
      } else {
        score -= active * 25;
      }

      // Drive time bonus — closer techs score higher (max 40 points)
      const driveMins = driveTimes.get(tech.id) ?? null;
      if (driveMins !== null) {
        // 40 points for 0 min drive, 0 points for 60+ min
        score += Math.max(0, 40 - Math.round(driveMins * (40 / 60)));
      }

      return { tech, score, driveMins };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    return {
      success: false,
      message: "No qualified technicians available for emergency dispatch",
    };
  }

  const assigned = candidates[0];

  // Assign the job
  const { error } = await supabase
    .from("jobs")
    .update({
      tech_id: assigned.tech.id,
      is_emergency: true,
      status: "booked",
    })
    .eq("id", jobId);

  if (error) {
    logger.error({ error, jobId }, "Failed to assign emergency job");
    return { success: false, message: "Failed to assign technician" };
  }

  logger.info(
    { jobId, techName: assigned.tech.name, score: assigned.score },
    "Emergency job assigned",
  );

  return {
    success: true,
    techId: assigned.tech.id,
    techName: assigned.tech.name,
    techPhone: assigned.tech.phone ?? undefined,
    message: `${assigned.tech.name} assigned to emergency job`,
  };
}
