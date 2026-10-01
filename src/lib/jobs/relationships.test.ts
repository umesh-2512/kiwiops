import{describe,expect,it}from"vitest";
import{jobDetailRelationships,jobListRelationships}from"./relationships";

describe("job PostgREST relationships",()=>{
  it("uses the organization member display name instead of a nonexistent profiles relationship",()=>{
    expect(jobDetailRelationships).toContain("organization_members!job_assignments_member_fk(id,role,display_name)");
    expect(jobDetailRelationships).not.toContain("profiles(");
  });
  it("loads assignment state for the jobs-list technician count",()=>{
    expect(jobListRelationships).toBe("job_assignments!job_assignments_job_fk(id,unassigned_at)");
  });
});
