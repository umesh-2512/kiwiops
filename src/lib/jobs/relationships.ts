export const jobDetailRelationships="job_assignments(id,member_id,assigned_at,unassigned_at,organization_members!job_assignments_member_fk(id,role,display_name))";
export const jobListRelationships="job_assignments!job_assignments_job_fk(id,unassigned_at)";
