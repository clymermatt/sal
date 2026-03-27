import { getSupabase } from "../../db/client.js";
import { logger } from "../../lib/logger.js";
import { getDriveTimes } from "../../lib/maps.js";

interface TechWithJobs {
  id: string;
  name: string;
  phone: string | null;
  skills: string[];
  jobCount: number;
}

interface UnassignedJob {
  id: string;
  job_type: string;
  required_skills: string[];
  address: string;
  scheduled_start: string;
  estimated_mins: number | null;
  is_emergency: boolean;
  customer_name: string | null;
}

interface Assignment {
  jobId: string;
  techId: string;
  techName: string;
  score: number;
}

/**
 * Daily schedule builder — runs at 5:55am.
 * Assigns unassigned jobs to technicians based on skills and workload.
 */
export async function buildDailySchedule(
  businessId: string,
  date: Date,
): Promise<Assignment[]> {
  const supabase = getSupabase();
  const dateStr = date.toISOString().split("T")[0];
  const dayStart = `${dateStr}T00:00:00`;
  const dayEnd = `${dateStr}T23:59:59`;

  // First: find return visits — priority rebooks and scheduled returns pinned to their tech
  const { data: returnVisits } = await supabase
    .from("jobs")
    .select(`
      id, job_type, required_skills, address, scheduled_start,
      estimated_mins, is_emergency, tech_id, hold_reason,
      customers!inner(name)
    `)
    .eq("business_id", businessId)
    .eq("status", "return_scheduled")
    .not("tech_id", "is", null);

  // Also find scheduling_overflow jobs (tech ran out of time yesterday)
  const { data: overflowJobs } = await supabase
    .from("jobs")
    .select(`
      id, job_type, required_skills, address, scheduled_start,
      estimated_mins, is_emergency, tech_id, hold_reason,
      customers!inner(name)
    `)
    .eq("business_id", businessId)
    .eq("status", "on_hold")
    .eq("hold_reason", "scheduling_overflow")
    .not("tech_id", "is", null);

  const allReturns = [...(returnVisits ?? []), ...(overflowJobs ?? [])];

  // Track which techs have return visits (they go first in the morning)
  const techReturnVisits = new Map<string, string>(); // techId → job address
  for (const rv of allReturns) {
    if (rv.tech_id && rv.address) {
      techReturnVisits.set(rv.tech_id, rv.address);

      // Auto-move scheduling_overflow to return_scheduled
      if (rv.hold_reason === "scheduling_overflow") {
        await supabase
          .from("jobs")
          .update({ status: "return_scheduled" })
          .eq("id", rv.id);
      }

      logger.info(
        { techId: rv.tech_id, jobId: rv.id, address: rv.address, reason: rv.hold_reason },
        "Tech has return visit — pinning as first job",
      );
    }
  }

  // Get unassigned jobs for the date
  const { data: unassignedJobs } = await supabase
    .from("jobs")
    .select(`
      id, job_type, required_skills, address, scheduled_start,
      estimated_mins, is_emergency,
      customers!inner(name)
    `)
    .eq("business_id", businessId)
    .is("tech_id", null)
    .neq("status", "cancelled")
    .gte("scheduled_start", dayStart)
    .lte("scheduled_start", dayEnd)
    .order("is_emergency", { ascending: false })
    .order("scheduled_start", { ascending: true });

  if (!unassignedJobs || unassignedJobs.length === 0) {
    logger.info({ businessId, date: dateStr }, "No unassigned jobs for today");
    return [];
  }

  // Get active technicians
  const { data: techs } = await supabase
    .from("technicians")
    .select("id, name, phone, skills, last_known_address")
    .eq("business_id", businessId)
    .eq("is_active", true);

  if (!techs || techs.length === 0) {
    logger.warn({ businessId }, "No active technicians available");
    return [];
  }

  // Count existing assigned jobs per tech for the day
  const { data: existingJobs } = await supabase
    .from("jobs")
    .select("tech_id")
    .eq("business_id", businessId)
    .not("tech_id", "is", null)
    .neq("status", "cancelled")
    .gte("scheduled_start", dayStart)
    .lte("scheduled_start", dayEnd);

  const techJobCounts = new Map<string, number>();
  for (const job of existingJobs ?? []) {
    const count = techJobCounts.get(job.tech_id) ?? 0;
    techJobCounts.set(job.tech_id, count + 1);
  }

  const techsWithLoad: TechWithJobs[] = techs.map((t) => ({
    ...t,
    // Count assigned jobs + return visits as workload
    jobCount: (techJobCounts.get(t.id) ?? 0) + (techReturnVisits.has(t.id) ? 1 : 0),
  }));

  // Assign each job to the best tech
  const assignments: Assignment[] = [];

  for (const raw of unassignedJobs) {
    const job: UnassignedJob = {
      ...raw,
      required_skills: raw.required_skills ?? [],
      customer_name: (raw.customers as unknown as { name: string })?.name ?? null,
    };

    // Get drive times for this job's address
    // If a tech has a return visit, their origin is that job site (not home)
    const driveTimes = new Map<string, number>();
    if (job.address) {
      const origins = techsWithLoad
        .filter((t) => {
          const returnAddr = techReturnVisits.get(t.id);
          const homeAddr = (t as unknown as { last_known_address?: string }).last_known_address;
          return returnAddr || homeAddr;
        })
        .map((t) => ({
          techId: t.id,
          address: techReturnVisits.get(t.id)
            ?? (t as unknown as { last_known_address: string }).last_known_address,
        }));

      if (origins.length > 0) {
        const times = await getDriveTimes(origins, job.address);
        for (const t of times) {
          driveTimes.set(t.techId, t.durationMins);
        }
      }
    }

    const scored = techsWithLoad
      .map((tech) => ({
        tech,
        score: scoreAssignment(job, tech, driveTimes.get(tech.id) ?? null),
      }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best || best.score <= 0) {
      logger.warn({ jobId: job.id, jobType: job.job_type }, "No suitable tech found for job");
      continue;
    }

    // Assign the job
    const { error } = await supabase
      .from("jobs")
      .update({ tech_id: best.tech.id })
      .eq("id", job.id);

    if (error) {
      logger.error({ error, jobId: job.id }, "Failed to assign job");
      continue;
    }

    // Update in-memory workload
    best.tech.jobCount++;

    assignments.push({
      jobId: job.id,
      techId: best.tech.id,
      techName: best.tech.name,
      score: best.score,
    });

    logger.info(
      { jobId: job.id, techName: best.tech.name, score: best.score },
      "Job assigned",
    );
  }

  return assignments;
}

/**
 * Score a tech for a job. Higher is better.
 *
 * Factors:
 * - Skill match (40 points for exact match, 10 for general)
 * - Workload balance (fewer jobs = higher score)
 * - Emergency bonus (emergency-skilled techs score higher for emergencies)
 */
function scoreAssignment(job: UnassignedJob, tech: TechWithJobs, driveMins: number | null): number {
  let score = 0;

  // Skill match: required skills must be met
  const requiredSkills = job.required_skills;
  if (requiredSkills.length > 0) {
    const matchCount = requiredSkills.filter((s) => tech.skills.includes(s)).length;
    if (matchCount === 0 && !tech.skills.includes("general")) {
      return 0; // Hard requirement: can't do the job
    }
    score += (matchCount / requiredSkills.length) * 40;
  } else {
    // No specific skills required — any tech works
    score += 20;
  }

  // Workload balance: fewer jobs = higher score (max 30 points)
  const loadPenalty = Math.min(tech.jobCount * 5, 30);
  score += 30 - loadPenalty;

  // Emergency bonus: if job is emergency, prefer less-loaded techs
  if (job.is_emergency) {
    score += 20 - tech.jobCount * 3;
  }

  // Drive time bonus — closer techs score higher (max 30 points)
  if (driveMins !== null) {
    score += Math.max(0, 30 - Math.round(driveMins * (30 / 60)));
  }

  return Math.max(score, 0);
}

/**
 * Update a tech's last known address when they complete a job.
 * Called when job status changes to "complete".
 */
export async function updateTechLocation(techId: string, address: string): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from("technicians")
    .update({ last_known_address: address })
    .eq("id", techId);
  logger.info({ techId, address }, "Tech location updated");
}

/**
 * Get the daily schedule for a tech — used for morning briefings.
 */
export async function getTechDailySchedule(
  businessId: string,
  techId: string,
  date: Date,
) {
  const supabase = getSupabase();
  const dateStr = date.toISOString().split("T")[0];

  const { data: jobs } = await supabase
    .from("jobs")
    .select(`
      id, job_type, address, scheduled_start, estimated_mins,
      is_emergency, notes, flat_rate,
      customers!inner(name, phone, notes)
    `)
    .eq("business_id", businessId)
    .eq("tech_id", techId)
    .neq("status", "cancelled")
    .gte("scheduled_start", `${dateStr}T00:00:00`)
    .lte("scheduled_start", `${dateStr}T23:59:59`)
    .order("scheduled_start", { ascending: true });

  return jobs ?? [];
}

/**
 * Get all jobs for a business for a given date.
 */
export async function getBusinessDailyJobs(businessId: string, date: Date) {
  const supabase = getSupabase();
  const dateStr = date.toISOString().split("T")[0];

  const { data: jobs } = await supabase
    .from("jobs")
    .select(`
      id, tech_id, job_type, address, scheduled_start, estimated_mins,
      is_emergency, status, notes, flat_rate,
      customers!inner(name, phone),
      technicians(name, phone)
    `)
    .eq("business_id", businessId)
    .neq("status", "cancelled")
    .gte("scheduled_start", `${dateStr}T00:00:00`)
    .lte("scheduled_start", `${dateStr}T23:59:59`)
    .order("scheduled_start", { ascending: true });

  return jobs ?? [];
}
